/**
 * DifyChat WebSocket服务 v2.0
 * 处理实时通信，包括消息发送、接收、流式响应等
 * 基于DifyChatBack v2.0 API指南的WebSocket规范
 * 作者: DifyChat开发团队
 * 创建时间: 2025-01-27
 */

import { StorageManager } from '../utils/storage.js';
import { ErrorHandler } from '../utils/error-handler.js';

/**
 * WebSocket连接状态枚举
 */
export const WebSocketState = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
};

/**
 * WebSocket消息类型枚举
 */
export const MessageType = {
    // 认证相关
    AUTH: 'auth',
    AUTH_SUCCESS: 'auth_success',
    AUTH_FAILED: 'auth_failed',
    
    // 消息相关
    SEND_MESSAGE: 'send_message',
    MESSAGE_RECEIVED: 'message_received',
    MESSAGE_ERROR: 'message_error',
    
    // 流式响应
    STREAM_START: 'stream_start',
    STREAM_CHUNK: 'stream_chunk',
    STREAM_END: 'stream_end',
    STREAM_ERROR: 'stream_error',
    
    // 系统消息
    HEARTBEAT: 'heartbeat',
    RECONNECT: 'reconnect',
    DISCONNECT: 'disconnect'
};

/**
 * WebSocket服务类
 * 管理与后端的WebSocket连接，处理实时消息传输
 */
export class WebSocketService {
    constructor() {
        this.storageManager = new StorageManager();
        this.errorHandler = new ErrorHandler();
        
        // 连接相关
        this.ws = null;
        this.state = WebSocketState.DISCONNECTED;
        this.url = null;
        
        // 重连机制
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 初始重连延迟
        this.maxReconnectDelay = 30000; // 最大重连延迟
        this.reconnectTimer = null;
        
        // 心跳机制
        this.heartbeatInterval = null;
        this.heartbeatTimeout = null;
        this.heartbeatDelay = 30000; // 30秒心跳间隔
        
        // 消息队列
        this.messageQueue = [];
        this.pendingMessages = new Map(); // 等待响应的消息
        
        // 事件监听器
        this.eventListeners = new Map();
        
        // 调试模式
        this.debugMode = (typeof ENV_CONFIG !== 'undefined' && ENV_CONFIG?.DEBUG_MODE) || false;
        
        this.log('WebSocketService初始化');
    }

    /**
     * 连接WebSocket
     * @param {string} url - WebSocket服务器URL
     * @param {Object} options - 连接选项
     */
    async connect(url = null, options = {}) {
        try {
            // 获取WebSocket URL
            if (!url) {
                url = this.getWebSocketUrl();
            }
            
            this.url = url;
            this.log('开始连接WebSocket:', url);
            
            // 如果已有连接，先关闭
            if (this.ws) {
                this.disconnect();
            }
            
            this.setState(WebSocketState.CONNECTING);
            
            // 创建WebSocket连接
            this.ws = new WebSocket(url);
            
            // 设置事件处理器
            this.setupEventHandlers();
            
            // 等待连接建立
            await this.waitForConnection();
            
            // 进行认证
            await this.authenticate();
            
            // 启动心跳
            this.startHeartbeat();
            
            // 处理队列中的消息
            this.processMessageQueue();
            
            this.log('WebSocket连接建立成功');
            
        } catch (error) {
            this.error('WebSocket连接失败:', error);
            this.setState(WebSocketState.ERROR);
            throw error;
        }
    }

    /**
     * 获取WebSocket URL
     */
    getWebSocketUrl() {
        const baseUrl = GLOBAL_CONFIG?.BACKEND?.BASE_URL || 'http://localhost:8000';
        const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws/chat';
        
        // 添加认证token作为查询参数
        const token = this.storageManager.getAccessToken();
        if (token) {
            const separator = wsUrl.includes('?') ? '&' : '?';
            return `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
        }
        
        return wsUrl;
    }

    /**
     * 设置WebSocket事件处理器
     */
    setupEventHandlers() {
        this.ws.onopen = (event) => {
            this.log('WebSocket连接已打开');
            this.setState(WebSocketState.CONNECTED);
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
        };
        
        this.ws.onmessage = (event) => {
            this.handleMessage(event);
        };
        
        this.ws.onclose = (event) => {
            this.log('WebSocket连接已关闭:', event.code, event.reason);
            this.setState(WebSocketState.DISCONNECTED);
            this.stopHeartbeat();
            
            // 自动重连（除非是正常关闭）
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            }
        };
        
        this.ws.onerror = (event) => {
            this.error('WebSocket连接错误:', event);
            this.setState(WebSocketState.ERROR);
        };
    }

    /**
     * 等待连接建立
     */
    waitForConnection() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket连接超时'));
            }, 10000);
            
            const checkConnection = () => {
                if (this.ws.readyState === WebSocket.OPEN) {
                    clearTimeout(timeout);
                    resolve();
                } else if (this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
                    clearTimeout(timeout);
                    reject(new Error('WebSocket连接失败'));
                } else {
                    setTimeout(checkConnection, 100);
                }
            };
            
            checkConnection();
        });
    }

    /**
     * 进行WebSocket认证
     */
    async authenticate() {
        const token = this.storageManager.getAccessToken();
        if (!token) {
            throw new Error('缺少认证token');
        }
        
        return new Promise((resolve, reject) => {
            const authMessage = {
                type: MessageType.AUTH,
                data: { token },
                timestamp: Date.now()
            };
            
            // 设置认证超时
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket认证超时'));
            }, 5000);
            
            // 监听认证结果
            const handleAuthResult = (message) => {
                if (message.type === MessageType.AUTH_SUCCESS) {
                    clearTimeout(timeout);
                    this.removeEventListener('message', handleAuthResult);
                    this.log('WebSocket认证成功');
                    resolve();
                } else if (message.type === MessageType.AUTH_FAILED) {
                    clearTimeout(timeout);
                    this.removeEventListener('message', handleAuthResult);
                    reject(new Error(message.data?.message || 'WebSocket认证失败'));
                }
            };
            
            this.addEventListener('message', handleAuthResult);
            this.send(authMessage);
        });
    }

    /**
     * 发送消息
     * @param {Object} message - 要发送的消息
     */
    send(message) {
        if (!message || typeof message !== 'object') {
            throw new Error('消息必须是一个对象');
        }
        
        // 添加消息ID和时间戳
        if (!message.id) {
            message.id = this.generateMessageId();
        }
        
        if (!message.timestamp) {
            message.timestamp = Date.now();
        }
        
        // 如果连接未建立，添加到队列
        if (this.state !== WebSocketState.CONNECTED) {
            this.log('连接未建立，消息加入队列:', message);
            this.messageQueue.push(message);
            return;
        }
        
        try {
            const messageStr = JSON.stringify(message);
            this.ws.send(messageStr);
            this.log('消息已发送:', message);
            
            // 如果是需要响应的消息，添加到待处理列表
            if (this.shouldWaitForResponse(message)) {
                this.pendingMessages.set(message.id, {
                    message,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            this.error('发送消息失败:', error);
            throw error;
        }
    }

    /**
     * 发送聊天消息
     * @param {string} content - 消息内容
     * @param {string} agentId - 代理ID
     * @param {Object} options - 额外选项
     */
    sendChatMessage(content, agentId = null, options = {}) {
        const message = {
            type: MessageType.SEND_MESSAGE,
            data: {
                content,
                agent_id: agentId,
                stream: options.stream !== false, // 默认使用流式响应
                conversation_id: options.conversationId,
                ...options
            }
        };
        
        this.send(message);
        return message.id;
    }

    /**
     * 处理接收到的消息
     * @param {MessageEvent} event - WebSocket消息事件
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.log('收到消息:', message);
            
            // 处理特殊消息类型
            switch (message.type) {
                case MessageType.HEARTBEAT:
                    this.handleHeartbeat(message);
                    return;
                    
                case MessageType.STREAM_CHUNK:
                    this.handleStreamChunk(message);
                    break;
                    
                case MessageType.STREAM_END:
                    this.handleStreamEnd(message);
                    break;
                    
                case MessageType.MESSAGE_ERROR:
                    this.handleMessageError(message);
                    break;
            }
            
            // 处理待响应消息
            if (message.reply_to) {
                this.handleMessageResponse(message);
            }
            
            // 触发事件监听器
            this.emitEvent('message', message);
            this.emitEvent(message.type, message);
            
        } catch (error) {
            this.error('处理消息失败:', error);
        }
    }

    /**
     * 处理心跳消息
     */
    handleHeartbeat(message) {
        // 响应心跳
        if (message.data?.ping) {
            this.send({
                type: MessageType.HEARTBEAT,
                data: { pong: true },
                reply_to: message.id
            });
        }
        
        // 重置心跳超时
        this.resetHeartbeatTimeout();
    }

    /**
     * 处理流式响应块
     */
    handleStreamChunk(message) {
        this.emitEvent('streamChunk', {
            messageId: message.reply_to || message.data?.message_id,
            content: message.data?.content || '',
            delta: message.data?.delta || '',
            metadata: message.data?.metadata
        });
    }

    /**
     * 处理流式响应结束
     */
    handleStreamEnd(message) {
        this.emitEvent('streamEnd', {
            messageId: message.reply_to || message.data?.message_id,
            finalContent: message.data?.content || '',
            metadata: message.data?.metadata
        });
        
        // 移除待处理消息
        if (message.reply_to) {
            this.pendingMessages.delete(message.reply_to);
        }
    }

    /**
     * 处理消息错误
     */
    handleMessageError(message) {
        const error = {
            messageId: message.reply_to || message.data?.message_id,
            error: message.data?.error || '未知错误',
            code: message.data?.code
        };
        
        this.emitEvent('messageError', error);
        
        // 移除待处理消息
        if (message.reply_to) {
            this.pendingMessages.delete(message.reply_to);
        }
    }

    /**
     * 处理消息响应
     */
    handleMessageResponse(message) {
        const pendingMessage = this.pendingMessages.get(message.reply_to);
        if (pendingMessage) {
            this.emitEvent('messageResponse', {
                originalMessage: pendingMessage.message,
                response: message
            });
            
            // 如果不是流式响应，移除待处理消息
            if (message.type !== MessageType.STREAM_CHUNK) {
                this.pendingMessages.delete(message.reply_to);
            }
        }
    }

    /**
     * 启动心跳机制
     */
    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.state === WebSocketState.CONNECTED) {
                this.send({
                    type: MessageType.HEARTBEAT,
                    data: { ping: true }
                });
                
                // 设置心跳超时
                this.heartbeatTimeout = setTimeout(() => {
                    this.error('心跳超时，连接可能已断开');
                    this.reconnect();
                }, 10000);
            }
        }, this.heartbeatDelay);
    }

    /**
     * 停止心跳机制
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        this.resetHeartbeatTimeout();
    }

    /**
     * 重置心跳超时
     */
    resetHeartbeatTimeout() {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    /**
     * 安排重连
     */
    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
        
        this.log(`安排重连，第${this.reconnectAttempts}次尝试，延迟${delay}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnect();
        }, delay);
    }

    /**
     * 重新连接
     */
    async reconnect() {
        try {
            this.log('尝试重新连接...');
            await this.connect(this.url);
        } catch (error) {
            this.error('重连失败:', error);
            
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            } else {
                this.error('达到最大重连次数，停止重连');
                this.emitEvent('maxReconnectAttemptsReached');
            }
        }
    }

    /**
     * 断开连接
     */
    disconnect() {
        this.log('断开WebSocket连接');
        
        this.stopHeartbeat();
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            this.ws.close(1000, '正常关闭');
            this.ws = null;
        }
        
        this.setState(WebSocketState.DISCONNECTED);
    }

    /**
     * 处理消息队列
     */
    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.state === WebSocketState.CONNECTED) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }

    /**
     * 判断消息是否需要等待响应
     */
    shouldWaitForResponse(message) {
        const waitTypes = [
            MessageType.SEND_MESSAGE,
            MessageType.AUTH
        ];
        
        return waitTypes.includes(message.type);
    }

    /**
     * 生成消息ID
     */
    generateMessageId() {
        return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 设置连接状态
     */
    setState(state) {
        if (this.state !== state) {
            const oldState = this.state;
            this.state = state;
            this.log('状态变化:', oldState, '->', state);
            this.emitEvent('stateChange', { oldState, newState: state });
        }
    }

    /**
     * 添加事件监听器
     */
    addEventListener(eventType, listener) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        
        this.eventListeners.get(eventType).push(listener);
    }

    /**
     * 移除事件监听器
     */
    removeEventListener(eventType, listener) {
        if (this.eventListeners.has(eventType)) {
            const listeners = this.eventListeners.get(eventType);
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 触发事件
     */
    emitEvent(eventType, data = null) {
        if (this.eventListeners.has(eventType)) {
            const listeners = this.eventListeners.get(eventType);
            listeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    this.error('事件监听器执行失败:', error);
                }
            });
        }
    }

    /**
     * 获取连接状态
     */
    getState() {
        return this.state;
    }

    /**
     * 检查是否已连接
     */
    isConnected() {
        return this.state === WebSocketState.CONNECTED;
    }

    /**
     * 获取连接统计信息
     */
    getStats() {
        return {
            state: this.state,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length,
            pendingMessages: this.pendingMessages.size,
            url: this.url
        };
    }

    /**
     * 日志记录
     */
    log(...args) {
        if (this.debugMode) {
            console.log('[WebSocketService]', ...args);
        }
    }

    /**
     * 错误记录
     */
    error(...args) {
        console.error('[WebSocketService]', ...args);
    }
}

// 默认导出
export default WebSocketService;
