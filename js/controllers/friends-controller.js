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
            
            // 搜索
            friendSearchInput: document.getElementById('friendSearchInput'),
            searchFriendsBtn: document.getElementById('searchFriendsBtn'),
            searchResults: document.getElementById('searchResults'),
            
            // 标签
            friendsTab: document.getElementById('friends-tab'),
            requestsTab: document.getElementById('friend-requests-tab')
        };

        // 调试：检查所有DOM元素是否存在
        console.log('🔍 DOM元素检查:', {
            sentRequestsList: !!this.elements.sentRequestsList,
            receivedRequestsList: !!this.elements.receivedRequestsList
        });

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
        console.log('🤝 初始化好友功能控制器');
        
        // 加载好友列表
        await this.loadFriends();
        
        // 加载好友请求
        await this.loadRequests();
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
            
            // 适配不同的响应结构 - 好友请求数据在 friends 字段中
            if (response.data && Array.isArray(response.data.friends)) {
                this.receivedRequests = response.data.friends;
            } else if (response.data && Array.isArray(response.data.requests)) {
                this.receivedRequests = response.data.requests;
            } else if (response.data && Array.isArray(response.data)) {
                this.receivedRequests = response.data;
            } else if (Array.isArray(response)) {
                this.receivedRequests = response;
            } else {
                console.warn('⚠️ 收到的请求数据结构异常:', response);
                this.receivedRequests = [];
            }
            
            console.log('✅ 解析后的收到请求列表:', this.receivedRequests);
            this.renderReceivedRequests();
            
        } catch (error) {
            console.error('❌ 加载收到的请求失败:', error);
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
            
            // 适配不同的响应结构 - 好友请求数据在 friends 字段中
            if (response.data && Array.isArray(response.data.friends)) {
                this.sentRequests = response.data.friends;
            } else if (response.data && Array.isArray(response.data.requests)) {
                this.sentRequests = response.data.requests;
            } else if (response.data && Array.isArray(response.data)) {
                this.sentRequests = response.data;
            } else if (Array.isArray(response)) {
                this.sentRequests = response;
            } else {
                console.warn('⚠️ 发送的请求数据结构异常:', response);
                this.sentRequests = [];
            }
            
            console.log('✅ 解析后的发送请求列表:', this.sentRequests);
            this.renderSentRequests();
            
        } catch (error) {
            console.error('❌ 加载发送的请求失败:', error);
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
        if (!this.elements.receivedRequestsList) return;

        if (this.receivedRequests.length === 0) {
            this.elements.receivedRequestsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h6>暂无新请求</h6>
                    <p>还没有收到好友请求</p>
                </div>
            `;
            return;
        }

        const html = this.receivedRequests.map(request => this.createReceivedRequestItem(request)).join('');
        this.elements.receivedRequestsList.innerHTML = html;
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
        if (this.elements.requestsBadge) {
            const count = this.receivedRequests.length;
            if (count > 0) {
                this.elements.requestsBadge.textContent = count > 99 ? '99+' : count;
                this.elements.requestsBadge.style.display = 'block';
            } else {
                this.elements.requestsBadge.style.display = 'none';
            }
        }
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
        
        // 清空搜索
        if (this.elements.friendSearchInput) {
            this.elements.friendSearchInput.value = '';
        }
        this.clearSearchResults();
        
        // 重新加载数据
        await Promise.all([
            this.loadFriends(),
            this.loadRequests()
        ]);
    }
}

// 全局实例
window.friendsController = null;

console.log('✅ 好友功能控制器已定义');
