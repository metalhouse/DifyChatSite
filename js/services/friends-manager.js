/**
 * 好友管理器 - 处理聊天室页面的好友功能
 * 支持好友列表、私聊、好友请求管理等功能
 */

class FriendsManager {
    constructor(chatroomController) {
        this.chatroomController = chatroomController;
        this.friendsApi = new FriendsApiService();
        this.friends = [];
        this.friendRequests = { received: [], sent: [] };
        this.currentPrivateChat = null;
        this.unreadCounts = {}; // 存储各好友的未读消息计数
        
        // DOM 元素
        this.elements = {
            friendList: document.getElementById('friendList'),
            friendRequestsBadge: document.getElementById('friendRequestsBadge'),
            requestsCount: document.getElementById('requestsCount'),
            receivedRequestsList: document.getElementById('receivedRequestsList'),
            sentRequestsList: document.getElementById('sentRequestsList'),
            receivedCount: document.getElementById('receivedCount'),
            sentCount: document.getElementById('sentCount'),
            friendNotificationBadge: document.getElementById('friendNotificationBadge')
        };

        console.log('好友管理器初始化完成');
    }

    /**
     * 初始化好友管理器
     */
    async initialize() {
        try {
            // 加载好友列表和请求
            await Promise.all([
                this.loadFriendsList(),
                this.loadFriendRequests(),
                this.loadUnreadCounts() // 加载未读消息计数
            ]);
            
            console.log('好友管理器初始化完成');
        } catch (error) {
            console.error('好友管理器初始化失败:', error);
        }
    }

    /**
     * 加载未读消息计数
     */
    async loadUnreadCounts() {
        try {
            const response = await this.friendsApi.getUnreadMessageCounts();
            if (response.data && response.data.friendUnreadCounts) {
                this.unreadCounts = {};
                response.data.friendUnreadCounts.forEach(item => {
                    this.unreadCounts[item.friendId] = item.unreadCount;
                });
                
                // 更新好友列表显示
                this.renderFriendsList();
                
                console.log('📊 未读消息计数已加载:', response.data.totalUnread || 0, '条未读');
            }
        } catch (error) {
            console.error('❌ 加载未读消息计数失败:', error);
        }
    }

    /**
     * 加载好友列表
     */
    async loadFriendsList() {
        if (!this.elements.friendList) return;

        try {
            console.log('加载好友列表...');
            this.elements.friendList.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <span>加载好友列表...</span>
                </div>
            `;

            const response = await this.friendsApi.getFriendsList();
            
            // 正确解析数据结构 - 好友API返回friendship记录，需要提取实际好友信息
            let friendships = [];
            if (response.data && response.data.friends) {
                friendships = response.data.friends;
            } else if (response.friends) {
                friendships = response.friends;
            } else if (Array.isArray(response.data)) {
                friendships = response.data;
            }
            
            // 从friendship记录中提取好友用户信息
            this.friends = friendships.map(friendship => {
                // 安全获取当前用户ID
                let currentUserId = null;
                if (this.chatroomController.currentUser && this.chatroomController.currentUser.id) {
                    currentUserId = this.chatroomController.currentUser.id;
                } else {
                    // 备用方案：从token中解析用户ID
                    try {
                        const token = localStorage.getItem('access_token');
                        if (token) {
                            const payload = JSON.parse(atob(token.split('.')[1]));
                            currentUserId = payload.userId;
                        }
                    } catch (error) {
                        console.warn('无法从token中获取用户ID:', error);
                    }
                }
                
                if (!currentUserId) {
                    console.error('无法获取当前用户ID');
                    return null;
                }
                
                // 判断当前用户是请求者还是接收者，返回对方的用户信息
                if (friendship.requester && friendship.requester.id === currentUserId) {
                    // 当前用户是请求者，好友是接收者
                    return {
                        id: friendship.addressee.id,
                        username: friendship.addressee.username,
                        nickname: friendship.addressee.nickname,
                        avatar_url: friendship.addressee.avatar_url,
                        status: friendship.addressee.status,
                        friendshipId: friendship.id,
                        friendshipStatus: friendship.status
                    };
                } else if (friendship.addressee && friendship.addressee.id === currentUserId) {
                    // 当前用户是接收者，好友是请求者
                    return {
                        id: friendship.requester.id,
                        username: friendship.requester.username,
                        nickname: friendship.requester.nickname,
                        avatar_url: friendship.requester.avatar_url,
                        status: friendship.requester.status,
                        friendshipId: friendship.id,
                        friendshipStatus: friendship.status
                    };
                } else {
                    console.warn('无法确定好友关系中的对方用户:', friendship);
                    return null;
                }
            }).filter(friend => friend !== null); // 过滤掉无效的记录
            
            this.renderFriendsList();
            console.log('好友列表加载完成:', this.friends);
        } catch (error) {
            console.error('加载好友列表失败:', error);
            this.elements.friendList.innerHTML = `
                <div class="text-center text-muted p-3">
                    <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                    <p>加载好友列表失败</p>
                    <button class="btn btn-outline-primary btn-sm" onclick="window.chatroomController.friendsManager.loadFriendsList()">
                        <i class="fas fa-redo"></i> 重试
                    </button>
                </div>
            `;
        }
    }

    /**
     * 渲染好友列表
     */
    renderFriendsList(searchKeyword = '') {
        if (!this.elements.friendList) return;

        let filteredFriends = this.friends;
        
        // 如果有搜索关键词，进行过滤
        if (searchKeyword) {
            filteredFriends = this.friends.filter(friend => 
                friend.username.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                (friend.nickname && friend.nickname.toLowerCase().includes(searchKeyword.toLowerCase()))
            );
        }

        if (filteredFriends.length === 0) {
            this.elements.friendList.innerHTML = `
                <div class="text-center text-muted p-3">
                    <i class="fas fa-user-friends fa-3x mb-3"></i>
                    <h6>${searchKeyword ? '没有找到相关好友' : '还没有好友'}</h6>
                    <p class="small">${searchKeyword ? '尝试其他关键词搜索' : '点击上方按钮添加好友'}</p>
                </div>
            `;
            return;
        }

        const friendsHTML = filteredFriends.map(friend => this.createFriendItemHTML(friend)).join('');
        this.elements.friendList.innerHTML = friendsHTML;
    }

    /**
     * 创建好友项目HTML
     */
    createFriendItemHTML(friend) {
        // 添加空值检查
        if (!friend || (!friend.nickname && !friend.username)) {
            console.warn('好友数据不完整:', friend);
            return '';
        }
        
        const isActive = this.currentPrivateChat && this.currentPrivateChat.friendId === friend.id;
        
        // 安全获取显示名称和头像文本
        const displayName = friend.nickname || friend.username || '未知用户';
        const avatarText = displayName.charAt(0).toUpperCase();
        
        // 使用好友的实际在线状态
        const isOnline = friend.status === 'active'; // 从好友数据中获取状态
        const onlineClass = isOnline ? 'online-indicator' : 'offline-indicator';
        const statusText = isOnline ? '在线' : '离线';
        
        // 获取实际未读消息数
        const unreadCount = this.unreadCounts[friend.id] || 0;
        const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
        
        // 显示加密状态提示
        const encryptionIcon = '<i class="fas fa-lock text-success ms-1" title="端到端加密"></i>';

        return `
            <div class="friend-item ${isActive ? 'active' : ''}" onclick="chatroomController.friendsManager.startPrivateChat('${friend.id}', '${displayName}')">
                <div class="friend-avatar">
                    ${avatarText}
                    <div class="${onlineClass}"></div>
                </div>
                <div class="friend-info">
                    <div class="friend-name">${displayName}${encryptionIcon}</div>
                    <div class="friend-meta">
                        <span class="friend-status">${statusText}</span>
                        ${unreadBadge}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 开始私聊
     */
    startPrivateChat(friendId, friendName) {
        console.log('开始与好友私聊:', friendId, friendName);
        
        // 设置当前私聊状态
        this.currentPrivateChat = {
            friendId: friendId,
            friendName: friendName,
            type: 'private'
        };

        // 更新聊天头部显示
        const currentRoomName = document.getElementById('currentRoomName');
        if (currentRoomName) {
            currentRoomName.innerHTML = `
                <i class="fas fa-user me-2"></i>
                ${friendName}
                <small class="text-muted ms-2">(私聊)</small>
            `;
        }

        // 清空当前群聊房间状态
        this.chatroomController.currentRoom = null;
        
        // 更新房间列表中的活跃状态
        this.updateActiveStates();

        // 切换到私聊模式
        this.switchToPrivateChat(friendId, friendName);

        // 标记消息为已读
        this.markMessagesAsRead(friendId);

        // 在移动设备上隐藏侧边栏
        if (window.innerWidth <= 768) {
            document.getElementById('roomSidebar').classList.remove('show');
        }
    }

    /**
     * 切换到私聊模式
     */
    switchToPrivateChat(friendId, friendName) {
        const chatMessages = document.getElementById('chatMessages');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        
        if (chatMessages) {
            // 清空消息区域
            chatMessages.innerHTML = `
                <div class="text-center text-muted mt-5">
                    <i class="fas fa-user fa-3x mb-3"></i>
                    <h5>与 ${friendName} 的私聊</h5>
                    <p>开始你们的对话吧！</p>
                </div>
            `;
            
            // TODO: 加载历史私聊消息
            this.loadPrivateChatHistory(friendId);
        }

        // 启用输入框
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = `给 ${friendName} 发消息...`;
        }
        
        if (sendButton) {
            sendButton.disabled = false;
        }

        // 更新连接状态显示
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.className = 'connection-status connected';
            connectionStatus.innerHTML = `
                <div class="status-indicator"></div>
                <span>私聊模式</span>
            `;
        }
    }

    /**
     * 加载私聊历史记录
     */
    async loadPrivateChatHistory(friendId) {
        try {
            console.log('🔄 加载私聊历史记录:', friendId);
            
            // 显示加载状态
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="text-center text-muted mt-5">
                        <div class="spinner"></div>
                        <h5>加载聊天记录中...</h5>
                    </div>
                `;
            }

            // 调用API获取私聊历史
            const response = await this.friendsApi.getChatHistory(friendId, 1, 50);
            
            if (response.data && response.data.messages) {
                this.renderChatMessages(response.data.messages);
                
                // 标记所有消息为已读
                if (response.data.messages.length > 0) {
                    await this.friendsApi.markMessagesAsRead(friendId);
                }
            } else {
                // 没有消息历史，显示欢迎界面
                if (chatMessages && this.currentPrivateChat && this.currentPrivateChat.friendId === friendId) {
                    chatMessages.innerHTML = `
                        <div class="text-center text-muted mt-5">
                            <i class="fas fa-user fa-3x mb-3"></i>
                            <h5>与 ${this.currentPrivateChat.friendName} 的私聊</h5>
                            <p>开始你们的对话吧！</p>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('❌ 加载私聊历史失败:', error);
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="text-center text-muted mt-5">
                        <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                        <h5>加载聊天记录失败</h5>
                        <p>请刷新页面重试</p>
                    </div>
                `;
            }
        }
    }

    /**
     * 渲染聊天消息列表
     */
    renderChatMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages || !Array.isArray(messages)) return;

        if (messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="text-center text-muted mt-5">
                    <i class="fas fa-user fa-3x mb-3"></i>
                    <h5>与 ${this.currentPrivateChat.friendName} 的私聊</h5>
                    <p>开始你们的对话吧！</p>
                </div>
            `;
            return;
        }

        // 获取当前用户ID
        const currentUserId = this.getCurrentUserId();
        
        // 按时间排序消息
        const sortedMessages = messages.sort((a, b) => 
            new Date(a.createdAt) - new Date(b.createdAt)
        );

        // 渲染消息
        chatMessages.innerHTML = sortedMessages.map(message => {
            const isCurrentUser = message.senderId === currentUserId;
            const messageClass = isCurrentUser ? 'message-user' : 'message-other';
            const senderName = isCurrentUser ? '我' : message.senderInfo?.username || this.currentPrivateChat.friendName;
            
            return `
                <div class="message ${messageClass}">
                    <div class="message-bubble">
                        <div class="message-header">
                            <span class="message-sender">${senderName}</span>
                            <span class="message-time">${this.formatTime(new Date(message.createdAt))}</span>
                            ${message.isEncrypted ? '<i class="fas fa-lock text-success" title="已加密"></i>' : ''}
                        </div>
                        <div class="message-content">${this.escapeHtml(message.content)}</div>
                    </div>
                </div>
            `;
        }).join('');

        // 滚动到底部
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);

        console.log(`✅ 已渲染 ${messages.length} 条私聊消息`);
    }

    /**
     * 安全获取当前用户ID
     */
    getCurrentUserId() {
        if (this.chatroomController.currentUser && this.chatroomController.currentUser.id) {
            return this.chatroomController.currentUser.id;
        }
        
        // 备用方案：从token中解析
        try {
            const token = localStorage.getItem('access_token');
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                return payload.userId;
            }
        } catch (error) {
            console.warn('无法获取当前用户ID:', error);
        }
        
        return null;
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 更新活跃状态
     */
    updateActiveStates() {
        // 更新好友列表状态
        const friendItems = document.querySelectorAll('.friend-item');
        friendItems.forEach(item => {
            item.classList.remove('active');
        });

        if (this.currentPrivateChat) {
            const activeFriend = document.querySelector(`.friend-item[onclick*="${this.currentPrivateChat.friendId}"]`);
            if (activeFriend) {
                activeFriend.classList.add('active');
            }
        }

        // 清除房间列表的活跃状态
        const roomItems = document.querySelectorAll('.room-item');
        roomItems.forEach(item => {
            item.classList.remove('active');
        });
    }

    /**
     * 搜索好友
     */
    async searchFriends(keyword = '') {
        console.log('搜索好友:', keyword);
        this.renderFriendsList(keyword);
    }

    /**
     * 搜索用户
     */
    async searchUsers(username, resultContainer) {
        try {
            console.log('搜索用户:', username);
            const response = await this.friendsApi.searchUsers(username);
            
            // 添加调试日志
            console.log('🔍 搜索响应完整数据:', response);
            console.log('🔍 响应中的users字段:', response.users);
            console.log('🔍 响应中的data字段:', response.data);
            
            // 正确解析数据结构
            let users = [];
            if (response.data && response.data.users) {
                users = response.data.users;
            } else if (response.users) {
                users = response.users;
            } else if (Array.isArray(response.data)) {
                users = response.data;
            }
            
            console.log('🔍 最终解析的用户列表:', users);
            
            // 详细打印每个用户的信息，特别是friendshipStatus字段
            users.forEach((user, index) => {
                console.log(`👤 用户${index + 1}:`, {
                    id: user.id,
                    username: user.username,
                    nickname: user.nickname,
                    friendshipStatus: user.friendshipStatus,
                    friendship: user.friendship,
                    relationship: user.relationship,
                    status: user.status
                });
            });
            
            if (users.length === 0) {
                resultContainer.innerHTML = '<div class="text-muted">没有找到相关用户</div>';
                return;
            }

            const usersHTML = users.map(user => this.createUserSearchResultHTML(user)).join('');
            resultContainer.innerHTML = usersHTML;
        } catch (error) {
            console.error('搜索用户失败:', error);
            resultContainer.innerHTML = `<div class="text-danger">搜索失败: ${error.message}</div>`;
        }
    }

    /**
     * 创建用户搜索结果HTML
     */
    createUserSearchResultHTML(user) {
        const avatarText = (user.nickname || user.username).charAt(0).toUpperCase();
        const displayName = user.nickname || user.username;
        
        // 尝试多种可能的状态字段名
        const friendshipStatus = user.friendshipStatus || user.friendship || user.relationship || user.status || 'none';
        
        console.log(`🔍 用户 ${user.username} 的好友状态:`, friendshipStatus);
        
        let actionHTML = '';
        let statusText = '';
        
        switch (friendshipStatus) {
            case 'none':
            case null:
            case undefined:
                actionHTML = `<button class="btn btn-primary btn-sm" onclick="chatroomController.friendsManager.sendFriendRequest('${user.username}')">添加好友</button>`;
                statusText = '可以添加为好友';
                break;
            case 'pending':
                actionHTML = `<span class="status-badge pending">请求已发送</span>`;
                statusText = '好友请求待处理';
                break;
            case 'accepted':
                actionHTML = `<span class="status-badge accepted">已是好友</span>`;
                statusText = '已经是你的好友';
                break;
            case 'declined':
                actionHTML = `<button class="btn btn-outline-primary btn-sm" onclick="chatroomController.friendsManager.sendFriendRequest('${user.username}')">重新发送</button>`;
                statusText = '之前的请求被拒绝';
                break;
            default:
                // 如果状态不识别，默认允许添加好友
                actionHTML = `<button class="btn btn-primary btn-sm" onclick="chatroomController.friendsManager.sendFriendRequest('${user.username}')">添加好友</button>`;
                statusText = `状态: ${friendshipStatus}`;
        }

        return `
            <div class="user-search-result">
                <div class="search-result-avatar">${avatarText}</div>
                <div class="search-result-info">
                    <div class="search-result-name">${displayName}</div>
                    <div class="search-result-status">${statusText}</div>
                </div>
                <div class="search-result-actions">
                    ${actionHTML}
                </div>
            </div>
        `;
    }

    /**
     * 发送好友请求
     */
    async sendFriendRequest(username, message = '我想加你为好友') {
        try {
            console.log('发送好友请求:', username);
            
            await this.friendsApi.sendFriendRequest(username, message);
            
            showToast('好友请求发送成功', 'success');
            
            // 重新搜索以更新状态
            const searchInput = document.getElementById('userSearchInput');
            if (searchInput && searchInput.value) {
                await this.searchUsers(searchInput.value.trim(), document.getElementById('searchResultsList'));
            }
            
            // 重新加载好友请求列表
            await this.loadFriendRequests();
        } catch (error) {
            console.error('发送好友请求失败:', error);
            showToast('发送好友请求失败: ' + error.message, 'error');
        }
    }

    /**
     * 加载好友请求
     */
    async loadFriendRequests() {
        try {
            console.log('加载好友请求...');
            
            // 并行加载收到和发送的请求
            const [receivedResponse, sentResponse] = await Promise.all([
                this.friendsApi.getReceivedRequests(),
                this.friendsApi.getSentRequests()
            ]);

            // 添加详细的调试日志
            console.log('📥 收到的请求原始响应:', receivedResponse);
            console.log('📤 发送的请求原始响应:', sentResponse);

            // 正确解析数据结构 - 后端返回的是 friends 字段，不是 requests
            let receivedRequests = [];
            let sentRequests = [];
            
            // 接收到的请求：数据在 data.friends 中
            if (receivedResponse.data && receivedResponse.data.friends) {
                receivedRequests = receivedResponse.data.friends;
            } else if (receivedResponse.data && receivedResponse.data.requests) {
                receivedRequests = receivedResponse.data.requests;
            } else if (receivedResponse.friends) {
                receivedRequests = receivedResponse.friends;
            } else if (receivedResponse.requests) {
                receivedRequests = receivedResponse.requests;
            } else if (Array.isArray(receivedResponse.data)) {
                receivedRequests = receivedResponse.data;
            }
            
            // 发送的请求：数据也在 data.friends 中
            if (sentResponse.data && sentResponse.data.friends) {
                sentRequests = sentResponse.data.friends;
            } else if (sentResponse.data && sentResponse.data.requests) {
                sentRequests = sentResponse.data.requests;
            } else if (sentResponse.friends) {
                sentRequests = sentResponse.friends;
            } else if (sentResponse.requests) {
                sentRequests = sentResponse.requests;
            } else if (Array.isArray(sentResponse.data)) {
                sentRequests = sentResponse.data;
            }

            console.log('📥 解析后的收到请求:', receivedRequests);
            console.log('📤 解析后的发送请求:', sentRequests);

            this.friendRequests.received = receivedRequests;
            this.friendRequests.sent = sentRequests;
            
            // 更新请求数量显示
            this.updateRequestCounts();
            
            // 渲染请求列表
            this.renderReceivedRequests();
            this.renderSentRequests();
            
            console.log('好友请求加载完成:', this.friendRequests);
        } catch (error) {
            console.error('加载好友请求失败:', error);
        }
    }

    /**
     * 更新请求数量显示
     */
    updateRequestCounts() {
        const receivedCount = this.friendRequests.received.length;
        const sentCount = this.friendRequests.sent.length;
        
        // 更新侧边栏徽章
        if (this.elements.friendRequestsBadge && this.elements.requestsCount) {
            if (receivedCount > 0) {
                this.elements.friendRequestsBadge.style.display = 'block';
                this.elements.requestsCount.textContent = receivedCount;
            } else {
                this.elements.friendRequestsBadge.style.display = 'none';
            }
        }
        
        // 更新好友tab红点通知
        if (this.elements.friendNotificationBadge) {
            if (receivedCount > 0) {
                this.elements.friendNotificationBadge.style.display = 'block';
                console.log(`🔴 显示好友请求红点提示 - ${receivedCount}个未处理请求`);
            } else {
                this.elements.friendNotificationBadge.style.display = 'none';
                console.log('⭕ 隐藏好友请求红点提示 - 无未处理请求');
            }
        }
        
        // 更新模态框中的计数
        if (this.elements.receivedCount) {
            this.elements.receivedCount.textContent = receivedCount;
        }
        if (this.elements.sentCount) {
            this.elements.sentCount.textContent = sentCount;
        }
    }

    /**
     * 渲染收到的请求
     */
    renderReceivedRequests() {
        if (!this.elements.receivedRequestsList) return;

        if (this.friendRequests.received.length === 0) {
            this.elements.receivedRequestsList.innerHTML = `
                <div class="text-center text-muted p-4">
                    <i class="fas fa-inbox fa-3x mb-3"></i>
                    <h6>没有收到好友请求</h6>
                    <p class="small">当有人想加你为好友时，请求会显示在这里</p>
                </div>
            `;
            return;
        }

        const requestsHTML = this.friendRequests.received.map(request => 
            this.createFriendRequestHTML(request, 'received')
        ).join('');
        
        this.elements.receivedRequestsList.innerHTML = requestsHTML;
    }

    /**
     * 渲染发送的请求
     */
    renderSentRequests() {
        if (!this.elements.sentRequestsList) return;

        if (this.friendRequests.sent.length === 0) {
            this.elements.sentRequestsList.innerHTML = `
                <div class="text-center text-muted p-4">
                    <i class="fas fa-paper-plane fa-3x mb-3"></i>
                    <h6>没有发送好友请求</h6>
                    <p class="small">你发送的好友请求会显示在这里</p>
                </div>
            `;
            return;
        }

        const requestsHTML = this.friendRequests.sent.map(request => 
            this.createFriendRequestHTML(request, 'sent')
        ).join('');
        
        this.elements.sentRequestsList.innerHTML = requestsHTML;
    }

    /**
     * 创建好友请求HTML
     */
    createFriendRequestHTML(request, type) {
        const user = type === 'received' ? request.requester : request.addressee;
        const avatarText = (user.nickname || user.username).charAt(0).toUpperCase();
        const displayName = user.nickname || user.username;
        const timeText = this.formatTime(new Date(request.created_at));
        
        let actionsHTML = '';
        if (type === 'received' && request.status === 'pending') {
            actionsHTML = `
                <div class="request-actions">
                    <button class="btn btn-success btn-sm" onclick="chatroomController.friendsManager.handleFriendRequest('${request.id}', 'accept')">
                        <i class="fas fa-check"></i> 接受
                    </button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="chatroomController.friendsManager.handleFriendRequest('${request.id}', 'decline')">
                        <i class="fas fa-times"></i> 拒绝
                    </button>
                </div>
            `;
        } else {
            actionsHTML = `<span class="status-badge ${request.status}">${this.getStatusText(request.status)}</span>`;
        }

        return `
            <div class="friend-request-item">
                <div class="request-avatar">${avatarText}</div>
                <div class="request-info">
                    <div class="request-name">${displayName}</div>
                    <div class="request-message">${request.message || '想加你为好友'}</div>
                    <div class="request-time">${timeText}</div>
                </div>
                ${actionsHTML}
            </div>
        `;
    }

    /**
     * 处理好友请求
     */
    async handleFriendRequest(requestId, action) {
        try {
            console.log('处理好友请求:', requestId, action);
            
            await this.friendsApi.handleFriendRequest(requestId, action);
            
            const actionText = action === 'accept' ? '接受' : '拒绝';
            showToast(`已${actionText}好友请求`, 'success');
            
            // 重新加载请求列表和好友列表
            await Promise.all([
                this.loadFriendRequests(),
                this.loadFriendsList()
            ]);
        } catch (error) {
            console.error('处理好友请求失败:', error);
            showToast('处理好友请求失败: ' + error.message, 'error');
        }
    }

    /**
     * 获取状态文本
     */
    getStatusText(status) {
        const statusMap = {
            'pending': '待处理',
            'accepted': '已接受',
            'declined': '已拒绝'
        };
        return statusMap[status] || status;
    }

    /**
     * 格式化时间
     */
    formatTime(date) {
        if (!date) return '';
        
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}天前`;
        } else if (hours > 0) {
            return `${hours}小时前`;
        } else if (minutes > 0) {
            return `${minutes}分钟前`;
        } else {
            return '刚刚';
        }
    }

    /**
     * 清除私聊状态
     */
    clearPrivateChat() {
        this.currentPrivateChat = null;
        this.updateActiveStates();
    }

    /**
     * 发送私聊消息
     */
    async sendPrivateMessage(content) {
        if (!this.currentPrivateChat) {
            console.warn('当前不在私聊模式');
            return;
        }

        try {
            console.log('💬 发送私聊消息:', content);
            
            // 先在界面显示发送中状态
            this.displaySendingMessage(content);
            
            // 调用API发送私聊消息
            const response = await this.friendsApi.sendPrivateMessage(
                this.currentPrivateChat.friendId, 
                content, 
                'text'
            );
            
            // 不再重新加载历史记录，而是等待WebSocket事件推送
            console.log('✅ 私聊消息发送请求完成，等待WebSocket确认');
            
        } catch (error) {
            console.error('❌ 发送私聊消息失败:', error);
            showToast('发送消息失败: ' + error.message, 'error');
            
            // 移除发送中的消息显示
            this.removeSendingMessage();
        }
    }

    /**
     * 显示私聊消息
     */
    displayPrivateMessage(content, sender = 'user') {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message message-${sender}`;
        
        const currentUser = this.chatroomController.currentUser;
        const senderName = sender === 'user' ? currentUser.username : this.currentPrivateChat.friendName;
        
        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-sender">${senderName}</span>
                    <span class="message-time">${this.formatTime(new Date())}</span>
                </div>
                <div class="message-content">${content}</div>
            </div>
        `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * 检查是否在私聊模式
     */
    isPrivateChatMode() {
        return this.currentPrivateChat !== null;
    }

    /**
     * 显示发送中的消息
     */
    displaySendingMessage(content) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        // 移除之前的发送中消息
        this.removeSendingMessage();

        const messageElement = document.createElement('div');
        messageElement.className = 'message message-user sending';
        messageElement.id = 'sending-message';
        
        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-sender">我</span>
                    <span class="message-time">发送中...</span>
                </div>
                <div class="message-content">${this.escapeHtml(content)}</div>
            </div>
        `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * 移除发送中的消息显示
     */
    removeSendingMessage() {
        const sendingMessage = document.getElementById('sending-message');
        if (sendingMessage) {
            sendingMessage.remove();
        }
    }

    /**
     * 显示接收到的私聊消息
     */
    displayReceivedMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages || !this.currentPrivateChat) return;

        const messageElement = document.createElement('div');
        messageElement.className = 'message message-other';
        
        const senderName = message.senderInfo?.nickname || message.senderInfo?.username || '好友';
        const time = this.formatTime(new Date(message.createdAt));
        
        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-sender">${this.escapeHtml(senderName)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-content">${this.escapeHtml(message.content)}</div>
            </div>
        `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // 标记消息为已读
        this.markMessagesAsRead(message.senderId);
    }

    /**
     * 显示发送成功的私聊消息
     */
    displaySentMessage(data) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages || !this.currentPrivateChat) return;

        // 先移除发送中的消息
        this.removeSendingMessage();

        const messageElement = document.createElement('div');
        messageElement.className = 'message message-user';
        
        const currentUser = this.chatroomController.currentUser;
        const time = this.formatTime(new Date(data.createdAt));
        
        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-sender">${this.escapeHtml(currentUser.username)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-content">${this.escapeHtml(data.content)}</div>
            </div>
        `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * 更新未读消息计数
     */
    updateUnreadCount(friendId, increment = 1) {
        if (!this.unreadCounts[friendId]) {
            this.unreadCounts[friendId] = 0;
        }
        this.unreadCounts[friendId] += increment;
        
        // 更新好友列表显示
        this.renderFriendsList();
        
        console.log(`📊 更新未读消息计数: ${friendId} = ${this.unreadCounts[friendId]}`);
    }

    /**
     * 标记消息为已读
     */
    async markMessagesAsRead(friendId) {
        if (!friendId) return;
        
        try {
            // 调用API标记已读
            await this.friendsApi.markMessagesAsRead(friendId);
            
            // 清除本地未读计数
            this.unreadCounts[friendId] = 0;
            
            // 更新好友列表显示
            this.renderFriendsList();
            
            console.log(`✅ 标记消息已读: ${friendId}`);
        } catch (error) {
            console.error('❌ 标记消息已读失败:', error);
        }
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
