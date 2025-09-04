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
        
        // 初始化懒加载器
        this.lazyLoader = null;
        
        // 初始化图片优化服务
        this.imageOptimizer = null;
        
        // 智能体和流式响应相关
        this.agents = []; // 可用智能体列表
        this.currentStreamingMessageId = null; // 当前流式消息ID
        this.processingMessages = new Set(); // 防重复处理
        this.eventsSetup = false; // WebSocket事件设置标记
        this.agentSuggestionsList = null; // 智能体建议列表DOM
        this.selectedSuggestionIndex = -1; // 选中的建议索引
        this.atPosition = -1; // @符号位置
        
        // DOM 元素
        this.elements = {
            roomList: document.getElementById('roomList'),
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            mentionButton: document.getElementById('mentionButton'),
            emojiButton: document.getElementById('emojiButton'),
            imageUploadButton: document.getElementById('addButton'), // 更新为新的addButton
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
        
        // @智能体建议列表相关
        this.agentSuggestionsList = null;
        this.selectedSuggestionIndex = -1;
        this.atPosition = -1;
    }

    /**
     * 初始化聊天室控制器
     */
    async initialize() {
        try {
            // 获取当前用户信息
            await this.loadUserInfo();
            
            // PIN验证检查
            await this.checkPinVerification(true); // 进入页面时强制验证
            
            // 初始化房间管理服务
            this.roomManagementService = new RoomManagementService();
            
            // 初始化好友管理器
            this.friendsManager = new FriendsManager(this);
            await this.friendsManager.initialize();
            
            // 设置全局引用，以便HTML中的按钮可以调用
            window.friendsManager = this.friendsManager;
            
            // 初始化懒加载器
            if (window.LazyLoader) {
                this.lazyLoader = new window.LazyLoader();
                this.lazyLoader.init();
                console.log('✅ [前端] 懒加载器初始化成功');
            } else {
                console.warn('⚠️ [前端] LazyLoader 未找到，图片将直接加载');
            }
            
            // 初始化图片优化服务
            if (window.ImageOptimizationService) {
                this.imageOptimizer = new window.ImageOptimizationService();
                console.log('✅ [前端] 图片优化服务初始化成功');
            } else {
                console.warn('⚠️ [前端] ImageOptimizationService 未找到，将使用默认图片加载');
            }
            
            // 初始化WebSocket连接
            this.initializeWebSocket();
            
            // 加载智能体列表
            await this.loadAgents();
            
            // 恢复上次的聊天状态
            this.restoreLastChatState();
            
            // 初始化用户活动监听器（用于PIN验证自动锁定）
            this.initializeActivityListeners();
            
            console.log('聊天室控制器初始化完成');
        } catch (error) {
            console.error('初始化聊天室失败:', error);
            this.showError('初始化聊天室失败，请刷新页面重试');
        }
    }

    /**
     * 保存当前聊天状态到localStorage
     */
    saveCurrentChatState() {
        try {
            const chatState = {
                timestamp: Date.now(),
                userId: this.currentUser?.id,
                type: null, // 'room' 或 'private'
                data: null
            };

            if (this.currentRoom) {
                // 当前在聊天室
                chatState.type = 'room';
                chatState.data = {
                    roomId: this.currentRoom.id || this.currentRoom.roomId,
                    roomName: this.currentRoom.name || this.currentRoom.roomName
                };
            } else if (this.friendsManager?.currentPrivateChat) {
                // 当前在私聊
                chatState.type = 'private';
                chatState.data = {
                    friendId: this.friendsManager.currentPrivateChat.friendId,
                    friendName: this.friendsManager.currentPrivateChat.friendName
                };
            }

            if (chatState.type && chatState.data) {
                localStorage.setItem('dify_last_chat_state', JSON.stringify(chatState));
                console.log('💾 聊天状态已保存:', chatState);
            }
        } catch (error) {
            console.warn('⚠️ 保存聊天状态失败:', error);
        }
    }

    /**
     * 恢复上次的聊天状态
     */
    async restoreLastChatState() {
        try {
            // 检查用户是否启用了自动恢复功能
            const autoRestore = localStorage.getItem('dify_auto_restore_chat');
            if (autoRestore === 'false') {
                console.log('🚫 用户已禁用自动恢复聊天功能');
                return;
            }

            const savedState = localStorage.getItem('dify_last_chat_state');
            if (!savedState) {
                console.log('📭 没有保存的聊天状态');
                return;
            }

            const chatState = JSON.parse(savedState);
            
            // 验证状态有效性（检查用户是否匹配，时间是否过期等）
            if (!chatState.userId || chatState.userId !== this.currentUser?.id) {
                console.log('👤 用户不匹配，清除保存的状态');
                localStorage.removeItem('dify_last_chat_state');
                return;
            }

            // 检查是否超过7天（可配置）
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天
            if (Date.now() - chatState.timestamp > maxAge) {
                console.log('⏰ 保存的状态已过期，清除');
                localStorage.removeItem('dify_last_chat_state');
                return;
            }

            console.log('🔄 准备恢复聊天状态:', chatState);

            // 等待一段时间确保WebSocket连接和数据加载完成
            // 使用更智能的等待机制
            this.waitForDataReady().then(() => {
                this.doRestoreChatState(chatState);
            });

        } catch (error) {
            console.warn('⚠️ 恢复聊天状态失败:', error);
            // 清除损坏的状态
            localStorage.removeItem('dify_last_chat_state');
        }
    }

    /**
     * 等待数据准备就绪
     */
    async waitForDataReady() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 20; // 最多等待10秒
            
            const checkReady = () => {
                attempts++;
                
                // 检查WebSocket连接状态
                const isWebSocketReady = this.websocket && this.websocket.connected;
                
                // 检查房间列表是否已加载
                const hasRooms = this.rooms && this.rooms.length > 0;
                
                // 检查好友列表是否已加载
                const hasFriends = this.friendsManager && 
                                  this.friendsManager.friends && 
                                  this.friendsManager.friends.length >= 0; // 可能没有好友，所以>=0
                
                console.log(`🔍 数据就绪检查 (${attempts}/${maxAttempts}):`, {
                    websocket: isWebSocketReady,
                    rooms: hasRooms,
                    roomsCount: this.rooms?.length || 0,
                    friends: hasFriends,
                    friendsCount: this.friendsManager?.friends?.length || 0
                });
                
                if ((isWebSocketReady && hasRooms) || attempts >= maxAttempts) {
                    console.log('✅ 数据就绪，开始恢复聊天状态');
                    resolve();
                } else {
                    // 每500ms检查一次
                    setTimeout(checkReady, 500);
                }
            };
            
            // 初始延迟1秒后开始检查
            setTimeout(checkReady, 1000);
        });
    }

    /**
     * 执行聊天状态恢复
     */
    async doRestoreChatState(chatState) {
        try {
            if (chatState.type === 'private' && chatState.data) {
                // 恢复私聊
                console.log('🔄 尝试恢复私聊:', chatState.data.friendName);
                
                // 确保好友管理器已初始化并且好友列表已加载
                if (!this.friendsManager || !this.friendsManager.friends) {
                    console.log('❌ 好友管理器未就绪，无法恢复私聊');
                    showToast('好友数据未加载完成，无法恢复聊天', 'warning');
                    return;
                }
                
                // 验证好友是否仍在好友列表中
                const friend = this.friendsManager.friends.find(f => f.id === chatState.data.friendId);
                if (friend) {
                    // 等待额外500ms确保好友管理器完全初始化
                    setTimeout(() => {
                        this.friendsManager.startPrivateChat(chatState.data.friendId, chatState.data.friendName);
                        showToast(`已恢复与 ${chatState.data.friendName} 的私聊`, 'success');
                        console.log('✅ 私聊恢复成功');
                    }, 500);
                } else {
                    console.log('❌ 好友不存在，无法恢复私聊');
                    showToast('上次的聊天好友已不存在', 'info');
                    // 清除无效的状态
                    localStorage.removeItem('dify_last_chat_state');
                }
                
            } else if (chatState.type === 'room' && chatState.data) {
                // 恢复聊天室
                console.log('🔄 尝试恢复聊天室:', chatState.data.roomName);
                
                // 验证房间是否仍存在
                const room = this.rooms.find(r => 
                    (r.id === chatState.data.roomId || r.roomId === chatState.data.roomId)
                );
                if (room) {
                    this.joinRoom(chatState.data.roomId);
                    showToast(`已恢复聊天室: ${chatState.data.roomName}`, 'success');
                    console.log('✅ 聊天室恢复成功');
                } else {
                    console.log('❌ 聊天室不存在，无法恢复');
                    showToast('上次的聊天室已不存在', 'info');
                    // 清除无效的状态
                    localStorage.removeItem('dify_last_chat_state');
                }
            } else {
                console.log('❓ 未知的聊天状态类型:', chatState.type);
                // 清除无效的状态
                localStorage.removeItem('dify_last_chat_state');
            }
        } catch (error) {
            console.error('❌ 执行聊天状态恢复失败:', error);
            showToast('恢复上次聊天失败', 'warning');
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
     * 初始化用户活动监听器
     * 用于PIN验证的自动锁定功能
     */
    initializeActivityListeners() {
        if (!window.pinVerification || !window.pinVerification.isEnabled()) {
            return;
        }

        const activities = ['click', 'keypress', 'scroll', 'mousemove', 'touchstart'];
        
        // 防抖处理，避免频繁重置定时器
        let resetTimer = null;
        const resetAutoLockDebounced = () => {
            if (resetTimer) clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
                this.resetAutoLockTimer();
            }, 1000); // 1秒内的多次操作只重置一次
        };

        activities.forEach(activity => {
            document.addEventListener(activity, resetAutoLockDebounced, { passive: true });
        });

        console.log('✅ PIN验证用户活动监听器已初始化');
    }

    /**
     * 检查PIN验证
     * @param {boolean} forceVerify - 是否强制验证（进入页面时为true）
     */
    async checkPinVerification(forceVerify = true) {
        try {
            // 检查是否启用了PIN验证
            if (!window.pinVerification || !window.pinVerification.isEnabled()) {
                console.log('PIN验证未启用，跳过验证');
                return;
            }

            // 检查是否需要解锁（超时锁定）
            const lockStatus = this.checkAutoLockStatus();
            if (lockStatus.needsUnlock) {
                await this.performPinVerification('界面已自动锁定，请输入PIN码解锁');
                this.resetAutoLockTimer();
                return;
            }

            let needVerification = forceVerify; // 进入页面时强制验证

            if (!forceVerify) {
                // 页面内部操作时，根据时间判断
                const lastVerification = localStorage.getItem('pin_last_verification');
                const verificationTimeout = window.pinVerification.getLockTimeout();
                const now = Date.now();
                needVerification = !lastVerification || (now - parseInt(lastVerification)) > verificationTimeout;
            }

            if (needVerification) {
                const message = forceVerify ? '请输入PIN码以访问聊天功能' : '会话已过期，请重新输入PIN码';
                await this.performPinVerification(message);
                
                // 记录本次验证时间，用于自动锁定计时
                const now = Date.now();
                localStorage.setItem('pin_last_verification', now.toString());
            }

            // 启动自动锁定定时器
            this.startAutoLockTimer();

        } catch (error) {
            console.error('PIN验证失败:', error);
            // PIN验证失败，重定向到主页
            showToast('PIN验证失败，无法访问聊天功能', 'error');
            setTimeout(() => {
                window.location.href = './index.html';
            }, 2000);
        }
    }

    /**
     * 执行PIN验证
     */
    async performPinVerification(message) {
        if (!window.pinVerification) {
            throw new Error('PIN验证功能不可用');
        }

        return new Promise((resolve, reject) => {
            window.pinVerification.showVerification(message, () => {
                // 用户取消验证，重定向到主页
                window.location.href = './index.html';
            })
            .then(() => {
                console.log('PIN验证成功');
                resolve();
            })
            .catch((error) => {
                console.error('PIN验证失败:', error);
                reject(error);
            });
        });
    }

    /**
     * 启动自动锁定定时器
     */
    startAutoLockTimer() {
        if (!window.pinVerification || !window.pinVerification.isEnabled()) {
            return;
        }

        this.clearAutoLockTimer();

        const lockTimeout = window.pinVerification.getLockTimeout();
        
        this.autoLockTimer = setTimeout(() => {
            this.lockInterface();
        }, lockTimeout);

        console.log(`自动锁定定时器启动，${lockTimeout / 60000}分钟后锁定`);
    }

    /**
     * 重置自动锁定定时器
     */
    resetAutoLockTimer() {
        if (window.pinVerification && window.pinVerification.isEnabled()) {
            this.startAutoLockTimer();
        }
    }

    /**
     * 清除自动锁定定时器
     */
    clearAutoLockTimer() {
        if (this.autoLockTimer) {
            clearTimeout(this.autoLockTimer);
            this.autoLockTimer = null;
        }
    }

    /**
     * 锁定界面
     */
    lockInterface() {
        console.log('界面自动锁定');
        localStorage.setItem('interface_locked', Date.now().toString());
        this.clearAutoLockTimer();
        
        // 显示锁定遮罩
        this.showLockOverlay();
    }

    /**
     * 显示锁定遮罩
     */
    showLockOverlay() {
        // 创建锁定遮罩
        const overlay = document.createElement('div');
        overlay.id = 'pin-lock-overlay';
        overlay.innerHTML = `
            <div class="pin-lock-content">
                <i class="fas fa-lock fa-3x mb-3"></i>
                <h4>界面已锁定</h4>
                <p class="text-muted mb-4">为了保护您的隐私，界面已自动锁定</p>
                <button class="btn btn-primary" onclick="chatroomController.unlockInterface()">
                    <i class="fas fa-unlock me-2"></i>
                    解锁
                </button>
            </div>
        `;
        
        // 添加样式
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            color: white;
            text-align: center;
        `;
        
        // 添加CSS样式到head中
        const style = document.createElement('style');
        style.textContent = `
            .pin-lock-content {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 1rem;
                padding: 2rem;
                backdrop-filter: blur(20px);
            }
            .pin-lock-content .btn {
                background: linear-gradient(135deg, #28a745, #20c997);
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                color: white;
                font-weight: 500;
                transition: all 0.3s ease;
            }
            .pin-lock-content .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(overlay);
    }

    /**
     * 解锁界面
     */
    async unlockInterface() {
        try {
            // 修改锁定遮罩显示解锁状态，但保持背景模糊
            const overlay = document.getElementById('pin-lock-overlay');
            if (overlay) {
                // 隐藏解锁按钮和提示文字，但保持背景遮罩
                const content = overlay.querySelector('.pin-lock-content');
                if (content) {
                    content.style.display = 'none';
                }
                // 保持遮罩背景以保护隐私
                overlay.style.background = 'rgba(0, 0, 0, 0.7)';
            }

            await this.performPinVerification('请输入PIN码解锁界面');
            
            // 验证成功后移除锁定遮罩
            if (overlay) {
                overlay.remove();
            }
            
            // 清除锁定状态
            localStorage.removeItem('interface_locked');
            localStorage.setItem('pin_last_verification', Date.now().toString());
            
            // 重新启动自动锁定定时器
            this.startAutoLockTimer();
            
            showToast('界面解锁成功', 'success');
            
        } catch (error) {
            console.error('解锁失败:', error);
            showToast('解锁失败', 'error');
            
            // 恢复锁定遮罩的原始显示状态
            const overlay = document.getElementById('pin-lock-overlay');
            if (overlay) {
                const content = overlay.querySelector('.pin-lock-content');
                if (content) {
                    content.style.display = 'block';
                }
                overlay.style.background = 'rgba(0, 0, 0, 0.9)';
            }
        }
    }

    /**
     * 检查自动锁定状态
     */
    checkAutoLockStatus() {
        const lockTimestamp = localStorage.getItem('interface_locked');
        if (!lockTimestamp) {
            return { needsUnlock: false };
        }

        // 检查锁定时间是否有效（避免长时间锁定）
        const lockTime = parseInt(lockTimestamp);
        const now = Date.now();
        const maxLockDuration = 24 * 60 * 60 * 1000; // 24小时

        if ((now - lockTime) > maxLockDuration) {
            // 超过最大锁定时间，自动解除锁定状态
            localStorage.removeItem('interface_locked');
            return { needsUnlock: false };
        }

        return { needsUnlock: true, lockTime };
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
        // 防止重复绑定 - 先移除所有已存在的监听器
        if (this.eventsSetup) {
            console.log('🔄 [前端] 清理旧的WebSocket事件监听器');
            this.websocket.removeAllListeners();
        }

        console.log('🎯 [前端] 设置WebSocket事件监听器...');

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

        this.websocket.on('join-room-success', async (data) => {
            console.log('✅ [前端] 成功加入房间:', data);
            console.log('🔍 [前端] 房间加入详情:', {
                roomId: data.id || data.roomId,
                roomName: data.roomName || data.name,
                memberCount: data.memberCount,
                onlineUsers: data.onlineUsers?.length || 0,
                recentMessages: data.recentMessages?.length || 0,
                recentMessagesDetail: data.recentMessages
            });
            
            // 检查是否有智能体消息
            if (data.recentMessages && data.recentMessages.length > 0) {
                const agentMessages = data.recentMessages.filter(msg => 
                    msg.senderType === 'agent' || msg.type === 'agent_response' || msg.agentId
                );
                console.log('🤖 [前端] WebSocket中的智能体消息数量:', agentMessages.length);
                if (agentMessages.length > 0) {
                    console.log('🤖 [前端] 智能体消息详情:', agentMessages);
                    
                    // 详细分析第一条智能体消息的数据结构
                    console.log('🔍 [WebSocket智能体消息] 第一条消息详细结构:', {
                        id: agentMessages[0].id,
                        senderType: agentMessages[0].senderType,
                        type: agentMessages[0].type,
                        agentId: agentMessages[0].agentId,
                        agentName: agentMessages[0].agentName,
                        userId: agentMessages[0].userId,
                        username: agentMessages[0].username,
                        sender_username: agentMessages[0].sender_username,
                        content: agentMessages[0].content?.substring(0, 50) + '...',
                        createdAt: agentMessages[0].createdAt,
                        allFields: Object.keys(agentMessages[0]).sort()
                    });
                }
            }
            
            // 清除timeout
            if (this.joinRoomTimeout) {
                clearTimeout(this.joinRoomTimeout);
                this.joinRoomTimeout = null;
            }
            
            this.currentRoom = data;
            await this.updateRoomInfo(data);
            this.showSuccess(`成功加入房间: ${data.roomName || data.name || data.roomId}`);
            
            // 保存聊天状态
            this.saveCurrentChatState();
            
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
            console.log('📨 [前端] 收到新消息 (完整对象):', message);
            console.log('🔍 [前端] 消息详情:', {
                messageId: message.id,
                content: message.content?.substring(0, 50) + '...',
                senderId: message.senderId,
                senderName: message.senderName,
                messageRoomId: message.roomId,
                currentRoomId: this.currentRoom?.id || this.currentRoom?.roomId,
                currentUserId: this.currentUser?.id,
                isOwnMessage: message.senderId === this.currentUser?.id,
                messageType: message.type || message.message_type,
                hasAttachments: !!message.attachments,
                attachments: message.attachments,
                allKeys: Object.keys(message)
            });
            
            // 检查消息是否属于当前房间
            const currentRoomId = this.currentRoom?.id || this.currentRoom?.roomId;
            if (message.roomId && currentRoomId && message.roomId !== currentRoomId) {
                console.log('🚫 [前端] 消息属于其他房间，忽略:', {
                    messageRoomId: message.roomId,
                    currentRoomId: currentRoomId
                });
                return;
            }
            
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

        // 智能体流式响应处理 - 按照后端文档方案B实现
        this.streamingMessages = new Map(); // 管理流式消息

        // 🚫 不再监听 agent-stream-start（后端不发送此事件）
        
        this.websocket.on('agent-typing-start', (data) => {
            console.log('🤖 [前端] 智能体开始思考:', data);
            this.showAgentTyping(data);
        });

        this.websocket.on('agent-typing-stop', (data) => {
            console.log('🤖 [前端] 智能体思考完成:', data);
            this.hideAgentTyping(data.agentId);
        });

        // 1. 监听流式片段，实时更新 - 关键事件
        this.websocket.on('agent-stream-chunk', (data) => {
            console.log('� [前端] 收到智能体流式片段:', {
                messageId: data.messageId,
                chunk: data.chunk,
                chunkLength: data.chunk?.length
            });
            
            let streamingMsg = this.streamingMessages.get(data.messageId);
            if (!streamingMsg) {
                // 创建新的流式消息
                streamingMsg = {
                    id: data.messageId,
                    agentId: data.agentId,
                    agentName: data.agentName,
                    content: '',
                    isStreaming: true,
                    timestamp: data.timestamp,
                    replyToId: data.replyToId
                };
                this.streamingMessages.set(data.messageId, streamingMsg);
                
                // 显示开始流式响应的占位符
                this.displayStreamingMessageStart(streamingMsg);
                console.log('✨ [前端] 创建新的流式消息:', data.messageId);
            }
            
            // 累积内容并更新UI
            streamingMsg.content += data.chunk;
            this.updateStreamingMessageContent(data.messageId, streamingMsg.content);
        });

        // 2. 监听完整响应，完成流式消息
        this.websocket.on('agent-response', (data) => {
            console.log('🎯 [前端] 智能体响应完成:', {
                id: data.id,
                messageId: data.messageId,
                isStreamingResponse: data.isStreamingResponse,
                agentName: data.agentName || data.username,
                contentLength: data.content?.length
            });
            
            if (data.isStreamingResponse) {
                console.log('✅ [前端] 这是流式响应的最终消息');
                
                // 🔧 修复：尝试找到对应的流式消息
                let foundStreamingId = null;
                
                // 先尝试用 data.messageId 查找
                if (data.messageId && this.streamingMessages.has(data.messageId)) {
                    foundStreamingId = data.messageId;
                    console.log('🔍 [前端] 通过 messageId 找到流式消息:', foundStreamingId);
                }
                // 再尝试用 data.id 查找
                else if (data.id && this.streamingMessages.has(data.id)) {
                    foundStreamingId = data.id;
                    console.log('🔍 [前端] 通过 id 找到流式消息:', foundStreamingId);
                }
                // 最后尝试查找同一智能体最近的流式消息
                else {
                    for (let [msgId, streamingMsg] of this.streamingMessages) {
                        if (streamingMsg.agentId === data.agentId) {
                            foundStreamingId = msgId;
                            console.log('🔍 [前端] 通过 agentId 找到流式消息:', foundStreamingId);
                            break;
                        }
                    }
                }
                
                if (foundStreamingId) {
                    // 从流式管理中移除
                    this.streamingMessages.delete(foundStreamingId);
                    
                    // 完成流式消息显示，使用找到的流式消息ID
                    this.finalizeStreamingMessage({
                        ...data,
                        streamingMessageId: foundStreamingId
                    });
                } else {
                    console.warn('⚠️ [前端] 未找到对应的流式消息，检查是否已存在相同消息');
                    
                    // 检查是否已经存在相同ID的消息（避免重复）
                    if (data.id && this.processedMessages.has(data.id)) {
                        console.log('🔄 [前端] 消息已存在，跳过添加:', data.id);
                        return;
                    }
                    
                    // 没有找到流式消息，且消息不存在，才添加完整消息
                    this.addMessage({
                        id: data.id,
                        content: data.content,
                        username: data.agentName || data.username || 'AI智能体',
                        agentId: data.agentId,
                        agentName: data.agentName,
                        createdAt: data.createdAt,
                        type: 'agent_response',
                        senderType: 'agent',
                        replyToId: data.replyToId,
                        replyToContent: data.replyToContent
                    });
                }
            } else {
                // 如果不是流式响应，检查是否已存在，然后添加消息
                console.log('📝 [前端] 这是直接的完整响应');
                
                // 检查是否已经存在相同ID的消息（避免重复）
                if (data.id && this.processedMessages.has(data.id)) {
                    console.log('🔄 [前端] 消息已存在，跳过添加:', data.id);
                    return;
                }
                
                this.addMessage({
                    id: data.id,
                    content: data.content,
                    username: data.agentName || data.username || 'AI智能体',
                    agentId: data.agentId,
                    agentName: data.agentName,
                    createdAt: data.createdAt,
                    type: 'agent_response',
                    senderType: 'agent',
                    replyToId: data.replyToId,
                    replyToContent: data.replyToContent
                });
            }
            
            this.hideAgentTyping(data.agentId);
        });

        // 智能体错误处理
        this.websocket.on('agent-error', (data) => {
            console.error('❌ [前端] 智能体响应错误:', data);
            this.hideAgentTyping(data.agentId);
            this.showAgentError(data);
        });

        // 智能体权限错误
        this.websocket.on('agent-no-permission', (data) => {
            console.warn('⚠️ [前端] 智能体权限不足:', data);
            this.showWarning(`您没有权限使用智能体 @${data.agentName}`);
        });

        // 兼容旧版本事件名
        this.websocket.on('agent-typing', (data) => {
            console.log('🤖 [前端] 智能体正在思考 (旧版):', data);
            this.showAgentTyping(data);
        });

        this.websocket.on('agent-thinking', (data) => {
            console.log('🤖 [前端] 智能体思考中 (兼容):', data);
            this.showAgentTyping({
                agentId: data.agentId,
                agentName: data.agentName || 'AI助手'
            });
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

        // 🔍 调试：监听所有WebSocket事件
        if (this.websocket.onAny) {
            this.websocket.onAny((eventName, data) => {
                console.log('🌐 [WebSocket] 收到事件:', eventName, data);
            });
        }

        // 标记事件已设置，防止重复绑定
        this.eventsSetup = true;
        console.log('✅ [前端] WebSocket事件监听器设置完成');
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
            // 如果智能体建议列表显示，不处理Enter键发送消息
            if (this.agentSuggestionsList && this.agentSuggestionsList.style.display !== 'none') {
                return;
            }
            
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 输入状态检测和@智能体功能
        this.elements.messageInput.addEventListener('input', (e) => {
            this.handleTypingStatus();
            this.handleAtMention(e);
        });

        // 添加键盘导航支持
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (this.agentSuggestionsList && this.agentSuggestionsList.style.display !== 'none') {
                this.handleAgentSuggestionKeydown(e);
            }
        });

        // 点击其他地方隐藏智能体建议列表
        document.addEventListener('click', (e) => {
            if (this.agentSuggestionsList && !this.agentSuggestionsList.contains(e.target) && e.target !== this.elements.messageInput) {
                this.hideAgentSuggestions();
            }
        });

        // @智能体按钮 - 现在只是简单地插入@符号到输入框
        this.elements.mentionButton.addEventListener('click', () => {
            this.insertAtSymbol();
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
        
        // 移动端添加调试按钮（临时禁用）
        // this.addMobileDebugButton();
    }

    /**
     * 添加移动端调试按钮
     */
    addMobileDebugButton() {
        // 强制显示调试按钮，不管屏幕大小
        const debugBtn = document.createElement('button');
        debugBtn.innerHTML = '🐛';
        debugBtn.title = '调试信息';
        debugBtn.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 10px;
            background: #dc3545;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 50%;
            font-size: 16px;
            z-index: 9998;
            cursor: pointer;
            width: 50px;
            height: 50px;
        `;
        
        debugBtn.addEventListener('click', () => {
            this.showCurrentDebugInfo();
        });
        
        document.body.appendChild(debugBtn);
        
        // 确认按钮已添加
        console.log('🐛 调试按钮已添加到页面');
    }

    /**
     * 显示当前消息的调试信息
     */
    showCurrentDebugInfo() {
        const messages = this.elements.chatMessages.querySelectorAll('.message');
        const messageCount = messages.length;
        const lastMessage = messages[messageCount - 1];
        
        let debugInfo = `屏幕宽度: ${window.innerWidth}px
当前用户ID: ${this.currentUser?.id || 'null'}
当前用户名: ${this.currentUser?.username || 'null'}
消息总数: ${messageCount}`;

        if (lastMessage) {
            const computedStyle = window.getComputedStyle(lastMessage);
            const classList = Array.from(lastMessage.classList);
            
            debugInfo += `

最后一条消息:
CSS类: ${classList.join(' ')}
display: ${computedStyle.display}
justifyContent: ${computedStyle.justifyContent}
flexDirection: ${computedStyle.flexDirection}
width: ${computedStyle.width}`;
        } else {
            debugInfo += `\n\n没有找到任何消息`;
        }
        
        // 同时显示在页面和alert中
        const debugContainer = document.getElementById('mobile-debug-info');
        const debugContent = document.getElementById('debug-content');
        
        if (debugContainer && debugContent) {
            debugContent.innerHTML = `<pre>${debugInfo}</pre>`;
            debugContainer.style.display = 'block';
        }
        
        alert(debugInfo);
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
    async joinRoom(roomId) {
        try {
            if (!this.websocket || !this.websocket.connected) {
                this.showError('WebSocket未连接');
                return;
            }

            if (this.currentRoom?.roomId === roomId || this.currentRoom?.id === roomId) {
                return; // 已在当前房间
            }

            // PIN验证检查 - 根据自动锁定时间判断
            if (window.pinVerification && window.pinVerification.isEnabled()) {
                const lastVerification = localStorage.getItem('pin_last_verification');
                const verificationTimeout = window.pinVerification.getLockTimeout();
                const now = Date.now();

                if (!lastVerification || (now - parseInt(lastVerification)) > verificationTimeout) {
                    try {
                        await window.pinVerification.showVerification('请输入PIN码以进入房间');
                        localStorage.setItem('pin_last_verification', now.toString());
                        this.resetAutoLockTimer();
                    } catch (error) {
                        console.log('房间PIN验证失败或取消:', error.message);
                        showToast('PIN验证失败，无法进入房间', 'warning');
                        return;
                    }
                } else {
                    // 重置自动锁定定时器
                    this.resetAutoLockTimer();
                }
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
        
        // 移动端自动关闭侧边栏
        if (window.innerWidth <= 768) {
            this.closeSidebar();
        }
        
        // 临时解决方案：如果2秒内没有收到join-room-success响应，直接设置房间
        // 这是为了处理后端可能没有实现join-room事件的情况
        const timeoutId = setTimeout(async () => {
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
                
                await this.updateRoomInfo(this.currentRoom);
                this.showSuccess(`已选择房间: ${this.currentRoom.roomName}`);
                
                // 保存聊天状态
                this.saveCurrentChatState();
                
                // 请求房间状态和在线用户信息
                setTimeout(() => {
                    console.log('🔄 [前端] 请求房间状态和在线用户信息 (临时方案):', roomId);
                    this.websocket.emit('get-room-state', { roomId: roomId });
                }, 500);
            }
        }, 2000);

        // 保存timeout ID以便在成功时清除
        this.joinRoomTimeout = timeoutId;
        } catch (error) {
            console.error('加入房间失败:', error);
            this.showError('加入房间失败: ' + error.message);
        }
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
    async updateRoomInfo(roomData) {
        if (!roomData) {
            // 清空状态 - 没有选择房间
            this.elements.currentRoomName.innerHTML = '<i class="fas fa-users me-2"></i>请选择聊天室';
            
            // 禁用输入控件
            this.elements.messageInput.disabled = true;
            this.elements.sendButton.disabled = true;
            this.elements.mentionButton.disabled = true;
            if (this.elements.emojiButton) {
                this.elements.emojiButton.disabled = true;
            }
            if (this.elements.imageUploadButton) {
                this.elements.imageUploadButton.disabled = true;
            }
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
        if (this.elements.emojiButton) {
            this.elements.emojiButton.disabled = false;
        }
        if (this.elements.imageUploadButton) {
            this.elements.imageUploadButton.disabled = false;
        }
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

        // 优先通过API获取完整的历史消息（后端修复后的方案）
        const apiSuccess = await this.loadRoomHistoryFromAPI(roomData.id || roomData.roomId);

        // 只有当API调用失败时，才使用WebSocket返回的消息作为备用
        if (!apiSuccess && roomData.recentMessages && roomData.recentMessages.length > 0) {
            console.log('🔄 [前端] API加载失败，使用WebSocket备用消息:', roomData.recentMessages.length);
            console.log('📋 [前端] WebSocket消息详情:', roomData.recentMessages);
            
            roomData.recentMessages.forEach((message, index) => {
                // 检查是否是智能体消息
                const isAgent = message.senderType === 'agent' || message.type === 'agent_response' || message.agentId;
                
                console.log(`📜 [WebSocket备用消息] ${index + 1}:`, {
                    id: message.id,
                    content: message.content?.substring(0, 50) + '...',
                    type: message.type,
                    senderType: message.senderType,
                    agentId: message.agentId,
                    agentName: message.agentName,
                    userId: message.userId,
                    username: message.username,
                    isAgentMessage: isAgent,
                    hasAttachments: !!message.attachments,
                    messageType: message.type || message.message_type
                });
                this.addMessage(message, false);
            });
            
            // 备用消息加载完成后滚动到底部
            setTimeout(() => {
                this.scrollToBottom();
            }, 200);
        }
        
        // 如果没有任何消息，显示欢迎信息
        if (!apiSuccess && (!roomData.recentMessages || roomData.recentMessages.length === 0)) {
            console.log('📭 [前端] 没有找到任何历史消息');
            console.log('🔍 [前端] 当前聊天区域消息数量:', this.elements.chatMessages?.children?.length || 0);
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
        
        // 重新加载智能体列表（因为现在使用全局智能体，不依赖特定聊天室）
        await this.loadAgents();
    }

    /**
     * 测试API调用（调试用）
     */
    async testAPICall(roomId) {
        try {
            console.log('🧪 [测试] 开始测试API调用:', roomId);
            
            const result = await this.roomManagementService.getRoomMessages(roomId, {
                limit: 10
            });
            
            console.log('🧪 [测试] API调用成功:', result);
            return result;
        } catch (error) {
            console.error('🧪 [测试] API调用失败:', error);
            return null;
        }
    }

    /**
     * 通过API加载房间历史消息（后端修复后的完整实现）
     */
    async loadRoomHistoryFromAPI(roomId) {
        try {
            console.log('🚀 [前端] 开始通过API加载房间历史消息:', roomId);
            
            // 检查 roomManagementService 是否存在
            if (!this.roomManagementService) {
                console.error('❌ [前端] roomManagementService 未初始化');
                return false;
            }
            
            // 调用房间管理服务获取历史消息
            const result = await this.roomManagementService.getRoomMessages(roomId, {
                limit: 50,
                type: null  // 获取所有类型的消息
            });

            console.log('📨 [前端] API返回的历史消息结果:', {
                success: !!result,
                messageCount: result?.messages?.length || 0,
                total: result?.total || 0,
                hasMessages: !!(result?.messages?.length),
                fullResult: result
            });
            
            // 显示API返回的原始数据结构
            if (result && result.messages && result.messages.length > 0) {
                console.log('🔍 [API原始数据] 前3条消息的完整数据结构:', 
                    result.messages.slice(0, 3).map(msg => ({
                        id: msg.id,
                        content: msg.content?.substring(0, 30) + '...',
                        allFields: Object.keys(msg),
                        rawMessage: msg
                    }))
                );
            }

            if (result && result.messages && result.messages.length > 0) {
                console.log('✅ [前端] 找到API历史消息，开始渲染:', result.messages.length);
                
                // 检查API返回的消息中是否有智能体消息
                const apiAgentMessages = result.messages.filter(msg => 
                    msg.senderType === 'agent' || msg.type === 'agent_response' || msg.agentId || 
                    (msg.userId === null && msg.agentName)
                );
                console.log('🤖 [API智能体消息] API返回的智能体消息数量:', apiAgentMessages.length);
                
                if (apiAgentMessages.length > 0) {
                    console.log('🤖 [API智能体消息] 第一条智能体消息详细结构:', {
                        id: apiAgentMessages[0].id,
                        senderType: apiAgentMessages[0].senderType,
                        type: apiAgentMessages[0].type,
                        agentId: apiAgentMessages[0].agentId,
                        agentName: apiAgentMessages[0].agentName,
                        userId: apiAgentMessages[0].userId,
                        username: apiAgentMessages[0].username,
                        sender_username: apiAgentMessages[0].sender_username,
                        content: apiAgentMessages[0].content?.substring(0, 50) + '...',
                        allFields: Object.keys(apiAgentMessages[0]).sort()
                    });
                    
                    // 🔍 检查是否有重复的智能体消息
                    console.log('🔍 [重复检查] 检查所有智能体消息的ID和内容:');
                    apiAgentMessages.forEach((msg, index) => {
                        console.log(`   智能体消息 ${index + 1}:`, {
                            id: msg.id,
                            agentId: msg.agentId,
                            agentName: msg.agentName,
                            username: msg.username,
                            content: msg.content?.substring(0, 100) + '...',
                            createdAt: msg.createdAt
                        });
                    });
                    
                    // 检查是否有相同内容的消息
                    const contentGroups = {};
                    apiAgentMessages.forEach(msg => {
                        const content = msg.content;
                        if (!contentGroups[content]) {
                            contentGroups[content] = [];
                        }
                        contentGroups[content].push({
                            id: msg.id,
                            agentName: msg.agentName || msg.username,
                            agentId: msg.agentId
                        });
                    });
                    
                    Object.keys(contentGroups).forEach(content => {
                        if (contentGroups[content].length > 1) {
                            console.error('❌ [重复内容] 发现相同内容的多条消息:', {
                                content: content?.substring(0, 100) + '...',
                                messages: contentGroups[content]
                            });
                        }
                    });
                } else {
                    console.log('❌ [API问题] API返回的消息中没有智能体标识字段！');
                    console.log('🔍 [API问题] 第一条消息的字段:', {
                        id: result.messages[0].id,
                        allFields: Object.keys(result.messages[0]).sort(),
                        senderType: result.messages[0].senderType,
                        type: result.messages[0].type,
                        agentId: result.messages[0].agentId,
                        userId: result.messages[0].userId,
                        sender_username: result.messages[0].sender_username
                    });
                }
                
                // 检查消息格式并添加调试信息
                result.messages.forEach((message, index) => {
                    // 解析attachments JSON字符串
                    if (message.attachments && typeof message.attachments === 'string') {
                        try {
                            message.attachments = JSON.parse(message.attachments);
                            console.log(`✅ [API消息] 成功解析attachments JSON: ${message.attachments.length}个附件`);
                        } catch (e) {
                            console.error('❌ [API消息] 解析attachments JSON失败:', e, message.attachments);
                            message.attachments = [];
                        }
                    } else if (!message.attachments) {
                        message.attachments = [];
                    }
                    
                    // 统一消息字段格式（适配不同的后端返回格式）
                    if (!message.senderName && message.sender_username) {
                        message.senderName = message.sender_nickname || message.sender_username;
                    }
                    if (!message.username && message.sender_username) {
                        message.username = message.sender_username;
                    }
                    
                    // 处理智能体消息字段
                    if (message.senderType === 'agent' || message.type === 'agent_response' || message.agentId) {
                        // 确保智能体消息有正确的agentName
                        if (!message.agentName && message.username) {
                            message.agentName = message.username;
                        }
                        if (!message.agentName && message.sender_username) {
                            message.agentName = message.sender_username;
                        }
                        console.log('🤖 [API智能体消息] 处理智能体字段:', {
                            agentId: message.agentId,
                            agentName: message.agentName,
                            senderType: message.senderType,
                            type: message.type
                        });
                    }
                    
                    if (!message.senderId) {
                        // 尝试多种可能的发送者ID字段
                        message.senderId = message.sender_id || message.user_id || message.senderId;
                        
                        // 如果还是没有senderId，通过用户名匹配
                        if (!message.senderId && this.currentUser && message.sender_username === this.currentUser.username) {
                            message.senderId = this.currentUser.id;
                        }
                    }
                    if (!message.createdAt && message.created_at) {
                        message.createdAt = message.created_at;
                    }
                    if (!message.timestamp && message.created_at) {
                        message.timestamp = message.created_at;
                    }
                    
                    console.log(`🔍 [API消息] ${index + 1}/${result.messages.length}:`, {
                        id: message.id,
                        content: message.content?.substring(0, 50) + '...',
                        content_type: message.content_type,
                        messageType: message.messageType,
                        type: message.type,
                        senderType: message.senderType,
                        agentId: message.agentId,
                        agentName: message.agentName,
                        userId: message.userId,
                        hasAttachments: !!(message.attachments && message.attachments.length > 0),
                        attachments: message.attachments,
                        sender: message.sender_username || message.senderInfo?.username,
                        mappedFields: {
                            senderName: message.senderName,
                            senderId: message.senderId,
                            createdAt: message.createdAt
                        }
                    });
                    
                    // 添加消息到聊天区域
                    this.addMessage(message, false);
                });

                console.log('✅ [前端] API历史消息渲染完成');
                console.log('📊 [前端] 当前聊天区域消息总数:', this.elements.chatMessages?.children?.length || 0);
                console.log('🔍 [前端] 聊天区域HTML内容预览:', this.elements.chatMessages?.innerHTML?.substring(0, 200) + '...');
                
                // 确保在所有消息渲染完成后滚动到底部
                setTimeout(() => {
                    this.scrollToBottom();
                }, 200);
                
                return true;
            } else {
                console.log('📭 [前端] API未返回历史消息');
                return false;
            }
        } catch (error) {
            console.error('❌ [前端] API加载历史消息失败:', error);
            console.error('🔧 [前端] 错误详情:', {
                message: error.message,
                stack: error.stack?.substring(0, 200)
            });
            return false;
        }
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
            // 发送普通消息 - 但仍然检测是否包含@智能体
            const agentMentions = this.extractAgentMentions(content);
            
            console.log('📤 [前端] 发送普通消息:', {
                roomId: this.currentRoom.id || this.currentRoom.roomId,
                content: content,
                type: 'text',
                agentMentions: agentMentions
            });
            
            const messageData = {
                roomId: this.currentRoom.id || this.currentRoom.roomId,
                content: content,
                type: 'text',
                timestamp: Date.now(),
                clientId: this.websocket.id,  // 客户端标识，用于消息确认
                agentMentions: agentMentions  // 添加智能体提及信息
            };
            
            // 先在本地显示消息（乐观更新）
            const localMessageId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const localMessage = {
                id: localMessageId,
                content: content,
                type: 'text',
                senderId: this.currentUser.id,
                userId: this.currentUser.id,
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
     * @智能体 - 根据后端反馈优化版本
     */
    async mentionAgent(agentName, content) {
        try {
            // 查找智能体（确保智能体存在）
            const agent = this.agents.find(a => 
                a.name === agentName || a.id === agentName || a.agentName === agentName
            );

            if (!agent) {
                this.showError(`未找到智能体: ${agentName}`);
                return;
            }

            // 提取所有@智能体提及
            const agentMentions = this.extractAgentMentions(content);

            console.log('🤖 [前端] @智能体发送 (优化版):', {
                agentId: agent.id,
                agentName: agent.name || agent.agentName,
                content: content,
                agentMentions: agentMentions,
                roomId: this.currentRoom.id || this.currentRoom.roomId
            });

            // 根据后端反馈的消息格式
            const messageData = {
                roomId: this.currentRoom.id || this.currentRoom.roomId,
                content: content, // 包含@智能体名称的完整消息内容
                type: 'text',
                timestamp: Date.now(),
                clientId: this.websocket.id,
                agentMentions: agentMentions, // 后端要求的字段
                metadata: {
                    mentionedAgent: {
                        id: agent.id,
                        name: agent.name
                    }
                }
            };
            
            // 先在本地显示消息（乐观更新）
            const localMessageId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const localMessage = {
                id: localMessageId,
                content: content,
                type: 'text',
                senderId: this.currentUser.id,
                userId: this.currentUser.id,
                senderName: this.currentUser.username,
                username: this.currentUser.username,
                timestamp: Date.now(),
                createdAt: new Date().toISOString(),
                isLocalPending: true  // 标记为本地待确认消息
            };
            
            this.addMessage(localMessage);
            console.log('📤 [前端] 添加本地@智能体消息:', localMessageId);
            
            // 通过WebSocket发送
            this.websocket.emit('send-message', messageData);
            
            // 设置超时检查
            const timeoutId = setTimeout(() => {
                if (localMessage.isLocalPending) {
                    console.warn('⚠️ [前端] @智能体消息5秒内未收到确认:', localMessageId);
                    this.showWarning('@智能体消息发送可能延迟，请稍候...');
                }
            }, 5000);

            localMessage.timeoutId = timeoutId;

        } catch (error) {
            console.error('💥 [前端] @智能体失败:', error);
            this.showError('@智能体失败: ' + error.message);
        }
    }

    /**
     * 添加消息到界面
     */
    addMessage(message, shouldScroll = true) {
        console.log('🖼️ [前端] addMessage 开始添加消息到界面:', {
            messageId: message.id,
            senderId: message.senderId,
            sender_username: message.sender_username,
            senderName: message.senderName,
            content: message.content?.substring(0, 50) + '...',
            currentUserId: this.currentUser?.id,
            currentUsername: this.currentUser?.username,
            currentRoomId: this.currentRoom?.id || this.currentRoom?.roomId,
            isStreaming: message.isStreaming,
            type: message.type
        });
        
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        
        // 设置消息ID和流式状态
        messageElement.setAttribute('data-message-id', message.id);
        if (message.isStreaming) {
            messageElement.setAttribute('data-streaming', 'true');
            messageElement.classList.add('streaming');
        }

        // 判断消息类型
        let messageClass = 'message-other';
        
        // 增强用户识别逻辑
        const isCurrentUser = (
            // 通过ID匹配
            (message.senderId && message.senderId === this.currentUser.id) ||
            (message.userId && message.userId === this.currentUser.id) ||
            // 通过用户名匹配（备用方案）
            (message.sender_username && message.sender_username === this.currentUser.username) ||
            (message.username && message.username === this.currentUser.username)
        );
        
        // 根据后端修复后的数据格式识别智能体消息
        const isAgentMessage = (
            message.senderType === 'agent' || 
            message.type === 'agent_response' || 
            message.agentId ||
            (message.userId === null && message.agentName)
        );

        if (isCurrentUser) {
            messageClass = 'message-user';
        } else if (isAgentMessage) {
            messageClass = 'message-agent';
        } else if (message.type === 'system') {
            messageClass = 'message-system';
        }

        console.log('🎨 [前端] 消息样式分类:', {
            messageClass: messageClass,
            messageId: message.id,
            senderId: message.senderId,
            senderType: message.senderType,
            agentId: message.agentId,
            agentName: message.agentName,
            userId: message.userId,
            currentUserId: this.currentUser.id,
            isCurrentUser: isCurrentUser,
            isAgentMessage: isAgentMessage,
            isSystem: message.type === 'system'
        });

        messageElement.classList.add(messageClass);

        // 构建消息HTML
        let messageHTML = `<div class="message-bubble">`;

        // 消息头部（发送者和时间）
        if (messageClass !== 'message-system') {
            // 根据消息类型选择合适的发送者名称
            let senderName;
            if (isAgentMessage) {
                // 智能体消息：优先使用 agentName，然后是 username
                senderName = message.agentName || message.username || '智能体';
            } else {
                // 用户消息：使用 username 或 senderName
                senderName = message.username || message.senderName || '未知用户';
            }
            
            const timestamp = this.formatTime(message.createdAt || message.timestamp);
            
            messageHTML += `
                <div class="message-header">
                    <span class="message-sender">
                        ${isAgentMessage ? '🤖 ' : '👤 '}${this.escapeHtml(senderName)}
                    </span>
                    <span class="message-time">${timestamp}</span>
                </div>
            `;
        }

        // 回复预览 - 检查是否为加密内容
        if (message.replyToContent) {
            // 检查回复内容是否是加密格式（包含冒号分隔的加密字符串）
            const isEncryptedReply = message.replyToContent.includes(':') && 
                                   message.replyToContent.split(':').length >= 3 &&
                                   /^[a-f0-9:]+$/i.test(message.replyToContent);
            
            if (isEncryptedReply) {
                // 如果是加密内容，显示简化的回复标识
                messageHTML += `
                    <div class="reply-preview">
                        <i class="fas fa-reply me-1"></i>回复消息
                    </div>
                `;
                console.log('🔒 [回复] 检测到加密回复内容，使用简化显示:', {
                    messageId: message.id,
                    encryptedContent: message.replyToContent?.substring(0, 50) + '...'
                });
            } else {
                // 正常的回复内容，截断显示
                const replyContent = message.replyToContent.length > 50 
                    ? message.replyToContent.substring(0, 50) + '...' 
                    : message.replyToContent;
                messageHTML += `
                    <div class="reply-preview">
                        <i class="fas fa-reply me-1"></i>回复: ${this.escapeHtml(replyContent)}
                    </div>
                `;
                console.log('💬 [回复] 显示正常回复内容:', {
                    messageId: message.id,
                    replyContent: replyContent
                });
            }
        }

        // 消息内容处理 - 对于图片消息，不显示加密文本
        let contentToShow = message.content;
        console.log('🔍 [调试] 消息内容处理开始:', {
            messageId: message.id,
            originalContent: contentToShow?.substring(0, 100) + (contentToShow?.length > 100 ? '...' : ''),
            contentLength: contentToShow?.length,
            hasAttachments: !!(message.attachments && message.attachments.length > 0),
            attachmentsCount: message.attachments?.length || 0
        });

        if (message.attachments && message.attachments.length > 0) {
            // 检查内容是否像加密字符串或系统提示
            const isEncryptedContent = contentToShow && 
                contentToShow.includes(':') && 
                contentToShow.length > 50 && 
                /^[a-f0-9:]+$/.test(contentToShow);
                
            const isImageSystemMessage = contentToShow && 
                (contentToShow.includes('发送了图片') || 
                 contentToShow.includes('sent an image') ||
                 contentToShow.match(/^[a-f0-9_.-]+\.(jpg|jpeg|png|gif|webp)$/i));
            
            console.log('🔍 [调试] 图片消息内容检查:', {
                messageId: message.id,
                isEncryptedContent,
                isImageSystemMessage,
                willHideContent: isEncryptedContent || isImageSystemMessage,
                contentPreview: contentToShow?.substring(0, 100)
            });
            
            if (isEncryptedContent || isImageSystemMessage) {
                contentToShow = '';
            }
        }
        
        // 对于没有附件的消息，也要检查是否是加密hash码
        if ((!message.attachments || message.attachments.length === 0) && contentToShow) {
            // 更严格的加密内容检测，避免误判正常消息
            const hasNonHexChars = /[^a-f0-9:]/.test(contentToShow);
            const isEncryptedContent = contentToShow && 
                !hasNonHexChars &&  // 只包含十六进制字符和冒号
                contentToShow.includes(':') && 
                contentToShow.length > 100 &&  // 增加长度要求
                contentToShow.split(':').length > 10;  // 确保有足够多的冒号分割
                
            console.log('🔍 [调试] 纯文本消息内容检查:', {
                messageId: message.id,
                contentLength: contentToShow.length,
                hasColon: contentToShow.includes(':'),
                hasNonHexChars: hasNonHexChars,
                isHexOnly: !hasNonHexChars,
                colonCount: contentToShow.split(':').length - 1,
                isEncryptedContent,
                willHideContent: isEncryptedContent,
                contentPreview: contentToShow.substring(0, 100) + (contentToShow.length > 100 ? '...' : '')
            });
                
            if (isEncryptedContent) {
                console.log('🔒 [聊天室] 检测到加密hash码内容，已过滤:', contentToShow.substring(0, 50) + '...');
                contentToShow = '';
            }
        }
        
        // 流式消息特殊处理：即使内容为空也要创建内容元素
        if (contentToShow && contentToShow.trim()) {
            console.log('✅ [调试] 将显示消息内容:', {
                messageId: message.id,
                contentPreview: contentToShow.substring(0, 100) + (contentToShow.length > 100 ? '...' : ''),
                contentLength: contentToShow.length
            });
            messageHTML += `
                <div class="message-content">${this.formatMessageContent(contentToShow)}</div>
            `;
        } else if (message.isStreaming) {
            console.log('🌊 [调试] 流式消息创建空内容元素:', {
                messageId: message.id,
                isStreaming: message.isStreaming
            });
            messageHTML += `
                <div class="message-content"><span class="typing-cursor">|</span></div>
            `;
        } else {
            console.log('⚠️ [调试] 消息内容为空，不显示:', {
                messageId: message.id,
                originalContent: message.content?.substring(0, 50),
                wasFiltered: message.content && !contentToShow
            });
        }

        // 处理附件（图片）
        console.log('🖼️ [调试] 检查消息附件:', {
            messageId: message.id,
            hasAttachments: !!message.attachments,
            attachmentsLength: message.attachments?.length,
            attachments: message.attachments,
            messageType: message.type || message.message_type,
            isHistoryMessage: !message.isLocalPending && !message.isOwnMessage,
            fullMessage: message
        });
        
        
        // 处理图片附件 - 使用DOM操作而不是innerHTML来支持认证
        if (message.attachments && message.attachments.length > 0) {
            // 先完成基本HTML结构，关闭 message-bubble
            messageHTML += '</div>';
            messageElement.innerHTML = messageHTML;
            
            // 创建附件容器
            const attachmentsContainer = document.createElement('div');
            attachmentsContainer.className = 'message-attachments mt-2';
            
            message.attachments.forEach((attachment, index) => {
                console.log(`🖼️ [调试] 处理附件 ${index + 1}:`, attachment, typeof attachment);
                
                let imageUrl = '';
                let fileName = '图片';
                
                // 尝试多种方式获取token
                let token = null;
                if (this.tokenManager && typeof this.tokenManager.getAccessToken === 'function') {
                    token = this.tokenManager.getAccessToken();
                } else if (window.tokenManager && typeof window.tokenManager.getAccessToken === 'function') {
                    token = window.tokenManager.getAccessToken();
                } else if (window.TokenManager && typeof window.TokenManager.getAccessToken === 'function') {
                    token = window.TokenManager.getAccessToken();
                } else {
                    // 修正token存储key，使用正确的key
                    token = localStorage.getItem('dify_access_token') || localStorage.getItem('access_token');
                }
                
                console.log('🔑 [调试] Token获取结果:', { 
                    token: token ? `${token.substring(0, 20)}...` : null,
                    hasTokenManager: !!this.tokenManager,
                    localStorageKeys: Object.keys(localStorage).filter(k => k.includes('token')),
                    attachment: typeof attachment
                });
                
                if (typeof attachment === 'object' && attachment !== null) {
                    // 优先使用带token的URL（后端直接返回）
                    if (attachment.urlWithToken) {
                        imageUrl = attachment.urlWithToken;
                        // 确保是完整的URL
                        if (!imageUrl.startsWith('http')) {
                            const backendUrl = window.ENV_CONFIG?.API_BASE_URL || window.globalConfig?.getBackendUrl() || 'http://127.0.0.1:4005';
                            imageUrl = `${backendUrl}${imageUrl}`;
                        }
                    } else if (attachment.url && token) {
                        // 使用附件中的URL路径加token参数
                        const backendUrl = window.ENV_CONFIG?.API_BASE_URL || window.globalConfig?.getBackendUrl() || 'http://127.0.0.1:4005';
                        const cleanUrl = attachment.url.startsWith('/') ? attachment.url : `/${attachment.url}`;
                        imageUrl = `${backendUrl}${cleanUrl}?token=${token}`;
                    } else if (attachment.id && token) {
                        // 使用ENV_CONFIG.getApiUrl()来构建完整的API URL
                        const apiUrl = window.ENV_CONFIG?.getApiUrl() || 'http://127.0.0.1:4005/api';
                        imageUrl = `${apiUrl}/files/${attachment.id}/view?token=${token}`;
                    } else if (attachment.url) {
                        // 备用方案：直接使用URL
                        imageUrl = attachment.url;
                        if (!imageUrl.startsWith('http')) {
                            const backendUrl = window.ENV_CONFIG?.API_BASE_URL || window.globalConfig?.getBackendUrl() || 'http://127.0.0.1:4005';
                            imageUrl = `${backendUrl}${imageUrl}`;
                        }
                    } else if (attachment.id) {
                        const apiUrl = window.ENV_CONFIG?.getApiUrl() || 'http://127.0.0.1:4005/api';
                        imageUrl = `${apiUrl}/files/${attachment.id}/view`;
                    }
                    fileName = attachment.original_name || attachment.filename || '图片';
                    console.log('🖼️ [调试] 构建图片URL (对象):', { imageUrl, fileName, attachment, token: token ? `${token.substring(0, 15)}...` : null });
                } else if (typeof attachment === 'string') {
                    // 附件是字符串ID
                    if (token) {
                        const apiUrl = window.ENV_CONFIG?.getApiUrl() || 'http://127.0.0.1:4005/api';
                        imageUrl = `${apiUrl}/files/${attachment}/view?token=${token}`;
                    } else {
                        const apiUrl = window.ENV_CONFIG?.getApiUrl() || 'http://127.0.0.1:4005/api';
                        imageUrl = `${apiUrl}/files/${attachment}/view`;
                    }
                    fileName = '图片';
                    console.log('🖼️ [调试] 构建图片URL (字符串ID):', { imageUrl, attachmentId: attachment, token: token ? `${token.substring(0, 15)}...` : null });
                } else {
                    console.log('❌ [调试] 未知的附件格式:', attachment);
                    return;
                }
                
                // 优先使用图片优化服务
                if (this.imageOptimizer) {
                    console.log('🚀 [优化] 使用ImageOptimizationService处理图片:', { attachment, fileName });
                    
                    // 从附件对象或字符串中提取文件ID
                    const fileId = (typeof attachment === 'object' && attachment !== null) ? attachment.id : attachment;
                    
                    if (fileId) {
                        const imageContainer = this.imageOptimizer.progressiveLoadImage(fileId, fileName);
                        attachmentsContainer.appendChild(imageContainer);
                    } else {
                        console.error('❌ [优化] 附件中缺少文件ID，无法优化:', attachment);
                        // 如果缺少文件ID，显示错误信息
                        const errorDiv = document.createElement('div');
                        errorDiv.textContent = `图片加载失败: ${fileName}`;
                        errorDiv.style.cssText = 'padding: 10px; background: #f5f5f5; border-radius: 4px; color: #666;';
                        attachmentsContainer.appendChild(errorDiv);
                    }
                } else {
                    // 降级方案：如果没有优化服务，使用旧的懒加载方法
                    console.log('⚠️ [降级] ImageOptimizationService未初始化，使用旧的懒加载方法');
                    const img = document.createElement('img');
                    img.className = 'message-image img-fluid lazy-image';
                    img.alt = fileName;
                    img.title = fileName;
                    img.style.cssText = 'border-radius: 8px; cursor: pointer; max-width: 100%; height: auto; display: block; min-height: 100px; background: #f0f0f0;';
                    
                    if (this.lazyLoader) {
                        img.dataset.src = imageUrl;
                        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="100%25" height="100%25" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="16"%3E加载中...%3C/text%3E%3C/svg%3E';
                        setTimeout(() => {
                            if (this.lazyLoader && img.parentNode) {
                                this.lazyLoader.observe(img);
                            }
                        }, 100);
                    } else {
                        img.src = imageUrl;
                    }
                    
                    img.onerror = () => {
                        if (img.parentNode) {
                            img.parentNode.innerHTML = `<div style="padding: 10px; background: #f5f5f5; border-radius: 4px; color: #666;">图片加载失败: ${fileName}</div>`;
                        }
                    };
                    
                    // 图片加载完成后重新滚动到底部
                    img.onload = () => {
                        if (shouldScroll) {
                            setTimeout(() => {
                                this.scrollToBottom();
                            }, 100);
                        }
                    };
                    
                    img.onclick = () => this.showImageModal(imageUrl, fileName);
                    
                    attachmentsContainer.appendChild(img);
                }
            });
            
            // 将附件容器添加到消息气泡中
            const messageBubble = messageElement.querySelector('.message-bubble');
            if (messageBubble) {
                messageBubble.appendChild(attachmentsContainer);
            } else {
                // 备用方案：直接添加到消息元素中
                messageElement.appendChild(attachmentsContainer);
            }
        } else {
            console.log('🖼️ [调试] 消息无附件或附件为空');
            // 没有附件时，关闭message-bubble并设置HTML
            messageHTML += '</div>';
            messageElement.innerHTML = messageHTML;
        }

        // 如果是本地待确认消息，添加状态指示
        if (message.isLocalPending) {
            const statusDiv = document.createElement('div');
            statusDiv.className = 'message-status';
            statusDiv.style.cssText = 'font-size: 0.7rem; opacity: 0.7; margin-top: 0.25rem;';
            statusDiv.innerHTML = '<i class="fas fa-clock"></i> 发送中...';
            
            const messageBubble = messageElement.querySelector('.message-bubble');
            if (messageBubble) {
                messageBubble.appendChild(statusDiv);
            }
        }

        // 保存消息数据引用到DOM元素，方便后续处理
        messageElement.localMessage = message;
        if (message.timeoutId) {
            messageElement.messageData = { timeoutId: message.timeoutId };
        }

        // 添加到消息列表
        this.elements.chatMessages.appendChild(messageElement);
        
        console.log('✅ [前端] 消息已成功添加到DOM:', {
            messageId: message.id,
            elementClass: messageElement.className,
            classList: Array.from(messageElement.classList),
            totalMessages: this.elements.chatMessages.children.length
        });

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
        console.log('🎯 [前端] handleNewMessage 开始处理:', {
            messageId: message.id,
            senderId: message.senderId,
            currentUserId: this.currentUser?.id,
            isOwnMessage: (message.senderId === this.currentUser?.id || message.userId === this.currentUser?.id)
        });
        
        // 消息去重：检查是否已经处理过这条消息
        if (message.id && this.processedMessages.has(message.id)) {
            console.log('🔄 [前端] 跳过重复消息:', {
                messageId: message.id,
                content: message.content?.substring(0, 50) + '...',
                source: '消息去重检查'
            });
            return;
        }
        
        // 额外检查：对于智能体消息，按内容和时间戳去重
        if (message.type === 'agent_response' || message.senderType === 'agent' || message.agentId) {
            const contentHash = message.content + '_' + (message.createdAt || message.timestamp);
            const duplicateCheckKey = `agent_${message.agentId || 'unknown'}_${contentHash}`;
            
            if (this.processedMessages.has(duplicateCheckKey)) {
                console.log('🔄 [智能体去重] 跳过重复的智能体消息:', {
                    messageId: message.id,
                    agentId: message.agentId,
                    agentName: message.agentName || message.username,
                    content: message.content?.substring(0, 50) + '...',
                    duplicateCheckKey: duplicateCheckKey
                });
                return;
            }
            
            // 记录智能体消息的内容哈希
            this.processedMessages.add(duplicateCheckKey);
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
        if (message.senderId === this.currentUser.id || message.userId === this.currentUser.id) {
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
        } else {
            console.log('👤 [前端] 收到其他用户的消息，准备显示:', {
                senderId: message.senderId,
                senderName: message.senderName,
                content: message.content?.substring(0, 50) + '...'
            });
        }
        
        // 添加服务器返回的正式消息
        console.log('📤 [前端] 准备添加消息到界面:', {
            messageId: message.id,
            content: message.content,
            senderId: message.senderId,
            senderName: message.senderName,
            isOwnMessage: message.senderId === this.currentUser.userId || message.userId === this.currentUser.userId
        });
        this.addMessage(message);
    }

    /**
     * 移动端调试信息显示
     * @param {Object} debugInfo - 调试信息对象
     * @param {Object} message - 消息对象
     */
    showMobileDebugInfo(debugInfo, message) {
        // 只在移动端显示
        if (window.innerWidth > 768) return;
        
        const debugContainer = document.getElementById('mobile-debug-info');
        const debugContent = document.getElementById('debug-content');
        
        if (debugContainer && debugContent) {
            const isCurrentUser = message.senderId === this.currentUser?.id || message.userId === this.currentUser?.id;
            const debugText = `
                <div style="margin-bottom: 5px; border-bottom: 1px solid #fff; padding-bottom: 5px;">
                    <strong>消息调试 (${new Date().toLocaleTimeString()})</strong><br>
                    当前用户ID: ${this.currentUser?.id || 'null'}<br>
                    消息发送者ID: ${message.senderId || 'null'}<br>
                    消息用户ID: ${message.userId || 'null'}<br>
                    是否为当前用户: ${isCurrentUser}<br>
                    CSS类: ${debugInfo.messageClass}<br>
                    应用的类: ${debugInfo.classList}<br>
                    display: ${debugInfo.display}<br>
                    justifyContent: ${debugInfo.justifyContent}<br>
                    flexDirection: ${debugInfo.flexDirection}<br>
                    屏幕宽度: ${window.innerWidth}px
                </div>
            `;
            
            debugContent.innerHTML = debugText + debugContent.innerHTML;
            debugContainer.style.display = 'block';
            
            // 10秒后自动隐藏
            setTimeout(() => {
                debugContainer.style.display = 'none';
            }, 10000);
        } else {
            // 如果找不到容器，就用alert
            const isCurrentUser = message.senderId === this.currentUser?.id || message.userId === this.currentUser?.id;
            alert(`调试信息:
当前用户ID: ${this.currentUser?.id}
消息发送者ID: ${message.senderId}
是否为当前用户: ${isCurrentUser}
CSS类: ${debugInfo.messageClass}
display: ${debugInfo.display}
justifyContent: ${debugInfo.justifyContent}
屏幕宽度: ${window.innerWidth}px`);
        }
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

        // 移动端限制显示的用户数量，避免挤占按钮
        const isMobile = window.innerWidth <= 768;
        const maxDisplayUsers = isMobile ? 3 : 5;
        const displayUsers = onlineUsers.slice(0, maxDisplayUsers);
        const hasMoreUsers = onlineUsers.length > maxDisplayUsers;

        const avatarsHTML = displayUsers.map((user, index) => {
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

        // 如果有更多用户，添加+号指示器
        const moreIndicator = hasMoreUsers ? `
            <div class="member-avatar more-indicator" 
                 data-bs-toggle="tooltip" 
                 data-bs-placement="top" 
                 data-bs-title="还有${onlineUsers.length - maxDisplayUsers}个用户在线，点击查看全部"
                 onclick="window.chatroomController.showAllUsers()"
                 style="cursor: pointer; background-color: #6c757d; color: white; font-weight: bold;">
                +${onlineUsers.length - maxDisplayUsers}
            </div>
        ` : '';

        memberAvatarsElement.innerHTML = avatarsHTML + moreIndicator;
        
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
     * 显示图片放大模态框 - 支持缩放功能
     */
    showImageModal(imageUrl, altText) {
        // 检查是否已有放大模态框
        let existingModal = document.getElementById('imageModal');
        if (existingModal) {
            document.body.removeChild(existingModal);
            return;
        }
        
        // 创建模态框
        const modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: zoom-out;
        `;
        
        // 移动端临时启用缩放
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        let originalViewport = null;
        if (isMobileDevice) {
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
                originalViewport = viewport.getAttribute('content');
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=yes');
            }
        }
        
        // 创建图片容器
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
            position: relative;
            overflow: hidden;
            max-width: 90%;
            max-height: 90%;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        // 创建放大的图片
        const enlargedImg = document.createElement('img');
        enlargedImg.src = imageUrl;
        enlargedImg.alt = altText;
        enlargedImg.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            cursor: grab;
            transition: transform 0.2s ease;
            transform-origin: center center;
        `;
        
        // 缩放控制变量
        let scale = 1;
        let isDragging = false;
        let startX, startY, translateX = 0, translateY = 0;
        const minScale = 1;
        const maxScale = 5;
        
        // 更新图片变换
        function updateTransform() {
            enlargedImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        }
        
        // 重置图片位置和缩放
        function resetTransform() {
            scale = 1;
            translateX = 0;
            translateY = 0;
            updateTransform();
        }
        
        // PC端：鼠标滚轮缩放
        function handleWheel(e) {
            e.preventDefault();
            
            const rect = enlargedImg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // 计算缩放中心点
            const centerX = mouseX / rect.width;
            const centerY = mouseY / rect.height;
            
            const oldScale = scale;
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            scale = Math.min(Math.max(scale + delta, minScale), maxScale);
            
            if (scale !== oldScale) {
                // 调整平移以保持鼠标位置为缩放中心
                const scaleRatio = scale / oldScale;
                const containerRect = imageContainer.getBoundingClientRect();
                const offsetX = (mouseX - containerRect.width / 2) * (scaleRatio - 1);
                const offsetY = (mouseY - containerRect.height / 2) * (scaleRatio - 1);
                
                translateX = (translateX - offsetX);
                translateY = (translateY - offsetY);
                
                updateTransform();
            }
        }
        
        // 移动端：双指缩放
        let lastTouchDistance = 0;
        let lastTouchX = 0;
        let lastTouchY = 0;
        
        function getTouchDistance(touches) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }
        
        function getTouchCenter(touches) {
            return {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2
            };
        }
        
        function handleTouchStart(e) {
            if (e.touches.length === 2) {
                e.preventDefault();
                lastTouchDistance = getTouchDistance(e.touches);
                const center = getTouchCenter(e.touches);
                lastTouchX = center.x;
                lastTouchY = center.y;
            } else if (e.touches.length === 1 && scale > 1) {
                isDragging = true;
                startX = e.touches[0].clientX - translateX;
                startY = e.touches[0].clientY - translateY;
                enlargedImg.style.cursor = 'grabbing';
            }
        }
        
        function handleTouchMove(e) {
            if (e.touches.length === 2) {
                e.preventDefault();
                
                const currentDistance = getTouchDistance(e.touches);
                const currentCenter = getTouchCenter(e.touches);
                
                if (lastTouchDistance > 0) {
                    const scaleChange = currentDistance / lastTouchDistance;
                    const newScale = Math.min(Math.max(scale * scaleChange, minScale), maxScale);
                    
                    if (newScale !== scale) {
                        // 计算缩放中心相对于图片容器的偏移
                        const containerRect = imageContainer.getBoundingClientRect();
                        const centerX = currentCenter.x - containerRect.left - containerRect.width / 2;
                        const centerY = currentCenter.y - containerRect.top - containerRect.height / 2;
                        
                        // 调整平移以保持双指中心为缩放中心
                        const scaleRatio = newScale / scale;
                        translateX = translateX - centerX * (scaleRatio - 1);
                        translateY = translateY - centerY * (scaleRatio - 1);
                        
                        scale = newScale;
                        updateTransform();
                    }
                }
                
                lastTouchDistance = currentDistance;
                lastTouchX = currentCenter.x;
                lastTouchY = currentCenter.y;
            } else if (e.touches.length === 1 && isDragging && scale > 1) {
                e.preventDefault();
                translateX = e.touches[0].clientX - startX;
                translateY = e.touches[0].clientY - startY;
                updateTransform();
            }
        }
        
        function handleTouchEnd(e) {
            if (e.touches.length < 2) {
                lastTouchDistance = 0;
            }
            if (e.touches.length === 0) {
                isDragging = false;
                enlargedImg.style.cursor = 'grab';
            }
        }
        
        // PC端：鼠标拖拽
        function handleMouseDown(e) {
            if (scale > 1) {
                isDragging = true;
                startX = e.clientX - translateX;
                startY = e.clientY - translateY;
                enlargedImg.style.cursor = 'grabbing';
                e.preventDefault();
            }
        }
        
        function handleMouseMove(e) {
            if (isDragging && scale > 1) {
                translateX = e.clientX - startX;
                translateY = e.clientY - startY;
                updateTransform();
            }
        }
        
        function handleMouseUp() {
            isDragging = false;
            enlargedImg.style.cursor = scale > 1 ? 'grab' : 'grab';
        }
        
        // 双击重置缩放
        let lastClickTime = 0;
        function handleImageClick(e) {
            e.stopPropagation();
            
            const currentTime = Date.now();
            if (currentTime - lastClickTime < 300) {
                // 双击重置
                resetTransform();
                enlargedImg.style.cursor = 'grab';
            } else if (scale === 1) {
                // 单击放大到2倍
                scale = 2;
                updateTransform();
                enlargedImg.style.cursor = 'grab';
            }
            lastClickTime = currentTime;
        }
        
        // 绑定事件
        enlargedImg.addEventListener('wheel', handleWheel, { passive: false });
        enlargedImg.addEventListener('touchstart', handleTouchStart, { passive: false });
        enlargedImg.addEventListener('touchmove', handleTouchMove, { passive: false });
        enlargedImg.addEventListener('touchend', handleTouchEnd, { passive: false });
        enlargedImg.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        enlargedImg.addEventListener('click', handleImageClick);
        
        // 为模态框也添加触摸事件处理（防止默认行为）
        modal.addEventListener('touchstart', function(e) {
            if (e.touches.length === 2) {
                e.preventDefault();
            }
        }, { passive: false });
        
        modal.addEventListener('touchmove', function(e) {
            if (e.touches.length === 2) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // 统一的关闭模态框函数
        function closeModal() {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('keydown', handleKeyPress);
            
            // 恢复原始viewport设置
            if (isMobileDevice && originalViewport) {
                const viewport = document.querySelector('meta[name="viewport"]');
                if (viewport) {
                    viewport.setAttribute('content', originalViewport);
                }
            }
        }
        
        // 点击模态框背景关闭
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // ESC键关闭
        const handleKeyPress = function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', handleKeyPress);
        
        // 添加缩放提示
        const hint = document.createElement('div');
        hint.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1;
        `;
        
        // 检测设备类型显示对应提示
        hint.textContent = isMobileDevice ? 
            '双指缩放 | 单指拖拽 | 双击重置' : 
            'PC: 滚轮缩放 | 移动端: 双指缩放 | 双击重置';
        
        imageContainer.appendChild(enlargedImg);
        modal.appendChild(imageContainer);
        modal.appendChild(hint);
        document.body.appendChild(modal);
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
     * 加载智能体列表 - 使用与simple-agent-service.js相同的逻辑
     */
    async loadAgents() {
        try {
            console.log('🤖 [前端] 开始加载智能体列表');
            
            // 使用环境配置的API基础URL，支持生产环境反代
            const baseURL = window.ENV_CONFIG?.API_BASE_URL || 'http://localhost:4005';
            const url = `${baseURL}/api/agents`;
            console.log('🔗 [前端] 请求智能体列表URL:', url);
            
            // 获取访问令牌
            const token = TokenManager.getAccessToken();
            console.log('🔐 [前端] Token状态:', !!token);
            
            // 构建请求头，如果有token则添加认证信息
            const headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                console.log('🔐 [前端] 使用认证token请求智能体列表');
                
                // 解析token显示用户信息（调试用）
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    console.log('👤 [前端] 当前用户:', payload.username, `(${payload.role})`);
                } catch (e) {
                    console.warn('⚠️ [前端] token解析失败，但继续请求');
                }
            } else {
                console.log('👤 [前端] 未登录用户，只能获取公开智能体');
            }
            
            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            console.log('📡 [前端] API响应状态:', response.status, response.statusText);

            if (response.ok) {
                const result = await response.json();
                console.log('📦 [前端] API响应数据:', result);
                
                if (result.success && result.data && Array.isArray(result.data.agents)) {
                    this.agents = result.data.agents;
                    const total = result.data.total || this.agents.length;
                    
                    console.log(`✅ [前端] 成功获取 ${this.agents.length} 个可访问智能体 (总计: ${total})`);
                    console.log('📋 [前端] 智能体详情:', this.agents.map(a => ({
                        id: a.id,
                        name: a.name,
                        description: a.description
                    })));
                } else {
                    console.warn('⚠️ [前端] 智能体数据格式异常:', result);
                    throw new Error(result.message || '数据格式异常');
                }
            } else {
                const errorText = await response.text();
                console.error('❌ [前端] 智能体API响应错误:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });
                throw new Error(`智能体API请求失败: ${response.status} ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('💥 [前端] 加载智能体失败:', error);
            // 发生错误时清空列表
            this.agents = [];
            this.showError('加载智能体列表失败: ' + error.message);
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
        if (!messagesElement) return;
        
        // 创建一个更强制和精确的滚动方法
        const forceScrollToBottom = () => {
            // 获取容器的样式信息
            const computedStyle = window.getComputedStyle(messagesElement);
            const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
            
            // 确保滚动到绝对底部，考虑padding
            const maxScrollTop = messagesElement.scrollHeight - messagesElement.clientHeight;
            messagesElement.scrollTop = maxScrollTop;
            
            // 如果仍然没有到底部，使用更直接的方法
            if (messagesElement.scrollTop < maxScrollTop) {
                messagesElement.scrollTop = messagesElement.scrollHeight;
            }
            
            // 使用 scrollIntoView 作为最终保障
            const lastMessage = messagesElement.lastElementChild;
            if (lastMessage && !lastMessage.classList.contains('text-center')) {
                lastMessage.scrollIntoView({ 
                    behavior: 'instant', 
                    block: 'end',
                    inline: 'nearest'
                });
            }
            
            console.log('🔄 [滚动调试]', {
                scrollHeight: messagesElement.scrollHeight,
                clientHeight: messagesElement.clientHeight,
                scrollTop: messagesElement.scrollTop,
                maxScrollTop: maxScrollTop,
                paddingBottom: paddingBottom,
                isAtBottom: messagesElement.scrollTop >= maxScrollTop - 5
            });
        };
        
        // 立即执行第一次滚动
        forceScrollToBottom();
        
        // 使用双重 requestAnimationFrame 确保DOM完全更新
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                forceScrollToBottom();
                
                // 短延时后再次检查和修正
                setTimeout(() => {
                    const maxScrollTop = messagesElement.scrollHeight - messagesElement.clientHeight;
                    const currentScrollTop = messagesElement.scrollTop;
                    const isAtBottom = currentScrollTop >= maxScrollTop - 10; // 允许10px的容差
                    
                    if (!isAtBottom) {
                        console.log('🔄 [滚动修正] 未完全到达底部，再次强制滚动', {
                            current: currentScrollTop,
                            max: maxScrollTop,
                            diff: maxScrollTop - currentScrollTop
                        });
                        forceScrollToBottom();
                    }
                }, 100);
                
                // 长延时后的最终检查（处理图片加载）
                setTimeout(() => {
                    const maxScrollTop = messagesElement.scrollHeight - messagesElement.clientHeight;
                    if (messagesElement.scrollTop < maxScrollTop - 10) {
                        console.log('🔄 [最终滚动修正] 执行最终滚动调整');
                        forceScrollToBottom();
                    }
                }, 800);
            });
        });
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

    /**
     * 关闭侧边栏（移动端）
     */
    closeSidebar() {
        const sidebar = document.getElementById('roomSidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar && sidebar.classList.contains('show')) {
            console.log('📱 移动端自动关闭侧边栏');
            sidebar.classList.remove('show');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }
    }
    /**
     * 带认证的图片加载方法
     * @param {HTMLImageElement} img - 图片元素
     * @param {string} imageUrl - 图片URL
     */
    async loadImageWithAuth(img, imageUrl) {
        try {
            // 尝试多种方式获取token (与图片URL构建保持一致)
            let token = null;
            if (this.tokenManager && typeof this.tokenManager.getAccessToken === 'function') {
                token = this.tokenManager.getAccessToken();
            } else if (window.tokenManager && typeof window.tokenManager.getAccessToken === 'function') {
                token = window.tokenManager.getAccessToken();
            } else {
                token = localStorage.getItem('access_token') || localStorage.getItem('dify_access_token');
            }
            
            console.log('🔑 [loadImageWithAuth] Token获取:', { 
                hasToken: !!token,
                imageUrl,
                tokenPreview: token ? `${token.substring(0, 20)}...` : null
            });
            
            if (!token) {
                console.log('⚠️ 没有认证token，使用直接加载');
                img.src = imageUrl;
                return;
            }

            // 如果URL已经包含token参数，直接使用
            if (imageUrl.includes('?token=')) {
                console.log('✅ URL已包含token参数，直接加载');
                img.src = imageUrl;
                return;
            }

            // 使用fetch获取图片，携带认证头
            const response = await fetch(imageUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 转换为blob并设置为图片源
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            img.src = blobUrl;
            
            // 图片加载完成后释放blob URL
            const originalOnload = img.onload;
            img.onload = function() {
                URL.revokeObjectURL(blobUrl);
                if (originalOnload) originalOnload.call(this);
            };
            
        } catch (error) {
            console.error('❌ 认证图片加载失败:', error);
            // 降级为直接加载
            img.src = imageUrl;
        }
    }

    /**
     * 处理@智能体输入
     */
    handleAtMention(event) {
        const input = this.elements.messageInput;
        const text = input.value;
        const cursorPosition = input.selectionStart;
        
        // 获取光标前的文本
        const textBeforeCursor = text.substring(0, cursorPosition);
        
        // 检查是否有@符号且在@符号后输入内容
        const atMatch = textBeforeCursor.match(/@(\w*)$/);
        
        if (atMatch) {
            const searchText = atMatch[1]; // @符号后的文本
            console.log('🎯 [前端] 检测到@输入:', { searchText, cursorPosition });
            
            // 过滤智能体列表
            const filteredAgents = this.agents.filter(agent => 
                agent.name.toLowerCase().includes(searchText.toLowerCase())
            );
            
            if (filteredAgents.length > 0) {
                this.showAgentSuggestions(filteredAgents, atMatch.index);
            } else if (searchText === '') {
                // 刚输入@符号，显示所有智能体
                this.showAgentSuggestions(this.agents, atMatch.index);
            } else {
                // 没有匹配的智能体
                this.hideAgentSuggestions();
            }
        } else {
            // 没有@符号，隐藏建议列表
            this.hideAgentSuggestions();
        }
    }

    /**
     * 显示智能体建议列表
     */
    showAgentSuggestions(agents, atPosition) {
        if (!this.agentSuggestionsList) {
            this.createAgentSuggestionsList();
        }

        // 清空现有内容
        this.agentSuggestionsList.innerHTML = '';
        
        if (agents.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'agent-suggestion-item no-results';
            noResults.textContent = '没有找到匹配的智能体';
            this.agentSuggestionsList.appendChild(noResults);
        } else {
            agents.forEach((agent, index) => {
                const item = document.createElement('div');
                item.className = 'agent-suggestion-item';
                item.innerHTML = `
                    <i class="fas fa-robot me-2"></i>
                    <span class="agent-name">${this.escapeHtml(agent.name)}</span>
                `;
                item.setAttribute('data-agent-id', agent.id);
                item.setAttribute('data-agent-name', agent.name);
                item.setAttribute('data-index', index);
                
                // 点击事件
                item.addEventListener('click', () => {
                    this.selectAgentFromSuggestions(agent.name);
                });
                
                // 鼠标悬停事件
                item.addEventListener('mouseenter', () => {
                    this.setSelectedSuggestion(index);
                });
                
                this.agentSuggestionsList.appendChild(item);
            });
        }

        // 显示列表
        this.agentSuggestionsList.style.display = 'block';
        this.selectedSuggestionIndex = 0;
        this.updateSelectedSuggestion();
        this.atPosition = atPosition;
    }

    /**
     * 创建智能体建议列表DOM元素
     */
    createAgentSuggestionsList() {
        this.agentSuggestionsList = document.createElement('div');
        this.agentSuggestionsList.className = 'agent-suggestions-list';
        this.agentSuggestionsList.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            min-width: 200px;
            bottom: 100%;
            left: 0;
            margin-bottom: 5px;
        `;

        // 添加到聊天输入区域的父元素
        const chatInput = document.querySelector('.chat-input');
        if (chatInput) {
            chatInput.style.position = 'relative';
            chatInput.appendChild(this.agentSuggestionsList);
        }

        // 添加CSS样式（如果还没有的话）
        if (!document.getElementById('agent-suggestions-styles')) {
            const style = document.createElement('style');
            style.id = 'agent-suggestions-styles';
            style.textContent = `
                .agent-suggestion-item {
                    padding: 8px 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    border-bottom: 1px solid #f0f0f0;
                    transition: background-color 0.2s ease;
                }
                
                .agent-suggestion-item:hover,
                .agent-suggestion-item.selected {
                    background-color: #f8f9fa;
                }
                
                .agent-suggestion-item:last-child {
                    border-bottom: none;
                }
                
                .agent-suggestion-item.no-results {
                    color: #666;
                    font-style: italic;
                    cursor: default;
                }
                
                .agent-suggestion-item .agent-name {
                    font-weight: 500;
                }
                
                .agent-suggestion-item i {
                    color: #28a745;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * 隐藏智能体建议列表
     */
    hideAgentSuggestions() {
        if (this.agentSuggestionsList) {
            this.agentSuggestionsList.style.display = 'none';
        }
        this.selectedSuggestionIndex = -1;
    }

    /**
     * 处理智能体建议列表的键盘导航
     */
    handleAgentSuggestionKeydown(event) {
        const items = this.agentSuggestionsList.querySelectorAll('.agent-suggestion-item:not(.no-results)');
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectedSuggestionIndex = Math.min(this.selectedSuggestionIndex + 1, items.length - 1);
                this.updateSelectedSuggestion();
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, 0);
                this.updateSelectedSuggestion();
                break;
                
            case 'Enter':
                event.preventDefault();
                const selectedItem = items[this.selectedSuggestionIndex];
                if (selectedItem) {
                    const agentName = selectedItem.getAttribute('data-agent-name');
                    this.selectAgentFromSuggestions(agentName);
                }
                break;
                
            case 'Escape':
                event.preventDefault();
                this.hideAgentSuggestions();
                break;
        }
    }

    /**
     * 更新选中的建议项样式
     */
    updateSelectedSuggestion() {
        const items = this.agentSuggestionsList.querySelectorAll('.agent-suggestion-item');
        items.forEach((item, index) => {
            if (index === this.selectedSuggestionIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * 设置选中的建议项索引
     */
    setSelectedSuggestion(index) {
        this.selectedSuggestionIndex = index;
        this.updateSelectedSuggestion();
    }

    /**
     * 从建议列表中选择智能体
     */
    selectAgentFromSuggestions(agentName) {
        const input = this.elements.messageInput;
        const text = input.value;
        const cursorPosition = input.selectionStart;
        
        // 获取光标前的文本
        const textBeforeCursor = text.substring(0, cursorPosition);
        const textAfterCursor = text.substring(cursorPosition);
        
        // 找到@符号的位置
        const atMatch = textBeforeCursor.match(/@(\w*)$/);
        if (atMatch) {
            const beforeAt = textBeforeCursor.substring(0, atMatch.index);
            const newText = beforeAt + `@${agentName} ` + textAfterCursor;
            
            input.value = newText;
            
            // 设置光标位置到@智能体名称之后
            const newCursorPosition = beforeAt.length + agentName.length + 2; // @智能体名 + 空格
            input.setSelectionRange(newCursorPosition, newCursorPosition);
        }
        
        this.hideAgentSuggestions();
        input.focus();
    }

    /**
     * 插入@符号到输入框
     */
    insertAtSymbol() {
        const input = this.elements.messageInput;
        const cursorPosition = input.selectionStart;
        const text = input.value;
        
        // 在光标位置插入@符号
        const newText = text.substring(0, cursorPosition) + '@' + text.substring(cursorPosition);
        input.value = newText;
        
        // 设置光标位置到@符号之后
        input.setSelectionRange(cursorPosition + 1, cursorPosition + 1);
        input.focus();
        
        // 触发input事件以显示智能体建议
        const inputEvent = new Event('input', { bubbles: true });
        input.dispatchEvent(inputEvent);
    }

    /**
     * 提取消息中的智能体提及
     */
    extractAgentMentions(content) {
        const regex = /@(\S+)/g;
        const mentions = [];
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            const agentName = match[1];
            const agent = this.agents.find(a => 
                a.name === agentName || a.id === agentName || a.agentName === agentName
            );
            
            if (agent) {
                mentions.push({
                    name: agent.name,
                    id: agent.id,
                    position: match.index
                });
            }
        }
        
        console.log('🎯 [前端] 提取智能体提及:', mentions);
        return mentions;
    }

    /**
     * 显示开始流式响应的占位符 - 按照后端文档方案B
     */
    displayStreamingMessageStart(streamingMsg) {
        const agentMessage = {
            id: streamingMsg.id,
            content: '', // 开始时内容为空
            username: streamingMsg.agentName || 'AI智能体',
            agentId: streamingMsg.agentId,
            createdAt: streamingMsg.timestamp || new Date().toISOString(),
            type: 'agent_response',
            isStreaming: true,
            replyToId: streamingMsg.replyToId
        };
        
        this.addMessage(agentMessage);
        this.scrollToBottom();
    }

    /**
     * 更新流式消息内容 - 按照后端文档方案B
     */
    updateStreamingMessageContent(messageId, content) {
        console.log('📝 [前端] 更新流式消息内容:', {
            messageId,
            contentLength: content.length,
            contentPreview: content.substring(0, 50) + (content.length > 50 ? '...' : '')
        });
        
        const messageElement = this.elements.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) {
            console.warn('⚠️ [前端] 未找到流式消息元素:', messageId);
            return;
        }
        
        const contentElement = messageElement.querySelector('.message-content');
        if (contentElement) {
            // 更新内容，使用formatMessageContent处理换行符，保留光标效果
            contentElement.innerHTML = this.formatMessageContent(content) + '<span class="typing-cursor">|</span>';
            this.scrollToBottom();
            console.log('✅ [前端] 流式内容已更新');
        } else {
            console.warn('⚠️ [前端] 未找到消息内容元素');
        }
    }

    /**
     * 完成流式消息 - 按照后端文档方案B，修复ID不匹配问题
     */
    finalizeStreamingMessage(data) {
        // 使用传入的 streamingMessageId 或者 data.id
        const targetMessageId = data.streamingMessageId || data.id;
        
        console.log('🎯 [前端] 完成流式消息:', {
            targetMessageId: targetMessageId,
            dataId: data.id,
            agentName: data.agentName || data.username,
            contentLength: data.content?.length
        });
        
        const messageElement = this.elements.chatMessages.querySelector(`[data-message-id="${targetMessageId}"]`);
        if (messageElement) {
            // 移除流式样式
            messageElement.classList.remove('streaming');
            delete messageElement.dataset.streaming;
            
            // 更新为最终内容（移除光标）
            const contentElement = messageElement.querySelector('.message-content');
            if (contentElement) {
                contentElement.innerHTML = this.formatMessageContent(data.content);
            }
            
            // 添加使用量信息（如果有）
            if (data.usage || data.metadata?.usage) {
                this.addTokenUsageToMessage(targetMessageId, data.usage || data.metadata.usage);
            }
            
            console.log('✅ [前端] 流式消息已完成:', targetMessageId);
        } else {
            console.warn('⚠️ [前端] 未找到要完成的流式消息元素:', targetMessageId);
            console.log('🔍 [调试] 当前DOM中的消息元素:', 
                Array.from(this.elements.chatMessages.querySelectorAll('[data-message-id]'))
                     .map(el => el.getAttribute('data-message-id')));
        }
    }

    /**
     * 防重复处理机制
     */
    initializeMessageProcessing() {
        if (!this.processingMessages) {
            this.processingMessages = new Set();
        }
    }

    /**
     * 检查是否正在处理中
     */
    isMessageProcessing(messageKey) {
        this.initializeMessageProcessing();
        return this.processingMessages.has(messageKey);
    }

    /**
     * 标记消息为处理中
     */
    markMessageProcessing(messageKey) {
        this.initializeMessageProcessing();
        this.processingMessages.add(messageKey);
    }

    /**
     * 清除消息处理标记
     */
    clearMessageProcessing(messageKey) {
        this.initializeMessageProcessing();
        this.processingMessages.delete(messageKey);
    }

    /**
     * 处理智能体流式响应片段
     */
    handleAgentStreamChunk(data) {
        console.log('📝 [前端] 处理流式片段:', {
            messageId: data.messageId,
            chunk: data.chunk,
            chunkLength: data.chunk?.length,
            currentStreamingId: this.currentStreamingMessageId
        });
        
        // 查找或创建智能体回复消息
        let streamingMessageId = this.currentStreamingMessageId;
        
        if (!streamingMessageId) {
            // 第一次收到流式数据，创建新的智能体消息
            const agentMessage = {
                id: data.messageId || 'agent_stream_' + Date.now(),
                content: data.chunk || '',
                username: data.agentName || 'AI智能体',
                agentId: data.agentId,
                createdAt: new Date().toISOString(),
                type: 'agent_response',
                isStreaming: true,
                replyToId: data.replyToId // 关联到用户消息
            };
            
            this.addMessage(agentMessage);
            this.currentStreamingMessageId = agentMessage.id;
            streamingMessageId = agentMessage.id;
            
            console.log('✨ [前端] 创建新的流式智能体消息:', streamingMessageId);
        } else {
            // 更新现有的流式消息内容
            this.appendToStreamingMessage(streamingMessageId, data.chunk);
        }
    }

    /**
     * 追加内容到流式消息
     */
    appendToStreamingMessage(messageId, chunk) {
        const messageElement = this.elements.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) {
            console.warn('⚠️ [前端] 未找到流式消息元素:', messageId);
            return;
        }
        
        const contentElement = messageElement.querySelector('.message-content');
        if (contentElement) {
            // 追加新的chunk到现有内容
            contentElement.textContent += chunk;
            this.scrollToBottom();
            console.log('📝 [前端] 已追加流式内容，当前长度:', contentElement.textContent.length);
        }
    }

    /**
     * 完成智能体消息 - 防重复优化版
     */
    finalizeAgentMessage(data) {
        console.log('✅ [前端] 完成智能体消息:', {
            dataId: data.id,
            dataMessageId: data.messageId,
            currentStreamingId: this.currentStreamingMessageId,
            hasStreamingMessage: !!this.currentStreamingMessageId
        });
        
        if (this.currentStreamingMessageId) {
            // 有流式消息，更新其最终状态
            const messageElement = this.elements.chatMessages.querySelector(`[data-message-id="${this.currentStreamingMessageId}"]`);
            if (messageElement) {
                const contentElement = messageElement.querySelector('.message-content');
                if (contentElement) {
                    // 确保显示完整内容（但优先保留流式累积的内容）
                    const currentContent = contentElement.textContent;
                    const finalContent = data.content || currentContent;
                    
                    if (finalContent !== currentContent) {
                        console.log('🔄 [前端] 更新最终内容:', {
                            from: currentContent.substring(0, 50),
                            to: finalContent.substring(0, 50)
                        });
                        contentElement.textContent = finalContent;
                    }
                }
                
                // 移除流式状态
                messageElement.classList.remove('streaming');
                delete messageElement.dataset.streaming;
                
                // 添加使用量信息（如果有）
                if (data.usage) {
                    this.addTokenUsageToMessage(this.currentStreamingMessageId, data.usage);
                }
            }
            
            console.log('✅ [前端] 流式消息已完成:', this.currentStreamingMessageId);
            this.currentStreamingMessageId = null;
        } else {
            // 没有流式消息，说明可能是直接接收完整回复，避免重复添加
            console.log('⚠️ [前端] 没有流式消息，检查是否已存在相同消息');
            
            // 检查是否已有相同内容的消息
            const existingMessage = this.findExistingAgentMessage(data);
            if (existingMessage) {
                console.log('🔍 [前端] 发现重复消息，跳过添加:', existingMessage.id);
                return;
            }
            
            // 确实没有相同消息，添加新消息
            const agentMessage = {
                id: data.id || data.messageId || 'agent_final_' + Date.now(),
                content: data.content,
                username: data.agentName || 'AI智能体',
                agentId: data.agentId,
                createdAt: data.timestamp || new Date().toISOString(),
                type: 'agent_response',
                replyToId: data.replyToId
            };
            
            console.log('➕ [前端] 添加完整智能体消息:', agentMessage.id);
            this.addMessage(agentMessage);
            
            if (data.usage) {
                this.addTokenUsageToMessage(agentMessage.id, data.usage);
            }
        }
    }

    /**
     * 查找是否已存在相同的智能体消息
     */
    findExistingAgentMessage(data) {
        if (!data.content) return null;
        
        const messageElements = this.elements.chatMessages.querySelectorAll('.message-agent');
        for (const element of messageElements) {
            const contentElement = element.querySelector('.message-content');
            if (contentElement && contentElement.textContent.trim() === data.content.trim()) {
                return {
                    id: element.getAttribute('data-message-id'),
                    content: contentElement.textContent
                };
            }
        }
        return null;
    }

    /**
     * 显示智能体错误
     */
    showAgentError(data) {
        console.error('❌ [前端] 智能体错误:', data);
        
        // 如果有正在进行的流式消息，将其标记为错误
        if (this.currentStreamingMessageId) {
            const messageElement = this.elements.chatMessages.querySelector(`[data-message-id="${this.currentStreamingMessageId}"]`);
            if (messageElement) {
                const contentElement = messageElement.querySelector('.message-content');
                if (contentElement) {
                    contentElement.innerHTML = `
                        <div class="agent-error">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            智能体响应失败: ${data.error || '未知错误'}
                        </div>
                    `;
                }
                messageElement.classList.add('error');
            }
            this.currentStreamingMessageId = null;
        } else {
            // 添加一个错误消息
            const errorMessage = {
                id: 'error_' + Date.now(),
                content: `❌ 智能体响应失败: ${data.error || '未知错误'}`,
                username: 'System',
                type: 'system',
                createdAt: new Date().toISOString()
            };
            this.addMessage(errorMessage);
        }
        
        this.showError('智能体回复失败: ' + (data.error || '未知错误'));
    }

    /**
     * 为消息添加Token使用量信息
     */
    addTokenUsageToMessage(messageId, usage) {
        const messageElement = this.elements.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement || !usage) return;
        
        const messageBubble = messageElement.querySelector('.message-bubble');
        if (!messageBubble) return;
        
        // 检查是否已经有使用量信息
        const existingUsage = messageBubble.querySelector('.token-usage');
        if (existingUsage) {
            existingUsage.remove();
        }
        
        const usageElement = document.createElement('div');
        usageElement.className = 'token-usage';
        usageElement.innerHTML = `
            <small class="text-muted">
                <i class="fas fa-chart-bar me-1"></i>
                Token: ${usage.prompt_tokens || 0}输入 + ${usage.completion_tokens || 0}输出 = ${usage.total_tokens || 0}总计
                ${usage.latency ? ` | 耗时: ${parseFloat(usage.latency).toFixed(2)}s` : ''}
            </small>
        `;
        
        // 添加到消息气泡的末尾
        messageBubble.appendChild(usageElement);
    }

}

// 导出到全局作用域
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatroomController;
} else {
    window.ChatroomController = ChatroomController;
}
