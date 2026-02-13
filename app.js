// ── RoomingKos Explores — App Logic (Email Auth Only) ──

(() => {
    'use strict';

    // ── State ──
    let state = {
        posts: [],
        user: null // { id: string, email: string, label: string, createdAt?: string }
    };
    const CATEGORIES = ['Sports', 'Culture', 'Eatout', 'Travel', 'Study', 'Extra'];
    let currentSort = 'votes'; // 'votes' | 'newest' | 'soonest'
    let currentCategory = 'all';
    let currentFeedFilter = 'all'; // 'all' | 'confirmed' | 'scheduled'
    let currentSearch = '';
    let supportsPostStatus = true;
    let dataLoaded = false;

    // ── DOM Refs ──
    // Auth Screen
    const loginScreen = document.getElementById('login-screen');
    // Auth Inputs
    const emailInput = document.getElementById('member-email');
    const nicknameInput = document.getElementById('member-nickname');
    const passwordInput = document.getElementById('member-password');
    const memberLoginBtn = document.getElementById('member-login-btn');
    const memberSignupBtn = document.getElementById('member-signup-btn');
    const loginError = document.getElementById('login-error');

    // App Layout
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
    const connectionStatus = document.getElementById('connection-status');
    const appContent = document.getElementById('app-content');
    const loadingScreen = document.getElementById('loading-screen');

    // Core Features
    const newSuggestionSection = document.querySelector('.new-suggestion'); // Parent of form
    const locationInput = document.getElementById('location-input');
    const categoryInput = document.getElementById('category-input');
    const dateInput = document.getElementById('date-input');
    const submitBtn = document.getElementById('submit-btn');
    const previewText = document.getElementById('preview-text');
    const postFeed = document.getElementById('post-feed');
    const sortBtns = document.querySelectorAll('.sort-btn');
    const categoryBtns = document.querySelectorAll('.category-btn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('search-input');
    const toastContainer = document.getElementById('toast-container');

    // ── Init ──
    init();

    async function init() {
        bindEvents();

        // Check for existing Supabase Session (Member)
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session) {
            setMemberState(session.user);
            showApp();
        }

        // Initialize Data & Realtime
        initSupabase();
    }

    // ── Auth Logic ──
    function bindEvents() {
        // Member Login/Signup
        emailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleMemberLogin();
        });
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleMemberLogin();
        });
        memberLoginBtn.addEventListener('click', handleMemberLogin);
        memberSignupBtn.addEventListener('click', handleMemberSignup);

        // Header Controls
        logoutBtn.addEventListener('click', handleLogout);
        profileToggleBtn.addEventListener('click', handleProfileToggle);

        // App Interactions
        locationInput.addEventListener('input', updatePreview);
        submitBtn.addEventListener('click', handleSubmitPost);
        sortBtns.forEach(btn => {
            btn.addEventListener('click', () => handleSort(btn.dataset.sort));
        });
        categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => handleCategoryFilter(btn.dataset.category));
        });
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => handleFeedFilter(btn.dataset.filter));
        });
        searchInput.addEventListener('input', handleSearch);
    }

    async function handleMemberLogin() {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        if (!email || !password) return showLoginError('Please enter email and password.');

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            showLoginError(error.message);
        } else if (!data.user?.email_confirmed_at) {
            showLoginError('Please verify your email before logging in.');
            await supabaseClient.auth.signOut();
        } else {
            setMemberState(data.user);
            showApp();
        }
    }

    async function handleMemberSignup() {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        if (!email || !password) return showLoginError('Please enter email and password.');

        const nickname = normalizeNickname(nicknameInput.value);
        if (nickname.length < 2) return showLoginError('Please choose a nickname (2-20 chars) for sign up.');

        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { nickname }
            }
        });
        if (error) {
            showLoginError(error.message);
        } else {
            showLoginError(`Check your email for the confirmation link, ${nickname}!`, true);
        }
    }

    function setMemberState(user) {
        state.user = {
            id: user.id, // Supabase Auth ID
            email: user.email,
            label: normalizeNickname(user.user_metadata?.nickname) || user.email.split('@')[0],
            createdAt: user.created_at
        };
        updateUIForUser();
    }

    function updateUIForUser() {
        if (!state.user) return;
        newSuggestionSection.style.display = 'block';
        updateProfilePanel();
    }

    function handleLogout() {
        supabaseClient.auth.signOut();
        state.user = null;

        appEl.classList.remove('active');
        loginScreen.style.display = 'flex';

        // Reset forms
        emailInput.value = '';
        nicknameInput.value = '';
        passwordInput.value = '';
        loginError.textContent = '';
        closeProfilePanel();
    }

    function showLoginError(msg, isSuccess = false) {
        loginError.textContent = msg;
        loginError.style.color = isSuccess ? 'green' : '';
    }

    function normalizeNickname(value) {
        return (value || '').trim().replace(/\s+/g, ' ').slice(0, 20);
    }



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

        const ownPosts = state.posts.filter(post => post.user_id === state.user.id).length;
        const votesCast = state.posts.filter(post => post.votes.includes(state.user.id)).length;
        const rsvpsJoined = state.posts.filter(post => post.rsvps.includes(state.user.id)).length;

        profileName.textContent = state.user.label;
        profileEmail.textContent = state.user.email || '-';
        profileJoined.textContent = state.user.createdAt ? new Date(state.user.createdAt).toLocaleDateString('en-AU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }) : '-';
        profilePostCount.textContent = String(ownPosts);
        profileVoteCount.textContent = String(votesCast);
        profileRsvpCount.textContent = String(rsvpsJoined);
    }

    function showApp() {
        loginScreen.style.display = 'none';
        appEl.classList.add('active');
        updateUIForUser();
    }

    // ── Supabase Data ──
    async function fetchAllPosts() {
        try {
            const { data: posts, error: postsErr } = await supabaseClient
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false });

            if (postsErr) throw postsErr;

            if (!posts || posts.length === 0) {
                state.posts = [];
                finishLoading();
                render();
                return;
            }

            const postIds = posts.map(p => p.id);

            // Fetch related data
            const [votesRes, rsvpsRes, commentsRes] = await Promise.all([
                supabaseClient.from('votes').select('*').in('post_id', postIds),
                supabaseClient.from('rsvps').select('*').in('post_id', postIds),
                supabaseClient.from('comments').select('*').in('post_id', postIds).order('created_at', { ascending: true })
            ]);

            const votes = votesRes.data || [];
            const rsvps = rsvpsRes.data || [];
            const comments = commentsRes.data || [];

            const votesByPost = groupBy(votes, 'post_id');
            const rsvpsByPost = groupBy(rsvps, 'post_id');
            const commentsByPost = groupBy(comments, 'post_id');

            state.posts = posts.map(p => ({
                id: p.id,
                location: p.location || '',
                author: p.author || 'Tenant',
                user_id: p.user_id, // Map ownership
                createdAt: p.created_at,
                proposedDate: p.proposed_date,
                category: normalizeCategory(p.category),
                status: normalizeStatus(p.status),
                votes: (votesByPost[p.id] || []).map(v => v.user_id),
                rsvps: (rsvpsByPost[p.id] || []).map(r => r.user_id),
                comments: (commentsByPost[p.id] || []).map(c => ({
                    id: c.id,
                    author: c.author,
                    text: c.text,
                    createdAt: c.created_at
                }))
            }));

            finishLoading();
            updateProfilePanel();
            render();
        } catch (err) {
            console.error('Fetch error:', err);
            finishLoading();
            postFeed.innerHTML = `<div class="empty-state">⚠️ Connect Error: ${err.message}</div>`;
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
            .subscribe(status => {
                const dot = connectionStatus.querySelector('.status-dot');
                const txt = connectionStatus.querySelector('.status-text');
                if (status === 'SUBSCRIBED') {
                    dot.className = 'status-dot online';
                    txt.textContent = 'Live';
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    dot.className = 'status-dot offline';
                    txt.textContent = 'Offline';
                }
            });
    }

    // ── Actions ──
    async function handleSubmitPost() {
        if (!state.user) return showToast('Please log in first.');

        const location = locationInput.value.trim();
        if (!location) return;

        const postPayload = {
            location: location,
            author: state.user.label, // Use email user-part
            user_id: state.user.id,   // Save owner ID
            proposed_date: dateInput.value || null,
            category: normalizeCategory(categoryInput.value)
        };

        if (supportsPostStatus) {
            postPayload.status = 'proposed';
        }

        let { error } = await supabaseClient.from('posts').insert(postPayload);

        if (error && isMissingStatusColumnError(error) && supportsPostStatus) {
            supportsPostStatus = false;
            delete postPayload.status;
            ({ error } = await supabaseClient.from('posts').insert(postPayload));
            if (!error) {
                showToast('Post added! (status feature disabled until DB migration)');
            }
        }

        if (error) {
            console.error('Post error:', error);
            showToast('Failed to post. ' + error.message);
        } else {
            locationInput.value = '';
            dateInput.value = '';
            categoryInput.value = 'Travel';
            updatePreview();
            showToast('Post added!');
        }
    }

    async function handleVote(postId) {
        if (!state.user) return showToast('Please log in first.');
        const userId = state.user.id;

        // Optimistic UI could go here, but let's rely on realtime for simplicity first
        const hasVoted = state.posts.find(p => p.id === postId)?.votes.includes(userId);

        if (hasVoted) {
            // Find vote ID to delete. 
            // In a real app we'd track the ID, but here we can DELETE by match
            await supabaseClient.from('votes').delete().match({ post_id: postId, user_id: userId });
        } else {
            await supabaseClient.from('votes').insert({ post_id: postId, user_id: userId });
        }
    }

    async function handleRsvp(postId) {
        if (!state.user) return showToast('Please log in first.');
        const userId = state.user.id;
        const hasRsvpd = state.posts.find(p => p.id === postId)?.rsvps.includes(userId);

        if (hasRsvpd) {
            await supabaseClient.from('rsvps').delete().match({ post_id: postId, user_id: userId });
        } else {
            await supabaseClient.from('rsvps').insert({ post_id: postId, user_id: userId });
        }
    }

    async function handleComment(postId, text) {
        if (!state.user) return showToast('Please log in first.');
        if (!text.trim()) return;

        await supabaseClient.from('comments').insert({
            post_id: postId,
            user_id: state.user.id,
            author: state.user.label,
            text: text.trim()
        });
    }

    function handleSort(type) {
        currentSort = type;

        // Update UI
        sortBtns.forEach(btn => {
            if (btn.dataset.sort === type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        render();
    }


    function handleCategoryFilter(category) {
        currentCategory = category;

        categoryBtns.forEach(btn => {
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        render();
    }

    function handleFeedFilter(type) {
        if (type === 'confirmed' && !supportsPostStatus) {
            showToast('Confirmed filter is unavailable until DB migration is applied.');
            return;
        }

        currentFeedFilter = type;

        filterBtns.forEach(btn => {
            if (btn.dataset.filter === type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        render();
    }

    function handleSearch() {
        currentSearch = searchInput.value.trim().toLowerCase();
        render();
    }

    // ── Render ──
    function render() {
        let filteredPosts = currentCategory === 'all'
            ? state.posts
            : state.posts.filter(post => post.category === currentCategory);

        if (currentFeedFilter === 'confirmed') {
            filteredPosts = filteredPosts.filter(post => post.status === 'confirmed');
        } else if (currentFeedFilter === 'scheduled') {
            filteredPosts = filteredPosts.filter(post => Boolean(post.proposedDate));
        }

        if (currentSearch) {
            filteredPosts = filteredPosts.filter(post => {
                const commentsText = post.comments.map(c => c.text).join(' ');
                return `${post.location} ${post.author} ${commentsText}`.toLowerCase().includes(currentSearch);
            });
        }

        // Sort
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
            postFeed.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🗺️</div>
                    <h3>No posts in this category yet</h3>
                    <p>Try another category or be the first to post!</p>
                </div>`;
        } else {
            postFeed.innerHTML = sorted.map(renderPost).join('');

            // Re-bind listeners
            postFeed.querySelectorAll('.vote-btn').forEach(btn =>
                btn.addEventListener('click', () => handleVote(btn.dataset.id)));

            postFeed.querySelectorAll('.btn-rsvp').forEach(btn =>
                btn.addEventListener('click', () => handleRsvp(btn.dataset.id)));

            postFeed.querySelectorAll('.comment-toggle').forEach(btn =>
                btn.addEventListener('click', () => {
                    const sec = document.querySelector(`[data-comments="${btn.dataset.id}"]`);
                    sec.classList.toggle('open');
                }));

            postFeed.querySelectorAll('.comment-form button').forEach(btn => {
                const id = btn.dataset.id;
                const input = document.querySelector(`.comment-input-${id}`);
                btn.addEventListener('click', () => {
                    handleComment(id, input.value);
                    input.value = '';
                });
            });

            postFeed.querySelectorAll('.delete-btn').forEach(btn =>
                btn.addEventListener('click', () => handleDeletePost(btn.dataset.id)));

            postFeed.querySelectorAll('.btn-confirm').forEach(btn =>
                btn.addEventListener('click', () => handleConfirmPost(btn.dataset.id)));
        }
    }

    function renderPost(post) {
        const userId = state.user ? state.user.id : null;
        const hasVoted = post.votes.includes(userId);
        const hasRsvpd = post.rsvps.includes(userId);
        const voteCount = post.votes.length;
        const commentCount = post.comments.length;

        let scheduleHtml = `
            <div class="category-badge">${escapeHtml(post.category)}</div>
        `;
        if (post.proposedDate) {
            scheduleHtml += `
                <div class="schedule-badge">📅 ${formatDate(post.proposedDate)}</div>
                <div class="rsvp-section">
                    <button class="btn-rsvp ${hasRsvpd ? 'joined' : ''}" data-id="${post.id}">
                        ${hasRsvpd ? '✓ I\'m in!' : 'I\'m in'}
                    </button>
                    <span class="rsvp-count">${post.rsvps.length} going</span>
                </div>`;
        }

        const commentsHtml = post.comments.map(c => `
            <div class="comment-item">
                <span class="comment-author">${escapeHtml(c.author)}</span>
                <span class="comment-time">${formatTimeAgo(c.createdAt)}</span>
                <div class="comment-text">${escapeHtml(c.text)}</div>
            </div>
        `).join('');

        const isOwner = state.user && state.user.id === post.user_id;
        const canConfirm = isOwner && post.status !== 'confirmed';
        const deleteBtn = isOwner ?
            `<button class="action-btn delete-btn" data-id="${post.id}" title="Delete Post">🗑️</button>` : '';
        const confirmBtn = canConfirm
            ? `<button class="btn-confirm" data-id="${post.id}" title="Confirm plan">Confirm</button>`
            : '';
        const timeAgo = formatTimeAgo(post.createdAt);
        const statusLabel = post.status === 'confirmed' ? '✅ Confirmed' : '🕓 Proposed';

        return `
            <div class="post-card">
                <div class="post-main">
                    <div class="post-vote">
                        <button class="vote-btn ${hasVoted ? 'voted' : ''}" data-id="${post.id}" title="Vote">▲</button>
                        <span class="vote-count">${voteCount}</span>
                    </div>
                    <div class="post-body">
                        <div class="post-title">
                            Let's go to <span class="location">${escapeHtml(post.location)}</span>!
                        </div>
                        <div class="post-meta">
                            <span class="meta-item">👤 ${escapeHtml(post.author)}</span>
                            <span class="meta-item">🕐 ${timeAgo}</span>
                        </div>
                        <div class="post-status ${post.status}">${statusLabel}</div>
                        ${scheduleHtml}
                    </div>
                </div>
                <div class="post-actions">
                    ${confirmBtn}
                    ${deleteBtn}
                    <button class="action-btn comment-toggle" data-id="${post.id}">
                        💬 ${commentCount > 0 ? commentCount + ' comment' + (commentCount === 1 ? '' : 's') : 'Comment'}
                    </button>
                </div>
                <div class="comments-section" data-comments="${post.id}">
                    <div class="comment-list">${commentsHtml}</div>
                    <div class="comment-form" data-id="${post.id}">
                        <input type="text" class="comment-input-${post.id}" placeholder="Write a comment..." />
                        <button data-id="${post.id}">Post</button>
                    </div>
                </div>
            </div>
        `;
    }

    async function handleDeletePost(postId) {
        if (!confirm('Are you sure you want to delete this trip?')) return;

        const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
        if (error) {
            console.error('Delete error:', error);
            showToast('Failed to delete. ' + error.message);
        } else {
            showToast('Post deleted.');
        }
    }

    async function handleConfirmPost(postId) {
        if (!state.user) return showToast('Please log in first.');
        if (!supportsPostStatus) return showToast('Trip status is unavailable until DB migration is applied.');

        const post = state.posts.find(item => item.id === postId);
        if (!post || post.user_id !== state.user.id) return showToast('Only the post owner can confirm this plan.');

        let { error } = await supabaseClient.from('posts').update({ status: 'confirmed' }).eq('id', postId);

        if (error && isMissingStatusColumnError(error)) {
            supportsPostStatus = false;
            showToast('Trip status is unavailable until DB migration is applied.');
            return;
        }

        if (error) {
            console.error('Confirm error:', error);
            showToast('Failed to confirm. ' + error.message);
        } else {
            showToast('Trip confirmed!');
        }
    }

    // ── Helpers ──
    function updatePreview() {
        const val = locationInput.value.trim();
        previewText.innerHTML = val ?
            `Let's go to <span class="filled">${escapeHtml(val)}</span>! 🚀` :
            'Let\'s go to _______ ! 🚀';
    }

    function finishLoading() {
        if (!dataLoaded) {
            dataLoaded = true;
            loadingScreen.style.display = 'none';
            appContent.style.display = '';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function groupBy(arr, key) {
        return arr.reduce((acc, item) => {
            (acc[item[key]] = acc[item[key]] || []).push(item);
            return acc;
        }, {});
    }

    function formatTimeAgo(iso) {
        const ms = new Date() - new Date(iso);
        const min = Math.floor(ms / 60000);
        const hr = Math.floor(ms / 3600000);
        const day = Math.floor(ms / 86400000);
        if (min < 1) return 'just now';
        if (min < 60) return min + 'm ago';
        if (hr < 24) return hr + 'h ago';
        if (day < 7) return day + 'd ago';
        return new Date(iso).toLocaleDateString();
    }

    function normalizeCategory(category) {
        return CATEGORIES.includes(category) ? category : 'Travel';
    }

    function normalizeStatus(status) {
        return status === 'confirmed' ? 'confirmed' : 'proposed';
    }

    function isMissingStatusColumnError(error) {
        return error && error.code === 'PGRST204' && String(error.message || '').includes("'status' column");
    }

    function formatDate(str) {
        return new Date(str + 'T00:00:00').toLocaleDateString('en-AU', {
            weekday: 'short', day: 'numeric', month: 'short'
        });
    }

    function showToast(msg) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        toastContainer.appendChild(t);
        setTimeout(() => {
            t.classList.add('fade-out');
            setTimeout(() => t.remove(), 300);
        }, 2500);
    }
})();
