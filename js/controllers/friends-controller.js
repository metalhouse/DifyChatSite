/**
 * 好友功能控制器
 * 管理好友列表、好友请求、用户搜索、好友聊天等功能
 */

class FriendsController {
    constructor() {
        this.friends = [];
        this.receivedRequests = [];
        this.sentRequests = [];
        this.searchResults = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.isLoading = false;

        // DOM元素
        this.elements = {
            // 好友列表
            friendsList: document.getElementById('friendsList'),
            
            // 好友请求
            receivedRequestsList: document.getElementById('receivedRequestsList'),
            sentRequestsList: document.getElementById('sentRequestsList'),
            requestsBadge: document.getElementById('requestsBadge'),
            friendRequestsBadge: document.getElementById('friendRequestsBadge'),
            requestSenderName: document.getElementById('requestSenderName'),
            acceptRequestBtn: document.getElementById('acceptRequestBtn'),
            declineRequestBtn: document.getElementById('declineRequestBtn'),
            
            // 搜索
            friendSearchInput: document.getElementById('friendSearchInput'),
            searchFriendsBtn: document.getElementById('searchFriendsBtn'),
            searchResults: document.getElementById('searchResults'),
            
            // 标签
            friendsTab: document.getElementById('friends-tab'),
            requestsTab: document.getElementById('friend-requests-tab')
        };

        // 调试：检查所有DOM元素是否存在
        // console.log('🔍 DOM元素检查:', {
        //     sentRequestsList: !!this.elements.sentRequestsList,
        //     receivedRequestsList: !!this.elements.receivedRequestsList
        // });

        // 如果关键元素不存在，等待DOM加载
        if (!this.elements.sentRequestsList) {
            console.warn('⚠️ sentRequestsList元素不存在，尝试延迟查找...');
            setTimeout(() => {
                this.elements.sentRequestsList = document.getElementById('sentRequestsList');
                console.log('🔄 延迟查找sentRequestsList结果:', !!this.elements.sentRequestsList);
                if (this.elements.sentRequestsList) {
                    console.log('✅ 找到sentRequestsList元素:', this.elements.sentRequestsList);
                } else {
                    console.error('❌ 仍然找不到sentRequestsList元素');
                    // 列出所有ID包含request的元素
                    const allElements = document.querySelectorAll('[id*="request"]');
                    console.log('📋 所有包含"request"的元素ID:', Array.from(allElements).map(el => el.id));
                }
            }, 1000);
        }

        this.bindEvents();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 搜索按钮点击
        this.elements.searchFriendsBtn?.addEventListener('click', () => {
            this.handleSearch();
        });

        // 搜索框回车
        this.elements.friendSearchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        // 搜索框输入时实时搜索
        this.elements.friendSearchInput?.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length >= 2) {
                // 防抖搜索
                clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => {
                    this.handleSearch();
                }, 500);
            } else if (query.length === 0) {
                this.clearSearchResults();
            }
        });

        // 标签切换事件
        this.elements.friendsTab?.addEventListener('shown.bs.tab', () => {
            this.loadFriends();
        });

        this.elements.requestsTab?.addEventListener('shown.bs.tab', () => {
            this.loadRequests();
        });

        // 注意：现在使用简单标签系统，不再需要Bootstrap标签事件
    }

    /**
     * 初始化好友功能
     */
    async initialize() {
        // console.log('🤝 初始化好友功能控制器');
        
        // 检查用户登录状态和Token可用性（现在是异步的）
        if (!await this.checkUserAuthentication()) {
            console.warn('⚠️ 用户未登录或Token不可用，延迟初始化');
            return;
        }
        
        try {
            // 加载好友列表
            await this.loadFriends();
            
            // 加载好友请求
            await this.loadRequests();
            
            // console.log('✅ 好友功能初始化完成');
        } catch (error) {
            console.error('❌ 好友功能初始化失败:', error);
            
            // 如果是认证错误，提示用户重新登录
            if (error.message.includes('认证失败') || error.message.includes('401')) {
                this.showToast('登录状态过期，请重新登录', 'warning');
            } else {
                this.showToast('好友功能加载失败，请刷新页面重试', 'error');
            }
        }
    }
    
    /**
     * 检查用户认证状态 - 改进版，参考chatroom功能
     */
    async checkUserAuthentication() {
        try {
            // 1. 使用与好友API相同的Token获取逻辑
            let accessToken = localStorage.getItem('access_token');
            
            // 如果没有access_token，尝试其他可能的键名（与FriendsApi保持一致）
            if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
                const fallbackKeys = [
                    'dify_access_token',  // 这是系统实际使用的Token键名
                    'jwt_token', 
                    'auth_token',
                    'user_token'
                ];
                
                for (const key of fallbackKeys) {
                    const fallbackToken = localStorage.getItem(key);
                    if (fallbackToken && fallbackToken !== 'null' && fallbackToken !== 'undefined') {
                        accessToken = fallbackToken;
                        console.log(`✅ 找到Token，使用键名: ${key}`);
                        break;
                    }
                }
            } else {
                console.log('✅ 找到access_token');
            }
            
            if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
                console.warn('❌ 未找到有效的Token');
                console.warn('📋 localStorage中的Token相关键:', 
                    Object.keys(localStorage).filter(key => 
                        key.toLowerCase().includes('token') || 
                        key.toLowerCase().includes('access')
                    ).map(key => ({ 
                        key, 
                        hasValue: !!localStorage.getItem(key) && localStorage.getItem(key) !== 'null'
                    }))
                );
                return false;
            }

            // 2. 验证Token有效性并获取当前用户信息
            // 参考chatroom.html的loadUserProfile函数
            if (typeof window.apiClient !== 'undefined') {
                try {
                    console.log('📡 验证用户Token并获取用户信息...');
                    const response = await window.apiClient.get('/users/profile');
                    if (response.success && response.data) {
                        // 设置当前用户信息，供好友API使用
                        window.currentUser = response.data;
                        console.log('✅ 用户认证成功:', window.currentUser);
                        return true;
                    } else {
                        console.warn('⚠️ Token验证失败:', response);
                        return false;
                    }
                } catch (error) {
                    console.error('❌ Token验证请求失败:', error);
                    return false;
                }
            }

            // 3. 备选方案：如果apiClient不可用，只检查Token存在性
            console.log('⚠️ apiClient不可用，只验证Token存在性');
            return true;
            
        } catch (error) {
            console.error('❌ 用户认证检查失败:', error);
            return false;
        }
    }

    // ========================================
    // 🔍 用户搜索功能
    // ========================================

    /**
     * 处理搜索
     */
    async handleSearch() {
        const query = this.elements.friendSearchInput?.value?.trim();
        if (!query || query.length < 2) {
            this.showToast('请输入至少2个字符进行搜索', 'warning');
            return;
        }

        this.searchQuery = query;
        await this.searchUsers();
    }

    /**
     * 搜索用户
     */
    async searchUsers() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showSearchLoading();

        try {
            const response = await window.FriendsApi.searchUsers(this.searchQuery);
            
            // 检查响应数据结构
            console.log('📊 搜索用户API原始响应:', response);
            
            // 适配不同的响应结构 - 用户数据可能在 users 或 data 字段中
            if (response.data && Array.isArray(response.data.users)) {
                this.searchResults = response.data.users;
            } else if (response.data && Array.isArray(response.data)) {
                this.searchResults = response.data;
            } else if (Array.isArray(response)) {
                this.searchResults = response;
            } else {
                console.warn('⚠️ 搜索结果数据结构异常:', response);
                this.searchResults = [];
            }
            
            console.log('✅ 解析后的搜索结果:', this.searchResults);
            this.renderSearchResults();
            
        } catch (error) {
            console.error('❌ 搜索用户失败:', error);
            this.showToast(`搜索失败: ${error.message}`, 'error');
            this.showSearchError();
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 清空搜索结果
     */
    clearSearchResults() {
        if (this.elements.searchResults) {
            this.elements.searchResults.innerHTML = `
                <div class="text-center text-muted mt-4">
                    <i class="fas fa-search fa-2x mb-3"></i>
                    <p>在上方搜索框输入用户名搜索好友</p>
                </div>
            `;
        }
    }

    /**
     * 显示搜索加载状态
     */
    showSearchLoading() {
        if (this.elements.searchResults) {
            this.elements.searchResults.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <span>搜索中...</span>
                </div>
            `;
        }
    }

    /**
     * 显示搜索错误
     */
    showSearchError() {
        if (this.elements.searchResults) {
            this.elements.searchResults.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h6>搜索失败</h6>
                    <p>请检查网络连接后重试</p>
                </div>
            `;
        }
    }

    /**
     * 渲染搜索结果
     */
    renderSearchResults() {
        if (!this.elements.searchResults) return;

        if (this.searchResults.length === 0) {
            this.elements.searchResults.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-slash"></i>
                    <h6>未找到用户</h6>
                    <p>没有找到匹配"${this.searchQuery}"的用户</p>
                </div>
            `;
            return;
        }

        console.log('🎨 开始渲染搜索结果:', this.searchResults);
        const html = this.searchResults.map(user => this.createSearchResultItem(user)).join('');
        console.log('🎨 生成的HTML:', html);
        this.elements.searchResults.innerHTML = html;
        
        // 验证DOM更新
        setTimeout(() => {
            const buttons = this.elements.searchResults.querySelectorAll('.action-btn');
            console.log('🔍 找到的按钮数量:', buttons.length);
            buttons.forEach((btn, index) => {
                console.log(`按钮 ${index + 1}:`, btn.outerHTML);
            });
        }, 100);
    }

    /**
     * 创建搜索结果项
     */
    createSearchResultItem(user) {
        const avatarChar = window.FriendsApi.getAvatarChar(user.nickname || user.username);
        
        // 修复字段名不匹配问题：API返回 friendship_status，但代码期望 friendshipStatus
        const friendshipStatus = user.friendshipStatus || user.friendship_status || 'none';
        
        const statusText = window.FriendsApi.getFriendshipStatusText(friendshipStatus);
        const statusClass = window.FriendsApi.getFriendshipStatusClass(friendshipStatus);
        
        console.log('🔍 创建搜索结果项:', {
            user,
            friendshipStatus,
            statusText,
            statusClass
        });
        
        let actionButton = '';
        switch (friendshipStatus) {
            case 'none':
                actionButton = `
                    <button class="action-btn primary" onclick="window.friendsController.testButtonClick('${user.username}')">
                        <i class="fas fa-user-plus me-1"></i>添加
                    </button>
                `;
                break;
            case 'pending':
                actionButton = `
                    <span class="action-btn secondary" disabled>
                        <i class="fas fa-clock me-1"></i>待处理
                    </span>
                `;
                break;
            case 'accepted':
                actionButton = `
                    <button class="action-btn success" onclick="window.friendsController.startChat('${user.id}')">
                        <i class="fas fa-comments me-1"></i>聊天
                    </button>
                `;
                break;
            case 'declined':
                actionButton = `
                    <button class="action-btn primary" onclick="window.friendsController.testButtonClick('${user.username}')">
                        <i class="fas fa-redo me-1"></i>重新添加
                    </button>
                `;
                break;
        }

        return `
            <div class="search-result-item">
                <div class="search-avatar">
                    ${avatarChar}
                </div>
                <div class="search-info">
                    <div class="search-name">${user.nickname || user.username}</div>
                    <div class="search-status">
                        @${user.username} • 
                        <span class="friendship-status ${friendshipStatus}">${statusText}</span>
                    </div>
                </div>
                <div class="search-actions">
                    ${actionButton}
                </div>
            </div>
        `;
    }

    // ========================================
    // 👥 好友列表管理
    // ========================================

    /**
     * 加载好友列表
     */
    async loadFriends() {
        if (!this.elements.friendsList) return;

        this.showFriendsLoading();

        try {
            const response = await window.FriendsApi.getFriends();
            
            // 检查响应数据结构
            console.log('📊 好友API原始响应:', response);
            
            // 适配不同的响应结构 - 好友数据在 friends 字段中
            if (response.data && Array.isArray(response.data.friends)) {
                this.friends = response.data.friends;
            } else if (response.data && Array.isArray(response.data)) {
                this.friends = response.data;
            } else if (Array.isArray(response)) {
                this.friends = response;
            } else {
                console.warn('⚠️ 好友列表数据结构异常:', response);
                this.friends = [];
            }
            
            console.log('✅ 解析后的好友列表:', this.friends);
            this.renderFriends();
            
        } catch (error) {
            console.error('❌ 加载好友列表失败:', error);
            this.showFriendsError();
        }
    }

    /**
     * 显示好友加载状态
     */
    showFriendsLoading() {
        if (this.elements.friendsList) {
            this.elements.friendsList.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <span>加载好友列表...</span>
                </div>
            `;
        }
    }

    /**
     * 显示好友错误
     */
    showFriendsError() {
        if (this.elements.friendsList) {
            this.elements.friendsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h6>加载失败</h6>
                    <p>无法加载好友列表，请刷新重试</p>
                </div>
            `;
        }
    }

    /**
     * 渲染好友列表
     */
    renderFriends() {
        if (!this.elements.friendsList) return;

        if (this.friends.length === 0) {
            this.elements.friendsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-friends"></i>
                    <h6>暂无好友</h6>
                    <p>搜索并添加好友开始聊天吧</p>
                </div>
            `;
            return;
        }

        const html = this.friends.map(friend => this.createFriendItem(friend)).join('');
        this.elements.friendsList.innerHTML = html;
    }

    /**
     * 创建好友项
     */
    createFriendItem(friend) {
        const avatarChar = window.FriendsApi.getAvatarChar(friend.nickname || friend.username);
        const onlineClass = friend.isOnline ? 'online' : '';
        const statusText = friend.isOnline ? '在线' : '离线';
        
        return `
            <div class="friend-item ${onlineClass}" onclick="window.friendsController.startChat('${friend.id}')">
                <div class="friend-avatar ${onlineClass}">
                    ${avatarChar}
                </div>
                <div class="friend-info">
                    <div class="friend-name">${friend.nickname || friend.username}</div>
                    <div class="friend-status">${statusText}</div>
                </div>
                <div class="friend-actions">
                    <button class="action-btn primary" onclick="event.stopPropagation(); window.friendsController.startChat('${friend.id}')">
                        <i class="fas fa-comments"></i>
                    </button>
                    <button class="action-btn danger" onclick="event.stopPropagation(); window.friendsController.deleteFriend('${friend.id}', '${friend.nickname || friend.username}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // ========================================
    // 📨 好友请求管理
    // ========================================

    /**
     * 加载好友请求
     */
    async loadRequests() {
        await Promise.all([
            this.loadReceivedRequests(),
            this.loadSentRequests()
        ]);
        this.updateRequestsBadge();
    }

    /**
     * 加载收到的请求
     */
    async loadReceivedRequests() {
        if (!this.elements.receivedRequestsList) return;

        this.showReceivedRequestsLoading();

        try {
            const response = await window.FriendsApi.getReceivedRequests();
            
            // 检查响应数据结构
            console.log('📊 收到的请求API原始响应:', response);
            
            let receivedRequests = [];
            
            // 根据API文档，数据结构应该是 { success: true, data: [...] }
            if (response && response.success && Array.isArray(response.data)) {
                receivedRequests = response.data;
                console.log('✅ 使用标准API响应格式 data 数组:', receivedRequests);
            } else if (response && response.data && Array.isArray(response.data.friends)) {
                // 兼容旧格式
                receivedRequests = response.data.friends;
                console.log('✅ 使用兼容格式 data.friends 字段:', receivedRequests);
            } else if (response && response.data && Array.isArray(response.data.requests)) {
                // 兼容格式
                receivedRequests = response.data.requests;
                console.log('✅ 使用兼容格式 data.requests 字段:', receivedRequests);
            } else if (response && Array.isArray(response.friends)) {
                receivedRequests = response.friends;
                console.log('✅ 使用friends字段:', receivedRequests);
            } else if (response && Array.isArray(response.requests)) {
                receivedRequests = response.requests;
                console.log('✅ 使用requests字段:', receivedRequests);
            } else if (Array.isArray(response)) {
                receivedRequests = response;
                console.log('✅ 响应本身是数组:', receivedRequests);
            } else {
                console.warn('⚠️ 收到的请求数据结构异常:', response);
                receivedRequests = [];
            }
            
            this.receivedRequests = receivedRequests;
            
            console.log('✅ 最终解析的收到请求列表:', this.receivedRequests);
            console.log('📊 收到请求数量:', this.receivedRequests.length);
            
            // 更新计数显示
            this.updateRequestCounts();
            
            this.renderReceivedRequests();
            
        } catch (error) {
            console.error('❌ 加载收到的请求失败:', error);
            
            // 如果是认证错误，提示用户
            if (error.message.includes('认证失败') || error.message.includes('401')) {
                this.showToast('登录已过期，请重新登录', 'warning');
                // 这里可以添加跳转到登录页的逻辑
            } else {
                this.showToast(`加载好友请求失败: ${error.message}`, 'error');
            }
            
            this.showReceivedRequestsError();
        }
    }

    /**
     * 加载发送的请求
     */
    async loadSentRequests() {
        // 确保元素存在
        if (!this.elements.sentRequestsList) {
            console.warn('⚠️ sentRequestsList元素不存在，尝试重新获取...');
            this.elements.sentRequestsList = document.getElementById('sentRequestsList');
        }

        if (!this.elements.sentRequestsList) {
            console.error('❌ 仍然找不到sentRequestsList元素，尝试创建...');
            // 尝试找到父容器并创建元素
            const sentRequestsTab = document.getElementById('sent-requests');
            if (sentRequestsTab) {
                console.log('🔧 找到sent-requests容器，创建sentRequestsList元素');
                const requestsList = document.createElement('div');
                requestsList.id = 'sentRequestsList';
                requestsList.className = 'requests-list';
                sentRequestsTab.innerHTML = '';
                sentRequestsTab.appendChild(requestsList);
                this.elements.sentRequestsList = requestsList;
                console.log('✅ 成功创建sentRequestsList元素');
            } else {
                console.error('❌ 连sent-requests容器都找不到');
                return;
            }
        }

        this.showSentRequestsLoading();

        try {
            const response = await window.FriendsApi.getSentRequests();
            
            // 检查响应数据结构
            console.log('📊 发送的请求API原始响应:', response);
            
            let sentRequests = [];
            
            // 根据API文档，数据结构应该是 { success: true, data: [...] }
            if (response && response.success && Array.isArray(response.data)) {
                sentRequests = response.data;
                console.log('✅ 使用标准API响应格式 data 数组:', sentRequests);
            } else if (response && response.data && Array.isArray(response.data.friends)) {
                // 兼容旧格式
                sentRequests = response.data.friends;
                console.log('✅ 使用兼容格式 data.friends 字段:', sentRequests);
            } else if (response && response.data && Array.isArray(response.data.requests)) {
                sentRequests = response.data.requests;
                console.log('✅ 使用兼容格式 data.requests 字段:', sentRequests);
            } else if (response && Array.isArray(response.friends)) {
                sentRequests = response.friends;
                console.log('✅ 使用friends字段:', sentRequests);
            } else if (response && Array.isArray(response.requests)) {
                sentRequests = response.requests;
                console.log('✅ 使用requests字段:', sentRequests);
            } else if (Array.isArray(response)) {
                sentRequests = response;
                console.log('✅ 响应本身是数组:', sentRequests);
            } else {
                console.warn('⚠️ 发送的请求数据结构异常:', response);
                sentRequests = [];
            }
            
            this.sentRequests = sentRequests;
            
            console.log('✅ 最终解析的发送请求列表:', this.sentRequests);
            console.log('📊 发送请求数量:', this.sentRequests.length);
            
            // 更新计数显示
            this.updateRequestCounts();
            
            this.renderSentRequests();
            
        } catch (error) {
            console.error('❌ 加载发送的请求失败:', error);
            
            // 如果是认证错误，提示用户
            if (error.message.includes('认证失败') || error.message.includes('401')) {
                this.showToast('登录已过期，请重新登录', 'warning');
                // 这里可以添加跳转到登录页的逻辑
            } else {
                this.showToast(`加载好友请求失败: ${error.message}`, 'error');
            }
            
            this.showSentRequestsError();
        }
    }

    /**
     * 显示收到请求加载状态
     */
    showReceivedRequestsLoading() {
        if (this.elements.receivedRequestsList) {
            this.elements.receivedRequestsList.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <span>加载收到的请求...</span>
                </div>
            `;
        }
    }

    /**
     * 显示发送请求加载状态
     */
    showSentRequestsLoading() {
        if (this.elements.sentRequestsList) {
            this.elements.sentRequestsList.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <span>加载发送的请求...</span>
                </div>
            `;
        }
    }

    /**
     * 显示收到请求错误
     */
    showReceivedRequestsError() {
        if (this.elements.receivedRequestsList) {
            this.elements.receivedRequestsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h6>加载失败</h6>
                    <p>无法加载收到的好友请求</p>
                </div>
            `;
        }
    }

    /**
     * 显示发送请求错误
     */
    showSentRequestsError() {
        if (this.elements.sentRequestsList) {
            this.elements.sentRequestsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h6>加载失败</h6>
                    <p>无法加载发送的好友请求</p>
                </div>
            `;
        }
    }

    /**
     * 渲染收到的请求
     */
    renderReceivedRequests() {
        console.log('🎨 [渲染] 开始渲染收到的请求');
        console.log('🎨 [渲染] receivedRequestsList元素存在:', !!this.elements.receivedRequestsList);
        console.log('🎨 [渲染] 请求数量:', this.receivedRequests.length);
        console.log('🎨 [渲染] 请求数据:', this.receivedRequests);
        if (!this.elements.receivedRequestsList) {
            console.error('❌ [渲染] receivedRequestsList元素未找到');
            return;
        }

        if (this.receivedRequests.length === 0) {
            console.log('📭 [渲染] 没有收到的请求，显示空状态');
            this.elements.receivedRequestsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h6>暂无新请求</h6>
                    <p>还没有收到好友请求</p>
                </div>
            `;
            return;
        }

        console.log('🎨 [渲染] 准备渲染请求项...');
        const html = this.receivedRequests.map((request, index) => {
            console.log(`🎨 [渲染] 处理请求 ${index + 1}:`, request);
            return this.createReceivedRequestItem(request);
        }).join('');
        
        console.log('🎨 [渲染] 生成的HTML长度:', html.length);
        console.log('🎨 [渲染] 设置DOM innerHTML...');
        this.elements.receivedRequestsList.innerHTML = html;
        
        // 调试：验证DOM更新
        setTimeout(() => {
            console.log('🔍 [渲染验证] DOM检查:');
            console.log('🔍 [渲染验证] receivedRequestsList子元素数量:', this.elements.receivedRequestsList.children.length);
            console.log('🔍 [渲染验证] receivedRequestsList innerHTML长度:', this.elements.receivedRequestsList.innerHTML.length);
            console.log('🔍 [渲染验证] receivedRequestsList可见性:', getComputedStyle(this.elements.receivedRequestsList).display !== 'none');
            console.log('🔍 [渲染验证] 父容器显示状态:', getComputedStyle(this.elements.receivedRequestsList.parentElement).display !== 'none');
            
            // 检查是否有CSS隐藏了内容
            const parent = this.elements.receivedRequestsList.parentElement;
            console.log('🔍 [渲染验证] 父容器类名:', parent.className);
            console.log('🔍 [渲染验证] 祖父容器类名:', parent.parentElement.className);
        }, 100);
        
        console.log('✅ [渲染] 收到的请求渲染完成');
    }

    /**
     * 渲染发送的请求
     */
    renderSentRequests() {        
        if (!this.elements.sentRequestsList) {
            console.error('❌ sentRequestsList元素未找到');
            return;
        }

        if (this.sentRequests.length === 0) {
            this.elements.sentRequestsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-paper-plane"></i>
                    <h6>暂无发送的请求</h6>
                    <p>还没有发送过好友请求</p>
                </div>
            `;
            return;
        }

        const html = this.sentRequests.map(request => this.createSentRequestItem(request)).join('');
        this.elements.sentRequestsList.innerHTML = html;
        
        // 确保标签页可见
        const sentTab = document.getElementById('simple-sent-requests');
        if (sentTab && !sentTab.classList.contains('active')) {
            console.log('🔧 发送请求内容已生成，但标签页未激活');
        }
    }

    /**
     * 创建收到的请求项
     */
    createReceivedRequestItem(request) {
        const requester = request.requester;
        const avatarChar = window.FriendsApi.getAvatarChar(requester?.nickname || requester?.username);
        const timeText = window.FriendsApi.formatTime(request.created_at);

        return `
            <div class="request-item">
                <div class="request-avatar">
                    ${avatarChar}
                </div>
                <div class="request-info">
                    <div class="request-name">${requester?.nickname || requester?.username}</div>
                    <div class="request-status">
                        ${timeText}${request.message ? ` • ${request.message}` : ''}
                    </div>
                </div>
                <div class="request-actions">
                    <button class="action-btn success" onclick="window.friendsController.acceptRequest('${request.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="action-btn danger" onclick="window.friendsController.declineRequest('${request.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 创建发送的请求项
     */
    createSentRequestItem(request) {
        const addressee = request.addressee;
        const avatarChar = window.FriendsApi.getAvatarChar(addressee?.nickname || addressee?.username);
        const timeText = window.FriendsApi.formatTime(request.created_at);
        
        let statusText = '';
        let statusClass = '';
        
        switch (request.status) {
            case 'pending':
                statusText = '等待响应';
                statusClass = 'text-warning';
                break;
            case 'accepted':
                statusText = '已接受';
                statusClass = 'text-success';
                break;
            case 'declined':
                statusText = '已拒绝';
                statusClass = 'text-danger';
                break;
        }

        return `
            <div class="request-item">
                <div class="request-avatar">
                    ${avatarChar}
                </div>
                <div class="request-info">
                    <div class="request-name">${addressee?.nickname || addressee?.username}</div>
                    <div class="request-status">
                        ${timeText} • <span class="${statusClass}">${statusText}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 更新请求徽章数量
     */
    updateRequestsBadge() {
        const count = this.receivedRequests.length;
        console.log('🏷️ [徽章] 更新请求徽章, 请求数量:', count);
        
        if (this.elements.friendRequestsBadge) {
            if (count > 0) {
                // 显示最新的好友请求
                const latestRequest = this.receivedRequests[0]; // 取最新的请求
                const senderName = latestRequest.requester?.username || latestRequest.requester?.nickname || '未知用户';
                
                // 更新发送者名称
                if (this.elements.requestSenderName) {
                    this.elements.requestSenderName.textContent = senderName;
                }
                
                // 绑定按钮事件
                this.bindRequestButtons(latestRequest.id);
                
                // 显示徽章
                this.elements.friendRequestsBadge.style.display = 'block';
                console.log('🏷️ [徽章] 显示好友请求徽章:', senderName);
            } else {
                this.elements.friendRequestsBadge.style.display = 'none';
                console.log('🏷️ [徽章] 隐藏好友请求徽章');
            }
        } else {
            console.error('🏷️ [徽章] friendRequestsBadge 元素不存在!');
        }
    }
    
    /**
     * 绑定请求按钮事件
     */
    bindRequestButtons(requestId) {
        if (this.elements.acceptRequestBtn) {
            this.elements.acceptRequestBtn.onclick = () => this.handleRequest(requestId, 'accept');
        }
        
        if (this.elements.declineRequestBtn) {
            this.elements.declineRequestBtn.onclick = () => this.handleRequest(requestId, 'decline');
        }
    }
    
    /**
     * 处理好友请求
     */
    async handleRequest(requestId, action) {
        try {
            console.log('处理好友请求:', requestId, action);
            
            const response = await window.FriendsApi.handleFriendRequest(requestId, action);
            
            if (response && response.success) {
                const actionText = action === 'accept' ? '接受' : '拒绝';
                console.log(`✅ ${actionText}好友请求成功`);
                
                // 显示成功消息
                if (typeof showToast === 'function') {
                    showToast(`已${actionText}好友请求`, 'success');
                }
                
                // 重新加载数据
                console.log('🔄 开始刷新数据...');
                await Promise.all([
                    this.loadFriendRequestsData(), // 刷新请求列表
                    this.loadFriends()             // 刷新好友列表
                ]);
                
                console.log('✅ 数据刷新完成，好友数量:', this.friends.length);
                
            } else {
                throw new Error(response?.message || '请求处理失败');
            }
        } catch (error) {
            console.error('❌ 处理好友请求失败:', error);
            if (typeof showToast === 'function') {
                showToast('处理请求失败: ' + error.message, 'error');
            }
        }
    }
    
    /**
     * 重新加载好友请求数据
     */
    async loadFriendRequestsData() {
        try {
            console.log('🔄 重新加载好友请求数据...');
            await Promise.all([
                this.loadReceivedRequests(),
                this.loadSentRequests()
            ]);
            console.log('✅ 好友请求数据加载完成');
        } catch (error) {
            console.error('❌ 加载好友请求数据失败:', error);
        }
    }

    /**
     * 更新请求计数显示
     */
    updateRequestCounts() {
        // 更新收到的请求数量
        const receivedCountBadge = document.getElementById('receivedCount');
        if (receivedCountBadge) {
            const receivedCount = this.receivedRequests ? this.receivedRequests.length : 0;
            receivedCountBadge.textContent = receivedCount;
            receivedCountBadge.style.display = receivedCount > 0 ? 'inline' : 'none';
        }

        // 更新发送的请求数量
        const sentCountBadge = document.getElementById('sentCount');
        if (sentCountBadge) {
            const sentCount = this.sentRequests ? this.sentRequests.length : 0;
            sentCountBadge.textContent = sentCount;
            sentCountBadge.style.display = sentCount > 0 ? 'inline' : 'none';
        }

        // 更新总的请求徽章
        this.updateRequestsBadge();

        console.log('📊 更新请求计数:', {
            received: this.receivedRequests ? this.receivedRequests.length : 0,
            sent: this.sentRequests ? this.sentRequests.length : 0
        });
    }

    // ========================================
    // 🎬 操作方法
    // ========================================

    /**
     * 测试方法 - 验证按钮点击是否工作
     */
    testButtonClick(username) {
        console.log('🔧 [测试] 按钮点击测试 - 用户名:', username);
        alert(`测试：准备为用户 ${username} 发送好友请求`);
        return this.sendFriendRequest(username);
    }

    /**
     * 发送好友请求
     */
    async sendFriendRequest(username, message = '') {
        console.log(`🤝 [FriendsController] 准备发送好友请求给: ${username}`);
        
        try {
            // 显示加载状态
            this.showToast('正在发送好友请求...', 'info');
            
            await window.FriendsApi.sendFriendRequest(username, message);
            this.showToast('好友请求发送成功', 'success');
            
            // 刷新搜索结果
            if (this.searchQuery) {
                console.log('🔄 刷新搜索结果');
                await this.searchUsers();
            }
            
            // 刷新发送的请求
            console.log('🔄 刷新发送的请求列表');
            await this.loadSentRequests();
            
        } catch (error) {
            console.error('❌ [FriendsController] 发送好友请求失败:', error);
            this.showToast(`发送失败: ${error.message}`, 'error');
        }
    }

    /**
     * 接受好友请求
     */
    async acceptRequest(requestId) {
        try {
            await window.FriendsApi.handleFriendRequest(requestId, 'accept');
            this.showToast('已接受好友请求', 'success');
            
            // 刷新相关列表
            await Promise.all([
                this.loadReceivedRequests(),
                this.loadFriends()
            ]);
            
        } catch (error) {
            console.error('❌ 接受好友请求失败:', error);
            this.showToast(`操作失败: ${error.message}`, 'error');
        }
    }

    /**
     * 拒绝好友请求
     */
    async declineRequest(requestId) {
        try {
            await window.FriendsApi.handleFriendRequest(requestId, 'decline');
            this.showToast('已拒绝好友请求', 'info');
            
            // 刷新收到的请求
            await this.loadReceivedRequests();
            
        } catch (error) {
            console.error('❌ 拒绝好友请求失败:', error);
            this.showToast(`操作失败: ${error.message}`, 'error');
        }
    }

    /**
     * 删除好友
     */
    async deleteFriend(friendId, friendName) {
        if (!confirm(`确定要删除好友"${friendName}"吗？`)) {
            return;
        }

        try {
            await window.FriendsApi.deleteFriend(friendId);
            this.showToast('好友已删除', 'info');
            
            // 刷新好友列表
            await this.loadFriends();
            
        } catch (error) {
            console.error('❌ 删除好友失败:', error);
            this.showToast(`删除失败: ${error.message}`, 'error');
        }
    }

    /**
     * 开始与好友聊天
     */
    startChat(friendId) {
        // TODO: 实现好友私聊功能
        this.showToast('好友私聊功能即将上线', 'info');
        console.log('🗨️ 开始与好友聊天:', friendId);
    }

    // ========================================
    // 🛠️ 工具方法
    // ========================================

    /**
     * 显示Toast通知
     */
    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * 刷新所有数据
     */
    async refresh() {
        console.log('🔄 刷新好友数据');
        
        // 检查认证状态
        if (!await this.checkUserAuthentication()) {
            console.warn('⚠️ 刷新时发现Token不可用');
            this.showToast('请重新登录以获取最新数据', 'warning');
            return;
        }
        
        // 清空搜索
        if (this.elements.friendSearchInput) {
            this.elements.friendSearchInput.value = '';
        }
        this.clearSearchResults();
        
        try {
            // 重新加载数据
            await Promise.all([
                this.loadFriends(),
                this.loadRequests()
            ]);
            
            console.log('✅ 好友数据刷新完成');
        } catch (error) {
            console.error('❌ 刷新好友数据失败:', error);
            this.showToast('刷新失败，请稍后重试', 'error');
        }
    }
    
    /**
     * 延迟初始化（用于Token延迟加载的情况）
     */
    async delayedInitialize(maxRetries = 5, retryInterval = 1000) {
        console.log('🕐 开始延迟初始化好友功能');
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`🔄 初始化尝试 ${attempt}/${maxRetries}`);
            
            if (await this.checkUserAuthentication()) {
                console.log('✅ Token可用，开始初始化');
                await this.initialize();
                return true;
            }
            
            if (attempt < maxRetries) {
                console.log(`⏳ 等待 ${retryInterval}ms 后重试`);
                await new Promise(resolve => setTimeout(resolve, retryInterval));
                retryInterval *= 1.5; // 指数退避
            }
        }
        
        console.error('❌ 延迟初始化失败，超过最大重试次数');
        this.showToast('好友功能初始化失败，请刷新页面', 'error');
        return false;
    }
}

// 全局实例
window.friendsController = null;

console.log('✅ 好友功能控制器已定义');
