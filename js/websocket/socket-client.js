/**
 * WebSocket客户端 - 基于DifyChatBack v2.0 API指南第6章
 * 实现Socket.IO实时通信功能
 * 支持群聊房间、@智能体、实时消息推送
 */

// 导入依赖
import { ENV_CONFIG } from '../../config/env.js';
import { WEBSOCKET_EVENTS } from './endpoints.js';

/**
 * WebSocket客户端类
 * 基于Socket.IO实现实时通信
 */
class SocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.isAuthenticated = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 1秒
        this.eventHandlers = new Map();
        
        // 连接状态
        this.connectionState = 'disconnected'; // disconnected, connecting, connected, authenticated, error
        this.lastError = null;
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🔌 SocketClient初始化');
        }
    }

    /**
     * 建立WebSocket连接 - 基于指南第6.2.2节
     * @param {string} token JWT访问令牌
     * @returns {Promise<boolean>} 连接是否成功
     */
    async connect(token) {
        if (!token) {
            throw new Error('WebSocket连接需要有效的JWT令牌');
        }

        if (this.isConnected) {
            if (ENV_CONFIG.isDebug()) {
                console.log('🔌 WebSocket已连接，跳过重复连接');
            }
            return true;
        }

        try {
            this.connectionState = 'connecting';
            
            // 动态导入Socket.IO客户端
            const { io } = await import('socket.io-client');
            
            // 基于指南的Socket.IO客户端配置
            const socketConfig = {
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling'],
                timeout: ENV_CONFIG.WS_TIMEOUT,
                forceNew: true,
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: this.reconnectDelay
            };

            if (ENV_CONFIG.isDebug()) {
                console.log('🔌 正在连接WebSocket:', {
                    url: ENV_CONFIG.getWsUrl(),
                    timeout: socketConfig.timeout,
                    hasToken: !!token
                });
            }

            this.socket = io(ENV_CONFIG.getWsUrl(), socketConfig);
            
            // 设置事件监听器
            this._setupEventHandlers();
            
            // 等待连接和认证完成
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket连接超时'));
                }, ENV_CONFIG.WS_TIMEOUT);

                this.socket.once(WEBSOCKET_EVENTS.CONNECTION.AUTHENTICATED, (data) => {
                    clearTimeout(timeout);
                    this.isConnected = true;
                    this.isAuthenticated = true;
                    this.connectionState = 'authenticated';
                    this.reconnectAttempts = 0;
                    
                    if (ENV_CONFIG.isDebug()) {
                        console.log('✅ WebSocket认证成功:', data);
                    }
                    
                    resolve(true);
                });

                this.socket.once(WEBSOCKET_EVENTS.CONNECTION.CONNECT_ERROR, (error) => {
                    clearTimeout(timeout);
                    this.connectionState = 'error';
                    this.lastError = error;
                    
                    console.error('❌ WebSocket连接失败:', error.message);
                    reject(error);
                });
            });

        } catch (error) {
            this.connectionState = 'error';
            this.lastError = error;
            console.error('❌ WebSocket连接异常:', error.message);
            throw error;
        }
    }

    /**
     * 断开WebSocket连接
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.isAuthenticated = false;
        this.connectionState = 'disconnected';
        this.eventHandlers.clear();
        
        if (ENV_CONFIG.isDebug()) {
            console.log('👋 WebSocket已断开连接');
        }
    }

    /**
     * 设置核心事件监听器
     * @private
     */
    _setupEventHandlers() {
        if (!this.socket) return;

        // 连接相关事件
        this.socket.on(WEBSOCKET_EVENTS.CONNECTION.CONNECT, () => {
            this.isConnected = true;
            this.connectionState = 'connected';
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🔌 WebSocket已连接');
            }
        });

        this.socket.on(WEBSOCKET_EVENTS.CONNECTION.DISCONNECT, (reason) => {
            this.isConnected = false;
            this.isAuthenticated = false;
            this.connectionState = 'disconnected';
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🔌 WebSocket连接断开:', reason);
            }
            
            // 自动重连逻辑
            if (reason === 'io server disconnect') {
                // 服务器主动断开，不自动重连
                return;
            }
            
            this._attemptReconnect();
        });

        this.socket.on(WEBSOCKET_EVENTS.CONNECTION.CONNECT_ERROR, (error) => {
            this.connectionState = 'error';
            this.lastError = error;
            
            console.error('❌ WebSocket连接错误:', error.message);
        });
    }

    /**
     * 自动重连逻辑
     * @private
     */
    _attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ WebSocket重连达到最大次数，停止重连');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避

        if (ENV_CONFIG.isDebug()) {
            console.log(`🔄 WebSocket重连尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts}，${delay}ms后重试`);
        }

        setTimeout(() => {
            if (this.socket && !this.isConnected) {
                this.socket.connect();
            }
        }, delay);
    }

    // ========================================
    // 🏠 群聊房间管理 - 基于指南第6.3节
    // ========================================

    /**
     * 加入群聊房间
     * @param {string} roomId 房间ID
     * @returns {Promise<Object>} 加入结果
     */
    async joinRoom(roomId) {
        if (!this.isAuthenticated) {
            throw new Error('WebSocket未认证，无法加入房间');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('加入房间超时'));
            }, 10000); // 10秒超时

            this.socket.emit(WEBSOCKET_EVENTS.ROOM.JOIN, { roomId });

            this.socket.once(WEBSOCKET_EVENTS.ROOM.JOINED, (data) => {
                clearTimeout(timeout);
                
                if (ENV_CONFIG.isDebug()) {
                    console.log('🚪 成功加入房间:', data);
                }
                
                resolve(data);
            });

            this.socket.once(WEBSOCKET_EVENTS.ROOM.ERROR, (error) => {
                clearTimeout(timeout);
                console.error('❌ 加入房间失败:', error);
                reject(new Error(error.message || '加入房间失败'));
            });
        });
    }

    /**
     * 离开群聊房间
     * @param {string} roomId 房间ID
     * @returns {Promise<Object>} 离开结果
     */
    async leaveRoom(roomId) {
        if (!this.isAuthenticated) {
            throw new Error('WebSocket未认证，无法离开房间');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('离开房间超时'));
            }, 5000); // 5秒超时

            this.socket.emit(WEBSOCKET_EVENTS.ROOM.LEAVE, { roomId });

            this.socket.once(WEBSOCKET_EVENTS.ROOM.LEFT, (data) => {
                clearTimeout(timeout);
                
                if (ENV_CONFIG.isDebug()) {
                    console.log('👋 已离开房间:', data);
                }
                
                resolve(data);
            });

            this.socket.once(WEBSOCKET_EVENTS.ROOM.ERROR, (error) => {
                clearTimeout(timeout);
                console.error('❌ 离开房间失败:', error);
                reject(new Error(error.message || '离开房间失败'));
            });
        });
    }

    // ========================================
    // 💬 实时消息功能 - 基于指南第6.4节
    // ========================================

    /**
     * 发送实时消息
     * @param {string} roomId 房间ID
     * @param {Object} messageData 消息数据
     * @param {string} messageData.content 消息内容
     * @param {string} [messageData.type='text'] 消息类型
     * @param {string} [messageData.mentionAgent] @的智能体ID
     */
    sendMessage(roomId, messageData) {
        if (!this.isAuthenticated) {
            throw new Error('WebSocket未认证，无法发送消息');
        }

        const message = {
            roomId,
            content: messageData.content,
            type: messageData.type || 'text',
            mentionAgent: messageData.mentionAgent,
            timestamp: Date.now()
        };

        this.socket.emit(WEBSOCKET_EVENTS.MESSAGE.NEW, message);

        if (ENV_CONFIG.isDebug()) {
            console.log('💬 发送实时消息:', {
                roomId,
                content: message.content.substring(0, 50) + '...',
                hasMention: !!message.mentionAgent
            });
        }
    }

    /**
     * 发送打字状态
     * @param {string} roomId 房间ID
     * @param {boolean} isTyping 是否正在打字
     */
    sendTypingStatus(roomId, isTyping) {
        if (!this.isAuthenticated) return;

        const event = isTyping ? WEBSOCKET_EVENTS.MESSAGE.TYPING : WEBSOCKET_EVENTS.MESSAGE.STOP_TYPING;
        this.socket.emit(event, { roomId });

        if (ENV_CONFIG.isDebug() && isTyping) {
            console.log('⌨️ 发送打字状态:', roomId);
        }
    }

    // ========================================
    // 📡 事件监听器管理
    // ========================================

    /**
     * 注册事件监听器
     * @param {string} event 事件名称
     * @param {Function} handler 处理函数
     */
    on(event, handler) {
        if (!this.socket) {
            console.warn('⚠️ WebSocket未连接，无法注册事件监听器:', event);
            return;
        }

        // 存储处理器以便后续移除
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);

        this.socket.on(event, handler);

        if (ENV_CONFIG.isDebug()) {
            console.log('📡 注册事件监听器:', event);
        }
    }

    /**
     * 移除事件监听器
     * @param {string} event 事件名称
     * @param {Function} handler 处理函数
     */
    off(event, handler) {
        if (!this.socket) return;

        this.socket.off(event, handler);

        // 从存储中移除
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(handler);
        }

        if (ENV_CONFIG.isDebug()) {
            console.log('📡 移除事件监听器:', event);
        }
    }

    /**
     * 注册一次性事件监听器
     * @param {string} event 事件名称
     * @param {Function} handler 处理函数
     */
    once(event, handler) {
        if (!this.socket) {
            console.warn('⚠️ WebSocket未连接，无法注册一次性事件监听器:', event);
            return;
        }

        this.socket.once(event, handler);

        if (ENV_CONFIG.isDebug()) {
            console.log('📡 注册一次性事件监听器:', event);
        }
    }

    // ========================================
    // 🛠️ 工具方法
    // ========================================

    /**
     * 获取连接状态
     * @returns {Object} 连接状态信息
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            isAuthenticated: this.isAuthenticated,
            connectionState: this.connectionState,
            reconnectAttempts: this.reconnectAttempts,
            lastError: this.lastError,
            socketId: this.socket?.id || null
        };
    }

    /**
     * 检查WebSocket是否可用
     * @returns {boolean} 是否可用
     */
    isReady() {
        return this.isConnected && this.isAuthenticated && this.socket;
    }

    /**
     * 重置连接状态
     */
    reset() {
        this.disconnect();
        this.reconnectAttempts = 0;
        this.lastError = null;
        this.connectionState = 'disconnected';
    }
}

// 导出类和事件常量
export { SocketClient, WEBSOCKET_EVENTS };
export default SocketClient;
