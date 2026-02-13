// ── RoomingKos Explores — App Logic (Dual Auth) ──

(() => {
    'use strict';

    // ── Constants ──
    const GUEST_SESSION_KEY = 'roomingkos_guest_session';
    const GUEST_ID_KEY = 'roomingkos_guest_id';
    const GUEST_PASSCODE = '13';

    // ── State ──
    let state = {
        posts: [],
        user: null // { role: 'guest'|'member', id: string, email?: string }
    };
    let currentSort = 'votes'; // 'votes' | 'newest'
    let dataLoaded = false;

    // ── DOM Refs ──
    // Auth Screen
    const loginScreen = document.getElementById('login-screen');
    const btnShowGuest = document.getElementById('btn-show-guest');
    const btnShowMember = document.getElementById('btn-show-member');
    const formGuest = document.getElementById('form-guest');
    const formMember = document.getElementById('form-member');

    // Auth Inputs
    const guestInput = document.getElementById('guest-code-input');
    const guestNicknameInput = document.getElementById('guest-nickname');
    const guestBtn = document.getElementById('guest-login-btn');
    const emailInput = document.getElementById('member-email');
    const passwordInput = document.getElementById('member-password');
    const memberLoginBtn = document.getElementById('member-login-btn');
    const memberSignupBtn = document.getElementById('member-signup-btn');
    const loginError = document.getElementById('login-error');

    // App Layout
    const appEl = document.getElementById('app');
    const logoutBtn = document.getElementById('logout-btn');
    const connectionStatus = document.getElementById('connection-status');
    const appContent = document.getElementById('app-content');
    const loadingScreen = document.getElementById('loading-screen');

    // Core Features
    const newSuggestionSection = document.querySelector('.new-suggestion'); // Parent of form
    const locationInput = document.getElementById('location-input');
    const dateInput = document.getElementById('date-input');
    const submitBtn = document.getElementById('submit-btn');
    const previewText = document.getElementById('preview-text');
    const postFeed = document.getElementById('post-feed');
    const sortBtns = document.querySelectorAll('.sort-btn');
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
        } else {
            // Check for Guest Session
            if (sessionStorage.getItem(GUEST_SESSION_KEY) === 'true') {
                setGuestState();
                showApp();
            } else {
                // Pre-fill nickname if exists
                const savedName = localStorage.getItem('roomingkos_guest_name');
                if (savedName) guestNicknameInput.value = savedName;
            }
        }

        // Initialize Data & Realtime
        initSupabase();
    }

    // ── Auth Logic ──
    function bindEvents() {
        // Toggle Auth Forms
        btnShowGuest.addEventListener('click', () => toggleAuthMode('guest'));
        btnShowMember.addEventListener('click', () => toggleAuthMode('member'));

        // Guest Login
        guestBtn.addEventListener('click', handleGuestLogin);
        guestInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleGuestLogin();
        });
        guestNicknameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleGuestLogin();
        });

        // Member Login/Signup
        memberLoginBtn.addEventListener('click', handleMemberLogin);
        memberSignupBtn.addEventListener('click', handleMemberSignup);

        // Logout
        logoutBtn.addEventListener('click', handleLogout);

        // App Interactions
        locationInput.addEventListener('input', updatePreview);
        submitBtn.addEventListener('click', handleSubmitPost);
        sortBtns.forEach(btn => {
            btn.addEventListener('click', () => handleSort(btn.dataset.sort));
        });
    }

    function toggleAuthMode(mode) {
        if (mode === 'guest') {
            btnShowGuest.classList.add('active');
            btnShowMember.classList.remove('active');
            formGuest.classList.add('active');
            formMember.classList.remove('active');
        } else {
            btnShowGuest.classList.remove('active');
            btnShowMember.classList.add('active');
            formGuest.classList.remove('active');
            formMember.classList.add('active');
        }
        loginError.textContent = '';
    }

    function handleGuestLogin() {
        const code = guestInput.value.trim();
        const nickname = guestNicknameInput.value.trim();

        if (!nickname) {
            showLoginError('Please enter a nickname.');
            guestNicknameInput.focus();
            return;
        }

        if (code === GUEST_PASSCODE) {
            sessionStorage.setItem(GUEST_SESSION_KEY, 'true');
            localStorage.setItem('roomingkos_guest_name', nickname);
            setGuestState();
            showApp();
        } else {
            showLoginError('Incorrect passcode.');
            guestInput.classList.add('shake');
            setTimeout(() => guestInput.classList.remove('shake'), 500);
        }
    }

    async function handleMemberLogin() {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        if (!email || !password) return showLoginError('Please enter email and password.');

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            showLoginError(error.message);
        } else {
            setMemberState(data.user);
            showApp();
        }
    }

    async function handleMemberSignup() {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        if (!email || !password) return showLoginError('Please enter email and password.');

        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
            showLoginError(error.message);
        } else {
            showLoginError('Check your email for the confirmation link!', true);
        }
    }

    function setGuestState() {
        const name = localStorage.getItem('roomingkos_guest_name') || 'Guest';
        state.user = {
            role: 'guest',
            id: getOrCreateGuestId(),
            label: name
        };
        updateUIForUser();
    }

    function setMemberState(user) {
        state.user = {
            role: 'member',
            id: user.id, // Supabase Auth ID
            email: user.email,
            label: user.email.split('@')[0]
        };
        updateUIForUser();
    }

    function updateUIForUser() {
        if (!state.user) return;

        // Hide/Show "Suggest Trip" based on role
        if (state.user.role === 'member') {
            newSuggestionSection.style.display = 'block';
        } else {
            newSuggestionSection.style.display = 'none';
        }
    }

    function handleLogout() {
        if (state.user?.role === 'member') {
            supabaseClient.auth.signOut();
        }
        sessionStorage.removeItem(GUEST_SESSION_KEY);
        state.user = null;

        appEl.classList.remove('active');
        loginScreen.style.display = 'flex';

        // Reset forms
        guestInput.value = '';
        emailInput.value = '';
        passwordInput.value = '';
        loginError.textContent = '';
    }

    function showLoginError(msg, isSuccess = false) {
        loginError.textContent = msg;
        loginError.style.color = isSuccess ? 'green' : '';
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
        if (state.user.role !== 'member') return; // Gate on client

        const location = locationInput.value.trim();
        if (!location) return;

        const { error } = await supabaseClient.from('posts').insert({
            location: location,
            author: state.user.label, // Use email user-part
            user_id: state.user.id,   // Save owner ID
            proposed_date: dateInput.value || null
        });

        if (error) {
            console.error('Post error:', error);
            showToast('Failed to post. ' + error.message);
        } else {
            locationInput.value = '';
            dateInput.value = '';
            updatePreview();
            showToast('Trip suggested!');
        }
    }

    async function handleVote(postId) {
        if (!state.user) return;
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
        if (!state.user) return;
        const userId = state.user.id;
        const hasRsvpd = state.posts.find(p => p.id === postId)?.rsvps.includes(userId);

        if (hasRsvpd) {
            await supabaseClient.from('rsvps').delete().match({ post_id: postId, user_id: userId });
        } else {
            await supabaseClient.from('rsvps').insert({ post_id: postId, user_id: userId });
        }
    }

    async function handleComment(postId, text) {
        if (!state.user || !text.trim()) return;

        await supabaseClient.from('comments').insert({
            post_id: postId,
            author: state.user.label || 'Guest',
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

    // ── Render ──
    function render() {
        // Sort
        const sorted = [...state.posts];
        if (currentSort === 'votes') {
            sorted.sort((a, b) => b.votes.length - a.votes.length);
        } else {
            sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        if (sorted.length === 0) {
            postFeed.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🗺️</div>
                    <h3>No suggestions yet</h3>
                    <p>Be the first to suggest a trip!</p>
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
        }
    }

    function renderPost(post) {
        const userId = state.user ? state.user.id : null;
        const hasVoted = post.votes.includes(userId);
        const hasRsvpd = post.rsvps.includes(userId);
        const voteCount = post.votes.length;
        const commentCount = post.comments.length;

        let scheduleHtml = '';
        if (post.proposedDate) {
            scheduleHtml = `
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
        const deleteBtn = isOwner ?
            `<button class="action-btn delete-btn" data-id="${post.id}" title="Delete Post">🗑️</button>` : '';

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
                        ${scheduleHtml}
                    </div>
                </div>
                <div class="post-actions">
                    ${deleteBtn}
                    <button class="action-btn comment-toggle" data-id="${post.id}">
                        💬 ${commentCount > 0 ? commentCount + ' comment' + (commentCount === 1 ? '' : 's') : 'Comment'}
                    </button>
                </div>
                <div class="comments-section" data-comments="${post.id}">
                    <div class="comment-list">${commentsHtml}</div>
                    <div class="comment-form" data-id="${post.id}">
                        <input type="text" placeholder="Write a comment..." />
                        <button>Post</button>
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

    // ── Helpers ──
    function getOrCreateGuestId() {
        let id = localStorage.getItem(GUEST_ID_KEY);
        if (!id) {
            id = 'guest_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
            localStorage.setItem(GUEST_ID_KEY, id);
        }
        return id;
    }

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
