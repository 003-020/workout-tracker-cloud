/* ========================================
   Workout Tracker - Application Logic (FastAPI Backend)
   ======================================== */

// ============ API Configuration ============
// API_BASE_URL is defined in config.js - load that file before this one
// ローカル開発時は config.js を編集してください
let accessToken = localStorage.getItem('accessToken');

// ============ API Client ============
const ApiClient = {
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate', // Prevent caching
            'Pragma': 'no-cache',
            ...options.headers
        };

        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
            console.log('Using token:', accessToken.substring(0, 20) + '...');
        } else {
            console.log('No token available');
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });

            if (response.status === 401) {
                // Token expired or invalid
                this.logout();
                throw new Error('認証が切れました。再ログインしてください。');
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'エラーが発生しました');
            }

            // Handle empty responses (204 No Content, etc.)
            const text = await response.text();
            return text ? JSON.parse(text) : null;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    setToken(token) {
        accessToken = token;
        localStorage.setItem('accessToken', token);
    },

    logout() {
        accessToken = null;
        localStorage.removeItem('accessToken');
    }
};

// ============ Category Manager ============
const CategoryManager = {
    cache: [],

    async getAll() {
        try {
            this.cache = await ApiClient.get('/categories');
            return this.cache;
        } catch (error) {
            console.error('Error getting categories:', error);
            return [];
        }
    },

    async add(name) {
        try {
            const result = await ApiClient.post('/categories', { name });
            this.cache.push(result);
            return result;
        } catch (error) {
            console.error('Error adding category:', error);
            return null;
        }
    },

    async delete(id) {
        try {
            await ApiClient.delete(`/categories/${id}`);
            this.cache = this.cache.filter(c => c.id !== id);
            // Update exercises that belonged to this category
            ExerciseManager.cache.forEach(ex => {
                if (ex.category_id === id) {
                    ex.category_id = null;
                }
            });
            return true;
        } catch (error) {
            console.error('Error deleting category:', error);
            return false;
        }
    },

    getById(id) {
        return this.cache.find(c => c.id === id);
    }
};

// ============ Exercise Manager ============
const ExerciseManager = {
    cache: [],

    async getAll() {
        try {
            this.cache = await ApiClient.get('/exercises');
            return this.cache;
        } catch (error) {
            console.error('Error getting exercises:', error);
            return [];
        }
    },

    async add(name, categoryId = null) {
        try {
            const result = await ApiClient.post('/exercises', {
                name,
                category_id: categoryId
            });
            this.cache.push(result);
            return result;
        } catch (error) {
            console.error('Error adding exercise:', error);
            return null;
        }
    },

    async delete(id) {
        try {
            await ApiClient.delete(`/exercises/${id}`);
            this.cache = this.cache.filter(e => e.id !== id);
            return true;
        } catch (error) {
            console.error('Error deleting exercise:', error);
            return false;
        }
    },

    async updateCategory(exerciseId, categoryId) {
        try {
            const result = await ApiClient.put(`/exercises/${exerciseId}`, {
                category_id: categoryId
            });
            const ex = this.cache.find(e => e.id === exerciseId);
            if (ex) ex.category_id = categoryId;
            return true;
        } catch (error) {
            console.error('Error updating exercise:', error);
            return false;
        }
    },

    getByCategory(categoryId) {
        return this.cache.filter(e => e.category_id === categoryId);
    },

    getById(id) {
        return this.cache.find(e => e.id === id);
    }
};

// ============ Record Manager ============
const RecordManager = {
    cache: [],

    async getAll() {
        try {
            this.cache = await ApiClient.get('/records');
            return this.cache;
        } catch (error) {
            console.error('Error getting records:', error);
            return [];
        }
    },

    async add(date, exerciseId, weight, reps, sets) {
        try {
            const data = {
                date,
                exercise_id: exerciseId,
                weight: parseFloat(weight) || 0,
                reps: parseInt(reps) || 0,
                sets: parseInt(sets) || 1
            };
            const result = await ApiClient.post('/records', data);
            this.cache.push(result);
            return result;
        } catch (error) {
            console.error('Error adding record:', error);
            return null;
        }
    },

    async delete(id) {
        try {
            await ApiClient.delete(`/records/${id}`);
            this.cache = this.cache.filter(r => r.id !== id);
            return true;
        } catch (error) {
            console.error('Error deleting record:', error);
            return false;
        }
    },

    getByDate(date) {
        return this.cache.filter(r => r.date === date);
    },

    getByExercise(exerciseId) {
        return this.cache.filter(r => r.exercise_id === exerciseId);
    },

    async getStats() {
        try {
            return await ApiClient.get('/stats');
        } catch (error) {
            console.error('Error getting stats:', error);
            return { total_workouts: 0, total_volume: 0, max_weight: 0 };
        }
    }
};

// ============ Auth Manager ============
const AuthManager = {
    async login(email, password) {
        try {
            // OAuth2PasswordRequestForm expects form data
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.detail || 'ログインに失敗しました' };
            }

            const data = await response.json();
            ApiClient.setToken(data.access_token);
            return { success: true };
        } catch (error) {
            return { success: false, error: 'サーバーに接続できません' };
        }
    },

    async register(email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.detail || '登録に失敗しました' };
            }

            // Auto login after registration
            return await this.login(email, password);
        } catch (error) {
            return { success: false, error: 'サーバーに接続できません' };
        }
    },

    async logout() {
        ApiClient.logout();
        return { success: true };
    },

    async checkAuth() {
        if (!accessToken) return false;
        try {
            await ApiClient.get('/auth/me');
            return true;
        } catch {
            return false;
        }
    }
};

// ============ UI Controllers ============
const App = {
    selectedExerciseId: null,
    selectedCategoryId: null,
    chart: null,
    currentUserEmail: null,

    async init() {
        // Check if already logged in
        if (await AuthManager.checkAuth()) {
            try {
                const user = await ApiClient.get('/auth/me');
                this.currentUserEmail = user.email;
                await this.onUserLogin();
            } catch {
                this.showAuthScreen();
            }
        } else {
            this.showAuthScreen();
        }

        this.bindAuthEvents();
    },

    bindAuthEvents() {
        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const authType = e.target.dataset.auth;
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.auth === authType));
                document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === `${authType}-form`));
                document.getElementById('auth-error').textContent = '';
            });
        });

        // Login form
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            document.getElementById('auth-error').textContent = '';
            const result = await AuthManager.login(email, password);

            if (result.success) {
                this.currentUserEmail = email;
                await this.onUserLogin();
            } else {
                document.getElementById('auth-error').textContent = result.error;
            }
        });

        // Register form
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-password-confirm').value;

            if (password !== confirm) {
                document.getElementById('auth-error').textContent = 'パスワードが一致しません';
                return;
            }

            document.getElementById('auth-error').textContent = '';
            const result = await AuthManager.register(email, password);

            if (result.success) {
                this.currentUserEmail = email;
                await this.onUserLogin();
            } else {
                document.getElementById('auth-error').textContent = result.error;
            }
        });

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', async () => {
            await AuthManager.logout();
            this.showAuthScreen();
        });
    },

    async onUserLogin() {
        this.showMainApp();
        this.updateSyncStatus('syncing', '同期中...');

        // Load all data
        await CategoryManager.getAll();
        await ExerciseManager.getAll();
        await RecordManager.getAll();

        // Update UI
        document.getElementById('user-email').textContent = this.currentUserEmail;
        this.bindMainEvents();
        this.setTodayDate();
        this.renderAll();

        this.updateSyncStatus('synced', '同期完了');

        // DIAGNOSTIC ALERT for User
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        alert(`【診断情報】\nこれをAIに伝えてください：\nUser: ${this.currentUserEmail}\nToken: ${token ? 'OK' : 'MISSING'}\nEx Count: ${ExerciseManager.cache.length}\nAPI: ${API_BASE_URL.includes('railway') ? 'Cloud' : 'Local'}`);
    },

    showAuthScreen() {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
        // Hide setup notice since we're using our own backend
        const setupNotice = document.getElementById('setup-notice');
        if (setupNotice) setupNotice.style.display = 'none';
    },

    showMainApp() {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
    },

    updateSyncStatus(status, text) {
        const el = document.getElementById('sync-status');
        el.className = 'sync-status ' + (status === 'syncing' ? 'syncing' : status === 'error' ? 'error' : '');
        el.querySelector('.sync-text').textContent = text;
        el.querySelector('.sync-icon').textContent = status === 'synced' ? '✓' : status === 'error' ? '✗' : '☁️';
    },

    setTodayDate() {
        const dateInput = document.getElementById('workout-date');
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    },

    bindMainEvents() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Selection tabs
        document.querySelectorAll('.selection-tab').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSelectionMode(e.target.dataset.selection));
        });

        // Date change
        document.getElementById('workout-date').addEventListener('change', () => this.renderTodayRecords());

        // Category selection
        document.getElementById('category-select').addEventListener('change', (e) => {
            this.renderCategoryExercises(e.target.value);
        });

        // Add record button
        document.getElementById('add-record-btn').addEventListener('click', () => this.addRecord());

        // Add category
        document.getElementById('add-category-btn').addEventListener('click', () => this.addCategory());

        // Add exercise
        document.getElementById('add-exercise-btn').addEventListener('click', () => this.addExercise());

        // Stats exercise select
        document.getElementById('stats-exercise-select').addEventListener('change', (e) => {
            this.renderChart(e.target.value);
        });

        // Enter key support
        document.getElementById('new-category-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addCategory();
        });
        document.getElementById('new-exercise-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addExercise();
        });

        // Close category detail
        document.getElementById('close-category-detail').addEventListener('click', () => {
            this.closeCategoryDetail();
        });
    },

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        if (tabName === 'stats') {
            this.renderStats();
        }
    },

    switchSelectionMode(mode) {
        document.querySelectorAll('.selection-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.selection === mode);
        });
        document.getElementById('all-exercises-list').classList.toggle('active', mode === 'all');
        document.getElementById('category-selection').classList.toggle('active', mode === 'category');
    },

    selectExercise(exerciseId) {
        this.selectedExerciseId = exerciseId;
        const exercise = ExerciseManager.getById(exerciseId);

        document.querySelectorAll('.exercise-chip').forEach(chip => {
            chip.classList.toggle('selected', chip.dataset.id == exerciseId);
        });

        const form = document.getElementById('recording-form');
        form.style.display = 'block';
        document.getElementById('selected-exercise-name').textContent = exercise ? exercise.name : '';

        // Initialize rows (default 3 empty rows)
        this.renderSetRows(3);

        // Focus first weight input
        const firstRow = document.querySelector('.set-row');
        if (firstRow) {
            firstRow.querySelector('.weight-input').focus();
        }
    },

    async addRecord() {
        if (!this.selectedExerciseId) {
            alert('種目を選択してください');
            return;
        }

        const date = document.getElementById('workout-date').value;
        const rows = document.querySelectorAll('.set-row');
        const records = [];

        // Collect data from each row
        rows.forEach((row, index) => {
            const weight = row.querySelector('.weight-input').value;
            const reps = row.querySelector('.reps-input').value;
            const memo = row.querySelector('.memo-input').value;

            if (reps && parseInt(reps) > 0) {
                records.push({
                    date: date,
                    exercise_id: this.selectedExerciseId,
                    weight: parseFloat(weight) || 0,
                    reps: parseInt(reps),
                    sets: 1, // Store as individual sets
                    memo: memo
                });
            }
        });

        if (records.length === 0) {
            alert('少なくとも1つのセット（回数）を入力してください');
            return;
        }

        this.updateSyncStatus('syncing', '保存中...');
        try {
            // Correctly use ApiClient.post so records are sent as body
            const result = await ApiClient.post('/records', records);

            // Update cache with new records
            if (Array.isArray(result)) {
                result.forEach(record => RecordManager.cache.push(record));
            } else if (result) {
                RecordManager.cache.push(result);
            }

            this.selectedExerciseId = null;
            document.getElementById('recording-form').style.display = 'none';
            document.querySelectorAll('.exercise-chip').forEach(chip => chip.classList.remove('selected'));

            this.renderTodayRecords();
            this.updateSyncStatus('synced', '保存完了');
        } catch (error) {
            console.error(error);
            this.updateSyncStatus('error', '保存失敗');
            alert(`保存に失敗しました: ${error.detail || error.message || JSON.stringify(error)}`);
        }
    },

    // --- New Helper Methods for Advanced Recording ---

    currentSets: [], // Store current row data temporarily if needed, or just read from DOM

    renderSetRows(count = 3) {
        const container = document.getElementById('set-rows-container');
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            this.addSetRow();
        }
    },

    addSetRow(weight = '', reps = '', memo = '') {
        const container = document.getElementById('set-rows-container');
        const index = container.children.length + 1;

        // Use previous weight if available and new row is empty
        if (weight === '' && index > 1) {
            const prevRow = container.lastElementChild;
            const prevWeight = prevRow.querySelector('.weight-input').value;
            if (prevWeight) weight = prevWeight;
        }

        const rowHtml = `
            <div class="set-row">
                <div class="set-row-header">
                    <div class="set-number-badge">${index}</div>
                    <button class="set-delete-btn" onclick="App.removeSetRow(this)">×</button>
                </div>
                <div class="set-inputs-row">
                    <div class="set-input-group">
                        <input type="number" class="weight-input" value="${weight}" step="0.5" placeholder="0">
                        <span class="set-unit">kg</span>
                    </div>
                    <div class="set-input-group">
                        <input type="number" class="reps-input" value="${reps}" min="0" placeholder="0">
                        <span class="set-unit">reps</span>
                    </div>
                </div>
                <div class="set-memo-row">
                    <input type="text" class="memo-input" value="${memo}" placeholder="メモ (任意)">
                </div>
            </div>
        `;

        // Append HTML
        container.insertAdjacentHTML('beforeend', rowHtml);

        // Focus the reps input if it's a new empty row, or weight if totally new
        const newRow = container.lastElementChild;
        if (index > 1) {
            newRow.querySelector('.reps-input').focus();
        }
    },

    removeSetRow(btn) {
        const container = document.getElementById('set-rows-container');
        if (container.children.length <= 1) {
            // Check if we should just clear inputs instead of removing the only row?
            // Actually, let's allow removing but maybe immediately add one back or just alert?
            // Let's just reset values if it's the last one
            const row = btn.closest('.set-row');
            row.querySelector('.weight-input').value = '';
            row.querySelector('.reps-input').value = '';
            row.querySelector('.memo-input').value = '';
            return;
        }

        btn.closest('.set-row').remove();
        this.renumberRows();
    },

    renumberRows() {
        const rows = document.querySelectorAll('.set-row');
        rows.forEach((row, index) => {
            row.querySelector('.set-number-badge').textContent = index + 1;
        });
    },

    async addCategory() {
        const input = document.getElementById('new-category-name');
        const name = input.value.trim();

        if (!name) {
            alert('カテゴリ名を入力してください');
            return;
        }

        this.updateSyncStatus('syncing', '保存中...');
        await CategoryManager.add(name);
        input.value = '';
        this.renderAll();
        this.updateSyncStatus('synced', '保存完了');
    },

    async addExercise() {
        const nameInput = document.getElementById('new-exercise-name');
        const name = nameInput.value.trim();

        if (!name) {
            alert('種目名を入力してください');
            return;
        }

        this.updateSyncStatus('syncing', '保存中...');
        await ExerciseManager.add(name, null);
        nameInput.value = '';
        this.renderAll();

        if (this.selectedCategoryId) {
            this.renderCategoryDetail(this.selectedCategoryId);
        }
        this.updateSyncStatus('synced', '保存完了');
    },

    async deleteCategory(id, event) {
        if (event) event.stopPropagation();
        if (confirm('このカテゴリを削除しますか？')) {
            this.updateSyncStatus('syncing', '削除中...');
            await CategoryManager.delete(id);
            if (this.selectedCategoryId === id) {
                this.closeCategoryDetail();
            }
            this.renderAll();
            this.updateSyncStatus('synced', '削除完了');
        }
    },

    async deleteExercise(id) {
        if (confirm('この種目を削除しますか？')) {
            this.updateSyncStatus('syncing', '削除中...');
            await ExerciseManager.delete(id);
            this.renderAll();
            if (this.selectedCategoryId) {
                this.renderCategoryDetail(this.selectedCategoryId);
            }
            this.updateSyncStatus('synced', '削除完了');
        }
    },

    async deleteRecord(id) {
        this.updateSyncStatus('syncing', '削除中...');
        await RecordManager.delete(id);
        this.renderTodayRecords();
        this.updateSyncStatus('synced', '削除完了');
    },

    // Category Detail Functions
    openCategoryDetail(categoryId) {
        this.selectedCategoryId = categoryId;
        document.getElementById('category-detail-card').style.display = 'block';
        this.renderCategoryDetail(categoryId);

        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id == categoryId);
        });
    },

    closeCategoryDetail() {
        this.selectedCategoryId = null;
        document.getElementById('category-detail-card').style.display = 'none';
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
    },

    renderCategoryDetail(categoryId) {
        const category = CategoryManager.getById(categoryId);
        if (!category) return;

        document.getElementById('category-detail-name').textContent = `📁 ${category.name}`;

        const inCategory = ExerciseManager.getByCategory(categoryId);
        const categoryExercisesContainer = document.getElementById('category-exercises');

        if (inCategory.length === 0) {
            categoryExercisesContainer.innerHTML = '<span class="empty-message" style="padding: 0;">種目がありません</span>';
        } else {
            categoryExercisesContainer.innerHTML = inCategory.map(ex => `
                <button class="chip in-category" onclick="App.removeExerciseFromCategory(${ex.id})" title="クリックで削除">
                    ${ex.name}
                    <span class="chip-icon">✕</span>
                </button>
            `).join('');
        }

        const available = ExerciseManager.cache.filter(e => e.category_id !== categoryId);
        const availableContainer = document.getElementById('available-exercises');

        if (available.length === 0) {
            availableContainer.innerHTML = '<span class="empty-message" style="padding: 0;">追加できる種目がありません</span>';
        } else {
            availableContainer.innerHTML = available.map(ex => `
                <button class="chip available" onclick="App.addExerciseToCategory(${ex.id}, ${categoryId})" title="クリックで追加">
                    ${ex.name}
                    <span class="chip-icon">+</span>
                </button>
            `).join('');
        }
    },

    async addExerciseToCategory(exerciseId, categoryId) {
        this.updateSyncStatus('syncing', '更新中...');
        await ExerciseManager.updateCategory(exerciseId, categoryId);
        this.renderCategoryDetail(categoryId);
        this.renderAll();
        this.updateSyncStatus('synced', '更新完了');
    },

    async removeExerciseFromCategory(exerciseId) {
        this.updateSyncStatus('syncing', '更新中...');
        await ExerciseManager.updateCategory(exerciseId, null);
        if (this.selectedCategoryId) {
            this.renderCategoryDetail(this.selectedCategoryId);
        }
        this.renderAll();
        this.updateSyncStatus('synced', '更新完了');
    },

    // ============ Render Functions ============
    renderAll() {
        this.renderAllExercises();
        this.renderCategorySelect();
        this.renderCategoriesList();
        this.renderExercisesList();
        this.renderTodayRecords();
        this.renderStatsExerciseSelect();
    },

    renderAllExercises() {
        const container = document.getElementById('all-exercises-list');
        const exercises = ExerciseManager.cache;

        if (exercises.length === 0) {
            container.innerHTML = '<p class="empty-message">種目を追加してください</p>';
            return;
        }

        container.innerHTML = exercises.map(ex => `
            <button class="exercise-chip" data-id="${ex.id}" onclick="App.selectExercise(${ex.id})">
                ${ex.name}
            </button>
        `).join('');
    },

    renderCategorySelect() {
        const select = document.getElementById('category-select');
        const categories = CategoryManager.cache;

        select.innerHTML = `<option value="">カテゴリを選択...</option>` +
            categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    },

    renderCategoryExercises(categoryId) {
        const container = document.getElementById('category-exercises-list');

        if (!categoryId) {
            container.innerHTML = '<p class="empty-message">カテゴリを選択してください</p>';
            return;
        }

        const exercises = ExerciseManager.getByCategory(parseInt(categoryId));

        if (exercises.length === 0) {
            container.innerHTML = '<p class="empty-message">このカテゴリに種目がありません</p>';
            return;
        }

        container.innerHTML = exercises.map(ex => `
            <button class="exercise-chip" data-id="${ex.id}" onclick="App.selectExercise(${ex.id})">
                ${ex.name}
            </button>
        `).join('');
    },

    renderCategoriesList() {
        const container = document.getElementById('categories-list');
        const categories = CategoryManager.cache;

        if (categories.length === 0) {
            container.innerHTML = '<p class="empty-message">カテゴリがありません</p>';
            return;
        }

        container.innerHTML = categories.map(cat => {
            const exerciseCount = ExerciseManager.getByCategory(cat.id).length;
            const isActive = this.selectedCategoryId === cat.id ? 'active' : '';
            return `
                <div class="category-item clickable ${isActive}" data-id="${cat.id}" onclick="App.openCategoryDetail(${cat.id})">
                    <span class="category-name">${cat.name}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span class="category-badge">${exerciseCount}種目</span>
                        <button class="delete-btn" onclick="App.deleteCategory(${cat.id}, event)">削除</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderExercisesList() {
        const container = document.getElementById('exercises-list');
        const exercises = ExerciseManager.cache;
        const categories = CategoryManager.cache;

        if (exercises.length === 0) {
            container.innerHTML = '<p class="empty-message">種目がありません</p>';
            return;
        }

        container.innerHTML = exercises.map(ex => {
            const category = categories.find(c => c.id === ex.category_id);
            return `
                <div class="exercise-item">
                    <span class="exercise-name">${ex.name}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${category ? `<span class="category-badge">${category.name}</span>` : ''}
                        <button class="delete-btn" onclick="App.deleteExercise(${ex.id})">削除</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderTodayRecords() {
        const container = document.getElementById('today-records');
        const date = document.getElementById('workout-date').value;
        const records = RecordManager.getByDate(date);

        if (records.length === 0) {
            container.innerHTML = '<p class="empty-message">まだ記録がありません</p>';
            return;
        }

        container.innerHTML = records.map(rec => `
            <div class="record-item">
                <div class="record-info">
                    <span class="record-exercise">${rec.exercise_name}</span>
                    <span class="record-details">
                        ${rec.weight}kg × ${rec.reps}reps
                        ${rec.memo ? `<br><small style="color:var(--text-muted)">📝 ${rec.memo}</small>` : ''}
                    </span>
                </div>
                <button class="delete-btn" onclick="App.deleteRecord(${rec.id})">削除</button>
            </div>
        `).join('');
    },

    renderStatsExerciseSelect() {
        const select = document.getElementById('stats-exercise-select');
        const exercises = ExerciseManager.cache;

        select.innerHTML = '<option value="">種目を選択...</option>' +
            exercises.map(ex => `<option value="${ex.id}">${ex.name}</option>`).join('');
    },

    async renderStats() {
        const stats = await RecordManager.getStats();
        document.getElementById('total-workouts').textContent = stats.total_workouts;
        document.getElementById('total-volume').textContent = stats.total_volume.toLocaleString();
        document.getElementById('max-weight').textContent = stats.max_weight;
    },

    renderChart(exerciseId) {
        const ctx = document.getElementById('progress-chart').getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        if (!exerciseId) {
            return;
        }

        const records = RecordManager.getByExercise(parseInt(exerciseId));

        if (records.length === 0) {
            return;
        }

        records.sort((a, b) => new Date(a.date) - new Date(b.date));

        const dateMap = {};
        records.forEach(r => {
            if (!dateMap[r.date] || dateMap[r.date].weight < r.weight) {
                dateMap[r.date] = r;
            }
        });

        const sortedDates = Object.keys(dateMap).sort();
        const labels = sortedDates.map(d => {
            const date = new Date(d);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });
        const weights = sortedDates.map(d => dateMap[d].weight);
        const volumes = sortedDates.map(d => dateMap[d].volume);

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '最大重量 (kg)',
                        data: weights,
                        borderColor: '#6c5ce7',
                        backgroundColor: 'rgba(108, 92, 231, 0.1)',
                        tension: 0.3,
                        fill: true,
                        yAxisID: 'y'
                    },
                    {
                        label: 'ボリューム (kg)',
                        data: volumes,
                        borderColor: '#00d9a6',
                        backgroundColor: 'rgba(0, 217, 166, 0.1)',
                        tension: 0.3,
                        fill: true,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#b4b4c4'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#6c6c8a' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '重量 (kg)',
                            color: '#b4b4c4'
                        },
                        ticks: { color: '#6c6c8a' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'ボリューム (kg)',
                            color: '#b4b4c4'
                        },
                        ticks: { color: '#6c6c8a' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }
};

// Initialize app when DOM is ready
// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();

    // Add event listener for new set button
    const addSetBtn = document.getElementById('add-set-btn');
    if (addSetBtn) {
        addSetBtn.addEventListener('click', () => App.addSetRow());
    }
});
