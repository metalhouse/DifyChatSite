/**
 * 聊天室控制器 - 基于WebSocket实时聊天室模块
 * 实现多人群聊、实时消息、智能体交互等功能
 */

class ChatroomController {
    constructor() {
        this.websocket = null;
        this.currentRoom = null;
        this.currentUser = null;
        this.rooms = [];
        this.onlineUsers = [];
        this.typingUsers = [];
        this.agents = [];
        this.connectionStatus = 'disconnected';
        
        // 消息去重：记录已处理的消息ID
        this.processedMessages = new Set();
        
        // 初始化好友管理器
        this.friendsManager = null;
        
        // DOM 元素
        this.elements = {
            roomList: document.getElementById('roomList'),
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            mentionButton: document.getElementById('mentionButton'),
            connectionStatus: document.getElementById('connectionStatus'),
            statusText: document.getElementById('statusText'),
            currentRoomName: document.getElementById('currentRoomName'),
            onlineMembers: document.getElementById('onlineMembers'),
            memberAvatars: document.getElementById('memberAvatars'),
            typingIndicators: document.getElementById('typingIndicators'),
            createRoomBtn: document.getElementById('createRoomBtn'),
            agentList: document.getElementById('agentList')
        };

        console.log('DOM元素初始化:', this.elements);
        
        // 绑定事件
        this.bindEvents();
        
        // 输入状态管理
        this.typingTimer = null;
        this.isTyping = false;
    }

    /**
     * 初始化聊天室控制器
     */
    async initialize() {
        try {
            // 获取当前用户信息
            await this.loadUserInfo();
            
            // 初始化房间管理服务
            this.roomManagementService = new RoomManagementService();
            
            // 初始化好友管理器
            this.friendsManager = new FriendsManager(this);
            await this.friendsManager.initialize();
            
            // 设置全局引用，以便HTML中的按钮可以调用
            window.friendsManager = this.friendsManager;
            
            // 初始化WebSocket连接
            this.initializeWebSocket();
            
            // 加载智能体列表
            await this.loadAgents();
            
            console.log('聊天室控制器初始化完成');
        } catch (error) {
            console.error('初始化聊天室失败:', error);
            this.showError('初始化聊天室失败，请刷新页面重试');
        }
    }

    /**
     * 加载用户信息
     */
    async loadUserInfo() {
        try {
            const userInfo = await AuthService.getCurrentUser();
            this.currentUser = userInfo;
            
            // 更新导航栏用户名
            const usernameElement = document.getElementById('currentUsername');
            if (usernameElement) {
                usernameElement.textContent = userInfo.username;
            }
            
            console.log('用户信息加载完成:', userInfo);
        } catch (error) {
            console.error('加载用户信息失败:', error);
            throw error;
        }
    }

    /**
     * 初始化WebSocket连接
     */
    initializeWebSocket() {
        const token = TokenManager.getAccessToken();
        if (!token) {
            this.showError('用户未登录');
            window.location.href = './login.html';
            return;
        }

        // 从配置文件获取服务器地址
        const serverUrl = (window.ENV_CONFIG && window.ENV_CONFIG.getWsUrl) ? 
            window.ENV_CONFIG.getWsUrl() : 
            (globalConfig ? globalConfig.websocket.url : 'http://localhost:4005');

        console.log('连接WebSocket服务器:', serverUrl);

        // 创建Socket.IO连接
        this.websocket = io(serverUrl, {
            auth: {
                token: token  // 根据API指南，直接传递token，不需要Bearer前缀
            },
            transports: ['websocket', 'polling'],
            forceNew: true,
            timeout: 10000,
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        console.log('🔑 [前端] 使用Token认证:', token.substring(0, 20) + '...');
        console.log('🚀 [前端] WebSocket配置:', {
            url: serverUrl,
            transports: ['websocket', 'polling'],
            timeout: 10000
        });

        this.setupWebSocketEvents();
    }

    /**
     * 设置WebSocket事件监听
     */
    setupWebSocketEvents() {
        // 连接事件
        this.websocket.on('connect', () => {
            console.log('✅ [前端] WebSocket连接成功:', this.websocket.id);
            console.log('🔗 [前端] 连接详情:', {
                id: this.websocket.id,
                connected: this.websocket.connected,
                transport: this.websocket.io.engine.transport.name
            });
            this.updateConnectionStatus('connected');
            this.loadRooms();
        });

        // 认证成功事件
        this.websocket.on('authenticated', (data) => {
            console.log('🔑 [前端] WebSocket认证成功:', data);
            this.showSuccess('认证成功');
        });

        // 认证失败事件
        this.websocket.on('authentication-failed', (data) => {
            console.error('❌ [前端] WebSocket认证失败:', data);
            this.showError('认证失败: ' + (data.message || '无效的访问令牌'));
            // 清除无效token并重新登录
            TokenManager.clearTokens();
            setTimeout(() => {
                window.location.href = './login.html';
            }, 2000);
        });

        // 监听未授权事件（Socket.IO标准事件）
        this.websocket.on('unauthorized', (error) => {
            console.error('❌ [前端] WebSocket未授权访问:', error);
            this.showError('访问被拒绝，请重新登录');
            TokenManager.clearTokens();
            setTimeout(() => {
                window.location.href = './login.html';
            }, 2000);
        });

        // 连接错误
        this.websocket.on('connect_error', (error) => {
            console.error('💥 [前端] WebSocket连接错误:', error);
            console.error('🔍 [前端] 错误详情:', {
                type: error.type,
                description: error.description,
                context: error.context,
                message: error.message
            });
            this.updateConnectionStatus('disconnected');
            this.showError('连接失败: ' + error.message);
        });

        // 断开连接
        this.websocket.on('disconnect', (reason, details) => {
            console.log('💔 [前端] WebSocket连接断开:', reason);
            console.log('🔍 [前端] 断开详情:', details);
            console.log('📊 [前端] 断开时的连接状态:', {
                connected: this.websocket.connected,
                id: this.websocket.id
            });
            this.updateConnectionStatus('disconnected');
            
            if (reason === 'io server disconnect') {
                this.showError('服务器主动断开连接，可能是认证失败');
            } else {
                this.showWarning('连接已断开: ' + reason);
            }
        });

        // 房间相关事件
        this.websocket.on('room-list', (rooms) => {
            console.log('✅ [前端] 收到房间列表响应:', rooms);
            console.log('📊 [前端] 房间数量:', rooms ? rooms.length : 0);
            
            if (rooms && Array.isArray(rooms)) {
                this.rooms = rooms;
                this.renderRoomList();
                console.log('🎯 [前端] 房间列表渲染完成');
            } else {
                console.warn('⚠️ [前端] 房间列表数据格式异常:', rooms);
                this.rooms = [];
                this.renderRoomList();
            }
        });

        this.websocket.on('join-room-success', (data) => {
            console.log('✅ [前端] 成功加入房间:', data);
            
            // 清除timeout
            if (this.joinRoomTimeout) {
                clearTimeout(this.joinRoomTimeout);
                this.joinRoomTimeout = null;
            }
            
            this.currentRoom = data;
            this.updateRoomInfo(data);
            this.showSuccess(`成功加入房间: ${data.roomName || data.name || data.roomId}`);
            
            // 主动请求房间状态和在线用户信息
            setTimeout(() => {
                const roomId = data.id || data.roomId;
                console.log('🔄 [前端] 请求房间状态和在线用户信息:', roomId);
                this.websocket.emit('get-room-state', { roomId: roomId });
            }, 500);
        });

        this.websocket.on('join-room-error', (data) => {
            console.error('加入房间失败:', data);
            this.showError('加入房间失败: ' + data.error);
        });

        this.websocket.on('room-state', (roomInfo) => {
            console.log('房间状态更新:', roomInfo);
            this.updateOnlineMembers(roomInfo.onlineUsers || []);
        });

        // 额外的在线用户更新事件
        this.websocket.on('online-users', (data) => {
            console.log('📊 [前端] 在线用户更新:', data);
            if (data.users) {
                this.updateOnlineMembers(data.users);
            } else if (Array.isArray(data)) {
                this.updateOnlineMembers(data);
            }
        });

        this.websocket.on('room-users-updated', (data) => {
            console.log('👥 [前端] 房间用户列表更新:', data);
            if (data.onlineUsers) {
                this.updateOnlineMembers(data.onlineUsers);
            }
        });

        // 创建房间相关事件
        this.websocket.on('create-room-success', (data) => {
            console.log('✅ [前端] 创建房间成功响应:', data);
            this.showSuccess(`房间 "${data.roomName || data.name}" 创建成功`);
            
            // 重新加载房间列表
            setTimeout(() => {
                console.log('🔄 [前端] 创建房间成功后重新加载房间列表');
                this.loadRooms();
            }, 1000);
        });

        this.websocket.on('create-room-error', (data) => {
            console.error('❌ [前端] 创建房间失败响应:', data);
            this.showError('创建房间失败: ' + (data.error || data.message || '未知错误'));
        });

        // 消息相关事件
        this.websocket.on('new-message', (message) => {
            console.log('📨 [前端] 收到新消息:', message);
            this.handleNewMessage(message);
        });

        this.websocket.on('message-sent', (data) => {
            console.log('✅ [前端] 消息发送成功确认:', data);
            // 移除本地待确认状态
            const pendingMessages = this.elements.chatMessages.querySelectorAll('.message .message-status');
            pendingMessages.forEach(status => {
                if (status.textContent.includes('发送中')) {
                    status.style.display = 'none';
                }
            });
        });

        // 支持API指南中的新事件格式
        this.websocket.on('send-message-success', (data) => {
            console.log('✅ [前端] 消息发送成功 (新格式):', data);
            this.handleMessageSentConfirmation(data);
        });

        this.websocket.on('messageSent', (data) => {
            console.log('✅ [前端] 消息发送成功 (兼容格式):', data);
            this.handleMessageSentConfirmation(data);
        });

        // 支持多种消息接收事件格式（注意：这些可能会重复，由handleNewMessage内部去重）
        this.websocket.on('newMessage', (message) => {
            console.log('📨 [前端] 收到新消息 (兼容格式):', message);
            this.handleNewMessage(message);
        });

        // 私聊消息相关事件
        this.websocket.on('private_message', (message) => {
            console.log('📨 [前端] 收到私聊消息:', message);
            this.handlePrivateMessage(message);
        });

        this.websocket.on('privateMessage', (message) => {
            console.log('📨 [前端] 收到私聊消息 (兼容格式):', message);
            this.handlePrivateMessage(message);
        });

        this.websocket.on('private-message-sent', (data) => {
            console.log('✅ [前端] 私聊消息发送成功:', data);
            this.handlePrivateMessageSent(data);
        });

        // 监听消息已读状态更新
        this.websocket.on('message-read', (data) => {
            console.log('👀 [前端] 消息已读状态更新:', data);
            this.handleMessageRead(data);
        });

        // 通用消息事件 - 注意可能与其他事件重复
        this.websocket.on('message', (message) => {
            console.log('📨 [前端] 收到新消息 (通用格式，可能重复):', message);
            // 为避免重复，先检查是否最近已处理过相同内容的消息
            const recentKey = `recent_${message.content}_${message.senderId || message.userId}_${Date.now()}`;
            const contentKey = `content_${message.content.trim()}_${message.senderId || message.userId}`;
            
            // 检查最近3秒内是否处理过相同内容
            if (!this.recentProcessed) {
                this.recentProcessed = new Map();
            }
            
            const now = Date.now();
            const cutoff = now - 3000; // 3秒前
            
            // 清理过期的记录
            for (let [key, timestamp] of this.recentProcessed.entries()) {
                if (timestamp < cutoff) {
                    this.recentProcessed.delete(key);
                }
            }
            
            // 检查是否重复
            if (!this.recentProcessed.has(contentKey)) {
                this.recentProcessed.set(contentKey, now);
                this.handleNewMessage(message);
            } else {
                console.log('🔄 [前端] 跳过可能重复的通用消息事件');
            }
        });

        this.websocket.on('send-message-error', (data) => {
            console.error('发送消息失败:', data);
            this.showError('发送消息失败: ' + data.error);
        });

        // 用户动态事件
        this.websocket.on('user-joined', (data) => {
            console.log('用户加入房间:', data);
            this.showInfo(`${data.username} 加入了房间`);
            
            // 更新在线用户列表
            if (data.onlineUsers) {
                this.updateOnlineMembers(data.onlineUsers);
            } else {
                // 如果没有完整列表，请求房间状态更新
                this.websocket.emit('get-room-state', { roomId: this.currentRoom?.id || this.currentRoom?.roomId });
            }
        });

        this.websocket.on('user-left', (data) => {
            console.log('用户离开房间:', data);
            this.showInfo(`${data.username} 离开了房间`);
            
            // 更新在线用户列表
            if (data.onlineUsers) {
                this.updateOnlineMembers(data.onlineUsers);
            } else {
                // 如果没有完整列表，请求房间状态更新
                this.websocket.emit('get-room-state', { roomId: this.currentRoom?.id || this.currentRoom?.roomId });
            }
        });

        // 正在输入事件
        this.websocket.on('userTyping', (data) => {
            console.log('用户正在输入:', data);
            this.updateTypingIndicator(data);
        });

        // 智能体相关事件
        this.websocket.on('agent-typing', (data) => {
            console.log('智能体正在思考:', data);
            this.showAgentTyping(data);
        });

        this.websocket.on('agent-typing-stop', (data) => {
            console.log('智能体思考完成:', data);
            this.hideAgentTyping(data.agentId);
        });

        // 支持API指南中的新智能体事件
        this.websocket.on('agent-thinking', (data) => {
            console.log('🤖 [前端] AI助手正在思考 (新格式):', data);
            this.showAgentTyping({
                agentId: data.agentId,
                agentName: 'AI助手'
            });
        });

        this.websocket.on('agent-response', (data) => {
            console.log('🤖 [前端] AI助手回复 (新格式):', data);
            this.hideAgentTyping(data.agentId);
            
            // 将AI助手响应作为消息显示
            const agentMessage = {
                id: data.messageId || 'agent_' + Date.now(),
                content: data.content,
                username: 'AI助手',
                agentId: data.agentId,
                createdAt: data.timestamp || new Date().toISOString(),
                encrypted: data.encrypted || false,
                type: 'agent_response'
            };
            
            this.addMessage(agentMessage);
        });

        this.websocket.on('agent-error', (data) => {
            console.error('🤖 [前端] AI助手错误 (新格式):', data);
            this.hideAgentTyping();
            this.showError('AI助手错误: ' + data.error);
        });

        // 增强房间管理事件 - 基于后端报告
        this.websocket.on('room-deleted', (data) => {
            console.log('📢 [前端] 房间被删除:', data);
            this.showWarning(`房间 "${data.roomName}" 已被房主删除`);
            
            // 如果当前在被删除的房间内，清空状态并返回房间列表
            if (this.currentRoom && (this.currentRoom.id === data.roomId || this.currentRoom.roomId === data.roomId)) {
                this.currentRoom = null;
                this.updateRoomInfo(null);
                this.clearChat();
            }
            
            // 刷新房间列表
            setTimeout(() => {
                this.loadRooms();
            }, 1000);
        });

        this.websocket.on('force-leave-room', (data) => {
            console.log('🚪 [前端] 被强制离开房间:', data);
            this.showWarning(`您已被强制离开房间: ${data.reason || '房间已删除'}`);
            
            // 清空当前房间状态
            if (this.currentRoom && (this.currentRoom.id === data.roomId || this.currentRoom.roomId === data.roomId)) {
                this.currentRoom = null;
                this.updateRoomInfo(null);
                this.clearChat();
            }
            
            // 刷新房间列表
            setTimeout(() => {
                this.loadRooms();
            }, 500);
        });

        this.websocket.on('user-kicked', (data) => {
            console.log('👮 [前端] 用户被踢出:', data);
            this.showWarning(`${data.username || '用户'} 被踢出房间`);
            
            // 如果是当前用户被踢出
            if (this.currentUser && data.userId === this.currentUser.id) {
                this.showError(`您已被踢出房间: ${data.reason || '无原因说明'}`);
                this.currentRoom = null;
                this.updateRoomInfo(null);
                this.clearChat();
                
                // 刷新房间列表
                setTimeout(() => {
                    this.loadRooms();
                }, 1000);
            }
        });

        this.websocket.on('agent-mentioned', (data) => {
            console.log('🤖 [前端] AI助手被提及:', data);
            this.showInfo(`AI助手 ${data.agentName} 被提及`);
        });

        this.websocket.on('mention-agent-success', (data) => {
            console.log('🤖 [前端] AI助手提及成功:', data);
            this.showSuccess(`成功提及AI助手: ${data.agentName}`);
        });

        this.websocket.on('mention-agent-error', (data) => {
            console.error('@智能体失败:', data);
            this.showError('@智能体失败: ' + data.error);
        });

        // 通用错误处理
        this.websocket.on('error', (error) => {
            console.error('WebSocket错误:', error);
            this.showError('WebSocket错误: ' + error.message);
        });
    }

    /**
     * 绑定DOM事件
     */
    bindEvents() {
        // 发送消息按钮
        this.elements.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // 消息输入框
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 输入状态检测
        this.elements.messageInput.addEventListener('input', () => {
            this.handleTypingStatus();
        });

        // @智能体按钮
        this.elements.mentionButton.addEventListener('click', () => {
            this.showMentionAgentModal();
        });

        // 创建房间按钮 - 在模态框中的实际创建按钮
        const modalCreateBtn = document.getElementById('modalCreateRoomBtn');
        if (modalCreateBtn) {
            modalCreateBtn.addEventListener('click', () => {
                console.log('🔧 [前端] 模态框中的创建房间按钮被点击');
                this.createRoom();
            });
            console.log('✅ [前端] 创建房间按钮事件绑定成功');
        } else {
            console.error('❌ [前端] 创建房间按钮元素未找到');
        }

        // 防止创建房间表单的默认提交行为
        const createRoomForm = document.getElementById('createRoomForm');
        if (createRoomForm) {
            createRoomForm.addEventListener('submit', (e) => {
                e.preventDefault(); // 阻止表单默认提交
                console.log('🔧 [前端] 创建房间表单提交被拦截');
                this.createRoom(); // 手动调用创建函数
            });
            console.log('✅ [前端] 创建房间表单事件绑定成功');
        }

        // 创建房间输入框回车键支持
        const roomNameInput = document.getElementById('roomName');
        if (roomNameInput) {
            roomNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // 防止表单提交
                    this.createRoom();
                }
            });
        }

        // 消息输入框自动调整高度
        this.elements.messageInput.addEventListener('input', () => {
            this.adjustTextareaHeight();
        });
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(status) {
        this.connectionStatus = status;
        const statusElement = this.elements.connectionStatus;
        const statusText = this.elements.statusText;

        // 清除所有状态类
        statusElement.className = 'connection-status';
        
        switch (status) {
            case 'connected':
                statusElement.classList.add('connected');
                statusText.textContent = '已连接';
                break;
            case 'connecting':
                statusElement.classList.add('connecting');
                statusText.textContent = '连接中...';
                break;
            case 'disconnected':
                statusElement.classList.add('disconnected');
                statusText.textContent = '已断开';
                break;
        }
    }

    /**
     * 加载房间列表
     */
    loadRooms() {
        if (this.websocket && this.websocket.connected) {
            console.log('🔄 [前端] 发送房间列表请求: get-room-list');
            console.log('🔌 [前端] WebSocket连接状态:', this.websocket.connected);
            console.log('🆔 [前端] WebSocket连接ID:', this.websocket.id);
            
            this.websocket.emit('get-room-list');
            
            // 添加请求超时监控（仅用于调试，不做处理）
            setTimeout(() => {
                try {
                    if (!this || !this.rooms || this.rooms.length === 0) {
                        console.error('⚠️ [前端] 5秒内未收到房间列表响应，可能的问题：');
                        console.error('1. 后端未监听 "get-room-list" 事件');
                        console.error('2. 后端处理 "get-room-list" 时发生错误');
                        console.error('3. 后端未发送 "room-list" 响应事件');
                        console.error('4. 数据库查询房间列表时出错');
                        console.error('5. WebSocket连接在请求期间断开');
                    }
                } catch (error) {
                    console.error('⚠️ [前端] 超时检测回调执行出错:', error);
                }
            }, 5000);
        } else {
            console.error('❌ [前端] WebSocket未连接，无法加载房间列表');
            this.showError('WebSocket连接已断开，无法加载房间列表');
        }
    }

    /**
     * 渲染房间列表
     */
    renderRoomList() {
        const roomListElement = this.elements.roomList;
        
        if (!this.rooms || this.rooms.length === 0) {
            roomListElement.innerHTML = `
                <div class="text-center text-muted p-3">
                    <i class="fas fa-comments fa-2x mb-2"></i>
                    <p>暂无聊天室</p>
                    <small>点击右上角+号创建新房间</small>
                </div>
            `;
            return;
        }

        const isDeleteMode = document.body.classList.contains('room-delete-mode');
        const roomsHTML = this.rooms.map(room => {
            const canDelete = this.canUserDeleteRoom(room);
            
            return `
            <div class="room-item ${room.id === this.currentRoom?.id || room.id === this.currentRoom?.roomId ? 'active' : ''}" 
                 ${!isDeleteMode ? `onclick="chatroomController.joinRoom('${room.id}')"` : ''}>
                ${isDeleteMode && canDelete ? `
                    <div class="room-checkbox-wrapper">
                        <input type="checkbox" class="room-checkbox" data-room-id="${room.id}" data-room-name="${this.escapeHtml(room.name || room.roomName || room.title)}" onchange="updateDeleteButtonState()">
                    </div>
                ` : ''}
                <div class="room-avatar ${isDeleteMode && !canDelete ? 'disabled' : ''}">
                    <i class="fas fa-users"></i>
                </div>
                <div class="room-info">
                    <div class="room-name">${this.escapeHtml(room.name || room.roomName || room.title || '未命名房间')}</div>
                    <div class="room-meta">
                        <span class="room-members">${room.memberCount || room.members_count || 0} 人</span>
                        <div class="room-status ${room.isActive !== false ? '' : 'inactive'}"></div>
                        ${isDeleteMode && !canDelete ? '<span class="text-muted" style="font-size: 0.7rem;">(无权限)</span>' : ''}
                    </div>
                </div>
            </div>
        `;
        }).join('');

        roomListElement.innerHTML = roomsHTML;
    }

    /**
     * 检查用户是否可以删除房间
     */
    canUserDeleteRoom(room) {
        if (!this.currentUser || !room) {
            console.log('🔍 [权限检查] 用户或房间信息缺失:', { 
                user: this.currentUser, 
                room: room 
            });
            return false;
        }
        
        // 使用 creatorId 字段（后端返回的驼峰命名格式）
        const isOwner = room.creatorId === this.currentUser.id;
        
        console.log('🔍 [权限检查] 删除权限验证:', {
            roomId: room.id || room.roomId,
            roomName: room.name || room.roomName,
            currentUserId: this.currentUser.id,
            roomCreatorId: room.creatorId,
            isOwner: isOwner
        });
        
        return isOwner;
    }

    /**
     * 加入房间
     */
    joinRoom(roomId) {
        if (!this.websocket || !this.websocket.connected) {
            this.showError('WebSocket未连接');
            return;
        }

        if (this.currentRoom?.roomId === roomId || this.currentRoom?.id === roomId) {
            return; // 已在当前房间
        }

        // 清除私聊状态
        if (this.friendsManager) {
            this.friendsManager.clearPrivateChat();
        }

        console.log('📍 [前端] 加入房间:', roomId);
        
        // 查找房间信息
        const room = this.rooms.find(r => r.id === roomId || r.roomId === roomId);
        if (!room) {
            console.error('❌ [前端] 未找到房间信息:', roomId);
            this.showError('房间信息未找到');
            return;
        }

        console.log('🏠 [前端] 找到房间信息:', room);

        // 发送加入房间请求
        this.websocket.emit('join-room', { roomId });
        
        // 临时解决方案：如果2秒内没有收到join-room-success响应，直接设置房间
        // 这是为了处理后端可能没有实现join-room事件的情况
        const timeoutId = setTimeout(() => {
            if (!this.currentRoom || (this.currentRoom.id !== roomId && this.currentRoom.roomId !== roomId)) {
                console.warn('⚠️ [前端] 2秒内未收到join-room-success响应，直接设置房间');
                console.warn('💡 [前端] 后端需要实现以下事件处理:');
                console.warn('   - join-room 事件监听器');
                console.warn('   - 响应 join-room-success 事件');
                
                // 直接设置当前房间
                this.currentRoom = {
                    id: room.id,
                    roomId: room.id,
                    roomName: room.name || room.roomName || room.title,
                    ...room
                };
                
                this.updateRoomInfo(this.currentRoom);
                this.showSuccess(`已选择房间: ${this.currentRoom.roomName}`);
                
                // 请求房间状态和在线用户信息
                setTimeout(() => {
                    console.log('🔄 [前端] 请求房间状态和在线用户信息 (临时方案):', roomId);
                    this.websocket.emit('get-room-state', { roomId: roomId });
                }, 500);
            }
        }, 2000);

        // 保存timeout ID以便在成功时清除
        this.joinRoomTimeout = timeoutId;
    }

    /**
     * 离开房间
     */
    async leaveRoom() {
        try {
            if (!this.currentRoom) {
                this.showWarning('您目前不在任何房间中');
                return;
            }

            if (!this.currentUser) {
                this.showError('用户未登录');
                return;
            }

            const roomId = this.currentRoom.id || this.currentRoom.roomId;
            const roomName = this.currentRoom.roomName || this.currentRoom.name;

            // 检查是否为房主
            const isOwner = this.currentRoom.creatorId === this.currentUser.id;
            if (isOwner) {
                this.showError('房主不能离开房间，如需解散房间请使用删除功能');
                return;
            }

            console.log('🚪 [前端] 准备离开房间:', {
                roomId: roomId,
                roomName: roomName,
                userId: this.currentUser.id
            });

            // 显示加载状态
            this.showInfo('正在离开房间...');

            // 调用后端API
            await this.roomManagementService.leaveRoom(roomId);

            // 通知WebSocket服务器
            this.websocket.emit('leave-room', { roomId: roomId });

            // 清空当前房间状态
            this.currentRoom = null;
            this.updateRoomInfo(null);
            this.clearChat();

            // 显示成功消息
            this.showSuccess(`已离开房间: ${roomName}`);

            // 刷新房间列表
            setTimeout(() => {
                this.loadRooms();
            }, 500);

        } catch (error) {
            console.error('❌ [前端] 离开房间失败:', error);
            this.showError('离开房间失败: ' + (error.message || '未知错误'));
        }
    }

    /**
     * 更新房间信息
     */
    updateRoomInfo(roomData) {
        if (!roomData) {
            // 清空状态 - 没有选择房间
            this.elements.currentRoomName.innerHTML = '<i class="fas fa-users me-2"></i>请选择聊天室';
            
            // 禁用输入控件
            this.elements.messageInput.disabled = true;
            this.elements.sendButton.disabled = true;
            this.elements.mentionButton.disabled = true;
            this.elements.messageInput.placeholder = '请先选择一个聊天室';

            // 隐藏所有房间管理按钮
            const onlineMembers = document.getElementById('onlineMembers');
            const deleteRoomBtn = document.getElementById('deleteRoomBtn');
            const manageMembersBtn = document.getElementById('manageMembersBtn');
            const leaveRoomBtn = document.getElementById('leaveRoomBtn');
            
            if (onlineMembers) onlineMembers.style.display = 'none';
            if (deleteRoomBtn) deleteRoomBtn.style.display = 'none';
            if (manageMembersBtn) manageMembersBtn.style.display = 'none';
            if (leaveRoomBtn) leaveRoomBtn.style.display = 'none';

            // 显示欢迎消息
            this.elements.chatMessages.innerHTML = `
                <div class="text-center text-muted mt-5">
                    <i class="fas fa-users fa-3x mb-3"></i>
                    <h5>欢迎使用 WebSocket 聊天室</h5>
                    <p>请从左侧选择一个聊天室开始群聊，或创建新的聊天室</p>
                </div>
            `;
            
            this.processedMessages.clear();
            return;
        }

        // 更新房间名称
        this.elements.currentRoomName.innerHTML = `
            <i class="fas fa-users me-2"></i>
            ${this.escapeHtml(roomData.roomName || roomData.roomId)}
        `;

        // 启用输入控件
        this.elements.messageInput.disabled = false;
        this.elements.sendButton.disabled = false;
        this.elements.mentionButton.disabled = false;
        this.elements.messageInput.placeholder = '输入您的消息... (Shift+Enter换行，Enter发送，@智能体名 可以@智能体)';

        // 显示/隐藏房间管理按钮
        const onlineMembers = document.getElementById('onlineMembers');
        const deleteRoomBtn = document.getElementById('deleteRoomBtn');
        const manageMembersBtn = document.getElementById('manageMembersBtn');
        
        if (onlineMembers) onlineMembers.style.display = 'flex';
        if (manageMembersBtn) manageMembersBtn.style.display = 'inline-block';
        
        // 检查用户是否有删除房间权限 (房间创建者)
        if (deleteRoomBtn && this.currentUser && roomData) {
            // 使用 creatorId 字段（后端返回的驼峰命名格式）
            const isOwner = roomData.creatorId === this.currentUser.id;
            
            console.log('🔍 [权限检查] 房间信息:', {
                roomId: roomData.id || roomData.roomId,
                roomName: roomData.roomName || roomData.name,
                creatorId: roomData.creatorId,
                currentUserId: this.currentUser.id,
                isOwner: isOwner
            });
            
            if (isOwner) {
                deleteRoomBtn.style.display = 'inline-block';
                console.log('👑 [前端] 显示删除按钮');
            } else {
                deleteRoomBtn.style.display = 'none';
                console.log('👤 [前端] 用户不是房间创建者，隐藏删除按钮');
            }
        }

        // 显示/隐藏退出房间按钮
        const leaveRoomBtn = document.getElementById('leaveRoomBtn');
        if (leaveRoomBtn && this.currentUser && roomData) {
            const isOwner = roomData.creatorId === this.currentUser.id;
            
            if (isOwner) {
                // 房主不能直接离开房间
                leaveRoomBtn.style.display = 'none';
                console.log('👑 [前端] 房主不能离开房间，隐藏退出按钮');
            } else {
                // 普通用户可以离开房间
                leaveRoomBtn.style.display = 'inline-block';
                console.log('👤 [前端] 显示退出房间按钮');
            }
        }

        // 清空消息区域和重置消息去重记录
        this.elements.chatMessages.innerHTML = '';
        this.processedMessages.clear(); // 清除消息去重记录
        console.log('🧹 [前端] 已清除消息去重记录');

        // 显示房间历史消息
        if (roomData.recentMessages && roomData.recentMessages.length > 0) {
            roomData.recentMessages.forEach(message => {
                this.addMessage(message, false);
            });
        } else {
            this.elements.chatMessages.innerHTML = `
                <div class="text-center text-muted mt-3">
                    <i class="fas fa-comments fa-2x mb-2"></i>
                    <p>欢迎来到聊天室</p>
                    <small>开始您的第一条消息吧！</small>
                </div>
            `;
        }

        // 重新渲染房间列表以更新激活状态
        this.renderRoomList();
    }

    /**
     * 清空聊天区域
     */
    clearChat() {
        this.elements.chatMessages.innerHTML = `
            <div class="text-center text-muted mt-5">
                <i class="fas fa-users fa-3x mb-3"></i>
                <h5>欢迎使用 WebSocket 聊天室</h5>
                <p>请从左侧选择一个聊天室开始群聊，或创建新的聊天室</p>
            </div>
        `;
        this.processedMessages.clear();
    }

    /**
     * 发送消息
     */
    sendMessage() {
        const content = this.elements.messageInput.value.trim();
        if (!content) {
            return;
        }

        // 检查是否在私聊模式
        if (this.friendsManager && this.friendsManager.isPrivateChatMode()) {
            this.friendsManager.sendPrivateMessage(content);
            this.elements.messageInput.value = '';
            return;
        }

        // 群聊模式
        if (!this.currentRoom) {
            this.showError('请先选择一个聊天室');
            return;
        }

        // 检查是否@智能体
        const mentionMatch = content.match(/@(\w+)/);
        if (mentionMatch) {
            this.mentionAgent(mentionMatch[1], content);
        } else {
            // 发送普通消息
            console.log('📤 [前端] 发送普通消息:', {
                roomId: this.currentRoom.id || this.currentRoom.roomId,
                content: content,
                type: 'text'
            });
            
            const messageData = {
                roomId: this.currentRoom.id || this.currentRoom.roomId,
                content: content,
                type: 'text',
                timestamp: Date.now(),
                clientId: this.websocket.id  // 客户端标识，用于消息确认
            };
            
            // 先在本地显示消息（乐观更新）
            const localMessageId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const localMessage = {
                id: localMessageId,
                content: content,
                type: 'text',
                senderId: this.currentUser.userId,
                userId: this.currentUser.userId,
                senderName: this.currentUser.username,
                username: this.currentUser.username,
                timestamp: Date.now(),
                createdAt: new Date().toISOString(),
                isLocalPending: true  // 标记为本地待确认消息
            };
            
            this.addMessage(localMessage);
            console.log('📤 [前端] 添加本地待确认消息:', localMessageId);
            
            // 发送到后端
            this.websocket.emit('send-message', messageData);
            
            // 设置超时检查：如果5秒内没有收到确认，显示警告
            const timeoutId = setTimeout(() => {
                if (localMessage.isLocalPending) {
                    console.warn('⚠️ [前端] 消息发送5秒内未收到后端确认:', localMessageId);
                    console.warn('💡 [前端] 可能的原因:');
                    console.warn('   - 网络连接问题');
                    console.warn('   - 后端处理延迟');
                    console.warn('   - 消息过长或包含特殊内容');
                    this.showWarning('消息发送可能延迟，请稍候...');
                } else {
                    console.log('✅ [前端] 消息已确认，取消超时警告:', localMessageId);
                }
            }, 5000);

            // 保存超时ID以便清除
            localMessage.timeoutId = timeoutId;
        }

        // 清空输入框
        this.elements.messageInput.value = '';
        this.adjustTextareaHeight();
        this.stopTyping();
    }

    /**
     * @智能体
     */
    mentionAgent(agentName, content) {
        // 查找智能体
        const agent = this.agents.find(a => 
            a.name === agentName || a.id === agentName || a.agentName === agentName
        );

        if (!agent) {
            this.showError(`未找到智能体: ${agentName}`);
            return;
        }

        console.log('🤖 [前端] @智能体 (根据API指南):', {
            agentId: agent.id,
            agentName: agent.name || agent.agentName,
            query: content
        });
        
        // 根据API指南使用 mention-agent 事件
        this.websocket.emit('mention-agent', {
            roomId: this.currentRoom.id || this.currentRoom.roomId,
            agentId: agent.id,
            query: content  // API指南中使用 query 字段而不是 content
        });
    }

    /**
     * 添加消息到界面
     */
    addMessage(message, shouldScroll = true) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';

        // 判断消息类型
        let messageClass = 'message-other';
        if (message.senderId === this.currentUser.userId || message.userId === this.currentUser.userId) {
            messageClass = 'message-user';
        } else if (message.type === 'agent_response' || message.agentId) {
            messageClass = 'message-agent';
        } else if (message.type === 'system') {
            messageClass = 'message-system';
        }

        messageElement.classList.add(messageClass);

        // 构建消息HTML
        let messageHTML = `<div class="message-bubble">`;

        // 消息头部（发送者和时间）
        if (messageClass !== 'message-system') {
            const senderName = message.senderName || message.username || message.agentName || '未知用户';
            const timestamp = this.formatTime(message.createdAt || message.timestamp);
            
            messageHTML += `
                <div class="message-header">
                    <span class="message-sender">${this.escapeHtml(senderName)}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
            `;
        }

        // 回复预览
        if (message.replyToContent) {
            messageHTML += `
                <div class="reply-preview">
                    回复: ${this.escapeHtml(message.replyToContent)}
                </div>
            `;
        }

        // 消息内容
        messageHTML += `
            <div class="message-content">${this.formatMessageContent(message.content)}</div>
        `;

        // 如果是本地待确认消息，添加状态指示
        if (message.isLocalPending) {
            messageHTML += `
                <div class="message-status" style="font-size: 0.7rem; opacity: 0.7; margin-top: 0.25rem;">
                    <i class="fas fa-clock"></i> 发送中...
                </div>
            `;
        }

        messageHTML += '</div>';
        messageElement.innerHTML = messageHTML;

        // 保存消息数据引用到DOM元素，方便后续处理
        messageElement.localMessage = message;
        if (message.timeoutId) {
            messageElement.messageData = { timeoutId: message.timeoutId };
        }

        // 添加到消息列表
        this.elements.chatMessages.appendChild(messageElement);

        // 滚动到底部
        if (shouldScroll) {
            this.scrollToBottom();
        }
    }

    /**
     * 处理消息发送确认
     */
    handleMessageSentConfirmation(data) {
        console.log('📤 [前端] 处理消息发送确认:', data);
        
        // 如果有消息ID，检查是否已经处理过确认
        if (data.messageId && this.processedMessages.has('confirmation_' + data.messageId)) {
            console.log('🔄 [前端] 跳过重复确认:', data.messageId);
            return;
        }
        
        // 记录已处理的确认
        if (data.messageId) {
            this.processedMessages.add('confirmation_' + data.messageId);
        }
        
        // 移除所有待确认状态和清除超时
        const pendingMessages = this.elements.chatMessages.querySelectorAll('.message');
        let clearedTimeouts = 0;
        
        pendingMessages.forEach(msg => {
            const statusDiv = msg.querySelector('.message-status');
            if (statusDiv && statusDiv.textContent.includes('发送中')) {
                try {
                    // 清除超时
                    const messageData = msg.messageData;
                    if (messageData && messageData.timeoutId) {
                        clearTimeout(messageData.timeoutId);
                        clearedTimeouts++;
                        console.log('⏰ [前端] 清除消息超时:', messageData.timeoutId);
                    }
                    
                    // 标记消息为已确认
                    if (msg.localMessage) {
                        msg.localMessage.isLocalPending = false;
                    }
                    
                    statusDiv.style.display = 'none';
                } catch (error) {
                    console.warn('⚠️ [前端] 处理消息确认失败:', error);
                }
            }
        });
        
        console.log(`✅ [前端] 消息确认处理完成，清除了 ${clearedTimeouts} 个超时`);
    }

    /**
     * 处理接收新消息（统一处理多种格式）
     */
    handleNewMessage(message) {
        // 消息去重：检查是否已经处理过这条消息
        if (message.id && this.processedMessages.has(message.id)) {
            console.log('🔄 [前端] 跳过重复消息:', message.id);
            return;
        }
        
        // 记录已处理的消息ID
        if (message.id) {
            this.processedMessages.add(message.id);
            
            // 限制Set大小，避免内存泄漏（保留最近1000条消息ID）
            if (this.processedMessages.size > 1000) {
                const firstItem = this.processedMessages.values().next().value;
                this.processedMessages.delete(firstItem);
            }
        }
        
        // 检查是否是自己发送的消息的确认（避免重复显示）
        if (message.senderId === this.currentUser.userId || message.userId === this.currentUser.userId) {
            console.log('📨 [前端] 收到自己的消息确认:', message);
            
            // 查找并移除本地待确认的消息
            const pendingMessages = this.elements.chatMessages.querySelectorAll('.message');
            let foundPending = false;
            
            for (let msg of pendingMessages) {
                // 检查是否是待确认的本地消息
                if (msg.localMessage && msg.localMessage.isLocalPending) {
                    const contentDiv = msg.querySelector('.message-content');
                    if (contentDiv && contentDiv.textContent.trim() === message.content.trim()) {
                        try {
                            // 清除对应的超时
                            if (msg.localMessage.timeoutId) {
                                clearTimeout(msg.localMessage.timeoutId);
                                console.log('⏰ [前端] 清除本地消息超时:', msg.localMessage.timeoutId);
                            }
                            
                            // 移除整个本地消息元素，因为服务器会返回正式消息
                            msg.remove();
                            foundPending = true;
                            console.log('✅ [前端] 移除本地待确认消息，使用服务器消息');
                            break;
                        } catch (error) {
                            console.warn('⚠️ [前端] 移除本地消息失败:', error);
                        }
                    }
                }
            }
            
            // 如果没找到对应的本地待确认消息，可能是因为之前已经处理过了
            if (!foundPending) {
                console.log('🔍 [前端] 未找到对应的本地待确认消息，可能已处理');
            }
        }
        
        // 添加服务器返回的正式消息
        this.addMessage(message);
    }

    /**
     * 处理输入状态
     */
    handleTypingStatus() {
        if (!this.currentRoom || !this.websocket?.connected) {
            return;
        }

        // 如果不在输入状态，发送开始输入事件
        if (!this.isTyping) {
            this.isTyping = true;
            this.websocket.emit('typing', {
                roomId: this.currentRoom.roomId,
                isTyping: true
            });
        }

        // 清除之前的计时器
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        // 3秒后停止输入状态
        this.typingTimer = setTimeout(() => {
            this.stopTyping();
        }, 3000);
    }

    /**
     * 停止输入状态
     */
    stopTyping() {
        if (this.isTyping && this.currentRoom && this.websocket?.connected) {
            this.isTyping = false;
            this.websocket.emit('typing', {
                roomId: this.currentRoom.roomId,
                isTyping: false
            });
        }

        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
    }

    /**
     * 处理私聊消息
     */
    handlePrivateMessage(message) {
        console.log('📨 [前端] 处理私聊消息:', message);
        
        // 如果当前正在与发送者私聊，直接显示消息
        if (this.friendsManager && this.friendsManager.currentPrivateChat && 
            this.friendsManager.currentPrivateChat.friendId === message.senderId) {
            this.friendsManager.displayReceivedMessage(message);
        }
        
        // 更新未读消息数
        if (this.friendsManager) {
            this.friendsManager.updateUnreadCount(message.senderId, 1);
        }
        
        // 显示新消息提示（如果不在当前私聊窗口）
        if (!this.friendsManager?.currentPrivateChat || 
            this.friendsManager.currentPrivateChat.friendId !== message.senderId) {
            this.showNewMessageNotification(message);
        }
    }

    /**
     * 处理私聊消息发送成功
     */
    handlePrivateMessageSent(data) {
        console.log('✅ [前端] 私聊消息发送成功:', data);
        
        // 如果当前正在私聊窗口，显示发送成功的消息
        if (this.friendsManager && this.friendsManager.currentPrivateChat && 
            this.friendsManager.currentPrivateChat.friendId === data.receiverId) {
            this.friendsManager.displaySentMessage(data);
        }
        
        // 移除发送中状态
        if (this.friendsManager) {
            this.friendsManager.removeSendingMessage();
        }
    }

    /**
     * 处理消息已读状态更新
     */
    handleMessageRead(data) {
        console.log('👀 [前端] 收到消息已读通知:', data);
        console.log('📊 [前端] 已读数据详情:', {
            messageId: data.messageId,
            senderId: data.senderId,
            readerId: data.readerId,
            readAt: data.readAt
        });
        
        if (this.friendsManager && data.messageId) {
            // 检查当前用户是否是消息发送者
            const currentUserId = this.currentUser?.id;
            if (currentUserId === data.senderId) {
                console.log('✅ [前端] 当前用户是发送者，添加已读指示器');
                this.friendsManager.addReadIndicator(data.messageId);
                
                // 静默处理已读状态，不显示弹窗通知（避免过多干扰）
                // WebSocket实时通知修复后，已读状态会频繁更新，弹窗会影响用户体验
                console.log('📱 [前端] 已读状态已静默更新，无弹窗提示');
            } else {
                console.log('ℹ️ [前端] 当前用户不是发送者，忽略已读通知');
            }
        } else {
            console.warn('⚠️ [前端] 无法处理已读状态 - friendsManager或messageId缺失');
        }
    }

    /**
     * 显示新消息通知
     */
    showNewMessageNotification(message) {
        // 简单的通知提示
        const senderName = message.senderInfo?.nickname || message.senderInfo?.username || '好友';
        this.showInfo(`${senderName} 发来新消息`);
    }

    /**
     * 更新正在输入指示器
     */
    updateTypingIndicator(data) {
        const { userId, isTyping } = data;
        
        if (isTyping) {
            // 添加到正在输入列表
            if (!this.typingUsers.some(user => user.userId === userId)) {
                this.typingUsers.push(data);
            }
        } else {
            // 从正在输入列表中移除
            this.typingUsers = this.typingUsers.filter(user => user.userId !== userId);
        }

        this.renderTypingIndicator();
    }

    /**
     * 渲染正在输入指示器
     */
    renderTypingIndicator() {
        const typingElement = this.elements.typingIndicators;

        if (this.typingUsers.length === 0) {
            typingElement.style.display = 'none';
            return;
        }

        const typingText = this.typingUsers.length === 1
            ? `${this.typingUsers[0].username || '用户'} 正在输入`
            : `${this.typingUsers.length} 人正在输入`;

        typingElement.innerHTML = `
            <div class="typing-indicator">
                ${typingText}
                <span class="typing-dots">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </span>
            </div>
        `;
        typingElement.style.display = 'flex';
    }

    /**
     * 显示智能体思考状态
     */
    showAgentTyping(data) {
        const { agentId, agentName } = data;
        this.updateTypingIndicator({
            userId: agentId,
            username: agentName || 'AI智能体',
            isTyping: true
        });
    }

    /**
     * 隐藏智能体思考状态
     */
    hideAgentTyping(agentId) {
        this.updateTypingIndicator({
            userId: agentId,
            isTyping: false
        });
    }

    /**
     * 更新在线成员
     */
    updateOnlineMembers(onlineUsers) {
        console.log('👥 [前端] 更新在线成员:', onlineUsers);
        this.onlineUsers = onlineUsers;
        
        const memberAvatarsElement = this.elements.memberAvatars;
        if (!onlineUsers || onlineUsers.length === 0) {
            console.log('👥 [前端] 没有在线用户，清空头像显示');
            memberAvatarsElement.innerHTML = '';
            return;
        }

        const avatarsHTML = onlineUsers.slice(0, 5).map((user, index) => {
            const initial = (user.username || user.name || '?').charAt(0).toUpperCase();
            const fullName = this.escapeHtml(user.username || user.name || '未知用户');
            const userId = user.id || index;
            
            return `
                <div class="member-avatar" 
                     data-bs-toggle="tooltip" 
                     data-bs-placement="top" 
                     data-bs-title="${fullName}"
                     data-user-id="${userId}"
                     data-username="${fullName}"
                     style="cursor: pointer;">
                    ${initial}
                </div>
            `;
        }).join('');

        memberAvatarsElement.innerHTML = avatarsHTML;
        
        // 初始化 Bootstrap tooltips
        const tooltipTriggerList = memberAvatarsElement.querySelectorAll('[data-bs-toggle="tooltip"]');
        const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl, {
            delay: { show: 200, hide: 100 }
        }));
        
        // 添加点击事件显示用户详情
        memberAvatarsElement.querySelectorAll('.member-avatar').forEach(avatar => {
            avatar.addEventListener('click', (e) => {
                const username = e.target.dataset.username;
                const userId = e.target.dataset.userId;
                this.showUserDetails(username, userId);
            });
        });
        
        console.log('👥 [前端] 已更新在线用户头像:', onlineUsers.length, '个用户');

        // 如果有更多用户，显示数量
        if (onlineUsers.length > 5) {
            const moreUsersHTML = `
                <div class="member-avatar more-users" 
                     data-bs-toggle="tooltip" 
                     data-bs-placement="top" 
                     data-bs-title="还有 ${onlineUsers.length - 5} 位用户在线"
                     style="background: linear-gradient(135deg, #6c757d, #495057); cursor: pointer;"
                     onclick="chatController.showAllUsers()">
                    +${onlineUsers.length - 5}
                </div>
            `;
            memberAvatarsElement.innerHTML += moreUsersHTML;
            
            // 为"更多用户"按钮也初始化tooltip
            const moreUsersTooltip = new bootstrap.Tooltip(memberAvatarsElement.querySelector('.more-users'), {
                delay: { show: 200, hide: 100 }
            });
        }
    }

    /**
     * 显示所有在线用户
     */
    showAllUsers() {
        console.log('👥 [前端] 显示所有在线用户:', this.onlineUsers);
        
        if (!this.onlineUsers || this.onlineUsers.length === 0) {
            this.showError('当前没有在线用户');
            return;
        }

        const allUsersHTML = `
            <div class="modal fade" id="allUsersModal" tabindex="-1" aria-labelledby="allUsersModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="allUsersModalLabel">
                                <i class="fas fa-users me-2"></i>在线成员 (${this.onlineUsers.length})
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                ${this.onlineUsers.map((user, index) => {
                                    const initial = (user.username || user.name || '?').charAt(0).toUpperCase();
                                    const fullName = this.escapeHtml(user.username || user.name || '未知用户');
                                    const userId = user.id || index;
                                    
                                    return `
                                        <div class="col-md-6 mb-3">
                                            <div class="d-flex align-items-center p-3 border rounded cursor-pointer user-item"
                                                 data-user-id="${userId}" 
                                                 data-username="${fullName}"
                                                 onclick="chatController.showUserDetails('${fullName}', '${userId}')">
                                                <div class="member-avatar me-3" style="cursor: pointer;">
                                                    ${initial}
                                                </div>
                                                <div class="flex-grow-1">
                                                    <h6 class="mb-1">${fullName}</h6>
                                                    <small class="text-muted">
                                                        <i class="fas fa-circle text-success me-1"></i>在线
                                                    </small>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除已存在的所有用户模态框
        const existingModal = document.getElementById('allUsersModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的模态框到页面
        document.body.insertAdjacentHTML('beforeend', allUsersHTML);

        // 添加hover效果样式
        const style = document.createElement('style');
        style.textContent = `
            .user-item:hover {
                background-color: rgba(0, 123, 255, 0.1);
                border-color: #007bff !important;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
                transition: all 0.2s ease;
            }
        `;
        document.head.appendChild(style);

        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('allUsersModal'));
        modal.show();

        // 模态框隐藏后移除DOM
        document.getElementById('allUsersModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        });
    }

    /**
     * 显示用户详情
     */
    showUserDetails(username, userId) {
        console.log('👤 [前端] 显示用户详情:', { username, userId });
        
        // 创建用户详情弹窗内容
        const userDetailsHTML = `
            <div class="modal fade" id="userDetailsModal" tabindex="-1" aria-labelledby="userDetailsModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="userDetailsModalLabel">
                                <i class="fas fa-user me-2"></i>用户信息
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="d-flex align-items-center mb-3">
                                <div class="member-avatar me-3" style="font-size: 2rem; width: 60px; height: 60px; line-height: 60px;">
                                    ${(username || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h5 class="mb-1">${this.escapeHtml(username || '未知用户')}</h5>
                                    <small class="text-muted">用户ID: ${userId || '未知'}</small>
                                </div>
                            </div>
                            <div class="user-status">
                                <span class="badge bg-success">
                                    <i class="fas fa-circle me-1"></i>在线
                                </span>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除已存在的用户详情模态框
        const existingModal = document.getElementById('userDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新的模态框到页面
        document.body.insertAdjacentHTML('beforeend', userDetailsHTML);

        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('userDetailsModal'));
        modal.show();

        // 模态框隐藏后移除DOM
        document.getElementById('userDetailsModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    /**
     * 创建房间
     */
    createRoom() {
        console.log('🔧 [前端] 创建房间函数被调用');
        
        const roomNameElement = document.getElementById('roomName');
        const roomDescriptionElement = document.getElementById('roomDescription');
        const isPrivateElement = document.getElementById('isPrivate');
        
        if (!roomNameElement || !roomDescriptionElement || !isPrivateElement) {
            console.error('❌ [前端] 创建房间表单元素未找到');
            this.showError('页面表单元素加载异常');
            return;
        }

        const roomName = roomNameElement.value.trim();
        const roomDescription = roomDescriptionElement.value.trim();
        const isPrivate = isPrivateElement.checked;

        console.log('📝 [前端] 房间信息:', { roomName, roomDescription, isPrivate });

        if (!roomName) {
            this.showError('请输入房间名称');
            return;
        }

        if (!this.websocket?.connected) {
            console.error('❌ [前端] WebSocket未连接，无法创建房间');
            this.showError('WebSocket未连接，无法创建房间');
            return;
        }

        console.log('📤 [前端] 发送创建房间请求:', { name: roomName, description: roomDescription, isPrivate });
        console.log('🔌 [前端] WebSocket状态:', {
            connected: this.websocket.connected,
            id: this.websocket.id
        });
        
        try {
            // 发送创建房间请求
            this.websocket.emit('create-room', {
                name: roomName,
                description: roomDescription,
                isPrivate: isPrivate
            });

            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('createRoomModal'));
            if (modal) {
                modal.hide();
            }

            // 清空表单
            document.getElementById('createRoomForm').reset();
            
            this.showInfo('正在创建房间，请稍候...');
            
        } catch (error) {
            console.error('💥 [前端] 发送创建房间请求失败:', error);
            this.showError('创建房间请求发送失败: ' + error.message);
        }
    }

    /**
     * 加载智能体列表
     */
    async loadAgents() {
        try {
            console.log('🤖 [前端] 开始加载智能体列表');
            
            // 获取API基础URL，优先使用环境配置
            const apiBaseUrl = (window.ENV_CONFIG && window.ENV_CONFIG.getApiUrl) ? 
                window.ENV_CONFIG.getApiUrl() : 
                (globalConfig ? globalConfig.api.baseURL : 'http://localhost:4005/api');
            
            // 调用智能体管理API（根据API指南第8章）
            if (window.AuthService) {
                const response = await fetch(apiBaseUrl + '/agents', {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + TokenManager.getAccessToken(),
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data) {
                        this.agents = result.data;
                        console.log('✅ [前端] 智能体列表加载成功:', this.agents.length, '个智能体');
                    } else {
                        throw new Error(result.message || '获取智能体列表失败');
                    }
                } else {
                    throw new Error('智能体API请求失败');
                }
            } else {
                // 如果AuthService不可用，使用模拟数据
                console.warn('⚠️ [前端] AuthService不可用，使用模拟智能体数据');
                this.agents = [
                    { id: 'agent_1', name: 'AI助手', description: '通用AI助手' },
                    { id: 'agent_2', name: '代码助手', description: '编程专家' },
                    { id: 'agent_3', name: '翻译助手', description: '多语言翻译' }
                ];
            }
            
            console.log('🎯 [前端] 智能体列表加载完成:', this.agents);
        } catch (error) {
            console.error('💥 [前端] 加载智能体失败:', error);
            // 发生错误时使用模拟数据
            this.agents = [
                { id: 'agent_1', name: 'AI助手', description: '通用AI助手' },
                { id: 'agent_2', name: '代码助手', description: '编程专家' },
                { id: 'agent_3', name: '翻译助手', description: '多语言翻译' }
            ];
            this.showWarning('加载智能体列表失败，使用默认列表');
        }
    }

    /**
     * 显示@智能体模态框
     */
    showMentionAgentModal() {
        if (!this.currentRoom) {
            this.showError('请先选择一个聊天室');
            return;
        }

        const agentListElement = this.elements.agentList;
        
        if (this.agents.length === 0) {
            agentListElement.innerHTML = `
                <div class="text-center text-muted p-3">
                    <i class="fas fa-robot fa-2x mb-2"></i>
                    <p>暂无可用智能体</p>
                </div>
            `;
        } else {
            const agentsHTML = this.agents.map(agent => `
                <button class="list-group-item list-group-item-action" 
                        onclick="chatroomController.selectAgent('${agent.id}', '${agent.name}')">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${this.escapeHtml(agent.name)}</h6>
                        <i class="fas fa-robot"></i>
                    </div>
                    <p class="mb-1">${this.escapeHtml(agent.description)}</p>
                </button>
            `).join('');
            
            agentListElement.innerHTML = agentsHTML;
        }

        const modal = new bootstrap.Modal(document.getElementById('mentionAgentModal'));
        modal.show();
    }

    /**
     * 选择智能体
     */
    selectAgent(agentId, agentName) {
        const currentText = this.elements.messageInput.value;
        const mentionText = `@${agentName} `;
        
        this.elements.messageInput.value = currentText + mentionText;
        this.elements.messageInput.focus();
        
        // 关闭模态框
        const modal = bootstrap.Modal.getInstance(document.getElementById('mentionAgentModal'));
        if (modal) {
            modal.hide();
        }
    }

    /**
     * 调整文本区域高度
     */
    adjustTextareaHeight() {
        const textarea = this.elements.messageInput;
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 120);
        textarea.style.height = newHeight + 'px';
    }

    /**
     * 滚动到底部
     */
    scrollToBottom() {
        const messagesElement = this.elements.chatMessages;
        messagesElement.scrollTop = messagesElement.scrollHeight;
    }

    /**
     * 格式化消息内容
     */
    formatMessageContent(content) {
        if (!content) return '';
        
        // 转义HTML
        let formatted = this.escapeHtml(content);
        
        // 处理换行
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 处理@提及（高亮显示）
        formatted = formatted.replace(/@(\w+)/g, '<span class="text-primary">@$1</span>');
        
        return formatted;
    }

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // 小于1分钟
        if (diff < 60000) {
            return '刚刚';
        }
        
        // 小于1小时
        if (diff < 3600000) {
            return Math.floor(diff / 60000) + '分钟前';
        }
        
        // 今天
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        // 其他日期
        return date.toLocaleDateString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * 显示模拟房间供测试（当WebSocket连接失败时）
     */
    showMockRoomsForTesting() {
        console.log('显示模拟房间供测试');
        this.rooms = [
            { 
                id: 'mock_room_1', 
                name: '测试聊天室1', 
                memberCount: 5, 
                isActive: true 
            },
            { 
                id: 'mock_room_2', 
                name: '测试聊天室2', 
                memberCount: 3, 
                isActive: true 
            },
            { 
                id: 'mock_room_3', 
                name: '离线测试房间', 
                memberCount: 0, 
                isActive: false 
            }
        ];
        this.renderRoomList();
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 显示错误消息
     */
    showError(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else if (typeof ErrorHandler !== 'undefined' && ErrorHandler.showError) {
            ErrorHandler.showError(message);
        } else {
            console.error('错误:', message);
            alert('错误: ' + message);
        }
    }

    /**
     * 显示成功消息
     */
    showSuccess(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'success');
        } else {
            console.log('成功:', message);
        }
    }

    /**
     * 显示警告消息
     */
    showWarning(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'warning');
        } else {
            console.warn('警告:', message);
        }
    }

    /**
     * 显示信息消息
     */
    showInfo(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'info');
        } else {
            console.info('信息:', message);
        }
    }

    /**
     * 切换删除模式
     */
    toggleDeleteMode() {
        const body = document.body;
        const deleteBtn = document.getElementById('deleteModeBtn');
        const cancelBtn = document.getElementById('cancelDeleteBtn');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        if (body.classList.contains('room-delete-mode')) {
            // 退出删除模式
            body.classList.remove('room-delete-mode');
            deleteBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'none';
            confirmBtn.style.display = 'none';
            
            // 重新渲染房间列表移除复选框
            this.renderRoomList();
            console.log('📤 [前端] 退出删除模式');
        } else {
            // 进入删除模式
            body.classList.add('room-delete-mode');
            deleteBtn.style.display = 'none';
            cancelBtn.style.display = 'inline-block';
            confirmBtn.style.display = 'none'; // 初始状态下隐藏，直到选择房间
            
            // 重新渲染房间列表添加复选框
            this.renderRoomList();
            console.log('📤 [前端] 进入删除模式');
        }
    }

    /**
     * 更新删除按钮状态
     */
    updateDeleteButtonState() {
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const checkboxes = document.querySelectorAll('.room-checkbox:checked');
        
        if (checkboxes.length > 0) {
            confirmBtn.style.display = 'inline-block';
            confirmBtn.textContent = `删除 (${checkboxes.length})`;
        } else {
            confirmBtn.style.display = 'none';
        }
    }

    /**
     * 确认批量删除
     */
    confirmBatchDelete() {
        const checkboxes = document.querySelectorAll('.room-checkbox:checked');
        
        if (checkboxes.length === 0) {
            this.showWarning('请先选择要删除的房间');
            return;
        }

        // 收集要删除的房间信息
        const selectedRooms = Array.from(checkboxes).map(checkbox => ({
            id: checkbox.dataset.roomId,
            name: checkbox.dataset.roomName
        }));

        // 显示确认对话框
        const modal = new bootstrap.Modal(document.getElementById('confirmBatchDeleteModal'));
        
        // 填充房间列表
        const roomListElement = document.getElementById('selectedRoomsList');
        roomListElement.innerHTML = selectedRooms.map(room => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span>${this.escapeHtml(room.name)}</span>
                <span class="badge bg-danger">删除</span>
            </li>
        `).join('');
        
        // 更新确认文本
        const countElement = document.getElementById('deleteRoomCount');
        countElement.textContent = selectedRooms.length;
        
        // 保存待删除房间数据供确认时使用
        this.pendingDeleteRooms = selectedRooms;
        
        modal.show();
    }

    /**
     * 执行批量删除
     */
    async executeBatchDelete() {
        if (!this.pendingDeleteRooms || this.pendingDeleteRooms.length === 0) {
            this.showError('没有要删除的房间');
            return;
        }

        const deleteButton = document.getElementById('executeBatchDeleteBtn');
        const originalText = deleteButton.textContent;
        
        try {
            // 显示加载状态
            deleteButton.disabled = true;
            deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除中...';
            
            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            // 逐个删除房间
            for (const room of this.pendingDeleteRooms) {
                try {
                    await this.roomManagementService.deleteRoom(room.id);
                    successCount++;
                    console.log(`✅ [前端] 房间删除成功: ${room.name}`);
                } catch (error) {
                    errorCount++;
                    errors.push(`${room.name}: ${error.message}`);
                    console.error(`❌ [前端] 房间删除失败: ${room.name}`, error);
                }
            }

            // 显示结果
            if (successCount > 0) {
                this.showSuccess(`成功删除 ${successCount} 个房间`);
            }
            
            if (errorCount > 0) {
                this.showError(`删除失败 ${errorCount} 个房间:\n${errors.join('\n')}`);
            }

            // 关闭确认对话框
            const modal = bootstrap.Modal.getInstance(document.getElementById('confirmBatchDeleteModal'));
            if (modal) {
                modal.hide();
            }

            // 退出删除模式
            this.toggleDeleteMode();

            // 刷新房间列表
            this.loadRooms();

        } catch (error) {
            console.error('💥 [前端] 批量删除房间失败:', error);
            this.showError('批量删除失败: ' + error.message);
        } finally {
            // 恢复按钮状态
            deleteButton.disabled = false;
            deleteButton.textContent = originalText;
            
            // 清除待删除数据
            this.pendingDeleteRooms = null;
        }
    }

    /**
     * 销毁控制器
     */
    destroy() {
        // 停止输入状态
        this.stopTyping();
        
        // 断开WebSocket连接
        if (this.websocket) {
            this.websocket.disconnect();
            this.websocket = null;
        }
        
        // 清理定时器
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }
        
        console.log('聊天室控制器已销毁');
    }

    // 测试方法 - 手动请求在线用户信息
    testRequestOnlineUsers() {
        if (!this.currentRoom) {
            console.warn('⚠️ [测试] 当前没有加入房间');
            return;
        }
        
        const roomId = this.currentRoom.id || this.currentRoom.roomId;
        console.log('🔬 [测试] 手动请求房间状态和在线用户:', roomId);
        this.websocket.emit('get-room-state', { roomId: roomId });
        
        // 也尝试其他可能的事件名称
        this.websocket.emit('get-online-users', { roomId: roomId });
        this.websocket.emit('room-info', { roomId: roomId });
    }
}

// 导出到全局作用域
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatroomController;
} else {
    window.ChatroomController = ChatroomController;
}
