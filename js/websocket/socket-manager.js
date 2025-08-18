/**
 * WebSocket管理器 - 全局WebSocket状态管理
 * 基于DifyChatBack v2.0 API指南第6章
 * 提供高级的WebSocket功能封装和状态管理
 */

// 导入依赖
import { ENV_CONFIG } from '../../config/env.js';
import { WEBSOCKET_EVENTS } from '../api/endpoints.js';
import SocketClient from './socket-client.js';

/**
 * WebSocket管理器类
 * 提供全局WebSocket状态管理和高级功能
 */
class SocketManager {
    constructor() {
        this.socketClient = new SocketClient();
        this.eventHandlers = new Map();
        this.rooms = new Set(); // 当前加入的房间
        this.users = new Map(); // 在线用户状态
        this.connectionState = 'disconnected';
        this.autoReconnect = true;
        
        // 心跳检测
        this.heartbeatInterval = null;
        this.heartbeatTimeout = 30000; // 30秒心跳间隔
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🎛️ SocketManager初始化');
        }
    }

    /**
     * 初始化WebSocket连接
     * @param {string} token JWT访问令牌
     * @returns {Promise<boolean>} 初始化是否成功
     */
    async initialize(token) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('🚀 初始化WebSocket管理器');
            }

            // 建立连接
            await this.socketClient.connect(token);
            
            // 设置全局事件监听器
            this._setupGlobalEventHandlers();
            
            // 启动心跳检测
            this._startHeartbeat();
            
            this.connectionState = 'connected';
            
            if (ENV_CONFIG.isDebug()) {
                console.log('✅ WebSocket管理器初始化成功');
            }
            
            return true;
        } catch (error) {
            console.error('❌ WebSocket管理器初始化失败:', error.message);
            this.connectionState = 'error';
            throw error;
        }
    }

    /**
     * 设置全局事件监听器
     * @private
     */
    _setupGlobalEventHandlers() {
        // 消息相关事件
        this.socketClient.on(WEBSOCKET_EVENTS.MESSAGE.NEW, (data) => {
            this._handleNewMessage(data);
        });

        this.socketClient.on(WEBSOCKET_EVENTS.MESSAGE.SENT, (data) => {
            this._handleMessageSent(data);
        });

        this.socketClient.on(WEBSOCKET_EVENTS.MESSAGE.TYPING, (data) => {
            this._handleUserTyping(data);
        });

        this.socketClient.on(WEBSOCKET_EVENTS.MESSAGE.STOP_TYPING, (data) => {
            this._handleUserStopTyping(data);
        });

        // 房间相关事件
        this.socketClient.on(WEBSOCKET_EVENTS.ROOM.JOINED, (data) => {
            this._handleRoomJoined(data);
        });

        this.socketClient.on(WEBSOCKET_EVENTS.ROOM.LEFT, (data) => {
            this._handleRoomLeft(data);
        });

        // 用户状态事件
        this.socketClient.on(WEBSOCKET_EVENTS.USER.JOINED, (data) => {
            this._handleUserJoined(data);
        });

        this.socketClient.on(WEBSOCKET_EVENTS.USER.LEFT, (data) => {
            this._handleUserLeft(data);
        });

        this.socketClient.on(WEBSOCKET_EVENTS.USER.ONLINE, (data) => {
            this._handleOnlineUsers(data);
        });

        // 连接状态事件
        this.socketClient.on(WEBSOCKET_EVENTS.CONNECTION.DISCONNECT, () => {
            this._handleDisconnect();
        });

        this.socketClient.on(WEBSOCKET_EVENTS.CONNECTION.CONNECT, () => {
            this._handleReconnect();
        });
    }

    // ========================================
    // 🏠 房间管理功能
    // ========================================

    /**
     * 加入群聊房间
     * @param {string} roomId 房间ID
     * @returns {Promise<Object>} 加入结果
     */
    async joinRoom(roomId) {
        try {
            const result = await this.socketClient.joinRoom(roomId);
            this.rooms.add(roomId);
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🏠 管理器：成功加入房间', roomId);
            }
            
            // 触发自定义事件
            this._triggerEvent('room:joined', { roomId, ...result });
            
            return result;
        } catch (error) {
            console.error('❌ 管理器：加入房间失败:', error.message);
            throw error;
        }
    }

    /**
     * 离开群聊房间
     * @param {string} roomId 房间ID
     * @returns {Promise<Object>} 离开结果
     */
    async leaveRoom(roomId) {
        try {
            const result = await this.socketClient.leaveRoom(roomId);
            this.rooms.delete(roomId);
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🏠 管理器：已离开房间', roomId);
            }
            
            // 触发自定义事件
            this._triggerEvent('room:left', { roomId, ...result });
            
            return result;
        } catch (error) {
            console.error('❌ 管理器：离开房间失败:', error.message);
            throw error;
        }
    }

    /**
     * 离开所有房间
     */
    async leaveAllRooms() {
        const roomPromises = Array.from(this.rooms).map(roomId => 
            this.leaveRoom(roomId).catch(error => {
                console.error(`❌ 离开房间 ${roomId} 失败:`, error.message);
            })
        );
        
        await Promise.all(roomPromises);
        this.rooms.clear();
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🏠 管理器：已离开所有房间');
        }
    }

    // ========================================
    // 💬 消息管理功能
    // ========================================

    /**
     * 发送消息到指定房间
     * @param {string} roomId 房间ID
     * @param {string} content 消息内容
     * @param {Object} options 选项
     * @param {string} [options.type='text'] 消息类型
     * @param {string} [options.mentionAgent] @的智能体ID
     */
    sendMessage(roomId, content, options = {}) {
        if (!this.socketClient.isReady()) {
            throw new Error('WebSocket未就绪，无法发送消息');
        }

        if (!this.rooms.has(roomId)) {
            throw new Error(`未加入房间 ${roomId}，无法发送消息`);
        }

        const messageData = {
            content,
            type: options.type || 'text',
            mentionAgent: options.mentionAgent
        };

        this.socketClient.sendMessage(roomId, messageData);

        if (ENV_CONFIG.isDebug()) {
            console.log('💬 管理器：发送消息到房间', {
                roomId,
                contentLength: content.length,
                type: messageData.type,
                hasMention: !!messageData.mentionAgent
            });
        }
    }

    /**
     * 发送@智能体消息
     * @param {string} roomId 房间ID
     * @param {string} agentId 智能体ID
     * @param {string} content 消息内容
     */
    mentionAgent(roomId, agentId, content) {
        const mentionContent = `@${agentId} ${content}`;
        this.sendMessage(roomId, mentionContent, {
            type: 'text',
            mentionAgent: agentId
        });

        if (ENV_CONFIG.isDebug()) {
            console.log('🤖 管理器：@智能体消息', { roomId, agentId });
        }
    }

    /**
     * 发送打字状态
     * @param {string} roomId 房间ID
     * @param {boolean} isTyping 是否正在打字
     */
    setTypingStatus(roomId, isTyping) {
        if (!this.socketClient.isReady()) return;
        if (!this.rooms.has(roomId)) return;

        this.socketClient.sendTypingStatus(roomId, isTyping);
    }

    // ========================================
    // 📡 事件处理器
    // ========================================

    /**
     * 处理新消息事件
     * @private
     */
    _handleNewMessage(data) {
        if (ENV_CONFIG.isDebug()) {
            console.log('💬 收到新消息:', {
                roomId: data.roomId,
                from: data.from,
                type: data.type,
                hasMention: !!data.mentionAgent
            });
        }

        this._triggerEvent('message:new', data);
        
        // 如果是@当前用户的消息，触发特殊事件
        if (data.mentionUser && this._isCurrentUser(data.mentionUser)) {
            this._triggerEvent('message:mentioned', data);
        }
        
        // 如果是智能体回复，触发特殊事件
        if (data.from.type === 'agent') {
            this._triggerEvent('message:agent', data);
        }
    }

    /**
     * 处理消息发送确认事件
     * @private
     */
    _handleMessageSent(data) {
        if (ENV_CONFIG.isDebug()) {
            console.log('✅ 消息发送确认:', data.messageId);
        }

        this._triggerEvent('message:sent', data);
    }

    /**
     * 处理用户打字事件
     * @private
     */
    _handleUserTyping(data) {
        this._triggerEvent('user:typing', data);
    }

    /**
     * 处理用户停止打字事件
     * @private
     */
    _handleUserStopTyping(data) {
        this._triggerEvent('user:stop-typing', data);
    }

    /**
     * 处理房间加入事件
     * @private
     */
    _handleRoomJoined(data) {
        this.rooms.add(data.roomId);
        this._triggerEvent('room:user-joined', data);
    }

    /**
     * 处理房间离开事件
     * @private
     */
    _handleRoomLeft(data) {
        this._triggerEvent('room:user-left', data);
    }

    /**
     * 处理用户加入事件
     * @private
     */
    _handleUserJoined(data) {
        this.users.set(data.userId, {
            ...data,
            status: 'online',
            joinedAt: Date.now()
        });

        this._triggerEvent('user:joined', data);
    }

    /**
     * 处理用户离开事件
     * @private
     */
    _handleUserLeft(data) {
        this.users.delete(data.userId);
        this._triggerEvent('user:left', data);
    }

    /**
     * 处理在线用户列表事件
     * @private
     */
    _handleOnlineUsers(data) {
        // 更新在线用户列表
        this.users.clear();
        data.users.forEach(user => {
            this.users.set(user.userId, {
                ...user,
                status: 'online'
            });
        });

        this._triggerEvent('users:online', data);
    }

    /**
     * 处理断开连接事件
     * @private
     */
    _handleDisconnect() {
        this.connectionState = 'disconnected';
        this._stopHeartbeat();
        this._triggerEvent('connection:disconnected');

        if (ENV_CONFIG.isDebug()) {
            console.log('🔌 管理器：连接已断开');
        }
    }

    /**
     * 处理重新连接事件
     * @private
     */
    _handleReconnect() {
        this.connectionState = 'connected';
        this._startHeartbeat();
        this._triggerEvent('connection:reconnected');

        // 重新加入之前的房间
        this._rejoinRooms();

        if (ENV_CONFIG.isDebug()) {
            console.log('🔌 管理器：已重新连接');
        }
    }

    /**
     * 重新加入房间
     * @private
     */
    async _rejoinRooms() {
        const roomIds = Array.from(this.rooms);
        this.rooms.clear(); // 清空，重新加入
        
        for (const roomId of roomIds) {
            try {
                await this.joinRoom(roomId);
                if (ENV_CONFIG.isDebug()) {
                    console.log('🔄 重新加入房间:', roomId);
                }
            } catch (error) {
                console.error(`❌ 重新加入房间 ${roomId} 失败:`, error.message);
            }
        }
    }

    // ========================================
    // ❤️ 心跳检测
    // ========================================

    /**
     * 启动心跳检测
     * @private
     */
    _startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (this.socketClient.isReady()) {
                this.socketClient.socket.emit('ping');
                
                if (ENV_CONFIG.isDebug()) {
                    console.log('💓 发送心跳');
                }
            }
        }, this.heartbeatTimeout);
    }

    /**
     * 停止心跳检测
     * @private
     */
    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // ========================================
    // 📡 事件系统
    // ========================================

    /**
     * 注册事件监听器
     * @param {string} event 事件名称
     * @param {Function} handler 处理函数
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);

        if (ENV_CONFIG.isDebug()) {
            console.log('📡 管理器：注册事件监听器', event);
        }
    }

    /**
     * 移除事件监听器
     * @param {string} event 事件名称
     * @param {Function} handler 处理函数
     */
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(handler);
        }
    }

    /**
     * 触发事件
     * @private
     */
    _triggerEvent(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`❌ 事件处理器错误 (${event}):`, error.message);
                }
            });
        }
    }

    // ========================================
    // 🛠️ 工具方法
    // ========================================

    /**
     * 检查是否为当前用户
     * @private
     */
    _isCurrentUser(userId) {
        // 从本地存储获取当前用户ID
        try {
            const userInfo = localStorage.getItem('dify_user_info');
            if (userInfo) {
                const user = JSON.parse(userInfo);
                return user.id === userId || user.userId === userId;
            }
        } catch (error) {
            console.error('❌ 获取当前用户信息失败:', error.message);
        }
        return false;
    }

    /**
     * 获取连接状态
     * @returns {Object} 连接状态信息
     */
    getStatus() {
        return {
            connectionState: this.connectionState,
            isReady: this.socketClient.isReady(),
            rooms: Array.from(this.rooms),
            onlineUsers: Array.from(this.users.values()),
            socketStatus: this.socketClient.getConnectionStatus()
        };
    }

    /**
     * 获取指定房间的在线用户
     * @param {string} roomId 房间ID
     * @returns {Array} 在线用户列表
     */
    getRoomUsers(roomId) {
        return Array.from(this.users.values()).filter(user => 
            user.rooms && user.rooms.includes(roomId)
        );
    }

    /**
     * 断开连接并清理
     */
    disconnect() {
        this._stopHeartbeat();
        this.socketClient.disconnect();
        this.rooms.clear();
        this.users.clear();
        this.eventHandlers.clear();
        this.connectionState = 'disconnected';

        if (ENV_CONFIG.isDebug()) {
            console.log('👋 WebSocket管理器已断开');
        }
    }

    /**
     * 重置管理器状态
     */
    reset() {
        this.disconnect();
        this.socketClient.reset();
    }
}

// 创建全局实例
const socketManager = new SocketManager();

// 导出管理器实例和类
window.SocketManager = SocketManager;
window.socketManager = socketManager;

export { SocketManager };
export default socketManager;
