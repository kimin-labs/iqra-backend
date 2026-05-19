document.addEventListener('DOMContentLoaded', () => {

    const page = document.body.dataset.page;
    const toast = document.getElementById('toast');

    if (page === 'login') initAuthPage();
    else if (page === 'chat') initChatPage();
    else if (page === 'quran') { initNavbar(); initQuranPage(); }
    else if (page === 'prophets') { initNavbar(); initProphetsPage(); }
    else if (page === 'home' || page === 'prayer' || page === 'reminder' || page === 'support') initOldPages();

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showToast(message, type) {
        if (!toast) return;
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 4000);
    }

    async function api(url, options = {}) {
        const res = await fetch(url, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    function initAuthPage() {
        const loginTab = document.getElementById('loginTab');
        const signupTab = document.getElementById('signupTab');
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        const loginError = document.getElementById('loginError');
        const signupError = document.getElementById('signupError');

        loginTab.addEventListener('click', () => {
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
            loginForm.classList.add('active');
            signupForm.classList.remove('active');
            loginError.textContent = '';
            signupError.textContent = '';
        });

        signupTab.addEventListener('click', () => {
            signupTab.classList.add('active');
            loginTab.classList.remove('active');
            signupForm.classList.add('active');
            loginForm.classList.remove('active');
            loginError.textContent = '';
            signupError.textContent = '';
        });

        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            loginError.textContent = '';
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            try {
                const data = await api('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                window.location.href = 'chat.html';
            } catch (err) {
                loginError.textContent = err.message;
            }
        });

        signupForm.addEventListener('submit', async e => {
            e.preventDefault();
            signupError.textContent = '';
            const username = document.getElementById('signupUsername').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;
            try {
                const data = await api('/api/auth/signup', {
                    method: 'POST',
                    body: JSON.stringify({ username, email, password })
                });
                window.location.href = 'chat.html';
            } catch (err) {
                signupError.textContent = err.message;
            }
        });
    }

    function initChatPage() {
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const conversationsList = document.getElementById('conversationsList');
        const newChatBtn = document.getElementById('newChatBtn');
        const topbarTitle = document.getElementById('topbarTitle');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebarClose = document.getElementById('sidebarClose');
        const sidebar = document.getElementById('sidebar');
        const logoutBtn = document.getElementById('logoutBtn');
        const usernameDisplay = document.getElementById('usernameDisplay');

        let currentConvId = null;
        let conversations = [];

        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const settingsClose = document.getElementById('settingsClose');
        const langSelect = document.getElementById('langSelect');
        const fontSizeGroup = document.getElementById('fontSizeGroup');
        const themeGroup = document.getElementById('themeGroup');

        settingsBtn.addEventListener('click', async () => {
            settingsModal.classList.add('open');
            goToStep(1);
            try {
                const data = await api('/api/auth/me');
                profileUsername.value = data.user.username || '';
                profileEmail.value = data.user.email || '';
            } catch {}
        });
        settingsClose.addEventListener('click', () => settingsModal.classList.remove('open'));
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) settingsModal.classList.remove('open');
        });

        const savedLang = localStorage.getItem('iqra-lang') || 'auto';
        const savedFontSize = localStorage.getItem('iqra-font-size') || 'medium';
        const savedTheme = localStorage.getItem('iqra-theme') || 'dark';

        langSelect.value = savedLang;
        document.documentElement.style.fontSize = { small: '13px', medium: '15px', large: '18px' }[savedFontSize] || '15px';
        document.documentElement.setAttribute('data-theme', savedTheme);
        applyTheme(savedTheme);

        fontSizeGroup.querySelectorAll('.setting-radio').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.size === savedFontSize);
            btn.addEventListener('click', () => {
                fontSizeGroup.querySelectorAll('.setting-radio').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const size = btn.dataset.size;
                const px = { small: '13px', medium: '15px', large: '18px' }[size];
                document.documentElement.style.fontSize = px;
                localStorage.setItem('iqra-font-size', size);
                showToast('Font size updated', 'success');
            });
        });

        themeGroup.querySelectorAll('.setting-radio').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === savedTheme);
            btn.addEventListener('click', () => {
                themeGroup.querySelectorAll('.setting-radio').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const theme = btn.dataset.theme;
                applyTheme(theme);
                localStorage.setItem('iqra-theme', theme);
                showToast('Theme updated', 'success');
            });
        });

        langSelect.addEventListener('change', () => {
            localStorage.setItem('iqra-lang', langSelect.value);
            showToast('Language preference saved', 'success');
        });

        const settingsBack = document.getElementById('settingsBack');
        const steps = document.querySelectorAll('.step');
        const slides = document.querySelectorAll('.settings-slide');
        const modalIcon = document.getElementById('settingsModalIcon');
        const modalTitle = document.getElementById('settingsModalTitle');

        function goToStep(step) {
            slides.forEach(s => s.classList.remove('active'));
            steps.forEach(s => {
                s.classList.remove('active', 'completed');
                const n = parseInt(s.dataset.step);
                if (n < step) s.classList.add('completed');
                if (n === step) s.classList.add('active');
            });
            document.getElementById(`slide${step}`).classList.add('active');
            const titles = { 1: 'Preferences', 2: 'Profile', 3: 'Password' };
            modalTitle.textContent = titles[step] || 'Settings';
            settingsBack.style.display = step > 1 ? 'block' : 'none';
        }

        document.querySelectorAll('.settings-next-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const next = parseInt(btn.dataset.next);
                goToStep(next);
            });
        });

        steps.forEach(s => {
            s.addEventListener('click', () => {
                const step = parseInt(s.dataset.step);
                goToStep(step);
            });
            s.style.cursor = 'pointer';
        });

        const saveProfileBtn = document.getElementById('saveProfileBtn');
        const profileUsername = document.getElementById('profileUsername');
        const profileEmail = document.getElementById('profileEmail');
        const profileError = document.getElementById('profileError');
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        const currentPassword = document.getElementById('currentPassword');
        const newPassword = document.getElementById('newPassword');
        const confirmPassword = document.getElementById('confirmPassword');
        const passwordError = document.getElementById('passwordError');

        saveProfileBtn.addEventListener('click', async () => {
            profileError.textContent = '';
            const username = profileUsername.value.trim();
            const email = profileEmail.value.trim();
            if (!username || !email) {
                profileError.textContent = 'All fields are required';
                return;
            }
            try {
                const data = await api('/api/auth/profile', {
                    method: 'PUT',
                    body: JSON.stringify({ username, email })
                });
                usernameDisplay.textContent = data.user.username;
                showToast('Profile updated', 'success');
                goToStep(3);
            } catch (err) {
                profileError.textContent = err.message;
            }
        });

        changePasswordBtn.addEventListener('click', async () => {
            passwordError.textContent = '';
            const cur = currentPassword.value;
            const nw = newPassword.value;
            const conf = confirmPassword.value;
            if (!cur || !nw || !conf) {
                passwordError.textContent = 'All fields are required';
                return;
            }
            if (nw !== conf) {
                passwordError.textContent = 'Passwords do not match';
                return;
            }
            if (nw.length < 4) {
                passwordError.textContent = 'Password must be at least 4 characters';
                return;
            }
            try {
                await api('/api/auth/password', {
                    method: 'PUT',
                    body: JSON.stringify({ current_password: cur, new_password: nw })
                });
                currentPassword.value = '';
                newPassword.value = '';
                confirmPassword.value = '';
                showToast('Password changed successfully', 'success');
            } catch (err) {
                passwordError.textContent = err.message;
            }
        });

        settingsBack.addEventListener('click', () => {
            const current = document.querySelector('.step.active');
            const curStep = current ? parseInt(current.dataset.step) : 1;
            if (curStep > 1) goToStep(curStep - 1);
        });

        function applyTheme(theme) {
            if (theme === 'light') {
                document.documentElement.style.setProperty('--bg-primary', '#f8fafc');
                document.documentElement.style.setProperty('--bg-secondary', '#ffffff');
                document.documentElement.style.setProperty('--text-primary', '#0f172a');
                document.documentElement.style.setProperty('--text-secondary', '#475569');
                document.documentElement.style.setProperty('--text-muted', '#94a3b8');
                document.documentElement.style.setProperty('--glass-bg', 'rgba(255,255,255,0.8)');
                document.documentElement.style.setProperty('--glass-border', 'rgba(0,0,0,0.1)');
            } else {
                document.documentElement.style.setProperty('--bg-primary', '#0a0e1a');
                document.documentElement.style.setProperty('--bg-secondary', '#0f172a');
                document.documentElement.style.setProperty('--text-primary', '#ffffff');
                document.documentElement.style.setProperty('--text-secondary', '#94a3b8');
                document.documentElement.style.setProperty('--text-muted', '#64748b');
                document.documentElement.style.setProperty('--glass-bg', 'rgba(255,255,255,0.05)');
                document.documentElement.style.setProperty('--glass-border', 'rgba(255,255,255,0.1)');
            }
        }

        checkAuth();

        sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
        sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));

        fetchHijriDate();

        async function fetchHijriDate() {
            try {
                const d = new Date();
                const res = await fetch(`https://api.aladhan.com/v1/gToH/${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()}`);
                const data = await res.json();
                if (data.code === 200) {
                    const h = data.data.hijri;
                    document.getElementById('hijriDisplay').textContent = `${h.day} ${h.month.en} ${h.year} AH`;
                }
            } catch {
                document.getElementById('hijriDisplay').textContent = '';
            }
        }

        async function checkAuth() {
            try {
                const data = await api('/api/auth/me');
                usernameDisplay.textContent = data.user.username;
                loadConversations();
            } catch {
                window.location.href = 'login.html';
            }
        }

        logoutBtn.addEventListener('click', async () => {
            await api('/api/auth/logout', { method: 'POST' });
            window.location.href = 'index.html';
        });

        async function loadConversations() {
            try {
                const data = await api('/api/conversations');
                conversations = data.conversations;
                renderConversations();
            } catch {
                conversationsList.innerHTML = '<div class="conv-empty">Could not load chats</div>';
            }
        }

        function renderConversations() {
            if (conversations.length === 0) {
                conversationsList.innerHTML = '<div class="conv-empty">No chats yet</div>';
                return;
            }
            conversationsList.innerHTML = conversations.map(c => `
                <div class="conv-item ${c.id === currentConvId ? 'active' : ''}" data-id="${c.id}">
                    <i class="fas fa-comment"></i>
                    <span class="conv-title">${escapeHtml(c.title)}</span>
                    <button class="conv-delete" data-id="${c.id}" title="Delete chat"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');

            conversationsList.querySelectorAll('.conv-item').forEach(item => {
                item.addEventListener('click', e => {
                    if (e.target.closest('.conv-delete')) return;
                    const id = parseInt(item.dataset.id);
                    switchConversation(id);
                    if (window.innerWidth <= 768) sidebar.classList.remove('open');
                });
            });

            conversationsList.querySelectorAll('.conv-delete').forEach(btn => {
                btn.addEventListener('click', async e => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    try {
                        await api(`/api/conversations/${id}`, { method: 'DELETE' });
                        if (currentConvId === id) {
                            currentConvId = null;
                            showWelcome();
                        }
                        loadConversations();
                        showToast('Chat deleted', 'success');
                    } catch {
                        showToast('Failed to delete', 'error');
                    }
                });
            });
        }

        function showWelcome() {
            chatMessages.innerHTML = `
                <div class="chat-welcome" id="chatWelcome">
                    <div class="welcome-icon"><i class="fas fa-mosque welcome-logo"></i></div>
                    <h2>Iqra AI</h2>
                    <p>Ask me anything about Islam, Quran, Hadith, or daily life</p>
                    <div class="welcome-suggestions">
                        <button class="chip" data-text="Tell me about the five pillars of Islam">Five Pillars</button>
                        <button class="chip" data-text="Give me a verse about patience">Patience in Quran</button>
                        <button class="chip" data-text="Dua for exams">Dua for Exams</button>
                        <button class="chip" data-text="How to deal with stress in Islam">Stress Relief</button>
                    </div>
                </div>
            `;
            topbarTitle.textContent = 'New Chat';
            initWelcomeChips();
        }

        function initWelcomeChips() {
            document.querySelectorAll('.welcome-suggestions .chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    chatInput.value = chip.dataset.text;
                    sendMessage();
                });
            });
        }

        showWelcome();

        async function switchConversation(convId) {
            currentConvId = convId;
            try {
                const data = await api(`/api/conversations/${convId}/messages`);
                const conv = conversations.find(c => c.id === convId);
                topbarTitle.textContent = conv ? conv.title : 'Chat';

                if (data.messages.length === 0) {
                    showWelcome();
                    return;
                }

                chatMessages.innerHTML = data.messages.map(msg => `
                    <div class="message-row ${msg.role}">
                        <div class="message">
                            <div class="message-avatar">
                                <i class="fas fa-${msg.role === 'user' ? 'user' : 'mosque'}"></i>
                            </div>
                            <div class="message-content"><p>${escapeHtml(msg.content)}</p></div>
                        </div>
                    </div>
                `).join('');
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } catch {
                showToast('Failed to load messages', 'error');
            }
        }

        newChatBtn.addEventListener('click', () => {
            currentConvId = null;
            showWelcome();
            chatInput.focus();
            document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
        });

        function sendMessage() {
            const text = chatInput.value.trim();
            if (!text) return;
            addMessage(text, 'user');
            chatInput.value = '';
            chatInput.style.height = 'auto';
            showTyping();
            getAIResponse(text);
        }

        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
        });

        function addMessage(text, sender) {
            const welcome = document.getElementById('chatWelcome');
            if (welcome) welcome.remove();

            const row = document.createElement('div');
            row.className = `message-row ${sender}`;

            if (sender === 'user') {
                row.innerHTML = `
                    <div class="message">
                        <div class="message-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="message-content"><p>${escapeHtml(text)}</p></div>
                    </div>
                `;
                chatMessages.appendChild(row);
            } else {
                row.innerHTML = `
                    <div class="message">
                        <div class="message-avatar">
                            <i class="fas fa-mosque"></i>
                        </div>
                        <div class="message-content"><p></p></div>
                    </div>
                `;
                chatMessages.appendChild(row);
                const p = row.querySelector('.message-content p');
                typeText(p, text);
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function typeText(element, text, speed = 15) {
            let i = 0;
            element.textContent = '';
            function type() {
                if (i < text.length) {
                    element.textContent += text.charAt(i);
                    i++;
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    setTimeout(type, speed);
                }
            }
            type();
        }

        function showTyping() {
            const row = document.createElement('div');
            row.className = 'message-row ai';
            row.id = 'typingIndicator';
            row.innerHTML = `
                <div class="message">
                    <div class="message-avatar"><i class="fas fa-mosque"></i></div>
                    <div class="message-content">
                        <div class="typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                </div>
            `;
            chatMessages.appendChild(row);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function hideTyping() {
            const el = document.getElementById('typingIndicator');
            if (el) el.remove();
        }

        async function getAIResponse(text) {
            try {
                const data = await api('/api/chat', {
                    method: 'POST',
                    body: JSON.stringify({ message: text, conversation_id: currentConvId })
                });
                hideTyping();
                currentConvId = data.conversation_id;
                addMessage(data.response, 'ai');
                const conv = conversations.find(c => c.id === currentConvId);
                if (conv) topbarTitle.textContent = conv.title;
                loadConversations();
            } catch {
                hideTyping();
                addMessage("Sorry, I couldn't reach the server. Please make sure the backend is running.", 'ai');
            }
        }
    }

    function initNavbar() {
        const menuToggle = document.getElementById('menuToggle');
        const navLinks = document.getElementById('navLinks');
        const navbar = document.getElementById('navbar');
        if (!menuToggle || !navLinks) return;

        if (navbar) {
            if (document.body.dataset.page === 'quran') {
                navbar.classList.add('scrolled');
            } else {
                window.addEventListener('scroll', () => {
                    navbar.classList.toggle('scrolled', window.scrollY > 50);
                });
            }
        }

        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
            });
        });
    }

    function initSurahMarquee() {
        const track = document.getElementById('surahMarqueeTrack');
        if (!track) return;

        fetch('https://api.alquran.cloud/v1/surah')
            .then(r => r.json())
            .then(data => {
                if (data.code !== 200) return;
                const surahs = data.data;
                const names = {
                    1:'الفاتحة',2:'البقرة',3:'آل عمران',4:'النساء',5:'المائدة',6:'الأنعام',7:'الأعراف',8:'الأنفال',9:'التوبة',10:'يونس',
                    11:'هود',12:'يوسف',13:'الرعد',14:'إبراهيم',15:'الحجر',16:'النحل',17:'الإسراء',18:'الكهف',19:'مريم',20:'طه',
                    21:'الأنبياء',22:'الحج',23:'المؤمنون',24:'النور',25:'الفرقان',26:'الشعراء',27:'النمل',28:'القصص',29:'العنكبوت',30:'الروم',
                    31:'لقمان',32:'السجدة',33:'الأحزاب',34:'سبأ',35:'فاطر',36:'يس',37:'الصافات',38:'ص',39:'الزمر',40:'غافر',
                    41:'فصلت',42:'الشورى',43:'الزخرف',44:'الدخان',45:'الجاثية',46:'الأحقاف',47:'محمد',48:'الفتح',49:'الحجرات',50:'ق',
                    51:'الذاريات',52:'الطور',53:'النجم',54:'القمر',55:'الرحمن',56:'الواقعة',57:'الحديد',58:'المجادلة',59:'الحشر',60:'الممتحنة',
                    61:'الصف',62:'الجمعة',63:'المنافقون',64:'التغابن',65:'الطلاق',66:'التحريم',67:'الملك',68:'القلم',69:'الحاقة',70:'المعارج',
                    71:'نوح',72:'الجن',73:'المزمل',74:'المدثر',75:'القيامة',76:'الإنسان',77:'المرسلات',78:'النبأ',79:'النازعات',80:'عبس',
                    81:'التكوير',82:'الإنفطار',83:'المطففين',84:'الإنشقاق',85:'البروج',86:'الطارق',87:'الأعلى',88:'الغاشية',89:'الفجر',90:'البلد',
                    91:'الشمس',92:'الليل',93:'الضحى',94:'الشرح',95:'التين',96:'العلق',97:'القدر',98:'البينة',99:'الزلزلة',100:'العاديات',
                    101:'القارعة',102:'التكاثر',103:'العصر',104:'الهمزة',105:'الفيل',106:'قريش',107:'الماعون',108:'الكوثر',109:'الكافرون',110:'النصر',
                    111:'المسد',112:'الإخلاص',113:'الفلق',114:'الناس'
                };
                const items = surahs.map(s => `
                    <div class="surah-marquee-item">
                        <span class="s-m-number">${s.number}</span>
                        <span class="s-m-name-ar">${names[s.number] || ''}</span>
                        <span class="s-m-name-en">${s.englishName}</span>
                        <span class="s-m-ayahs">(${s.numberOfAyahs} ayahs)</span>
                        <span class="s-m-sep">|</span>
                    </div>
                `).join('');
                track.innerHTML = items + items;
            })
            .catch(() => { track.innerHTML = ''; });
    }

    async function initProphetsPage() {
        const grid = document.getElementById('prophetGrid');
        const modal = document.getElementById('storyModal');
        const modalBody = document.getElementById('storyModalBody');
        const modalTitle = document.getElementById('storyModalTitle');
        const modalClose = document.getElementById('storyModalClose');

        modalClose.addEventListener('click', () => modal.classList.remove('open'));
        modal.addEventListener('click', e => {
            if (e.target === modal) modal.classList.remove('open');
        });

        async function loadProphetList() {
            try {
                const res = await fetch('/api/prophets');
                const data = await res.json();
                renderGrid(data.prophets);
            } catch {
                grid.innerHTML = '<div class="loading-spinner">Failed to load prophets. Make sure the backend is running on port 5000.</div>';
            }
        }

        function renderGrid(prophets) {
            grid.innerHTML = prophets.map(p => `
                <div class="prophet-card" data-id="${p.id}">
                    <span class="p-id">#${p.id}</span>
                    <div class="p-icon"><i class="fas fa-star"></i></div>
                    <div class="p-name">${escapeHtml(p.name)}</div>
                    <div class="p-arabic" dir="rtl">${p.arabic}</div>
                    <div class="p-meaning">${escapeHtml(p.meaning)}</div>
                    <button class="p-btn" data-id="${p.id}"><i class="fas fa-book-open"></i> Soma</button>
                </div>
            `).join('');

            grid.querySelectorAll('.p-btn').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    loadStory(id);
                });
            });

            grid.querySelectorAll('.prophet-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = parseInt(card.dataset.id);
                    loadStory(id);
                });
            });
        }

        async function loadStory(prophetId) {
            modalTitle.textContent = 'Loading...';
            modalBody.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading story...</div>';
            modal.classList.add('open');

            try {
                const res = await fetch(`/api/prophets/${prophetId}/story`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                modalTitle.textContent = data.title || data.prophet.name;
                modalBody.innerHTML = data.content.split('\n\n').filter(Boolean).map(p =>
                    `<p>${escapeHtml(p.trim())}</p>`
                ).join('');
            } catch (err) {
                modalBody.innerHTML = `<p style="color:var(--danger);text-align:center;padding:40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:32px;display:block;margin-bottom:12px;"></i>
                    Could not load the story. <br><small>${err.message}</small>
                </p>`;
            }
        }

        loadProphetList();
    }

    function initMotivationSlides() {
        const wrapper = document.getElementById('slideWrapper');
        const prevBtn = document.getElementById('slidePrev');
        const nextBtn = document.getElementById('slideNext');
        const dots = document.getElementById('slideDots');
        if (!wrapper) return;

        const slides = [
            { ar: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', sw: 'Hakika pamoja na shida kuna urahisi.', ref: 'Quran 94:5-6' },
            { ar: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', sw: 'Na anayemtawakkali Mwenyezi Mungu, basi Yake ni kumtosha.', ref: 'Quran 65:3' },
            { ar: 'رَبِّ زِدْنِي عِلْمًا', sw: 'Mola wangu, niongezee elimu.', ref: 'Quran 20:114' },
            { ar: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا', sw: 'Mwenyezi Mungu hampa mtu mzigo usiomweza.', ref: 'Quran 2:286' },
            { ar: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', sw: 'Hakika Mwenyezi Mungu yuko pamoja na wanao subiri.', ref: 'Quran 2:153' },
            { ar: 'خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ', sw: 'Mbora wa watu ni yule anaye faa wenzake.', ref: 'Hadith — Al-Mu\'jam Al-Awsat' },
            { ar: 'وَمَا أُوتِيتُم مِّنَ الْعِلْمِ إِلَّا قَلِيلًا', sw: 'Nyinyi mmepewa elimu kidogo tu.', ref: 'Quran 17:85' },
            { ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ', sw: 'Nikumbukeni Mimi nawakumbukuni.', ref: 'Quran 2:152' },
            { ar: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', sw: 'Hakika kwa kumkumbuka Mwenyezi Mungu ndio mioyo ina tulia.', ref: 'Quran 13:28' },
            { ar: 'وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ', sw: 'Wala msife moyo wala msi huzunika, nyinyi ndio watakuwa juu.', ref: 'Quran 3:139' },
        ];

        let current = 0;
        let interval = null;

        function render() {
            wrapper.innerHTML = `
                <div class="slide-track" id="slideTrack" style="transform: translateX(-${current * 100}%)">
                    ${slides.map(s => `
                        <div class="slide">
                            <div class="slide-arabic" dir="rtl">${s.ar}</div>
                            <div class="slide-swahili">${s.sw}</div>
                            <div class="slide-ref">${s.ref}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            dots.innerHTML = slides.map((_, i) =>
                `<button class="slide-dot ${i === current ? 'active' : ''}" data-index="${i}"></button>`
            ).join('');
        }

        function goTo(index) {
            if (index < 0) index = slides.length - 1;
            if (index >= slides.length) index = 0;
            current = index;
            const track = document.getElementById('slideTrack');
            if (track) track.style.transform = `translateX(-${current * 100}%)`;
            document.querySelectorAll('.slide-dot').forEach((d, i) => {
                d.classList.toggle('active', i === current);
            });
            resetInterval();
        }

        function resetInterval() {
            if (interval) clearInterval(interval);
            interval = setInterval(() => goTo(current + 1), 5000);
        }

        prevBtn.addEventListener('click', () => goTo(current - 1));
        nextBtn.addEventListener('click', () => goTo(current + 1));

        dots.addEventListener('click', e => {
            const dot = e.target.closest('.slide-dot');
            if (dot) goTo(parseInt(dot.dataset.index));
        });

        wrapper.addEventListener('mouseenter', () => { if (interval) clearInterval(interval); });
        wrapper.addEventListener('mouseleave', resetInterval);

        render();
        resetInterval();
    }

    function initOldPages() {
        initNavbar();

        initSurahMarquee();
        initMotivationSlides();
        if (page === 'prayer') initPrayerPage();
        if (page === 'reminder') initReminderPage();
        if (page === 'support') initSupportPage();
    }

    function initPrayerPage() {
        const locEl = document.getElementById('prayerLocation');
        let userLat = null, userLng = null;

        function detectLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    pos => { userLat = pos.coords.latitude; userLng = pos.coords.longitude;
                        locEl.textContent = `${pos.coords.latitude.toFixed(2)}°N, ${pos.coords.longitude.toFixed(2)}°E`;
                        fetchPrayerTimes(userLat, userLng); },
                    () => { locEl.textContent = 'Dar es Salaam, Tanzania'; fetchPrayerTimes(-6.7924, 39.2083); }
                );
            } else { locEl.textContent = 'Dar es Salaam, Tanzania'; fetchPrayerTimes(-6.7924, 39.2083); }
        }

        async function fetchPrayerTimes(lat, lng) {
            try {
                const date = new Date();
                const res = await fetch(`https://api.aladhan.com/v1/timings/${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}?latitude=${lat}&longitude=${lng}&method=2`);
                const data = await res.json();
                if (data.code === 200) {
                    const t = data.data.timings;
                    const d = data.data.date;
                    document.getElementById('fajrTime').textContent = t.Fajr;
                    document.getElementById('dhuhrTime').textContent = t.Dhuhr;
                    document.getElementById('asrTime').textContent = t.Asr;
                    document.getElementById('maghribTime').textContent = t.Maghrib;
                    document.getElementById('ishaTime').textContent = t.Isha;
                    document.getElementById('hijriDate').textContent = `${d.hijri.day} ${d.hijri.month.en} ${d.hijri.year} AH`;
                    updateNextPrayer(t);
                }
            } catch { showToast('Could not load prayer times.', 'error'); }
        }

        function updateNextPrayer(timings) {
            const now = new Date();
            const prayers = [
                {name:'Fajr',time:timings.Fajr},{name:'Dhuhr',time:timings.Dhuhr},
                {name:'Asr',time:timings.Asr},{name:'Maghrib',time:timings.Maghrib},{name:'Isha',time:timings.Isha}
            ];
            const nextNameEl = document.getElementById('nextPrayerName');
            const countdownEl = document.getElementById('nextPrayerCountdown');
            let next = null;
            for (const p of prayers) {
                const [h,m] = p.time.split(':').map(Number);
                const pt = new Date(now); pt.setHours(h,m,0,0);
                if (pt > now) { next = {...p, time: pt}; break; }
            }
            if (!next) { nextNameEl.textContent = 'Fajr (tomorrow)'; countdownEl.textContent = ''; return; }
            nextNameEl.textContent = next.name;
            document.querySelectorAll('.prayer-card').forEach(card => {
                card.classList.remove('active');
                if (card.querySelector('.prayer-name').textContent === next.name) card.classList.add('active');
            });
            function updateCountdown() {
                const diff = next.time - new Date();
                if (diff <= 0) { location.reload(); return; }
                countdownEl.textContent = `(${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m ${Math.floor((diff%60000)/1000)}s remaining)`;
            }
            updateCountdown();
            setInterval(updateCountdown, 1000);
        }

        detectLocation();
        setTimeout(() => {
            if (!userLat) {
                fetch('https://ipapi.co/json/').then(r=>r.json()).then(data => {
                    if (data.latitude) fetchPrayerTimes(data.latitude, data.longitude);
                }).catch(()=>{});
            }
        }, 3000);
    }

    function initQuranPage() {
        const surahList = document.getElementById('surahList');
        const quranReader = document.getElementById('quranReader');
        const quranTopbarTitle = document.getElementById('quranTopbarTitle');
        const surahSearch = document.getElementById('surahSearch');
        const sidebarToggle = document.getElementById('quranSidebarToggle');
        const sidebarClose = document.getElementById('quranSidebarClose');
        const sidebar = document.getElementById('quranSidebar');
        const randomBtn = document.getElementById('randomSurahBtn');

        let allSurahs = [];
        let currentSurah = null;

        sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
        sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));

        fetchAllSurahs();

        surahSearch.addEventListener('input', filterSurahs);
        randomBtn.addEventListener('click', () => {
            const rand = allSurahs[Math.floor(Math.random() * allSurahs.length)];
            loadSurah(rand.number);
        });

        async function fetchAllSurahs() {
            try {
                const res = await fetch('https://api.alquran.cloud/v1/surah');
                const data = await res.json();
                if (data.code === 200) {
                    allSurahs = data.data;
                    renderSurahList(allSurahs);
                } else {
                    surahList.innerHTML = '<div class="surah-loading">Failed to load surahs</div>';
                }
            } catch {
                surahList.innerHTML = '<div class="surah-loading">Check your connection</div>';
            }
        }

        function renderSurahList(surahs) {
            surahList.innerHTML = surahs.map(s => {
                const isActive = currentSurah === s.number;
                return `
                    <div class="surah-item ${isActive ? 'active' : ''}" data-number="${s.number}">
                        <div class="surah-number">${s.number}</div>
                        <div class="surah-info">
                            <div class="surah-name">${s.englishName}</div>
                            <div class="surah-meta">${s.revelationType} — ${s.numberOfAyahs} ayahs</div>
                        </div>
                        <div class="surah-ayahs-count"><span class="surah-name-ar">${getNameArabic(s.number)}</span></div>
                    </div>
                `;
            }).join('');

            surahList.querySelectorAll('.surah-item').forEach(item => {
                item.addEventListener('click', () => {
                    const num = parseInt(item.dataset.number);
                    loadSurah(num);
                    if (window.innerWidth <= 768) sidebar.classList.remove('open');
                });
            });
        }

        function filterSurahs() {
            const q = surahSearch.value.toLowerCase().trim();
            if (!q) {
                renderSurahList(allSurahs);
                return;
            }
            const filtered = allSurahs.filter(s =>
                s.englishName.toLowerCase().includes(q) ||
                s.englishNameTranslation.toLowerCase().includes(q) ||
                s.number.toString() === q
            );
            renderSurahList(filtered);
        }

        function getNameArabic(surahNumber) {
            const names = {
                1:'الفاتحة',2:'البقرة',3:'آل عمران',4:'النساء',5:'المائدة',6:'الأنعام',7:'الأعراف',8:'الأنفال',9:'التوبة',10:'يونس',
                11:'هود',12:'يوسف',13:'الرعد',14:'إبراهيم',15:'الحجر',16:'النحل',17:'الإسراء',18:'الكهف',19:'مريم',20:'طه',
                21:'الأنبياء',22:'الحج',23:'المؤمنون',24:'النور',25:'الفرقان',26:'الشعراء',27:'النمل',28:'القصص',29:'العنكبوت',30:'الروم',
                31:'لقمان',32:'السجدة',33:'الأحزاب',34:'سبأ',35:'فاطر',36:'يس',37:'الصافات',38:'ص',39:'الزمر',40:'غافر',
                41:'فصلت',42:'الشورى',43:'الزخرف',44:'الدخان',45:'الجاثية',46:'الأحقاف',47:'محمد',48:'الفتح',49:'الحجرات',50:'ق',
                51:'الذاريات',52:'الطور',53:'النجم',54:'القمر',55:'الرحمن',56:'الواقعة',57:'الحديد',58:'المجادلة',59:'الحشر',60:'الممتحنة',
                61:'الصف',62:'الجمعة',63:'المنافقون',64:'التغابن',65:'الطلاق',66:'التحريم',67:'الملك',68:'القلم',69:'الحاقة',70:'المعارج',
                71:'نوح',72:'الجن',73:'المزمل',74:'المدثر',75:'القيامة',76:'الإنسان',77:'المرسلات',78:'النبأ',79:'النازعات',80:'عبس',
                81:'التكوير',82:'الإنفطار',83:'المطففين',84:'الإنشقاق',85:'البروج',86:'الطارق',87:'الأعلى',88:'الغاشية',89:'الفجر',90:'البلد',
                91:'الشمس',92:'الليل',93:'الضحى',94:'الشرح',95:'التين',96:'العلق',97:'القدر',98:'البينة',99:'الزلزلة',100:'العاديات',
                101:'القارعة',102:'التكاثر',103:'العصر',104:'الهمزة',105:'الفيل',106:'قريش',107:'الماعون',108:'الكوثر',109:'الكافرون',110:'النصر',
                111:'المسد',112:'الإخلاص',113:'الفلق',114:'الناس'
            };
            return names[surahNumber] || '';
        }

        async function loadSurah(surahNumber) {
            currentSurah = surahNumber;
            renderSurahList(allSurahs);
            quranReader.innerHTML = '<div class="quran-welcome"><div class="welcome-icon"><i class="fas fa-spinner fa-spin"></i></div><h2>Loading...</h2></div>';

            try {
                const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/editions/quran-uthmani,en.asad`);
                const data = await res.json();
                if (data.code !== 200) throw Error();

                const arabic = data.data[0];
                const english = data.data[1];
                const surahInfo = arabic;

                quranTopbarTitle.textContent = `${surahInfo.number}. ${surahInfo.englishName}`;
                document.title = `${surahInfo.englishName} — Iqra AI Quran`;

                const reciters = [
                    { id: 'ar.alafasy', name: 'Mishary Alafasy' },
                    { id: 'ar.abdurrahmaansudais', name: 'Abdurrahman Sudais' },
                    { id: 'ar.saoodshuraym', name: 'Saood Shuraym' },
                    { id: 'ar.abdullahbasfar', name: 'Abdullah Basfar' },
                ];
                let currentReciter = reciters[0].id;

                function getAudioUrl(globalAyah) {
                    return `https://cdn.islamic.app/quran/audio/${currentReciter}/${globalAyah}.mp3`;
                }

                let html = `
                    <div class="surah-display">
                        <div class="surah-display-header">
                            <div class="surah-name-ar">${surahInfo.name}</div>
                            <div class="surah-name-en">${surahInfo.englishName}</div>
                            <div class="surah-info">${surahInfo.englishNameTranslation} — ${surahInfo.revelationType} — ${surahInfo.numberOfAyahs} Ayahs</div>
                        </div>
                        <div class="audio-controls">
                            <button class="audio-btn" id="playAllBtn"><i class="fas fa-play"></i></button>
                            <div class="audio-label">Play all</div>
                            <audio id="surahAudio" preload="none"></audio>
                            <input type="range" class="audio-progress" id="audioProgress" min="0" max="1" step="0.01" value="0">
                            <select id="reciterSelect" class="reciter-select">
                                ${reciters.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                            </select>
                        </div>
                        <div id="ayahsContainer">
                `;

                arabic.ayahs.forEach((a, i) => {
                    const en = english.ayahs[i];
                    html += `
                        <div class="ayah-block" data-ayah="${a.numberInSurah}" data-index="${i}">
                            <div class="ayah-number"><i class="fas fa-play ayah-play-icon"></i> ${a.numberInSurah}</div>
                            <div class="arabic">${a.text}</div>
                            <div class="translation">${en.text}</div>
                        </div>
                    `;
                });

                html += '</div></div>';
                quranReader.innerHTML = html;

                const audio = document.getElementById('surahAudio');
                const reciterSelect = document.getElementById('reciterSelect');

                reciterSelect.addEventListener('change', () => {
                    currentReciter = reciterSelect.value;
                    if (audio.src && !audio.paused) {
                        const idx = currentAyahIdx;
                        if (arabic.ayahs[idx]) {
                            audio.src = getAudioUrl(arabic.ayahs[idx].number);
                            audio.play();
                        }
                    }
                });

                let currentAyahIdx = 0;
                let isPlayingAll = false;
                const playAllBtn = document.getElementById('playAllBtn');
                const audioProgress = document.getElementById('audioProgress');
                const ayahBlocks = quranReader.querySelectorAll('.ayah-block');

                function highlightAyah(index) {
                    ayahBlocks.forEach(b => b.classList.remove('active'));
                    if (ayahBlocks[index]) {
                        ayahBlocks[index].classList.add('active');
                        ayahBlocks[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }

                function playAyah(index) {
                    if (index < 0 || index >= ayahBlocks.length) return;
                    currentAyahIdx = index;
                    const globalNum = arabic.ayahs[index].number;
                    const ayahInSurah = arabic.ayahs[index].numberInSurah;
                    const surahPadded = String(surahNumber).padStart(3, '0');
                    const ayahPadded = String(ayahInSurah).padStart(3, '0');

                    const urls = [
                        getAudioUrl(globalNum),
                        `https://download.quranicaudio.com/quran/abdullaah_basfar/${surahPadded}${ayahPadded}.mp3`
                    ];

                    let urlIdx = 0;
                    function tryPlay() {
                        if (urlIdx >= urls.length) {
                            if (isPlayingAll) {
                                isPlayingAll = false;
                                playAllBtn.innerHTML = '<i class="fas fa-play"></i>';
                            }
                            return;
                        }
                        audio.src = urls[urlIdx++];
                        audio.play().catch(tryPlay);
                    }
                    tryPlay();
                    highlightAyah(index);
                }

                ayahBlocks.forEach(block => {
                    block.addEventListener('click', () => {
                        const idx = parseInt(block.dataset.index);
                        if (currentAyahIdx === idx && !audio.paused) {
                            audio.pause();
                            return;
                        }
                        if (isPlayingAll) {
                            isPlayingAll = false;
                            playAllBtn.innerHTML = '<i class="fas fa-play"></i>';
                        }
                        playAyah(idx);
                    });
                });

                function playNextAyah() {
                    currentAyahIdx++;
                    if (currentAyahIdx >= ayahBlocks.length) {
                        isPlayingAll = false;
                        playAllBtn.innerHTML = '<i class="fas fa-play"></i>';
                        ayahBlocks.forEach(b => b.classList.remove('active'));
                        return;
                    }
                    playAyah(currentAyahIdx);
                }

                playAllBtn.addEventListener('click', () => {
                    if (isPlayingAll) {
                        audio.pause();
                        isPlayingAll = false;
                        playAllBtn.innerHTML = '<i class="fas fa-play"></i>';
                        return;
                    }
                    isPlayingAll = true;
                    playAllBtn.innerHTML = '<i class="fas fa-pause"></i>';
                    const playing = currentAyahIdx < ayahBlocks.length && !audio.paused;
                    if (playing) {
                        playAyah(currentAyahIdx);
                    } else {
                        currentAyahIdx = 0;
                        playAyah(0);
                    }
                });

                audio.addEventListener('ended', () => {
                    if (isPlayingAll) {
                        playNextAyah();
                    } else {
                        ayahBlocks.forEach(b => b.classList.remove('active'));
                    }
                });

                audio.addEventListener('timeupdate', () => {
                    if (audio.duration) {
                        audioProgress.value = audio.currentTime / audio.duration;
                    }
                });

                audioProgress.addEventListener('input', () => {
                    if (audio.duration) {
                        audio.currentTime = audioProgress.value * audio.duration;
                    }
                });

                if (window.innerWidth <= 768) sidebar.classList.remove('open');

            } catch {
                quranReader.innerHTML = `
                    <div class="no-surah-selected">
                        <i class="fas fa-exclamation-triangle" style="font-size:48px;color:var(--accent);margin-bottom:16px;"></i>
                        <p>Could not load surah. Check your connection.</p>
                        <button class="btn btn-primary" style="margin-top:16px;" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }
    }

    function initReminderPage() {
        const data = {
            ayahs: [
                {t:'"So verily, with the hardship, there is relief. Verily, with the hardship, there is relief."',r:'Quran 94:5-6'},
                {t:'"And whoever puts their trust in Allah, He is sufficient for them."',r:'Quran 65:3'},
                {t:'"My Lord, increase me in knowledge."',r:'Quran 20:114'},
                {t:'"Allah does not burden a soul more than it can bear."',r:'Quran 2:286'},
                {t:'"Indeed, Allah is with the patient."',r:'Quran 2:153'}
            ],
            hadiths: [
                {t:'"The best of you are those who are best to others."',r:'Ibn Majah'},
                {t:'"Whoever follows a path seeking knowledge, Allah will make easy for them a path to Paradise."',r:'Muslim'},
                {t:'"A good word is charity."',r:'Bukhari & Muslim'},
                {t:'"Make things easy, do not make things difficult."',r:'Bukhari'},
                {t:'"Whoever relieves a believer\'s distress, Allah will relieve their distress on Judgment Day."',r:'Muslim'}
            ],
            duas: [
                {t:'"Rabbi zidni ilma" — "My Lord, increase me in knowledge."',r:'Quran 20:114'},
                {t:'"Rabbana atina fid-dunya hasanah..." — "Our Lord, grant us good in this world and the Hereafter."',r:'Quran 2:201'},
                {t:'"Rabbi-shrah li sadri wa yassir li amri" — "My Lord, expand my chest and ease my task."',r:'Quran 20:25-26'},
                {t:'"Hasbunallahu wa nimal wakeel" — "Allah is sufficient for us."',r:'Quran 3:173'},
                {t:'"Bismillahi tawakkaltu alallah..." — "In the name of Allah, I trust in Allah."',r:'Abu Dawud'}
            ]
        };
        const idx = new Date().getDate() % data.ayahs.length;
        document.getElementById('ayahText').textContent = data.ayahs[idx].t;
        document.getElementById('ayahRef').textContent = data.ayahs[idx].r;
        document.getElementById('hadithText').textContent = data.hadiths[idx].t;
        document.getElementById('hadithRef').textContent = data.hadiths[idx].r;
        document.getElementById('duaText').textContent = data.duas[idx].t;
        document.getElementById('duaRef').textContent = data.duas[idx].r;
    }

    function initSupportPage() {
        const supportCards = document.querySelectorAll('.support-card');
        const responseEl = document.getElementById('supportResponse');
        const bodyEl = document.getElementById('supportBody');
        const closeBtn = document.getElementById('supportClose');

        const supportData = {
            stress: { title: 'Islamic Guidance on Stress', content: 'Assalaamu Alaikum dear student.\n\nAllah says: "Inna ma\'al usri yusra" — "Indeed, with hardship comes ease." (Quran 94:6)\n\nTips:\n1. Pray your 5 daily salah\n2. Make dhikr — hearts find rest in remembrance of Allah (Quran 13:28)\n3. Make dua\n4. Take breaks\n5. Talk to someone you trust\n\nAllah never gives a burden greater than you can bear (Quran 2:286).' },
            anxiety: { title: 'Islamic Guidance on Anxiety', content: 'Wa Alaikum Assalaam.\n\nAllah has given us tools to find peace:\n1. Salah — the coolness of the eyes\n2. Dua: "Hasbunallahu wa nimal wakeel"\n3. Trust in Allah — "Whoever relies upon Allah, He is sufficient for them." (Quran 65:3)\n4. Read Quran — it is healing for the heart\n\nYou are not alone. Allah is always with you.' },
            exams: { title: 'Dua & Tips for Exams', content: 'Bismillah.\n\nBefore studying: "Rabbi zidni ilma" (Quran 20:114)\nBefore exam: "Rabbi-shrah li sadri wa yassir li amri" (Quran 20:25-26)\nDuring exam: "Hasbunallahu wa nimal wakeel"\nWhen stuck: "La ilaha illa anta subhanaka inni kuntu minadh-dhalimeen" (Quran 21:87)\n\nTips:\n- Study consistently\n- Sleep well\n- Trust Allah, then do your best' },
            motivation: { title: 'Islamic Motivation', content: 'Assalaamu Alaikum!\n\nThe Prophet ﷺ said: "The best of people are those who bring the most benefit to others."\n\nEvery letter of the Quran = 10 rewards. Seeking knowledge is worship. Your efforts are seen by Allah.\n\n"And say: Work, for Allah will see your work." (Quran 9:105)\n\nKeep going! Jannah is worth every effort.' },
            discipline: { title: 'Building Discipline in Islam', content: 'Bismillah.\n\n1. Start with salah — pray on time\n2. Make a schedule\n3. Wake up for Fajr\n4. Fast Mondays and Thursdays\n5. "Indeed, prayer prohibits immorality." (Quran 29:45)\n\nStart small. Consistency beats intensity.' },
            depression: { title: 'Islamic Support for Depression', content: 'Wa Alaikum Assalaam.\n\n"When My servants ask you concerning Me, indeed I am near." (Quran 2:186)\n\n1. Talk to a trusted adult or counselor\n2. Never give up on Allah\'s mercy (Quran 39:53)\n3. Keep praying\n4. Read Quran\n5. Reach out to friends\n\nYou are valuable and loved by Allah.' },
            anger: { title: 'Controlling Anger in Islam', content: 'The Prophet ﷺ said: "The strong person controls themselves at times of anger." (Bukhari)\n\nWhen angry:\n1. Say "A\'udhu billahi minash shaytanir rajim"\n2. If standing, sit down. If sitting, lie down.\n3. Make wudu\n4. Stay silent\n5. "Those who control their anger — Allah loves the doers of good." (Quran 3:134)' },
            relationships: { title: 'Islamic Guidance on Relationships', content: 'Bismillah.\n\nBuild relationships on:\n1. Respect\n2. Good character\n3. Modesty\n4. Choose friends who bring you closer to Allah\n\nYour relationship with Allah is the foundation of all others.' },
            family: { title: 'Islamic Advice on Family', content: 'Assalaamu Alaikum.\n\n"And We have enjoined upon people goodness to their parents." (Quran 29:8)\n\n1. Be kind and patient\n2. Help at home\n3. Speak respectfully\n4. Make dua for your family\n5. "Your Lord has decreed that you worship none but Him and be good to your parents." (Quran 17:23)' }
        };

        supportCards.forEach(card => {
            card.addEventListener('click', () => {
                const topic = card.dataset.topic;
                const data = supportData[topic];
                if (!data) return;
                bodyEl.innerHTML = `<h4 style="color: var(--primary); margin-bottom: 12px;">${data.title}</h4><p>${data.content.replace(/\n/g, '</p><p>')}</p>`;
                responseEl.style.display = 'block';
                responseEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        closeBtn.addEventListener('click', () => { responseEl.style.display = 'none'; });
    }
});
