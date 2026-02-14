// RoomingKos Explores - App Logic (Email Auth)

(() => {
    'use strict';

    const ADMIN_EMAIL = 'swanston@roomingkos.com';
    const CATEGORIES = ['Sports', 'Culture', 'Eatout', 'Travel', 'Study', 'Extra'];
    const DEFAULT_CAPACITY = 10;
    const MAX_CAPACITY = 200;
    const MAX_REASON_LENGTH = 500;

    // State
    let state = {
        posts: [],
        user: null, // { id, email, label, createdAt, isAdmin }
        adminReports: [],
        adminLogs: []
    };

    let currentSort = 'votes'; // votes | newest | soonest
    let currentCategory = 'all';
    let currentFeedFilter = 'all'; // all | confirmed | scheduled
    let currentSearch = '';
    let showHiddenPosts = false;

    let supportsPostStatus = true;
    let supportsReportsTable = true;
    let supportsAdminLogsTable = true;

    let dataLoaded = false;
    let latestFetchToken = 0;
    let latestAdminFetchToken = 0;

    // DOM Refs - Auth
    const loginScreen = document.getElementById('login-screen');
    const emailInput = document.getElementById('member-email');
    const nicknameInput = document.getElementById('member-nickname');
    const passwordInput = document.getElementById('member-password');
    const memberLoginBtn = document.getElementById('member-login-btn');
    const memberSignupBtn = document.getElementById('member-signup-btn');
    const loginError = document.getElementById('login-error');

    // DOM Refs - Header/Layout
    const appEl = document.getElementById('app');
    const logoutBtn = document.getElementById('logout-btn');
    const profileToggleBtn = document.getElementById('profile-toggle-btn');
    const profilePanel = document.getElementById('profile-panel');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profileJoined = document.getElementById('profile-joined');
    const profilePostCount = document.getElementById('profile-post-count');
    const profileVoteCount = document.getElementById('profile-vote-count');
    const profileRsvpCount = document.getElementById('profile-rsvp-count');

    const adminToggleBtn = document.getElementById('admin-toggle-btn');
    const adminPanel = document.getElementById('admin-panel');
    const adminRefreshBtn = document.getElementById('admin-refresh-btn');
    const adminToggleHiddenBtn = document.getElementById('admin-toggle-hidden-btn');
    const adminOpenReportsEl = document.getElementById('admin-open-reports');
    const adminHiddenPostsEl = document.getElementById('admin-hidden-posts');
    const adminReportQueue = document.getElementById('admin-report-queue');
    const adminLogList = document.getElementById('admin-log-list');

    const connectionStatus = document.getElementById('connection-status');
    const appContent = document.getElementById('app-content');
    const loadingScreen = document.getElementById('loading-screen');

    // DOM Refs - Core Features
    const newSuggestionSection = document.querySelector('.new-suggestion');
    const locationInput = document.getElementById('location-input');
    const categoryInput = document.getElementById('category-input');
    const dateInput = document.getElementById('date-input');
    const capacityInput = document.getElementById('capacity-input');
    const meetupPlaceInput = document.getElementById('meetup-place-input');
    const meetupTimeInput = document.getElementById('meetup-time-input');
    const costInput = document.getElementById('cost-input');
    const deadlineInput = document.getElementById('deadline-input');
    const prepInput = document.getElementById('prep-input');

    const submitBtn = document.getElementById('submit-btn');
    const previewText = document.getElementById('preview-text');
    const postFeed = document.getElementById('post-feed');
    const sortBtns = document.querySelectorAll('.sort-btn');
    const categoryBtns = document.querySelectorAll('.category-btn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('search-input');
    const toastContainer = document.getElementById('toast-container');

    const requiredElements = [
        ['loginScreen', loginScreen],
        ['emailInput', emailInput],
        ['nicknameInput', nicknameInput],
        ['passwordInput', passwordInput],
        ['memberLoginBtn', memberLoginBtn],
        ['memberSignupBtn', memberSignupBtn],
        ['loginError', loginError],
        ['appEl', appEl],
        ['logoutBtn', logoutBtn],
        ['profileToggleBtn', profileToggleBtn],
        ['profilePanel', profilePanel],
        ['profileName', profileName],
        ['profileEmail', profileEmail],
        ['profileJoined', profileJoined],
        ['profilePostCount', profilePostCount],
        ['profileVoteCount', profileVoteCount],
        ['profileRsvpCount', profileRsvpCount],
        ['adminToggleBtn', adminToggleBtn],
        ['adminPanel', adminPanel],
        ['adminRefreshBtn', adminRefreshBtn],
        ['adminToggleHiddenBtn', adminToggleHiddenBtn],
        ['adminOpenReportsEl', adminOpenReportsEl],
        ['adminHiddenPostsEl', adminHiddenPostsEl],
        ['adminReportQueue', adminReportQueue],
        ['adminLogList', adminLogList],
        ['connectionStatus', connectionStatus],
        ['appContent', appContent],
        ['loadingScreen', loadingScreen],
        ['newSuggestionSection', newSuggestionSection],
        ['locationInput', locationInput],
        ['categoryInput', categoryInput],
        ['dateInput', dateInput],
        ['capacityInput', capacityInput],
        ['meetupPlaceInput', meetupPlaceInput],
        ['meetupTimeInput', meetupTimeInput],
        ['costInput', costInput],
        ['deadlineInput', deadlineInput],
        ['prepInput', prepInput],
        ['submitBtn', submitBtn],
        ['previewText', previewText],
        ['postFeed', postFeed],
        ['searchInput', searchInput],
        ['toastContainer', toastContainer]
    ];

    init();

    async function init() {
        if (!hasRequiredElements()) return;

        if (typeof supabaseClient === 'undefined') {
            console.error('Supabase client is not configured.');
            showLoginError('Configuration error: Supabase client is missing.');
            return;
        }

        bindEvents();
        updatePreview();

        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (error) throw error;

            if (session) {
                setMemberState(session.user);
                showApp();
            }
        } catch (err) {
            console.error('Session check error:', err);
            showLoginError(getErrorMessage(err, 'Unable to restore your session.'));
        }

        initSupabase();
    }

    // Events
    function bindEvents() {
        emailInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') handleMemberLogin();
        });
        passwordInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') handleMemberLogin();
        });

        memberLoginBtn.addEventListener('click', handleMemberLogin);
        memberSignupBtn.addEventListener('click', handleMemberSignup);

        logoutBtn.addEventListener('click', handleLogout);
        profileToggleBtn.addEventListener('click', handleProfileToggle);
        adminToggleBtn.addEventListener('click', handleAdminToggle);

        adminRefreshBtn.addEventListener('click', loadAdminData);
        adminToggleHiddenBtn.addEventListener('click', () => {
            showHiddenPosts = !showHiddenPosts;
            updateAdminHiddenToggleButton();
            render();
        });

        locationInput.addEventListener('input', updatePreview);
        dateInput.addEventListener('input', updatePreview);
        capacityInput.addEventListener('input', updatePreview);

        submitBtn.addEventListener('click', handleSubmitPost);

        sortBtns.forEach((btn) => {
            btn.addEventListener('click', () => handleSort(btn.dataset.sort));
        });

        categoryBtns.forEach((btn) => {
            btn.addEventListener('click', () => handleCategoryFilter(btn.dataset.category));
        });

        filterBtns.forEach((btn) => {
            btn.addEventListener('click', () => handleFeedFilter(btn.dataset.filter));
        });

        searchInput.addEventListener('input', handleSearch);

        bindFeedEvents();
        bindAdminPanelEvents();
    }

    function bindFeedEvents() {
        postFeed.addEventListener('click', async (event) => {
            const clickTarget = event.target instanceof Element ? event.target : null;
            const targetBtn = clickTarget ? clickTarget.closest('button') : null;
            if (!targetBtn || !postFeed.contains(targetBtn)) return;

            const postId = targetBtn.dataset.id;
            if (!postId) return;

            if (targetBtn.classList.contains('vote-btn')) {
                await handleVote(postId);
                return;
            }

            if (targetBtn.classList.contains('btn-rsvp')) {
                await handleRsvp(postId);
                return;
            }

            if (targetBtn.classList.contains('comment-toggle')) {
                const section = postFeed.querySelector(`[data-comments="${postId}"]`);
                if (section) section.classList.toggle('open');
                return;
            }

            if (targetBtn.classList.contains('comment-submit')) {
                const form = targetBtn.closest('.comment-form');
                const input = form ? form.querySelector('.comment-input') : null;
                if (input) await submitCommentFromInput(postId, input);
                return;
            }

            if (targetBtn.classList.contains('btn-confirm')) {
                await handleConfirmPost(postId);
                return;
            }

            if (targetBtn.classList.contains('delete-btn')) {
                await handleDeletePost(postId);
                return;
            }

            if (targetBtn.classList.contains('report-btn')) {
                await handleReportPost(postId);
                return;
            }

            if (targetBtn.classList.contains('admin-hide-btn')) {
                await handleAdminHidePost(postId);
                return;
            }

            if (targetBtn.classList.contains('admin-unhide-btn')) {
                await handleAdminUnhidePost(postId);
                return;
            }

            if (targetBtn.classList.contains('admin-delete-btn')) {
                await handleAdminDeletePost(postId);
            }
        });

        postFeed.addEventListener('keydown', async (event) => {
            if (event.key !== 'Enter') return;

            const keyTarget = event.target instanceof Element ? event.target : null;
            const input = keyTarget ? keyTarget.closest('.comment-input') : null;
            if (!input || !postFeed.contains(input)) return;

            const form = input.closest('.comment-form');
            const postId = form?.dataset.id;
            if (!postId) return;

            event.preventDefault();
            await submitCommentFromInput(postId, input);
        });
    }

    function bindAdminPanelEvents() {
        adminReportQueue.addEventListener('click', async (event) => {
            const clickTarget = event.target instanceof Element ? event.target : null;
            const button = clickTarget ? clickTarget.closest('button') : null;
            if (!button || !adminReportQueue.contains(button)) return;

            const reportId = button.dataset.reportId;
            const postId = button.dataset.postId;
            if (!reportId) return;

            if (button.classList.contains('admin-review-hide-btn')) {
                if (postId) await handleAdminHidePost(postId, reportId);
                return;
            }

            if (button.classList.contains('admin-review-delete-btn')) {
                if (postId) await handleAdminDeletePost(postId, reportId);
                return;
            }

            if (button.classList.contains('admin-review-dismiss-btn')) {
                await handleAdminDismissReport(reportId, postId || null);
            }
        });
    }

    async function submitCommentFromInput(postId, input) {
        const posted = await handleComment(postId, input.value);
        if (posted) input.value = '';
    }

    // Auth
    async function handleMemberLogin() {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            return showLoginError('Please enter email and password.');
        }

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;

            if (!data.user?.email_confirmed_at) {
                showLoginError('Please verify your email before logging in.');
                const { error: signOutError } = await supabaseClient.auth.signOut();
                if (signOutError) {
                    console.error('Sign-out after unverified login failed:', signOutError);
                }
                return;
            }

            setMemberState(data.user);
            showApp();
            showLoginError('');
        } catch (err) {
            console.error('Login error:', err);
            showLoginError(getErrorMessage(err, 'Unable to log in right now.'));
        }
    }

    async function handleMemberSignup() {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            return showLoginError('Please enter email and password.');
        }

        const nickname = normalizeNickname(nicknameInput.value);
        if (nickname.length < 2) {
            return showLoginError('Please choose a nickname (2-20 chars) for sign up.');
        }

        try {
            const { error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { nickname }
                }
            });

            if (error) throw error;
            showLoginError(`Check your email for the confirmation link, ${nickname}!`, true);
        } catch (err) {
            console.error('Signup error:', err);
            showLoginError(getErrorMessage(err, 'Unable to sign up right now.'));
        }
    }

    function setMemberState(user) {
        const email = normalizeEmail(user.email || '');

        state.user = {
            id: user.id,
            email: user.email,
            label: normalizeNickname(user.user_metadata?.nickname) || (user.email || '').split('@')[0] || 'Tenant',
            createdAt: user.created_at,
            isAdmin: email === ADMIN_EMAIL
        };

        updateUIForUser();
    }

    function updateUIForUser() {
        if (!state.user) {
            newSuggestionSection.style.display = 'none';
            adminToggleBtn.hidden = true;
            closeAdminPanel();
            return;
        }

        newSuggestionSection.style.display = 'block';

        if (state.user.isAdmin) {
            adminToggleBtn.hidden = false;
            updateAdminToggleButton();
            renderAdminPanel();
        } else {
            adminToggleBtn.hidden = true;
            closeAdminPanel();
        }

        updateProfilePanel();
    }

    async function handleLogout() {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
        } catch (err) {
            console.error('Logout error:', err);
            showToast('Failed to log out. ' + getErrorMessage(err, 'Please try again.'));
            return;
        }

        clearMemberState();
    }

    function clearMemberState() {
        state.user = null;
        state.adminReports = [];
        state.adminLogs = [];
        showHiddenPosts = false;

        appEl.classList.remove('active');
        loginScreen.style.display = 'flex';

        closeProfilePanel();
        closeAdminPanel();

        emailInput.value = '';
        nicknameInput.value = '';
        passwordInput.value = '';

        showLoginError('');
        updateUIForUser();
        render();
    }

    function showLoginError(message, isSuccess = false) {
        loginError.textContent = message || '';
        loginError.style.color = isSuccess ? 'green' : '';
    }

    function normalizeNickname(value) {
        return (value || '').trim().replace(/\s+/g, ' ').slice(0, 20);
    }

    function normalizeEmail(value) {
        return String(value || '').trim().toLowerCase();
    }

    // Header controls
    function handleProfileToggle() {
        if (!state.user) return;

        const isOpen = !profilePanel.hasAttribute('hidden');
        if (isOpen) {
            closeProfilePanel();
            return;
        }

        updateProfilePanel();
        profilePanel.removeAttribute('hidden');
        profileToggleBtn.setAttribute('aria-expanded', 'true');
        profileToggleBtn.textContent = '👤 Hide Profile';
    }

    function closeProfilePanel() {
        profilePanel.setAttribute('hidden', '');
        profileToggleBtn.setAttribute('aria-expanded', 'false');
        profileToggleBtn.textContent = '👤 Profile';
    }

    function updateProfilePanel() {
        if (!state.user) return;

        const ownPosts = state.posts.filter((post) => post.user_id === state.user.id).length;
        const votesCast = state.posts.filter((post) => post.votes.includes(state.user.id)).length;
        const rsvpsJoined = state.posts.filter((post) => post.rsvps.includes(state.user.id)).length;

        profileName.textContent = state.user.label;
        profileEmail.textContent = state.user.email || '-';
        profileJoined.textContent = state.user.createdAt
            ? new Date(state.user.createdAt).toLocaleDateString('en-AU', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            })
            : '-';

        profilePostCount.textContent = String(ownPosts);
        profileVoteCount.textContent = String(votesCast);
        profileRsvpCount.textContent = String(rsvpsJoined);
    }

    function handleAdminToggle() {
        if (!isCurrentUserAdmin()) return;

        const isOpen = !adminPanel.hasAttribute('hidden');
        if (isOpen) {
            closeAdminPanel();
            return;
        }

        adminPanel.removeAttribute('hidden');
        adminToggleBtn.setAttribute('aria-expanded', 'true');
        updateAdminToggleButton();
        renderAdminPanel();
        loadAdminData();
    }

    function closeAdminPanel() {
        adminPanel.setAttribute('hidden', '');
        adminToggleBtn.setAttribute('aria-expanded', 'false');
        updateAdminToggleButton();
    }

    function updateAdminToggleButton() {
        if (!isCurrentUserAdmin()) {
            adminToggleBtn.textContent = '🛡️ Admin';
            return;
        }

        const isOpen = !adminPanel.hasAttribute('hidden');
        adminToggleBtn.textContent = isOpen ? '🛡️ Hide Admin' : '🛡️ Admin';
    }

    function updateAdminHiddenToggleButton() {
        adminToggleHiddenBtn.dataset.showHidden = String(showHiddenPosts);
        adminToggleHiddenBtn.textContent = showHiddenPosts ? 'Hide Hidden Posts' : 'Show Hidden Posts';
    }

    function showApp() {
        loginScreen.style.display = 'none';
        appEl.classList.add('active');
        updateUIForUser();
    }

    // Supabase Data
    async function fetchAllPosts() {
        const fetchToken = ++latestFetchToken;

        try {
            const { data: posts, error: postsErr } = await supabaseClient
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false });

            if (postsErr) throw postsErr;
            if (fetchToken !== latestFetchToken) return;

            if (!posts || posts.length === 0) {
                state.posts = [];
                finishLoading();
                updateProfilePanel();
                renderAdminPanel();
                render();
                return;
            }

            const postIds = posts.map((post) => post.id);

            const [votesRes, rsvpsRes, commentsRes] = await Promise.all([
                supabaseClient.from('votes').select('*').in('post_id', postIds),
                supabaseClient.from('rsvps').select('*').in('post_id', postIds),
                supabaseClient.from('comments').select('*').in('post_id', postIds).order('created_at', { ascending: true })
            ]);

            if (votesRes.error) throw votesRes.error;
            if (rsvpsRes.error) throw rsvpsRes.error;
            if (commentsRes.error) throw commentsRes.error;
            if (fetchToken !== latestFetchToken) return;

            const votes = votesRes.data || [];
            const rsvps = rsvpsRes.data || [];
            const comments = commentsRes.data || [];

            const votesByPost = groupBy(votes, 'post_id');
            const rsvpsByPost = groupBy(rsvps, 'post_id');
            const commentsByPost = groupBy(comments, 'post_id');

            state.posts = posts.map((post) => ({
                id: post.id,
                location: post.location || '',
                author: post.author || 'Tenant',
                user_id: post.user_id,
                createdAt: post.created_at,
                proposedDate: post.proposed_date,
                category: normalizeCategory(post.category),
                status: normalizeStatus(post.status),
                capacity: normalizeCapacity(post.capacity),
                meetupPlace: normalizeOptionalText(post.meetup_place),
                meetingTime: normalizeOptionalText(post.meeting_time),
                estimatedCost: normalizeEstimatedCost(post.estimated_cost),
                prepNotes: normalizeOptionalText(post.prep_notes),
                rsvpDeadline: post.rsvp_deadline || null,
                isHidden: Boolean(post.is_hidden),
                hiddenReason: normalizeOptionalText(post.hidden_reason),
                hiddenAt: post.hidden_at || null,
                votes: (votesByPost[post.id] || []).map((vote) => vote.user_id),
                rsvps: (rsvpsByPost[post.id] || []).map((rsvp) => rsvp.user_id),
                rsvpEntries: (rsvpsByPost[post.id] || []).map((rsvp) => ({
                    userId: rsvp.user_id,
                    createdAt: rsvp.created_at
                })),
                comments: (commentsByPost[post.id] || []).map((comment) => ({
                    id: comment.id,
                    author: comment.author,
                    text: comment.text,
                    createdAt: comment.created_at
                }))
            }));

            finishLoading();
            updateProfilePanel();
            renderAdminPanel();
            render();
        } catch (err) {
            if (fetchToken !== latestFetchToken) return;

            console.error('Fetch error:', err);
            finishLoading();
            postFeed.innerHTML = `<div class="empty-state">⚠️ Connect Error: ${escapeHtml(getErrorMessage(err, 'Unable to load posts.'))}</div>`;
        }
    }

    async function loadAdminData() {
        if (!isCurrentUserAdmin()) return;

        const fetchToken = ++latestAdminFetchToken;

        try {
            const reportPromise = supportsReportsTable
                ? supabaseClient.from('post_reports').select('*').order('created_at', { ascending: false }).limit(100)
                : Promise.resolve({ data: [], error: null });

            const logPromise = supportsAdminLogsTable
                ? supabaseClient.from('admin_action_logs').select('*').order('created_at', { ascending: false }).limit(100)
                : Promise.resolve({ data: [], error: null });

            const [reportRes, logRes] = await Promise.all([reportPromise, logPromise]);
            if (fetchToken !== latestAdminFetchToken) return;

            if (reportRes.error) {
                if (isMissingTableError(reportRes.error, 'post_reports')) {
                    supportsReportsTable = false;
                    showToast('Report queue unavailable. Run the latest database schema.');
                } else {
                    throw reportRes.error;
                }
            }

            if (logRes.error) {
                if (isMissingTableError(logRes.error, 'admin_action_logs')) {
                    supportsAdminLogsTable = false;
                    showToast('Admin logs unavailable. Run the latest database schema.');
                } else {
                    throw logRes.error;
                }
            }

            state.adminReports = supportsReportsTable ? (reportRes.data || []) : [];
            state.adminLogs = supportsAdminLogsTable ? (logRes.data || []) : [];

            renderAdminPanel();
        } catch (err) {
            console.error('Admin data fetch error:', err);
            showToast('Failed to load admin data. ' + getErrorMessage(err, 'Please refresh.'));
        }
    }

    function initSupabase() {
        fetchAllPosts();

        supabaseClient
            .channel('explores-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchAllPosts)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, fetchAllPosts)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rsvps' }, fetchAllPosts)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchAllPosts)
            .subscribe((status) => {
                const dot = connectionStatus.querySelector('.status-dot');
                const text = connectionStatus.querySelector('.status-text');
                if (!dot || !text) return;

                if (status === 'SUBSCRIBED') {
                    dot.className = 'status-dot online';
                    text.textContent = 'Live';
                    return;
                }

                if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    dot.className = 'status-dot offline';
                    text.textContent = 'Offline';
                }
            });
    }

    // Actions
    async function handleSubmitPost() {
        if (!state.user) return showToast('Please log in first.');

        const location = locationInput.value.trim();
        if (!location) return showToast('Please enter a destination.');

        const capacityValue = Number.parseInt(capacityInput.value, 10);
        if (!Number.isFinite(capacityValue) || capacityValue < 1 || capacityValue > MAX_CAPACITY) {
            return showToast(`Capacity must be between 1 and ${MAX_CAPACITY}.`);
        }

        const estimatedCost = parseEstimatedCost(costInput.value);
        if (estimatedCost === 'INVALID') {
            return showToast('Estimated cost must be 0 or higher.');
        }

        const deadlineIso = parseDeadlineIso(deadlineInput.value);
        if (deadlineIso === 'INVALID') {
            return showToast('Please provide a valid RSVP deadline.');
        }

        if (deadlineIso && new Date(deadlineIso).getTime() < Date.now()) {
            return showToast('RSVP deadline must be in the future.');
        }

        if (deadlineIso && dateInput.value) {
            const latestAllowed = new Date(`${dateInput.value}T23:59:59`);
            if (new Date(deadlineIso) > latestAllowed) {
                return showToast('RSVP deadline should be before the trip date.');
            }
        }

        const postPayload = {
            location,
            author: state.user.label,
            user_id: state.user.id,
            proposed_date: dateInput.value || null,
            category: normalizeCategory(categoryInput.value),
            capacity: capacityValue,
            meetup_place: normalizeOptionalText(meetupPlaceInput.value) || null,
            meeting_time: meetupTimeInput.value || null,
            estimated_cost: estimatedCost,
            prep_notes: normalizeOptionalText(prepInput.value) || null,
            rsvp_deadline: deadlineIso,
            status: 'proposed'
        };

        if (!supportsPostStatus) {
            delete postPayload.status;
        }

        try {
            let { error } = await supabaseClient.from('posts').insert(postPayload);

            if (error && isMissingStatusColumnError(error) && supportsPostStatus) {
                supportsPostStatus = false;
                delete postPayload.status;
                ({ error } = await supabaseClient.from('posts').insert(postPayload));
                if (!error) {
                    showToast('Post added. Status feature is disabled until DB migration is applied.');
                }
            }

            if (error) {
                if (isSchemaMismatchError(error)) {
                    showToast('Database schema is outdated. Please run supabase_schema.sql and refresh.');
                    return;
                }

                throw error;
            }

            resetPostForm();
            showToast('Post added!');
        } catch (err) {
            console.error('Post error:', err);
            showToast('Failed to post. ' + getErrorMessage(err, 'Please try again.'));
        }
    }

    function resetPostForm() {
        locationInput.value = '';
        categoryInput.value = 'Travel';
        dateInput.value = '';
        capacityInput.value = String(DEFAULT_CAPACITY);
        meetupPlaceInput.value = '';
        meetupTimeInput.value = '';
        costInput.value = '';
        deadlineInput.value = '';
        prepInput.value = '';
        updatePreview();
    }

    async function handleVote(postId) {
        if (!state.user) return showToast('Please log in first.');

        const post = getPostById(postId);
        if (!post) return showToast('Post not found.');

        const userId = state.user.id;
        const hasVoted = post.votes.includes(userId);

        try {
            if (hasVoted) {
                const { error } = await supabaseClient.from('votes').delete().match({ post_id: postId, user_id: userId });
                if (error) throw error;
            } else {
                const { error } = await supabaseClient.from('votes').insert({ post_id: postId, user_id: userId });
                if (error) throw error;
            }
        } catch (err) {
            console.error('Vote error:', err);
            showToast('Failed to update vote. ' + getErrorMessage(err, 'Please try again.'));
        }
    }

    async function handleRsvp(postId) {
        if (!state.user) return showToast('Please log in first.');

        const post = getPostById(postId);
        if (!post) return showToast('Post not found.');

        const userId = state.user.id;
        const summary = getRsvpSummary(post, userId);

        if (!summary.hasRsvpd && isRsvpClosed(post)) {
            return showToast('RSVP is closed for this trip.');
        }

        try {
            if (summary.hasRsvpd) {
                const { error } = await supabaseClient.from('rsvps').delete().match({ post_id: postId, user_id: userId });
                if (error) throw error;
                showToast('RSVP removed.');
                return;
            }

            const { error } = await supabaseClient.from('rsvps').insert({ post_id: postId, user_id: userId });
            if (error) throw error;

            if (summary.isFull) {
                showToast('Trip is full. You joined the waitlist.');
            } else {
                showToast('RSVP confirmed!');
            }
        } catch (err) {
            console.error('RSVP error:', err);

            if (String(err.code) === '23505') {
                showToast('You have already RSVP\'d to this trip.');
                return;
            }

            showToast('Failed to update RSVP. ' + getErrorMessage(err, 'Please try again.'));
        }
    }

    async function handleComment(postId, text) {
        if (!state.user) return showToast('Please log in first.');

        const cleanText = text.trim();
        if (!cleanText) return false;

        try {
            const { error } = await supabaseClient.from('comments').insert({
                post_id: postId,
                user_id: state.user.id,
                author: state.user.label,
                text: cleanText
            });

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Comment error:', err);
            showToast('Failed to add comment. ' + getErrorMessage(err, 'Please try again.'));
            return false;
        }
    }

    async function handleReportPost(postId) {
        if (!state.user) return showToast('Please log in first.');

        if (!supportsReportsTable) {
            showToast('Report queue is unavailable. Run the latest database schema first.');
            return;
        }

        const post = getPostById(postId);
        if (!post) return showToast('Post not found.');

        if (post.user_id === state.user.id) {
            return showToast('You cannot report your own post.');
        }

        const reason = promptForReason('Why are you reporting this post? (min 5 characters)');
        if (!reason) return;

        try {
            const { error } = await supabaseClient.from('post_reports').insert({
                post_id: postId,
                reporter_user_id: state.user.id,
                reporter_email: state.user.email,
                reason,
                status: 'open'
            });

            if (error) {
                if (isMissingTableError(error, 'post_reports')) {
                    supportsReportsTable = false;
                    showToast('Report queue unavailable. Run the latest database schema.');
                    return;
                }
                throw error;
            }

            showToast('Report submitted. Admin will review it soon.');
            if (isCurrentUserAdmin()) await loadAdminData();
        } catch (err) {
            console.error('Report error:', err);
            showToast('Failed to submit report. ' + getErrorMessage(err, 'Please try again.'));
        }
    }

    function handleSort(type) {
        if (!type) return;
        currentSort = type;
        setActiveByDataset(sortBtns, 'sort', type);
        render();
    }

    function handleCategoryFilter(category) {
        if (!category) return;
        currentCategory = category;
        setActiveByDataset(categoryBtns, 'category', category);
        render();
    }

    function handleFeedFilter(type) {
        if (!type) return;

        if (type === 'confirmed' && !supportsPostStatus) {
            showToast('Confirmed filter is unavailable until DB migration is applied.');
            return;
        }

        currentFeedFilter = type;
        setActiveByDataset(filterBtns, 'filter', type);
        render();
    }

    function handleSearch() {
        currentSearch = searchInput.value.trim().toLowerCase();
        render();
    }

    // Admin actions
    async function handleAdminHidePost(postId, reportId = null) {
        if (!isCurrentUserAdmin()) return showToast('Admin mode required.');

        const post = getPostById(postId);
        if (!post) return showToast('Post not found.');

        if (post.isHidden) {
            return showToast('This post is already hidden.');
        }

        const reason = promptForReason('Why are you hiding this post? (required)', 5);
        if (!reason) return;

        try {
            const { error } = await supabaseClient
                .from('posts')
                .update({
                    is_hidden: true,
                    hidden_reason: reason,
                    hidden_by: state.user.id,
                    hidden_at: new Date().toISOString()
                })
                .eq('id', postId);

            if (error) {
                if (isSchemaMismatchError(error)) {
                    showToast('Moderation columns are missing. Run the latest database schema.');
                    return;
                }
                throw error;
            }

            if (reportId) {
                await markReportStatus(reportId, 'actioned');
            }

            const logged = await logAdminAction('hide', postId, reason, reportId);
            if (!logged) {
                showToast('Post hidden, but action log failed. Check DB schema.');
            } else {
                showToast('Post hidden.');
            }

            if (isCurrentUserAdmin()) await loadAdminData();
        } catch (err) {
            console.error('Admin hide error:', err);
            showToast('Failed to hide post. ' + getErrorMessage(err, 'Please try again.'));
        }
    }

    async function handleAdminUnhidePost(postId) {
        if (!isCurrentUserAdmin()) return showToast('Admin mode required.');

        const post = getPostById(postId);
        if (!post) return showToast('Post not found.');
        if (!post.isHidden) return showToast('This post is already visible.');

        const reason = promptForReason('Why are you un-hiding this post? (required)', 5);
        if (!reason) return;

        try {
            const { error } = await supabaseClient
                .from('posts')
                .update({
                    is_hidden: false,
                    hidden_reason: null,
                    hidden_by: null,
                    hidden_at: null
                })
                .eq('id', postId);

            if (error) {
                if (isSchemaMismatchError(error)) {
                    showToast('Moderation columns are missing. Run the latest database schema.');
                    return;
                }
                throw error;
            }

            const logged = await logAdminAction('unhide', postId, reason, null);
            if (!logged) {
                showToast('Post unhidden, but action log failed. Check DB schema.');
            } else {
                showToast('Post is visible again.');
            }

            if (isCurrentUserAdmin()) await loadAdminData();
        } catch (err) {
            console.error('Admin unhide error:', err);
            showToast('Failed to unhide post. ' + getErrorMessage(err, 'Please try again.'));
        }
    }

    async function handleAdminDeletePost(postId, reportId = null) {
        if (!isCurrentUserAdmin()) return showToast('Admin mode required.');

        const post = getPostById(postId);
        if (!post) return showToast('Post not found.');

        const reason = promptForReason('Why are you deleting this post? (required)', 5);
        if (!reason) return;

        if (!window.confirm('Delete this post permanently? This cannot be undone.')) return;

        try {
            const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
            if (error) throw error;

            if (reportId) {
                await markReportStatus(reportId, 'actioned');
            }

            const logged = await logAdminAction('delete', null, `${reason} (Deleted post: ${post.location})`, reportId);
            if (!logged) {
                showToast('Post deleted, but action log failed. Check DB schema.');
            } else {
                showToast('Post deleted by admin.');
            }

            if (isCurrentUserAdmin()) await loadAdminData();
        } catch (err) {
            console.error('Admin delete error:', err);
            showToast('Failed to delete post. ' + getErrorMessage(err, 'Please try again.'));
        }
    }

    async function handleAdminDismissReport(reportId, postId) {
        if (!isCurrentUserAdmin()) return showToast('Admin mode required.');

        const reason = promptForReason('Why are you dismissing this report? (required)', 5);
        if (!reason) return;

        const statusUpdated = await markReportStatus(reportId, 'dismissed');
        if (!statusUpdated) return;

        const logged = await logAdminAction('dismiss_report', postId, reason, reportId);
        if (!logged) {
            showToast('Report dismissed, but action log failed. Check DB schema.');
        } else {
            showToast('Report dismissed.');
        }

        if (isCurrentUserAdmin()) await loadAdminData();
    }

    async function markReportStatus(reportId, status) {
        if (!supportsReportsTable || !reportId) return false;

        try {
            const { error } = await supabaseClient
                .from('post_reports')
                .update({
                    status,
                    reviewed_by: state.user.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', reportId);

            if (error) {
                if (isMissingTableError(error, 'post_reports')) {
                    supportsReportsTable = false;
                    showToast('Report queue unavailable. Run the latest database schema.');
                    return false;
                }
                throw error;
            }

            return true;
        } catch (err) {
            console.error('Report status update error:', err);
            showToast('Failed to update report status. ' + getErrorMessage(err, 'Please try again.'));
            return false;
        }
    }

    async function logAdminAction(action, postId, reason, reportId) {
        if (!supportsAdminLogsTable) return false;

        try {
            const { error } = await supabaseClient.from('admin_action_logs').insert({
                post_id: postId || null,
                report_id: reportId || null,
                action,
                reason,
                admin_user_id: state.user.id,
                admin_email: state.user.email
            });

            if (error) {
                if (isMissingTableError(error, 'admin_action_logs')) {
                    supportsAdminLogsTable = false;
                    return false;
                }
                throw error;
            }

            return true;
        } catch (err) {
            console.error('Admin log insert error:', err);
            return false;
        }
    }

    // Render
    function render() {
        let filteredPosts = currentCategory === 'all'
            ? state.posts
            : state.posts.filter((post) => post.category === currentCategory);

        if (currentFeedFilter === 'confirmed') {
            filteredPosts = filteredPosts.filter((post) => post.status === 'confirmed');
        } else if (currentFeedFilter === 'scheduled') {
            filteredPosts = filteredPosts.filter((post) => Boolean(post.proposedDate));
        }

        if (!isCurrentUserAdmin()) {
            filteredPosts = filteredPosts.filter((post) => {
                if (!post.isHidden) return true;
                if (!state.user) return false;
                return post.user_id === state.user.id;
            });
        } else if (!showHiddenPosts) {
            filteredPosts = filteredPosts.filter((post) => !post.isHidden);
        }

        if (currentSearch) {
            filteredPosts = filteredPosts.filter((post) => {
                const commentsText = post.comments.map((comment) => comment.text).join(' ');
                const haystack = [
                    post.location,
                    post.author,
                    post.meetupPlace,
                    post.prepNotes,
                    commentsText
                ].join(' ').toLowerCase();

                return haystack.includes(currentSearch);
            });
        }

        const sorted = [...filteredPosts];

        if (currentSort === 'votes') {
            sorted.sort((a, b) => b.votes.length - a.votes.length);
        } else if (currentSort === 'newest') {
            sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
            sorted.sort((a, b) => {
                if (!a.proposedDate && !b.proposedDate) return 0;
                if (!a.proposedDate) return 1;
                if (!b.proposedDate) return -1;
                return new Date(a.proposedDate) - new Date(b.proposedDate);
            });
        }

        if (sorted.length === 0) {
            const emptyTitle = currentSearch ? 'No matches found' : 'No posts to show';
            const emptyMessage = (isCurrentUserAdmin() && !showHiddenPosts)
                ? 'Try "Show Hidden Posts" in Admin Mode to review moderated content.'
                : 'Try another category or be the first to post!';

            postFeed.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🗺️</div>
                    <h3>${escapeHtml(emptyTitle)}</h3>
                    <p>${escapeHtml(emptyMessage)}</p>
                </div>`;
            return;
        }

        postFeed.innerHTML = sorted.map(renderPost).join('');
    }

    function renderPost(post) {
        const userId = state.user ? state.user.id : null;
        const isOwner = Boolean(state.user && state.user.id === post.user_id);
        const isAdmin = isCurrentUserAdmin();

        const hasVoted = post.votes.includes(userId);
        const voteCount = post.votes.length;
        const commentCount = post.comments.length;

        const rsvpSummary = getRsvpSummary(post, userId);
        const hasRsvpd = rsvpSummary.hasRsvpd;
        const isRsvpClosedForJoin = isRsvpClosed(post) && !hasRsvpd;

        let rsvpBtnText = 'I\'m in';
        let rsvpBtnClass = '';

        if (rsvpSummary.isGoing) {
            rsvpBtnText = 'Leave';
            rsvpBtnClass = 'joined';
        } else if (rsvpSummary.isWaitlisted) {
            rsvpBtnText = 'Leave Waitlist';
            rsvpBtnClass = 'waitlisted';
        } else if (isRsvpClosedForJoin) {
            rsvpBtnText = 'RSVP Closed';
        } else if (rsvpSummary.isFull) {
            rsvpBtnText = 'Join Waitlist';
        }

        let scheduleHtml = `<div class="category-badge">${escapeHtml(post.category)}</div>`;

        if (post.proposedDate) {
            scheduleHtml += `<div class="schedule-badge">📅 ${formatDate(post.proposedDate)}</div>`;
        }

        scheduleHtml += `
            <div class="rsvp-section">
                <button class="btn-rsvp ${rsvpBtnClass}" data-id="${post.id}" ${isRsvpClosedForJoin ? 'disabled' : ''}>
                    ${escapeHtml(rsvpBtnText)}
                </button>
                <div class="rsvp-meta">
                    <span class="rsvp-count">${rsvpSummary.goingCount}/${rsvpSummary.capacity} going</span>
                    ${rsvpSummary.waitlistCount > 0 ? `<span class="waitlist-count">${rsvpSummary.waitlistCount} waitlist</span>` : ''}
                </div>
                ${rsvpSummary.waitlistPosition > 0 ? `<div class="waitlist-note">You are #${rsvpSummary.waitlistPosition} on the waitlist.</div>` : ''}
                ${isRsvpClosed(post) ? '<div class="waitlist-note">RSVP is closed for this trip.</div>' : ''}
            </div>
        `;

        const detailItems = [];

        if (post.meetupPlace) {
            detailItems.push(`<div class="detail-item"><strong>Meet-up:</strong>${escapeHtml(post.meetupPlace)}</div>`);
        }

        if (post.meetingTime) {
            detailItems.push(`<div class="detail-item"><strong>Time:</strong>${escapeHtml(formatMeetingTime(post.meetingTime))}</div>`);
        }

        if (post.estimatedCost !== null) {
            detailItems.push(`<div class="detail-item"><strong>Cost:</strong>${escapeHtml(formatCurrency(post.estimatedCost))}</div>`);
        }

        if (post.rsvpDeadline) {
            const deadlineClass = isRsvpClosed(post) ? 'detail-item deadline-alert' : 'detail-item';
            const deadlineLabel = isRsvpClosed(post) ? 'RSVP closed:' : 'RSVP deadline:';
            detailItems.push(`<div class="${deadlineClass}"><strong>${escapeHtml(deadlineLabel)}</strong>${escapeHtml(formatDateTime(post.rsvpDeadline))}</div>`);
        }

        if (post.prepNotes) {
            detailItems.push(`<div class="detail-item"><strong>Preparation:</strong>${escapeHtml(post.prepNotes)}</div>`);
        }

        const detailsHtml = detailItems.length > 0 ? `<div class="post-details">${detailItems.join('')}</div>` : '';

        const commentsHtml = post.comments.map((comment) => `
            <div class="comment-item">
                <span class="comment-author">${escapeHtml(comment.author)}</span>
                <span class="comment-time">${escapeHtml(formatTimeAgo(comment.createdAt))}</span>
                <div class="comment-text">${escapeHtml(comment.text)}</div>
            </div>
        `).join('');

        const canConfirm = isOwner && post.status !== 'confirmed';
        const confirmBtn = canConfirm
            ? `<button class="btn-confirm" data-id="${post.id}" title="Confirm plan">Confirm</button>`
            : '';

        const ownerDeleteBtn = !isAdmin && isOwner
            ? `<button class="action-btn delete-btn" data-id="${post.id}" title="Delete Post">🗑️</button>`
            : '';

        const reportBtn = state.user && !isOwner
            ? `<button class="action-btn report-btn" data-id="${post.id}" title="Report post">🚩 Report</button>`
            : '';

        const adminHideBtn = isAdmin
            ? (post.isHidden
                ? `<button class="btn-admin-inline warning admin-unhide-btn" data-id="${post.id}" title="Unhide post">Unhide</button>`
                : `<button class="btn-admin-inline warning admin-hide-btn" data-id="${post.id}" title="Hide post">Hide</button>`)
            : '';

        const adminDeleteBtn = isAdmin
            ? `<button class="btn-admin-inline danger admin-delete-btn" data-id="${post.id}" title="Delete post">Delete</button>`
            : '';

        const hiddenNote = post.isHidden
            ? `<div class="post-hidden-note">Hidden by admin${post.hiddenReason ? `: ${escapeHtml(post.hiddenReason)}` : '.'}</div>`
            : '';

        const statusLabel = post.status === 'confirmed' ? '✅ Confirmed' : '🕓 Proposed';
        const timeAgo = formatTimeAgo(post.createdAt);

        return `
            <div class="post-card">
                <div class="post-main">
                    <div class="post-vote">
                        <button class="vote-btn ${hasVoted ? 'voted' : ''}" data-id="${post.id}" title="Vote">▲</button>
                        <span class="vote-count">${voteCount}</span>
                    </div>
                    <div class="post-body">
                        ${hiddenNote}
                        <div class="post-title">
                            Let's go to <span class="location">${escapeHtml(post.location)}</span>!
                        </div>
                        <div class="post-meta">
                            <span class="meta-item">👤 ${escapeHtml(post.author)}</span>
                            <span class="meta-item">🕐 ${escapeHtml(timeAgo)}</span>
                        </div>
                        <div class="post-status ${escapeHtml(post.status)}">${escapeHtml(statusLabel)}</div>
                        ${scheduleHtml}
                        ${detailsHtml}
                    </div>
                </div>
                <div class="post-actions">
                    ${confirmBtn}
                    ${ownerDeleteBtn}
                    ${adminHideBtn}
                    ${adminDeleteBtn}
                    ${reportBtn}
                    <button class="action-btn comment-toggle" data-id="${post.id}">
                        💬 ${commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Comment'}
                    </button>
                </div>
                <div class="comments-section" data-comments="${post.id}">
                    <div class="comment-list">${commentsHtml}</div>
                    <div class="comment-form" data-id="${post.id}">
                        <input type="text" class="comment-input" placeholder="Write a comment..." />
                        <button type="button" class="comment-submit" data-id="${post.id}">Post</button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderAdminPanel() {
        if (!isCurrentUserAdmin()) {
            closeAdminPanel();
            return;
        }

        const openReports = (state.adminReports || []).filter((report) => report.status === 'open');
        const hiddenPostsCount = state.posts.filter((post) => post.isHidden).length;

        adminOpenReportsEl.textContent = String(openReports.length);
        adminHiddenPostsEl.textContent = String(hiddenPostsCount);
        updateAdminHiddenToggleButton();

        if (!supportsReportsTable) {
            adminReportQueue.innerHTML = '<div class="admin-list-empty">Report queue unavailable. Run the latest <code>supabase_schema.sql</code>.</div>';
        } else if (openReports.length === 0) {
            adminReportQueue.innerHTML = '<div class="admin-list-empty">No open reports.</div>';
        } else {
            adminReportQueue.innerHTML = openReports.map((report) => {
                const post = getPostById(report.post_id);
                const postTitle = post ? post.location : 'Deleted post';
                const postId = post ? post.id : '';
                const reporter = normalizeOptionalText(report.reporter_email) || 'Unknown reporter';

                return `
                    <div class="admin-item">
                        <div class="admin-item-title">🚩 ${escapeHtml(postTitle)}</div>
                        <div class="admin-item-meta">${escapeHtml(reporter)} • ${escapeHtml(formatDateTime(report.created_at))}</div>
                        <div class="admin-item-meta">Reason: ${escapeHtml(report.reason || '-')}</div>
                        <div class="admin-item-actions">
                            ${postId ? `<button class="admin-action-btn warning admin-review-hide-btn" data-report-id="${report.id}" data-post-id="${postId}">Hide</button>` : ''}
                            ${postId ? `<button class="admin-action-btn danger admin-review-delete-btn" data-report-id="${report.id}" data-post-id="${postId}">Delete</button>` : ''}
                            <button class="admin-action-btn admin-review-dismiss-btn" data-report-id="${report.id}" data-post-id="${postId}">Dismiss</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (!supportsAdminLogsTable) {
            adminLogList.innerHTML = '<div class="admin-list-empty">Action log unavailable. Run the latest <code>supabase_schema.sql</code>.</div>';
            return;
        }

        const logs = (state.adminLogs || []).slice(0, 20);
        if (logs.length === 0) {
            adminLogList.innerHTML = '<div class="admin-list-empty">No moderation actions yet.</div>';
            return;
        }

        adminLogList.innerHTML = logs.map((log) => `
            <div class="admin-item">
                <div class="admin-item-title">${escapeHtml(getAdminActionLabel(log.action))}</div>
                <div class="admin-item-meta">${escapeHtml(log.admin_email || '-') } • ${escapeHtml(formatDateTime(log.created_at))}</div>
                <div class="admin-item-meta">Reason: ${escapeHtml(log.reason || '-')}</div>
            </div>
        `).join('');
    }

    async function handleDeletePost(postId) {
        if (!window.confirm('Are you sure you want to delete this trip?')) return;

        try {
            const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
            if (error) throw error;

            showToast('Post deleted.');
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Failed to delete. ' + getErrorMessage(err, 'Please try again.'));
        }
    }

    async function handleConfirmPost(postId) {
        if (!state.user) return showToast('Please log in first.');
        if (!supportsPostStatus) return showToast('Trip status is unavailable until DB migration is applied.');

        const post = getPostById(postId);
        if (!post || post.user_id !== state.user.id) {
            return showToast('Only the post owner can confirm this plan.');
        }

        try {
            let { error } = await supabaseClient.from('posts').update({ status: 'confirmed' }).eq('id', postId);

            if (error && isMissingStatusColumnError(error)) {
                supportsPostStatus = false;
                showToast('Trip status is unavailable until DB migration is applied.');
                return;
            }

            if (error) throw error;

            showToast('Trip confirmed!');
        } catch (err) {
            console.error('Confirm error:', err);
            showToast('Failed to confirm. ' + getErrorMessage(err, 'Please try again.'));
        }
    }

    // Helpers
    function updatePreview() {
        const location = locationInput.value.trim();
        const capacity = normalizeCapacity(capacityInput.value);
        const dateText = dateInput.value ? ` • ${formatDate(dateInput.value)}` : '';

        previewText.innerHTML = location
            ? `Let's go to <span class="filled">${escapeHtml(location)}</span>! 🚀 <small>${capacity} spots${escapeHtml(dateText)}</small>`
            : 'Let\'s go to _______ ! 🚀';
    }

    function finishLoading() {
        if (dataLoaded) return;

        dataLoaded = true;
        loadingScreen.style.display = 'none';
        appContent.style.display = '';
    }

    function getRsvpSummary(post, viewerUserId) {
        const capacity = normalizeCapacity(post.capacity);

        const sortedEntries = [...(post.rsvpEntries || [])].sort((a, b) => {
            return new Date(a.createdAt) - new Date(b.createdAt);
        });

        const uniqueEntries = [];
        const seenUsers = new Set();

        sortedEntries.forEach((entry) => {
            if (!entry || !entry.userId) return;
            if (seenUsers.has(entry.userId)) return;
            seenUsers.add(entry.userId);
            uniqueEntries.push(entry);
        });

        const goingEntries = uniqueEntries.slice(0, capacity);
        const waitlistEntries = uniqueEntries.slice(capacity);

        const goingIds = goingEntries.map((entry) => entry.userId);
        const waitlistIds = waitlistEntries.map((entry) => entry.userId);

        const isGoing = viewerUserId ? goingIds.includes(viewerUserId) : false;
        const isWaitlisted = viewerUserId ? waitlistIds.includes(viewerUserId) : false;

        return {
            capacity,
            goingCount: goingIds.length,
            waitlistCount: waitlistIds.length,
            isFull: goingIds.length >= capacity,
            isGoing,
            isWaitlisted,
            hasRsvpd: isGoing || isWaitlisted,
            waitlistPosition: isWaitlisted ? (waitlistIds.indexOf(viewerUserId) + 1) : 0
        };
    }

    function isRsvpClosed(post) {
        if (!post.rsvpDeadline) return false;
        return new Date(post.rsvpDeadline).getTime() < Date.now();
    }

    function parseEstimatedCost(value) {
        const raw = String(value || '').trim();
        if (!raw) return null;

        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed) || parsed < 0) return 'INVALID';
        return parsed;
    }

    function parseDeadlineIso(value) {
        const raw = String(value || '').trim();
        if (!raw) return null;

        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return 'INVALID';
        return date.toISOString();
    }

    function parseMeetingTime(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';

        const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (!match) return '';

        const hours = Number.parseInt(match[1], 10);
        const minutes = Number.parseInt(match[2], 10);
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';

        const safe = new Date();
        safe.setHours(hours, minutes, 0, 0);
        return safe.toLocaleTimeString('en-AU', {
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function formatMeetingTime(timeValue) {
        return parseMeetingTime(timeValue) || timeValue;
    }

    function formatCurrency(value) {
        if (!Number.isFinite(value)) return '-';

        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            maximumFractionDigits: 0
        }).format(value);
    }

    function formatDate(str) {
        return new Date(`${str}T00:00:00`).toLocaleDateString('en-AU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
    }

    function formatDateTime(isoValue) {
        const date = new Date(isoValue);
        if (Number.isNaN(date.getTime())) return '-';

        return date.toLocaleString('en-AU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function formatTimeAgo(isoValue) {
        const date = new Date(isoValue);
        if (Number.isNaN(date.getTime())) return '-';

        const ms = Date.now() - date.getTime();
        const min = Math.floor(ms / 60000);
        const hour = Math.floor(ms / 3600000);
        const day = Math.floor(ms / 86400000);

        if (min < 1) return 'just now';
        if (min < 60) return `${min}m ago`;
        if (hour < 24) return `${hour}h ago`;
        if (day < 7) return `${day}d ago`;

        return date.toLocaleDateString('en-AU');
    }

    function getAdminActionLabel(action) {
        if (action === 'hide') return 'Post Hidden';
        if (action === 'unhide') return 'Post Unhidden';
        if (action === 'delete') return 'Post Deleted';
        if (action === 'dismiss_report') return 'Report Dismissed';
        return 'Admin Action';
    }

    function normalizeCategory(category) {
        return CATEGORIES.includes(category) ? category : 'Travel';
    }

    function normalizeStatus(status) {
        return status === 'confirmed' ? 'confirmed' : 'proposed';
    }

    function normalizeCapacity(value) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_CAPACITY;
        return Math.min(parsed, MAX_CAPACITY);
    }

    function normalizeEstimatedCost(value) {
        if (value === null || value === undefined || value === '') return null;

        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 0) return null;
        return parsed;
    }

    function normalizeOptionalText(value) {
        return String(value || '').trim();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    }

    function groupBy(items, key) {
        return items.reduce((accumulator, item) => {
            (accumulator[item[key]] = accumulator[item[key]] || []).push(item);
            return accumulator;
        }, {});
    }

    function getPostById(postId) {
        return state.posts.find((post) => post.id === postId);
    }

    function setActiveByDataset(buttons, key, activeValue) {
        buttons.forEach((button) => {
            button.classList.toggle('active', button.dataset[key] === activeValue);
        });
    }

    function getErrorMessage(error, fallback = 'Unexpected error.') {
        if (error && typeof error.message === 'string' && error.message.trim()) {
            return error.message.trim();
        }
        return fallback;
    }

    function isCurrentUserAdmin() {
        return Boolean(state.user && state.user.isAdmin);
    }

    function hasRequiredElements() {
        const missing = requiredElements
            .filter(([, element]) => !element)
            .map(([name]) => name);

        if (missing.length === 0) return true;

        console.error('Missing required DOM element(s):', missing.join(', '));
        return false;
    }

    function isMissingStatusColumnError(error) {
        return isMissingColumnError(error, 'status');
    }

    function isMissingColumnError(error, columnName) {
        if (!error) return false;

        const message = String(error.message || '');
        if (error.code === 'PGRST204' && message.includes(`'${columnName}' column`)) return true;
        if (error.code === '42703' && message.toLowerCase().includes(columnName.toLowerCase())) return true;

        return false;
    }

    function isSchemaMismatchError(error) {
        if (!error) return false;
        return error.code === 'PGRST204' || error.code === '42703';
    }

    function isMissingTableError(error, tableName) {
        if (!error) return false;

        const message = String(error.message || '').toLowerCase();
        const relation = String(tableName || '').toLowerCase();

        if (error.code === 'PGRST205' || error.code === '42P01') return true;
        if (relation && message.includes(relation) && (message.includes('relation') || message.includes('table'))) return true;

        return false;
    }

    function promptForReason(promptText, minLength = 5) {
        const raw = window.prompt(promptText, '');
        if (raw === null) return null;

        const clean = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_REASON_LENGTH);
        if (clean.length < minLength) {
            showToast(`Please provide at least ${minLength} characters.`);
            return null;
        }

        return clean;
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }
})();
