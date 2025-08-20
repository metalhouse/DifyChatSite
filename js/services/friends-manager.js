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
            
            // 加载历史私聊消息
            this.loadPrivateChatHistory(friendId);
        }

        // 启用输入框
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = `给 ${friendName} 发消息...`;
        }
        
        // 用户进入与好友的聊天时，标记该好友的消息为已读
        this.markMessagesAsRead(friendId);
        
        if (sendButton) {
            sendButton.disabled = false;
        }

        // 显示私聊操作按钮，隐藏群聊元素
        const privateChatActions = document.getElementById('privateChatActions');
        const onlineMembers = document.getElementById('onlineMembers');
        if (privateChatActions) {
            privateChatActions.style.display = 'block';
        }
        if (onlineMembers) {
            onlineMembers.style.display = 'none';
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
                this.renderChatMessages(response.data.messages, friendId);
                
                // 注意：不在这里标记已读，由startPrivateChat统一处理
                console.log(`✅ 加载了 ${response.data.messages.length} 条聊天记录`);
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
     * @param {Array} messages 消息数组
     * @param {string} friendId 好友ID
     */
    renderChatMessages(messages, friendId) {
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
            
            // 兼容不同的ID字段名
            const messageId = message.id || message._id || message.messageId || message.message_id;
            
            // 已读状态指示器（只对当前用户发送的消息显示）
            const readStatusIndicator = isCurrentUser && message.isRead ? 
                '<div class="message-read-status"><span class="message-read-indicator" title="对方已读"></span></div>' : '';
            
            return `
                <div class="message ${messageClass}" data-message-id="${messageId}">
                    <div class="message-select-wrapper">
                        <input type="checkbox" class="message-checkbox" data-message-id="${messageId}" style="display: none;">
                        <div class="message-bubble">
                            <div class="message-header">
                                <span class="message-sender">${senderName}</span>
                                <span class="message-time">${this.formatTime(new Date(message.createdAt))}</span>
                                ${message.isEncrypted ? '<i class="fas fa-lock text-success" title="已加密"></i>' : ''}
                                <div class="message-actions" style="display: none;">
                                    <button class="btn btn-sm btn-outline-danger delete-message-btn" data-message-id="${messageId}" title="删除消息">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="message-content">${this.escapeHtml(message.content)}</div>
                            ${readStatusIndicator}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // 重置事件附加标志并附加事件
        this.eventsAttached = false;
        this.attachMessageEvents();

        // 加载已读状态（异步加载，不阻塞消息显示）
        if (friendId) {
            this.loadMessageReadStatus(friendId, sortedMessages);
        } else if (this.currentPrivateChat?.friendId) {
            this.loadMessageReadStatus(this.currentPrivateChat.friendId, sortedMessages);
        }

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
        
        // 兼容不同的ID字段名
        const messageId = message.id || message._id || message.messageId || message.message_id;
        messageElement.dataset.messageId = messageId;
        
        const senderName = message.senderInfo?.nickname || message.senderInfo?.username || '好友';
        const time = this.formatTime(new Date(message.createdAt));
        
        messageElement.innerHTML = `
            <div class="message-select-wrapper">
                <input type="checkbox" class="message-checkbox" data-message-id="${messageId}" style="display: none;">
                <div class="message-bubble">
                    <div class="message-header">
                        <span class="message-sender">${this.escapeHtml(senderName)}</span>
                        <span class="message-time">${time}</span>
                        <div class="message-actions" style="display: none;">
                            <button class="btn btn-sm btn-outline-danger delete-message-btn" data-message-id="${messageId}" title="删除消息">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="message-content">${this.escapeHtml(message.content)}</div>
                </div>
            </div>
        `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // 只有当前正在与发送方聊天时才标记为已读
        if (this.currentPrivateChat && this.currentPrivateChat.friendId === message.senderId) {
            this.markMessagesAsRead(message.senderId);
        }
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
        
        // 兼容不同的ID字段名
        const messageId = data.id || data._id || data.messageId || data.message_id;
        messageElement.dataset.messageId = messageId;
        
        const currentUser = this.chatroomController.currentUser;
        const time = this.formatTime(new Date(data.createdAt));
        
        messageElement.innerHTML = `
            <div class="message-select-wrapper">
                <input type="checkbox" class="message-checkbox" data-message-id="${messageId}" style="display: none;">
                <div class="message-bubble">
                    <div class="message-header">
                        <span class="message-sender">${this.escapeHtml(currentUser.username)}</span>
                        <span class="message-time">${time}</span>
                        <div class="message-actions" style="display: none;">
                            <button class="btn btn-sm btn-outline-danger delete-message-btn" data-message-id="${messageId}" title="删除消息">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="message-content">${this.escapeHtml(data.content)}</div>
                </div>
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
     * 清除私聊状态，切换回群聊模式
     */
    clearPrivateChat() {
        this.currentPrivateChat = null;
        
        // 隐藏私聊操作按钮，显示群聊元素
        const privateChatActions = document.getElementById('privateChatActions');
        const onlineMembers = document.getElementById('onlineMembers');
        if (privateChatActions) {
            privateChatActions.style.display = 'none';
        }
        if (onlineMembers) {
            onlineMembers.style.display = 'block';
        }
        
        // 退出选择模式
        if (this.selectionMode) {
            this.exitSelectionMode();
        }
        
        console.log('✅ 已清除私聊状态');
    }

    /**
     * 附加消息事件处理
     */
    attachMessageEvents() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages || this.eventsAttached) return;

        // 标记事件已附加，避免重复绑定
        this.eventsAttached = true;

        // 消息右键菜单
        chatMessages.addEventListener('contextmenu', (e) => {
            const messageElement = e.target.closest('.message');
            if (messageElement) {
                e.preventDefault();
                // 先关闭所有现有的右键菜单
                this.closeAllContextMenus();
                this.showMessageContextMenu(e, messageElement);
            }
        });

        // 全局点击事件：点击其他地方关闭右键菜单
        if (!this.globalClickAttached) {
            this.globalClickAttached = true;
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.message-context-menu')) {
                    this.closeAllContextMenus();
                }
            });
        }

        // 删除按钮点击事件
        chatMessages.addEventListener('click', (e) => {
            if (e.target.closest('.delete-message-btn')) {
                const messageId = e.target.closest('.delete-message-btn').dataset.messageId;
                if (messageId && messageId !== 'undefined') {
                    this.showDeleteConfirmation([messageId]);
                } else {
                    console.warn('⚠️ 无法获取消息ID，跳过删除操作');
                }
            }
        });

        // 消息选择框变化事件
        chatMessages.addEventListener('change', (e) => {
            if (e.target.classList.contains('message-checkbox')) {
                this.updateDeleteToolbar();
            }
        });
    }

    /**
     * 显示消息右键菜单
     */
    showMessageContextMenu(event, messageElement) {
        // 防抖：如果刚刚显示过菜单，则忽略
        const now = Date.now();
        if (this.lastMenuTime && now - this.lastMenuTime < 100) {
            return;
        }
        this.lastMenuTime = now;
        
        const messageId = messageElement.dataset.messageId;
        if (!messageId || messageId === 'undefined') {
            console.warn('⚠️ 无效的消息ID，无法显示右键菜单');
            return;
        }
        
        const currentUserId = this.getCurrentUserId();
        const isOwnMessage = messageElement.classList.contains('message-user');

        // 创建右键菜单
        const contextMenu = document.createElement('div');
        contextMenu.className = 'message-context-menu';
        contextMenu.innerHTML = `
            <div class="dropdown-menu show" style="position: absolute; z-index: 1000;">
                <button class="dropdown-item" data-action="select" data-message-id="${messageId}">
                    <i class="fas fa-check-square"></i> 选择消息
                </button>
                <button class="dropdown-item text-danger" data-action="delete" data-message-id="${messageId}">
                    <i class="fas fa-trash"></i> 删除消息
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" data-action="multi-select">
                    <i class="fas fa-tasks"></i> 多选模式
                </button>
            </div>
        `;

        // 添加事件监听器
        contextMenu.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const msgId = button.dataset.messageId;

            switch (action) {
                case 'select':
                    this.toggleMessageSelection(msgId);
                    break;
                case 'delete':
                    this.showDeleteConfirmation([msgId]);
                    break;
                case 'multi-select':
                    this.enterSelectionMode();
                    break;
            }
            
            this.closeContextMenu(button);
        });

        // 定位菜单并防止超出屏幕
        contextMenu.style.position = 'fixed';
        
        // 临时添加到页面以获取尺寸
        contextMenu.style.visibility = 'hidden';
        document.body.appendChild(contextMenu);
        
        const menuRect = contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 计算菜单位置，防止超出边界
        let left = event.clientX;
        let top = event.clientY;
        
        if (left + menuRect.width > viewportWidth) {
            left = viewportWidth - menuRect.width - 10;
        }
        
        if (top + menuRect.height > viewportHeight) {
            top = viewportHeight - menuRect.height - 10;
        }
        
        contextMenu.style.left = left + 'px';
        contextMenu.style.top = top + 'px';
        contextMenu.style.visibility = 'visible';
    }

    /**
     * 关闭所有右键菜单
     */
    closeAllContextMenus() {
        const contextMenus = document.querySelectorAll('.message-context-menu');
        contextMenus.forEach(menu => {
            if (document.body.contains(menu)) {
                try {
                    document.body.removeChild(menu);
                } catch (error) {
                    console.warn('右键菜单已被移除:', error);
                }
            }
        });
    }

    /**
     * 关闭右键菜单
     */
    closeContextMenu(buttonElement) {
        // 直接关闭所有右键菜单
        this.closeAllContextMenus();
    }

    /**
     * 切换消息选择状态
     */
    toggleMessageSelection(messageId) {
        const checkbox = document.querySelector(`input[data-message-id="${messageId}"]`);
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            this.updateDeleteToolbar();
        }
    }

    /**
     * 进入选择模式
     */
    enterSelectionMode() {
        this.selectionMode = true;
        
        // 关闭右键菜单
        this.closeAllContextMenus();
        
        // 显示所有复选框，允许选择所有消息
        document.querySelectorAll('.message-checkbox').forEach(checkbox => {
            checkbox.style.display = 'block';
            checkbox.disabled = false;
            checkbox.style.opacity = '1';
            checkbox.title = '';
        });

        // 显示工具栏
        this.showSelectionToolbar();
        
        // 显示快捷按钮
        const quickDeleteBtn = document.getElementById('quickDeleteBtn');
        const exitSelectionBtn = document.getElementById('exitSelectionBtn');
        if (quickDeleteBtn) {
            quickDeleteBtn.style.display = 'inline-block';
            quickDeleteBtn.disabled = true; // 初始状态禁用
        }
        if (exitSelectionBtn) exitSelectionBtn.style.display = 'inline-block';
        
        console.log('✅ 进入多选模式');
    }

    /**
     * 退出选择模式
     */
    exitSelectionMode() {
        this.selectionMode = false;
        
        // 关闭右键菜单
        this.closeAllContextMenus();
        
        // 隐藏所有复选框
        document.querySelectorAll('.message-checkbox').forEach(checkbox => {
            checkbox.style.display = 'none';
            checkbox.checked = false;
        });

        // 隐藏工具栏
        this.hideSelectionToolbar();
        
        // 隐藏快捷按钮
        const quickDeleteBtn = document.getElementById('quickDeleteBtn');
        const exitSelectionBtn = document.getElementById('exitSelectionBtn');
        if (quickDeleteBtn) quickDeleteBtn.style.display = 'none';
        if (exitSelectionBtn) exitSelectionBtn.style.display = 'none';
        
        console.log('✅ 退出多选模式');
    }

    /**
     * 显示选择工具栏
     */
    showSelectionToolbar() {
        let toolbar = document.getElementById('messageSelectionToolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = 'messageSelectionToolbar';
            toolbar.className = 'message-selection-toolbar';
            toolbar.innerHTML = `
                <div class="d-flex justify-content-between align-items-center p-2 bg-light border">
                    <div>
                        <button class="btn btn-sm btn-outline-primary" onclick="window.friendsManager.selectAllMessages()">
                            <i class="fas fa-check-double"></i> 全选
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="window.friendsManager.clearSelection()">
                            <i class="fas fa-times"></i> 清除
                        </button>
                    </div>
                    <div>
                        <span id="selectedCount" class="me-3">已选择: 0 条</span>
                        <button class="btn btn-sm btn-danger" onclick="window.friendsManager.deleteSelectedMessages()" disabled>
                            <i class="fas fa-trash"></i> 删除选中
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="window.friendsManager.exitSelectionMode()">
                            <i class="fas fa-times"></i> 取消
                        </button>
                    </div>
                </div>
            `;
            
            const chatContainer = document.querySelector('.chat-container') || document.querySelector('.chat-area');
            if (chatContainer) {
                chatContainer.insertBefore(toolbar, chatContainer.firstChild);
            } else {
                // 备用方案：插入到聊天消息区域上方
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages && chatMessages.parentElement) {
                    chatMessages.parentElement.insertBefore(toolbar, chatMessages);
                }
            }
        }
        toolbar.style.display = 'block';
    }

    /**
     * 隐藏选择工具栏
     */
    hideSelectionToolbar() {
        const toolbar = document.getElementById('messageSelectionToolbar');
        if (toolbar) {
            toolbar.style.display = 'none';
        }
    }

    /**
     * 更新删除工具栏状态
     */
    updateDeleteToolbar() {
        const selectedCheckboxes = document.querySelectorAll('.message-checkbox:checked');
        const selectedCount = selectedCheckboxes.length;
        
        const countElement = document.getElementById('selectedCount');
        const deleteButton = document.querySelector('#messageSelectionToolbar .btn-danger');
        const quickDeleteBtn = document.getElementById('quickDeleteBtn');
        
        if (countElement) {
            countElement.textContent = `已选择: ${selectedCount} 条`;
        }
        
        if (deleteButton) {
            deleteButton.disabled = selectedCount === 0;
        }
        
        // 同时更新快捷删除按钮
        if (quickDeleteBtn) {
            quickDeleteBtn.disabled = selectedCount === 0;
            quickDeleteBtn.textContent = selectedCount > 0 ? ` 删除 (${selectedCount})` : ' 删除';
            quickDeleteBtn.innerHTML = selectedCount > 0 
                ? `<i class="fas fa-trash"></i> 删除 (${selectedCount})`
                : `<i class="fas fa-trash"></i> 删除`;
        }
    }

    /**
     * 全选消息
     */
    selectAllMessages() {
        document.querySelectorAll('.message-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
        this.updateDeleteToolbar();
    }

    /**
     * 清除选择
     */
    clearSelection() {
        document.querySelectorAll('.message-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateDeleteToolbar();
    }

    /**
     * 加载消息的已读状态
     * @param {string} friendId 好友ID
     * @param {Array} messages 消息列表
     */
    async loadMessageReadStatus(friendId, messages) {
        try {
            const currentUserId = this.getCurrentUserId();
            
            // 只获取当前用户发送的消息的已读状态
            const userMessages = messages.filter(msg => msg.senderId === currentUserId);
            if (userMessages.length === 0) return;
            
            const messageIds = userMessages.map(msg => msg.id || msg._id || msg.messageId || msg.message_id);
            
            // 调用API获取已读状态
            const response = await this.friendsApi.getMessageReadStatus(friendId, messageIds);
            
            if (response.success && response.data) {
                this.updateMessageReadIndicators(response.data);
            }
        } catch (error) {
            console.error('❌ 加载消息已读状态失败:', error.message);
        }
    }

    /**
     * 更新消息的已读指示器
     * @param {Object} readStatusData 已读状态数据
     */
    updateMessageReadIndicators(readStatusData) {
        Object.entries(readStatusData).forEach(([messageId, isRead]) => {
            if (isRead) {
                this.addReadIndicator(messageId);
            }
        });
    }

    /**
     * 为消息添加已读指示器
     * @param {string} messageId 消息ID
     */
    addReadIndicator(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement || !messageElement.classList.contains('message-user')) return;
        
        // 检查是否已经有已读指示器
        const existingIndicator = messageElement.querySelector('.message-read-status');
        if (existingIndicator) return;
        
        // 创建已读指示器
        const readIndicator = document.createElement('div');
        readIndicator.className = 'message-read-status';
        readIndicator.innerHTML = '<span class="message-read-indicator" title="对方已读"></span>';
        
        // 添加到消息气泡中
        const messageBubble = messageElement.querySelector('.message-bubble');
        if (messageBubble) {
            messageBubble.appendChild(readIndicator);
        }
    }

    /**
     * 删除选中的消息
     */
    deleteSelectedMessages() {
        const selectedCheckboxes = document.querySelectorAll('.message-checkbox:checked');
        
        // 获取消息ID
        const messageIds = Array.from(selectedCheckboxes)
            .map(cb => cb.dataset.messageId)
            .filter(id => id && id !== 'undefined' && id !== 'null');
        
        if (messageIds.length > 0) {
            this.showDeleteConfirmation(messageIds);
        } else {
            alert('未选择有效的消息');
        }
    }

    /**
     * 显示删除确认对话框
     */
    showDeleteConfirmation(messageIds) {
        const messageCount = messageIds.length;
        const message = messageCount === 1 ? '确定要删除这条消息吗？' : `确定要删除选中的 ${messageCount} 条消息吗？`;
        
        if (confirm(message)) {
            this.deleteMessages(messageIds);
        }
    }

    /**
     * 删除消息
     */
    async deleteMessages(messageIds) {
        try {
            // 记录要删除的消息详情
            const messageElements = messageIds.map(id => {
                const element = document.querySelector(`[data-message-id="${id}"]`);
                return {
                    id,
                    exists: !!element,
                    isOwnMessage: element ? element.classList.contains('message-user') : false,
                    element: element
                };
            });

            if (messageIds.length === 1) {
                await this.friendsApi.deleteMessage(messageIds[0]);
            } else {
                await this.friendsApi.deleteMessages(messageIds);
            }

            // 从DOM中移除消息元素
            let removedCount = 0;
            messageIds.forEach(messageId => {
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageElement) {
                    messageElement.remove();
                    removedCount++;
                }
            });

            // 如果是选择模式，更新工具栏
            if (this.selectionMode) {
                this.updateDeleteToolbar();
            }

            // 显示成功提示
            if (removedCount > 0) {
                const message = removedCount === 1 ? '消息删除成功' : `成功删除 ${removedCount} 条消息`;
                showToast(message, 'success');
            }

        } catch (error) {
            console.error('❌ 删除消息失败:', error);
            
            // 根据错误类型提供具体的用户提示
            let errorMessage = '删除消息失败';
            
            if (error.message.includes('网络错误') || error.message.includes('fetch')) {
                errorMessage = '网络连接失败，请检查网络后重试';
            } else if (error.message.includes('未授权') || error.message.includes('401')) {
                errorMessage = '登录已过期，请重新登录';
                setTimeout(() => {
                    window.location.href = './login.html';
                }, 2000);
            } else if (error.message.includes('权限') || error.message.includes('403')) {
                errorMessage = '权限不足，无法删除此消息';
            } else if (error.message.includes('不存在') || error.message.includes('404')) {
                errorMessage = '消息不存在或已被删除';
                // 如果消息不存在，仍然从DOM中移除
                messageIds.forEach(messageId => {
                    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                    if (messageElement) {
                        messageElement.remove();
                    }
                });
            }
            
            alert(errorMessage);
        }
    }

    /**
     * 显示搜索对话框
     */
    showSearchDialog() {
        if (!this.currentPrivateChat) {
            alert('请先选择一个好友开始聊天');
            return;
        }

        // 创建搜索对话框
        const searchDialog = document.createElement('div');
        searchDialog.className = 'modal fade';
        searchDialog.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">搜索聊天记录</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <input type="text" class="form-control" id="searchKeyword" placeholder="输入搜索关键词...">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">时间范围（可选）</label>
                            <div class="row">
                                <div class="col-6">
                                    <input type="date" class="form-control" id="searchStartDate">
                                </div>
                                <div class="col-6">
                                    <input type="date" class="form-control" id="searchEndDate">
                                </div>
                            </div>
                        </div>
                        <div id="searchResults" class="border rounded p-3" style="max-height: 300px; overflow-y: auto; display: none;">
                            <!-- 搜索结果将在这里显示 -->
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" onclick="window.friendsManager.performSearch()">搜索</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(searchDialog);
        
        // 显示对话框
        const modal = new bootstrap.Modal(searchDialog);
        modal.show();

        // 对话框关闭时移除DOM元素
        searchDialog.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(searchDialog);
        });

        // 回车搜索
        const keywordInput = searchDialog.querySelector('#searchKeyword');
        keywordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
    }

    /**
     * 执行搜索
     */
    async performSearch() {
        const keyword = document.getElementById('searchKeyword').value.trim();
        const startDate = document.getElementById('searchStartDate').value;
        const endDate = document.getElementById('searchEndDate').value;
        const resultsDiv = document.getElementById('searchResults');

        if (!keyword) {
            alert('请输入搜索关键词');
            return;
        }

        try {
            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = '<div class="text-center"><div class="spinner"></div><p>搜索中...</p></div>';

            const options = {};
            if (startDate || endDate) {
                options.dateRange = { start: startDate, end: endDate };
            }

            const response = await this.friendsApi.searchMessages(this.currentPrivateChat.friendId, keyword, options);
            
            if (response.data && response.data.messages) {
                this.renderSearchResults(response.data.messages, keyword);
            } else {
                resultsDiv.innerHTML = '<div class="text-center text-muted"><p>没有找到匹配的消息</p></div>';
            }
        } catch (error) {
            console.error('❌ 搜索失败:', error);
            resultsDiv.innerHTML = '<div class="text-center text-danger"><p>搜索失败，请重试</p></div>';
        }
    }

    /**
     * 渲染搜索结果
     */
    renderSearchResults(messages, keyword) {
        const resultsDiv = document.getElementById('searchResults');
        const currentUserId = this.getCurrentUserId();

        if (messages.length === 0) {
            resultsDiv.innerHTML = '<div class="text-center text-muted"><p>没有找到匹配的消息</p></div>';
            return;
        }

        const highlightKeyword = (text, keyword) => {
            const regex = new RegExp(`(${keyword})`, 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        };

        resultsDiv.innerHTML = messages.map(message => {
            const isCurrentUser = message.senderId === currentUserId;
            const senderName = isCurrentUser ? '我' : message.senderInfo?.username || this.currentPrivateChat.friendName;
            const highlightedContent = highlightKeyword(this.escapeHtml(message.content), keyword);
            
            return `
                <div class="search-result-item mb-2 p-2 border rounded">
                    <div class="d-flex justify-content-between">
                        <small class="text-primary">${senderName}</small>
                        <small class="text-muted">${this.formatTime(new Date(message.createdAt))}</small>
                    </div>
                    <div class="search-result-content">${highlightedContent}</div>
                </div>
            `;
        }).join('');

        console.log(`✅ 搜索完成，找到 ${messages.length} 条匹配的消息`);
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
