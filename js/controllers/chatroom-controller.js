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
        });

        this.websocket.on('join-room-error', (data) => {
            console.error('加入房间失败:', data);
            this.showError('加入房间失败: ' + data.error);
        });

        this.websocket.on('room-state', (roomInfo) => {
            console.log('房间状态更新:', roomInfo);
            this.updateOnlineMembers(roomInfo.onlineUsers || []);
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

        // 支持多种消息接收事件格式
        this.websocket.on('newMessage', (message) => {
            console.log('📨 [前端] 收到新消息 (兼容格式):', message);
            this.handleNewMessage(message);
        });

        this.websocket.on('message', (message) => {
            console.log('📨 [前端] 收到新消息 (简单格式):', message);
            this.handleNewMessage(message);
        });

        this.websocket.on('send-message-error', (data) => {
            console.error('发送消息失败:', data);
            this.showError('发送消息失败: ' + data.error);
        });

        // 用户动态事件
        this.websocket.on('user-joined', (data) => {
            console.log('用户加入房间:', data);
            this.showInfo(`${data.username} 加入了房间`);
        });

        this.websocket.on('user-left', (data) => {
            console.log('用户离开房间:', data);
            this.showInfo(`${data.username} 离开了房间`);
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
        const modalCreateBtn = document.getElementById('createRoomBtn');
        if (modalCreateBtn) {
            modalCreateBtn.addEventListener('click', () => {
                console.log('🔧 [前端] 模态框中的创建房间按钮被点击');
                this.createRoom();
            });
            console.log('✅ [前端] 创建房间按钮事件绑定成功');
        } else {
            console.error('❌ [前端] 创建房间按钮元素未找到');
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

        const roomsHTML = this.rooms.map(room => `
            <div class="room-item ${room.id === this.currentRoom?.id || room.id === this.currentRoom?.roomId ? 'active' : ''}" 
                 onclick="chatroomController.joinRoom('${room.id}')">
                <div class="room-avatar">
                    <i class="fas fa-users"></i>
                </div>
                <div class="room-info">
                    <div class="room-name">${this.escapeHtml(room.name || room.roomName || room.title || '未命名房间')}</div>
                    <div class="room-meta">
                        <span class="room-members">${room.memberCount || room.members_count || 0} 人</span>
                        <div class="room-status ${room.isActive !== false ? '' : 'inactive'}"></div>
                    </div>
                </div>
            </div>
        `).join('');

        roomListElement.innerHTML = roomsHTML;
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
            }
        }, 2000);

        // 保存timeout ID以便在成功时清除
        this.joinRoomTimeout = timeoutId;
    }

    /**
     * 更新房间信息
     */
    updateRoomInfo(roomData) {
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
     * 发送消息
     */
    sendMessage() {
        if (!this.currentRoom) {
            this.showError('请先选择一个聊天室');
            return;
        }

        const content = this.elements.messageInput.value.trim();
        if (!content) {
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
            const localMessage = {
                id: 'temp_' + Date.now(),
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
            
            // 发送到后端
            this.websocket.emit('send-message', messageData);
            
            // 设置超时检查：如果5秒内没有收到确认，显示警告
            const timeoutId = setTimeout(() => {
                // 检查消息是否已经确认（通过检查是否有新消息ID在processedMessages中）
                const hasConfirmed = Array.from(this.processedMessages).some(id => 
                    id.startsWith('confirmation_') || 
                    (messageData.content && this.elements.chatMessages.textContent.includes(messageData.content))
                );
                
                if (localMessage.isLocalPending && !hasConfirmed) {
                    console.warn('⚠️ [前端] 消息发送5秒内未收到后端确认');
                    console.warn('💡 [前端] 可能的原因:');
                    console.warn('   - 网络连接问题');
                    console.warn('   - 后端处理延迟');
                    console.warn('   - 消息过长或包含特殊内容');
                    this.showWarning('消息发送可能延迟，请稍候...');
                } else {
                    console.log('✅ [前端] 消息已确认，取消超时警告');
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
            // 查找并移除本地待确认的消息
            const pendingMessages = this.elements.chatMessages.querySelectorAll('.message');
            for (let msg of pendingMessages) {
                const contentDiv = msg.querySelector('.message-content');
                if (contentDiv && contentDiv.textContent.trim() === message.content.trim()) {
                    const statusDiv = msg.querySelector('.message-status');
                    if (statusDiv && statusDiv.parentNode === msg) {
                        try {
                            // 清除对应的超时
                            const messageData = msg.messageData;
                            if (messageData && messageData.timeoutId) {
                                clearTimeout(messageData.timeoutId);
                            }
                            
                            msg.removeChild(statusDiv); // 安全移除"发送中"状态
                            console.log('✅ [前端] 消息发送确认，移除待发送状态');
                            return; // 不重复添加消息
                        } catch (error) {
                            console.warn('⚠️ [前端] 移除状态元素失败:', error);
                            // 如果移除失败，隐藏状态元素
                            statusDiv.style.display = 'none';
                            return;
                        }
                    }
                }
            }
        }
        
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
        this.onlineUsers = onlineUsers;
        
        const memberAvatarsElement = this.elements.memberAvatars;
        if (!onlineUsers || onlineUsers.length === 0) {
            memberAvatarsElement.innerHTML = '';
            return;
        }

        const avatarsHTML = onlineUsers.slice(0, 5).map(user => {
            const initial = (user.username || user.name || '?').charAt(0).toUpperCase();
            return `
                <div class="member-avatar" title="${this.escapeHtml(user.username || user.name || '未知用户')}">
                    ${initial}
                </div>
            `;
        }).join('');

        memberAvatarsElement.innerHTML = avatarsHTML;

        // 如果有更多用户，显示数量
        if (onlineUsers.length > 5) {
            memberAvatarsElement.innerHTML += `
                <div class="member-avatar" title="${onlineUsers.length - 5} 更多用户">
                    +${onlineUsers.length - 5}
                </div>
            `;
        }
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
}

// 导出到全局作用域
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatroomController;
} else {
    window.ChatroomController = ChatroomController;
}
