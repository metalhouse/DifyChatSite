/**
 * 消息流处理器 - 处理AI智能体流式消息
 * 基于DifyChatBack v2.0 API指南第5章
 * 提供智能体流式回复的实时显示和状态管理
 */

// 导入依赖
import { ENV_CONFIG } from '../../config/env.js';
import { WEBSOCKET_EVENTS } from '../api/endpoints.js';

/**
 * 消息流处理器类
 * 专门处理AI智能体的流式消息返回
 */
class StreamProcessor {
    constructor() {
        this.activeStreams = new Map(); // 活跃的流式消息
        this.streamHandlers = new Map(); // 流处理器
        this.bufferSize = 10; // 缓冲区大小
        this.flushInterval = 100; // 刷新间隔(ms)
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🌊 StreamProcessor初始化');
        }
    }

    /**
     * 开始处理新的流式消息
     * @param {string} messageId 消息ID
     * @param {Object} streamInfo 流信息
     * @returns {StreamHandler} 流处理器实例
     */
    createStream(messageId, streamInfo) {
        if (this.activeStreams.has(messageId)) {
            console.warn('⚠️ 流消息已存在:', messageId);
            return this.activeStreams.get(messageId);
        }

        const handler = new StreamHandler(messageId, streamInfo);
        this.activeStreams.set(messageId, handler);
        this.streamHandlers.set(messageId, handler);

        if (ENV_CONFIG.isDebug()) {
            console.log('🆕 创建流处理器:', messageId);
        }

        return handler;
    }

    /**
     * 获取流处理器
     * @param {string} messageId 消息ID
     * @returns {StreamHandler|null} 流处理器实例
     */
    getStream(messageId) {
        return this.streamHandlers.get(messageId) || null;
    }

    /**
     * 关闭流处理器
     * @param {string} messageId 消息ID
     */
    closeStream(messageId) {
        const handler = this.streamHandlers.get(messageId);
        if (handler) {
            handler.close();
            this.activeStreams.delete(messageId);
            this.streamHandlers.delete(messageId);

            if (ENV_CONFIG.isDebug()) {
                console.log('🔚 关闭流处理器:', messageId);
            }
        }
    }

    /**
     * 获取所有活跃流的状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        const streams = {};
        this.activeStreams.forEach((handler, messageId) => {
            streams[messageId] = handler.getStatus();
        });

        return {
            activeCount: this.activeStreams.size,
            streams
        };
    }

    /**
     * 清理所有流
     */
    cleanup() {
        this.activeStreams.forEach((handler, messageId) => {
            this.closeStream(messageId);
        });

        if (ENV_CONFIG.isDebug()) {
            console.log('🧹 流处理器已清理');
        }
    }
}

/**
 * 单个流处理器类
 * 处理单条消息的流式接收和显示
 */
class StreamHandler {
    constructor(messageId, streamInfo) {
        this.messageId = messageId;
        this.roomId = streamInfo.roomId;
        this.agentId = streamInfo.agentId;
        this.conversationId = streamInfo.conversationId;
        
        // 流状态
        this.status = 'starting'; // starting, streaming, completed, error
        this.startTime = Date.now();
        this.lastChunkTime = Date.now();
        this.totalChunks = 0;
        this.totalLength = 0;
        
        // 内容缓冲
        this.buffer = [];
        this.fullContent = '';
        this.displayedContent = '';
        
        // 事件回调
        this.onChunk = null;
        this.onComplete = null;
        this.onError = null;
        this.onProgress = null;
        
        // 自动刷新定时器
        this.flushTimer = null;
        this.flushInterval = 100; // 100ms刷新间隔
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🌊 StreamHandler创建:', {
                messageId,
                roomId: this.roomId,
                agentId: this.agentId
            });
        }
    }

    /**
     * 开始流处理
     */
    start() {
        this.status = 'streaming';
        this._startFlushTimer();

        if (ENV_CONFIG.isDebug()) {
            console.log('▶️ 开始流处理:', this.messageId);
        }
    }

    /**
     * 处理新的流数据块
     * @param {Object} chunk 数据块
     */
    processChunk(chunk) {
        if (this.status !== 'streaming') {
            console.warn('⚠️ 流未处于streaming状态:', this.status);
            return;
        }

        this.lastChunkTime = Date.now();
        this.totalChunks++;
        
        // 处理不同类型的数据块
        switch (chunk.type) {
            case 'text':
                this._processTextChunk(chunk);
                break;
                
            case 'function_call':
                this._processFunctionCall(chunk);
                break;
                
            case 'function_result':
                this._processFunctionResult(chunk);
                break;
                
            case 'metadata':
                this._processMetadata(chunk);
                break;
                
            case 'error':
                this._processError(chunk);
                return;
                
            default:
                console.warn('⚠️ 未知的chunk类型:', chunk.type);
        }

        // 触发进度回调
        if (this.onProgress) {
            this.onProgress({
                messageId: this.messageId,
                chunks: this.totalChunks,
                length: this.totalLength,
                duration: Date.now() - this.startTime
            });
        }

        // 触发数据块回调
        if (this.onChunk) {
            this.onChunk({
                messageId: this.messageId,
                chunk,
                fullContent: this.fullContent,
                displayedContent: this.displayedContent
            });
        }

        if (ENV_CONFIG.isDebug()) {
            console.log('📦 处理数据块:', {
                messageId: this.messageId,
                type: chunk.type,
                size: chunk.content?.length || 0,
                totalChunks: this.totalChunks
            });
        }
    }

    /**
     * 处理文本数据块
     * @private
     */
    _processTextChunk(chunk) {
        const content = chunk.content || '';
        this.buffer.push(content);
        this.fullContent += content;
        this.totalLength += content.length;
    }

    /**
     * 处理函数调用数据块
     * @private
     */
    _processFunctionCall(chunk) {
        const functionInfo = {
            type: 'function_call',
            name: chunk.function_name,
            arguments: chunk.arguments,
            id: chunk.call_id
        };

        this.buffer.push(functionInfo);
        
        // 添加到显示内容
        const displayText = `🔧 调用函数: ${chunk.function_name}`;
        this.fullContent += displayText;
        this.totalLength += displayText.length;
    }

    /**
     * 处理函数结果数据块
     * @private
     */
    _processFunctionResult(chunk) {
        const resultInfo = {
            type: 'function_result',
            callId: chunk.call_id,
            result: chunk.result,
            success: chunk.success
        };

        this.buffer.push(resultInfo);
        
        // 添加到显示内容
        const displayText = chunk.success ? 
            `✅ 函数执行成功` : 
            `❌ 函数执行失败: ${chunk.error}`;
        this.fullContent += displayText;
        this.totalLength += displayText.length;
    }

    /**
     * 处理元数据
     * @private
     */
    _processMetadata(chunk) {
        // 存储元数据但不影响显示内容
        this.metadata = {
            ...this.metadata,
            ...chunk.data
        };
    }

    /**
     * 处理错误数据块
     * @private
     */
    _processError(chunk) {
        this.status = 'error';
        this.error = {
            message: chunk.error || '流处理出错',
            code: chunk.error_code,
            details: chunk.details
        };

        this._stopFlushTimer();

        if (this.onError) {
            this.onError({
                messageId: this.messageId,
                error: this.error
            });
        }

        console.error('❌ 流处理错误:', this.error);
    }

    /**
     * 完成流处理
     * @param {Object} finalData 最终数据
     */
    complete(finalData = {}) {
        if (this.status === 'completed') {
            return;
        }

        this.status = 'completed';
        this.completedAt = Date.now();
        this._stopFlushTimer();
        
        // 最后一次刷新显示
        this._flushBuffer();

        // 处理最终数据
        if (finalData.usage) {
            this.usage = finalData.usage;
        }

        if (finalData.metadata) {
            this.metadata = {
                ...this.metadata,
                ...finalData.metadata
            };
        }

        if (this.onComplete) {
            this.onComplete({
                messageId: this.messageId,
                fullContent: this.fullContent,
                usage: this.usage,
                metadata: this.metadata,
                duration: this.completedAt - this.startTime,
                totalChunks: this.totalChunks
            });
        }

        if (ENV_CONFIG.isDebug()) {
            console.log('✅ 流处理完成:', {
                messageId: this.messageId,
                duration: this.completedAt - this.startTime,
                chunks: this.totalChunks,
                length: this.totalLength
            });
        }
    }

    /**
     * 强制关闭流
     */
    close() {
        if (this.status === 'streaming') {
            this.status = 'interrupted';
        }
        
        this._stopFlushTimer();
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🛑 强制关闭流:', this.messageId);
        }
    }

    /**
     * 启动缓冲区刷新定时器
     * @private
     */
    _startFlushTimer() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }

        this.flushTimer = setInterval(() => {
            this._flushBuffer();
        }, this.flushInterval);
    }

    /**
     * 停止缓冲区刷新定时器
     * @private
     */
    _stopFlushTimer() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }

    /**
     * 刷新缓冲区到显示内容
     * @private
     */
    _flushBuffer() {
        if (this.buffer.length === 0) {
            return;
        }

        // 将缓冲区内容合并到显示内容
        const textChunks = this.buffer.filter(item => 
            typeof item === 'string'
        );

        if (textChunks.length > 0) {
            const newContent = textChunks.join('');
            this.displayedContent += newContent;
        }

        // 清空缓冲区
        this.buffer = [];
    }

    /**
     * 设置事件回调
     * @param {string} event 事件名称
     * @param {Function} callback 回调函数
     */
    on(event, callback) {
        switch (event) {
            case 'chunk':
                this.onChunk = callback;
                break;
            case 'complete':
                this.onComplete = callback;
                break;
            case 'error':
                this.onError = callback;
                break;
            case 'progress':
                this.onProgress = callback;
                break;
            default:
                console.warn('⚠️ 未知的事件类型:', event);
        }
    }

    /**
     * 获取流状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            messageId: this.messageId,
            status: this.status,
            startTime: this.startTime,
            completedAt: this.completedAt,
            lastChunkTime: this.lastChunkTime,
            totalChunks: this.totalChunks,
            totalLength: this.totalLength,
            bufferSize: this.buffer.length,
            contentLength: this.displayedContent.length,
            duration: (this.completedAt || Date.now()) - this.startTime,
            error: this.error,
            usage: this.usage,
            metadata: this.metadata
        };
    }

    /**
     * 获取当前显示内容
     * @returns {string} 当前显示的内容
     */
    getCurrentContent() {
        this._flushBuffer(); // 强制刷新一次
        return this.displayedContent;
    }

    /**
     * 获取完整内容
     * @returns {string} 完整内容
     */
    getFullContent() {
        return this.fullContent;
    }
}

/**
 * 流式消息的WebSocket事件处理器
 * 将WebSocket事件与流处理器连接
 */
class StreamEventHandler {
    constructor(streamProcessor, socketManager) {
        this.processor = streamProcessor;
        this.socketManager = socketManager;
        
        this._setupEventHandlers();
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🔗 StreamEventHandler初始化');
        }
    }

    /**
     * 设置WebSocket事件监听器
     * @private
     */
    _setupEventHandlers() {
        // 流开始事件
        this.socketManager.on('stream:start', (data) => {
            this._handleStreamStart(data);
        });

        // 流数据块事件
        this.socketManager.on('stream:chunk', (data) => {
            this._handleStreamChunk(data);
        });

        // 流完成事件
        this.socketManager.on('stream:complete', (data) => {
            this._handleStreamComplete(data);
        });

        // 流错误事件
        this.socketManager.on('stream:error', (data) => {
            this._handleStreamError(data);
        });
    }

    /**
     * 处理流开始事件
     * @private
     */
    _handleStreamStart(data) {
        const { messageId, roomId, agentId, conversationId } = data;
        
        const handler = this.processor.createStream(messageId, {
            roomId,
            agentId,
            conversationId
        });
        
        handler.start();

        if (ENV_CONFIG.isDebug()) {
            console.log('🎬 流开始:', messageId);
        }
    }

    /**
     * 处理流数据块事件
     * @private
     */
    _handleStreamChunk(data) {
        const { messageId, chunk } = data;
        const handler = this.processor.getStream(messageId);
        
        if (handler) {
            handler.processChunk(chunk);
        } else {
            console.warn('⚠️ 未找到流处理器:', messageId);
        }
    }

    /**
     * 处理流完成事件
     * @private
     */
    _handleStreamComplete(data) {
        const { messageId, finalData } = data;
        const handler = this.processor.getStream(messageId);
        
        if (handler) {
            handler.complete(finalData);
        }
    }

    /**
     * 处理流错误事件
     * @private
     */
    _handleStreamError(data) {
        const { messageId, error } = data;
        const handler = this.processor.getStream(messageId);
        
        if (handler) {
            handler._processError({
                type: 'error',
                error: error.message,
                error_code: error.code,
                details: error.details
            });
        }
    }
}

// 创建全局实例
const streamProcessor = new StreamProcessor();

// 导出类和实例
window.StreamProcessor = StreamProcessor;
window.StreamHandler = StreamHandler;
window.StreamEventHandler = StreamEventHandler;
window.streamProcessor = streamProcessor;

export { StreamProcessor, StreamHandler, StreamEventHandler };
export default streamProcessor;
