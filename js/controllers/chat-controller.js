/**
 * DifyChat 聊天界面控制器 v2.0
 * 现代化聊天界面管理，整合认证、WebSocket、错误处理等服务
 * 作者: DifyChat开发团队
 * 创建时间: 2025-01-27
 */

import { AuthService } from '../services/auth-service.js';
import { WebSocketService, MessageType } from '../services/websocket-service.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { LoadingManager } from '../utils/loading.js';
import { StorageManager } from '../utils/storage.js';

/**
 * 聊天界面控制器类
 * 管理整个聊天界面的交互逻辑，包括认证检查、消息处理、UI更新等
 */
export class ChatController {
    constructor() {
        this.authService = new AuthService();
        this.wsService = new WebSocketService();
        this.errorHandler = new ErrorHandler();
        this.loadingManager = new LoadingManager();
        this.storageManager = new StorageManager();
        
        // UI元素引用
        this.messageContainer = null;
        this.messageInput = null;
        this.sendButton = null;
        this.agentSelector = null;
        this.userInfo = null;
        
        // 聊天状态
        this.currentAgent = null;
        this.isConnected = false;
        this.messageHistory = [];
        this.streamingMessageId = null;
        
        // WebSocket 连接
        this.wsConnection = null;
        this.wsRetryCount = 0;
        this.maxRetries = 3;
        
        // 调试模式
        this.debugMode = (typeof ENV_CONFIG !== 'undefined' && ENV_CONFIG?.DEBUG_MODE) || false;
        
        this.log('ChatController初始化');
    }

    /**
     * 初始化聊天控制器
     */
    async init() {
        try {
            this.log('开始初始化聊天界面...');
            
            // 检查认证状态
            await this.checkAuthentication();
            
            // 初始化UI元素
            this.initializeUIElements();
            
            // 设置事件监听器
            this.setupEventListeners();
            
            // 加载用户信息
            await this.loadUserInfo();
            
            // 加载可用代理
            await this.loadAvailableAgents();
            
            // 恢复聊天历史
            this.restoreChatHistory();
            
            // 建立WebSocket连接
            await this.connectWebSocket();
            
            this.log('聊天界面初始化完成');
            
        } catch (error) {
            this.error('聊天界面初始化失败:', error);
            this.errorHandler.handleApiError(error);
        }
    }

    /**
     * 检查用户认证状态
     */
    async checkAuthentication() {
        this.log('检查认证状态...');
        
        if (!await this.authService.isAuthenticated()) {
            this.log('用户未认证，跳转到登录页面');
            this.errorHandler.showError('请先登录');
            setTimeout(() => {
                window.location.href = './login.html';
            }, 1000);
            return;
        }
        
        this.log('用户认证有效');
    }

    /**
     * 初始化UI元素引用
     */
    initializeUIElements() {
        this.log('初始化UI元素...');
        
        // 消息相关元素
        this.messageContainer = document.getElementById('messageContainer') || 
                               document.querySelector('.chat-messages') ||
                               document.querySelector('#chatMessages');
        
        this.messageInput = document.getElementById('messageInput') || 
                           document.querySelector('textarea[placeholder*="消息"]') ||
                           document.querySelector('.message-input');
        
        this.sendButton = document.getElementById('sendButton') || 
                         document.querySelector('.send-button') ||
                         document.querySelector('button[onclick*="send"]');
        
        // 代理选择器
        this.agentSelector = document.getElementById('agentSelector') || 
                           document.querySelector('.agent-selector') ||
                           document.querySelector('select[name*="agent"]');
        
        // 用户信息区域
        this.userInfo = document.querySelector('.user-info') ||
                       document.querySelector('.profile-info') ||
                       document.getElementById('userInfo');
        
        // 验证必要元素
        if (!this.messageContainer) {
            throw new Error('未找到消息容器元素');
        }
        
        if (!this.messageInput) {
            throw new Error('未找到消息输入元素');
        }
        
        this.log('UI元素初始化完成');
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        this.log('设置事件监听器...');
        
        // 发送按钮点击
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.sendMessage());
        }
        
        // 输入框事件
        if (this.messageInput) {
            // 回车发送（Ctrl+Enter换行）
            this.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // 输入状态监听
            this.messageInput.addEventListener('input', () => {
                this.updateSendButtonState();
            });
        }
        
        // 代理切换
        if (this.agentSelector) {
            this.agentSelector.addEventListener('change', (e) => {
                this.switchAgent(e.target.value);
            });
        }
        
        // 退出登录
        const logoutBtn = document.querySelector('.logout-btn') || 
                         document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        // 主题切换
        const themeToggle = document.querySelector('.theme-toggle') ||
                           document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // 清空聊天
        const clearChat = document.querySelector('.clear-chat') ||
                         document.getElementById('clearChat');
        if (clearChat) {
            clearChat.addEventListener('click', () => this.clearChatHistory());
        }
        
        // 窗口关闭前保存状态
        window.addEventListener('beforeunload', () => {
            this.saveChatState();
        });
        
        this.log('事件监听器设置完成');
    }

    /**
     * 加载用户信息
     */
    async loadUserInfo() {
        try {
            this.log('加载用户信息...');
            
            const userInfo = this.storageManager.getUserInfo();
            if (userInfo && this.userInfo) {
                // 更新用户信息显示
                const avatar = this.userInfo.querySelector('.user-avatar');
                const name = this.userInfo.querySelector('.user-name');
                const email = this.userInfo.querySelector('.user-email');
                
                if (avatar) {
                    avatar.src = userInfo.avatar || 'assets/images/default-avatar.png';
                    avatar.alt = userInfo.name || userInfo.username || '用户';
                }
                
                if (name) {
                    name.textContent = userInfo.name || userInfo.username || '用户';
                }
                
                if (email) {
                    email.textContent = userInfo.email || '';
                }
            }
            
            this.log('用户信息加载完成');
            
        } catch (error) {
            this.error('加载用户信息失败:', error);
        }
    }

    /**
     * 加载可用代理列表
     */
    async loadAvailableAgents() {
        try {
            this.log('加载可用代理...');
            
            this.loadingManager.showComponentLoading(this.agentSelector?.parentElement, '加载代理中...');
            
            // 这里应该调用实际的API获取代理列表
            // const response = await this.authService.difySdk.getAgents();
            
            // 模拟数据（在实际应用中替换为API调用）
            const agents = [
                { id: 'general', name: '通用助手', description: '全能AI助手' },
                { id: 'coding', name: '编程助手', description: '专业代码助手' },
                { id: 'writing', name: '写作助手', description: '文本创作专家' }
            ];
            
            if (this.agentSelector) {
                this.agentSelector.innerHTML = '';
                
                agents.forEach(agent => {
                    const option = document.createElement('option');
                    option.value = agent.id;
                    option.textContent = agent.name;
                    option.title = agent.description;
                    this.agentSelector.appendChild(option);
                });
                
                // 设置默认代理
                if (agents.length > 0) {
                    this.currentAgent = agents[0];
                    this.agentSelector.value = agents[0].id;
                }
            }
            
            this.log('代理列表加载完成');
            
        } catch (error) {
            this.error('加载代理列表失败:', error);
            this.errorHandler.showError('无法加载AI代理列表');
        } finally {
            this.loadingManager.hideComponentLoading(this.agentSelector?.parentElement);
        }
    }

    /**
     * 恢复聊天历史
     */
    restoreChatHistory() {
        try {
            this.log('恢复聊天历史...');
            
            const savedHistory = this.storageManager.getCache('chat_history');
            if (savedHistory && Array.isArray(savedHistory)) {
                this.messageHistory = savedHistory;
                this.renderMessageHistory();
            }
            
            this.log('聊天历史恢复完成');
            
        } catch (error) {
            this.error('恢复聊天历史失败:', error);
        }
    }

    /**
     * 渲染消息历史
     */
    renderMessageHistory() {
        if (!this.messageContainer) return;
        
        this.messageContainer.innerHTML = '';
        
        this.messageHistory.forEach(message => {
            this.appendMessage(message, false);
        });
        
        this.scrollToBottom();
    }

    /**
     * 建立WebSocket连接
     */
    async connectWebSocket() {
        try {
            this.log('建立WebSocket连接...');
            
            // 设置WebSocket事件监听器
            this.setupWebSocketListeners();
            
            // 连接WebSocket
            await this.wsService.connect();
            
            this.isConnected = true;
            this.wsRetryCount = 0;
            
            this.log('WebSocket连接建立成功');
            this.updateConnectionStatus(true);
            
        } catch (error) {
            this.error('WebSocket连接失败:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            // 重试连接
            if (this.wsRetryCount < this.maxRetries) {
                this.wsRetryCount++;
                setTimeout(() => this.connectWebSocket(), 3000 * this.wsRetryCount);
            }
        }
    }

    /**
     * 设置WebSocket事件监听器
     */
    setupWebSocketListeners() {
        // 连接状态变化
        this.wsService.addEventListener('stateChange', (data) => {
            this.isConnected = this.wsService.isConnected();
            this.updateConnectionStatus(this.isConnected);
            this.updateSendButtonState();
        });
        
        // 收到消息
        this.wsService.addEventListener('message_received', (message) => {
            this.handleReceivedMessage(message);
        });
        
        // 流式响应块
        this.wsService.addEventListener('streamChunk', (data) => {
            this.handleStreamChunk(data);
        });
        
        // 流式响应结束
        this.wsService.addEventListener('streamEnd', (data) => {
            this.handleStreamEnd(data);
        });
        
        // 消息错误
        this.wsService.addEventListener('messageError', (error) => {
            this.handleMessageError(error);
        });
        
        // 最大重连次数达到
        this.wsService.addEventListener('maxReconnectAttemptsReached', () => {
            this.errorHandler.showError('连接中断，请刷新页面重试');
        });
    }

    /**
     * 处理收到的消息
     */
    handleReceivedMessage(message) {
        if (message.type === MessageType.MESSAGE_RECEIVED) {
            const assistantMessage = {
                id: message.data.id || this.generateMessageId(),
                type: 'assistant',
                content: message.data.content || '',
                timestamp: message.data.timestamp || Date.now(),
                agent: message.data.agent_id || this.currentAgent?.id,
                metadata: message.data.metadata
            };
            
            this.addMessage(assistantMessage);
        }
    }

    /**
     * 处理流式响应块
     */
    handleStreamChunk(data) {
        if (this.streamingMessageId && data.messageId) {
            // 查找对应的消息
            const message = this.messageHistory.find(m => 
                m.relatedMessageId === data.messageId || m.id === this.streamingMessageId
            );
            
            if (message) {
                // 累积内容
                if (data.delta) {
                    message.content += data.delta;
                } else if (data.content) {
                    message.content = data.content;
                }
                
                // 更新界面
                this.updateStreamingMessage(message.id, message.content);
            }
        }
    }

    /**
     * 处理流式响应结束
     */
    handleStreamEnd(data) {
        if (this.streamingMessageId) {
            this.completeStreamResponse(this.streamingMessageId);
        }
    }

    /**
     * 处理消息错误
     */
    handleMessageError(error) {
        this.error('消息处理错误:', error);
        
        if (this.streamingMessageId) {
            this.removeMessage(this.streamingMessageId);
            this.streamingMessageId = null;
        }
        
        this.errorHandler.showError(error.error || '消息处理失败');
    }

    /**
     * 发送消息
     */
    async sendMessage() {
        if (!this.messageInput || !this.messageInput.value.trim()) {
            return;
        }
        
        const messageText = this.messageInput.value.trim();
        this.messageInput.value = '';
        this.updateSendButtonState();
        
        try {
            this.log('发送消息:', messageText);
            
            // 添加用户消息到界面
            const userMessage = {
                id: this.generateMessageId(),
                type: 'user',
                content: messageText,
                timestamp: Date.now(),
                agent: this.currentAgent?.id
            };
            
            this.addMessage(userMessage);
            
            // 检查WebSocket连接
            if (!this.wsService.isConnected()) {
                throw new Error('WebSocket连接未建立');
            }
            
            // 创建加载消息
            const loadingMessage = {
                id: this.generateMessageId(),
                type: 'assistant',
                content: '',
                loading: true,
                timestamp: Date.now(),
                agent: this.currentAgent?.id,
                relatedMessageId: null // 将在收到响应时设置
            };
            
            this.addMessage(loadingMessage);
            this.streamingMessageId = loadingMessage.id;
            
            // 通过WebSocket发送消息
            const sentMessageId = this.wsService.sendChatMessage(messageText, this.currentAgent?.id, {
                stream: true,
                conversationId: this.getCurrentConversationId()
            });
            
            // 关联发送的消息ID
            loadingMessage.relatedMessageId = sentMessageId;
            
            this.log('消息已通过WebSocket发送，ID:', sentMessageId);
            
        } catch (error) {
            this.error('发送消息失败:', error);
            
            // 如果WebSocket连接失败，尝试降级到HTTP请求
            if (error.message.includes('WebSocket') || error.message.includes('连接')) {
                this.errorHandler.showWarning('实时连接中断，正在尝试重新连接...');
                this.connectWebSocket(); // 尝试重连
            } else {
                this.errorHandler.showError('消息发送失败，请重试');
            }
            
            // 移除加载消息
            if (this.streamingMessageId) {
                this.removeMessage(this.streamingMessageId);
                this.streamingMessageId = null;
            }
        }
    }

    /**
     * 获取当前会话ID
     */
    getCurrentConversationId() {
        // 这里应该返回当前会话的ID
        // 可以从URL参数、本地存储或其他地方获取
        return this.storageManager.getCache('current_conversation_id') || 
               new URLSearchParams(window.location.search).get('conversation_id');
    }

    /**
     * 模拟流式响应（在实际应用中替换为真实的流式处理）
     */
    simulateStreamResponse(messageId) {
        const responses = [
            '我理解您的问题。',
            '让我为您详细分析一下...',
            '基于您提供的信息，我建议：',
            '\n\n1. 首先考虑...',
            '\n2. 其次需要注意...',
            '\n3. 最后建议...'
        ];
        
        let currentIndex = 0;
        let currentContent = '';
        
        const streamInterval = setInterval(() => {
            if (currentIndex >= responses.length) {
                clearInterval(streamInterval);
                this.completeStreamResponse(messageId);
                return;
            }
            
            currentContent += responses[currentIndex];
            this.updateStreamingMessage(messageId, currentContent);
            currentIndex++;
        }, 500);
    }

    /**
     * 更新流式消息内容
     */
    updateStreamingMessage(messageId, content) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const contentElement = messageElement.querySelector('.message-content');
            if (contentElement) {
                contentElement.innerHTML = this.formatMessageContent(content);
            }
        }
        
        // 更新历史记录
        const message = this.messageHistory.find(m => m.id === messageId);
        if (message) {
            message.content = content;
        }
        
        this.scrollToBottom();
    }

    /**
     * 完成流式响应
     */
    completeStreamResponse(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.classList.remove('loading');
            const spinner = messageElement.querySelector('.loading-spinner');
            if (spinner) {
                spinner.remove();
            }
        }
        
        // 更新历史记录
        const message = this.messageHistory.find(m => m.id === messageId);
        if (message) {
            message.loading = false;
        }
        
        this.streamingMessageId = null;
        this.saveChatHistory();
    }

    /**
     * 添加消息到历史和界面
     */
    addMessage(message) {
        this.messageHistory.push(message);
        this.appendMessage(message, true);
        this.saveChatHistory();
    }

    /**
     * 在界面中显示消息
     */
    appendMessage(message, shouldScroll = true) {
        if (!this.messageContainer) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.type}`;
        messageElement.setAttribute('data-message-id', message.id);
        
        if (message.loading) {
            messageElement.classList.add('loading');
        }
        
        const avatar = message.type === 'user' ? 
            this.getUserAvatar() : 
            this.getAgentAvatar(message.agent);
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                <img src="${avatar}" alt="${message.type}" />
            </div>
            <div class="message-body">
                <div class="message-header">
                    <span class="message-sender">
                        ${message.type === 'user' ? '您' : (this.currentAgent?.name || 'AI助手')}
                    </span>
                    <span class="message-time">
                        ${this.formatTime(message.timestamp)}
                    </span>
                </div>
                <div class="message-content">
                    ${message.loading ? '<div class="loading-spinner"></div>' : this.formatMessageContent(message.content)}
                </div>
            </div>
        `;
        
        this.messageContainer.appendChild(messageElement);
        
        if (shouldScroll) {
            this.scrollToBottom();
        }
    }

    /**
     * 格式化消息内容
     */
    formatMessageContent(content) {
        // 基本的文本格式化
        return content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }

    /**
     * 获取用户头像
     */
    getUserAvatar() {
        const userInfo = this.storageManager.getUserInfo();
        return userInfo?.avatar || 'assets/images/default-avatar.png';
    }

    /**
     * 获取代理头像
     */
    getAgentAvatar(agentId) {
        // 根据代理ID返回相应头像
        const avatarMap = {
            'general': 'assets/images/agent-general.png',
            'coding': 'assets/images/agent-coding.png',
            'writing': 'assets/images/agent-writing.png'
        };
        
        return avatarMap[agentId] || 'assets/images/agent-default.png';
    }

    /**
     * 格式化时间显示
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * 滚动到底部
     */
    scrollToBottom() {
        if (this.messageContainer) {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        }
    }

    /**
     * 更新发送按钮状态
     */
    updateSendButtonState() {
        if (this.sendButton && this.messageInput) {
            const hasContent = this.messageInput.value.trim().length > 0;
            this.sendButton.disabled = !hasContent || !this.isConnected;
        }
    }

    /**
     * 更新连接状态显示
     */
    updateConnectionStatus(connected) {
        const statusElement = document.querySelector('.connection-status');
        if (statusElement) {
            statusElement.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
            statusElement.textContent = connected ? '已连接' : '连接中断';
        }
    }

    /**
     * 切换代理
     */
    async switchAgent(agentId) {
        try {
            this.log('切换代理:', agentId);
            
            // 这里应该调用API获取代理详情
            this.currentAgent = { id: agentId, name: `代理-${agentId}` };
            
            this.errorHandler.showSuccess(`已切换到${this.currentAgent.name}`);
            
        } catch (error) {
            this.error('切换代理失败:', error);
            this.errorHandler.showError('切换代理失败');
        }
    }

    /**
     * 清空聊天历史
     */
    clearChatHistory() {
        if (confirm('确定要清空所有聊天记录吗？此操作不可撤销。')) {
            this.messageHistory = [];
            if (this.messageContainer) {
                this.messageContainer.innerHTML = '';
            }
            this.storageManager.removeCache('chat_history');
            this.errorHandler.showSuccess('聊天记录已清空');
        }
    }

    /**
     * 切换主题
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        this.storageManager.setUserSetting('theme', newTheme);
        
        this.log('主题已切换:', newTheme);
    }

    /**
     * 处理退出登录
     */
    async handleLogout() {
        if (confirm('确定要退出登录吗？')) {
            try {
                this.loadingManager.showPageLoading('正在退出...');
                await this.authService.logout();
                window.location.href = './login.html?logout=true';
            } catch (error) {
                this.error('退出登录失败:', error);
                this.errorHandler.showError('退出登录失败');
            } finally {
                this.loadingManager.hidePageLoading();
            }
        }
    }

    /**
     * 保存聊天状态
     */
    saveChatState() {
        this.saveChatHistory();
        // 保存其他状态信息
        this.storageManager.setUserSetting('currentAgent', this.currentAgent?.id);
    }

    /**
     * 保存聊天历史
     */
    saveChatHistory() {
        this.storageManager.setCache('chat_history', this.messageHistory, 24 * 60); // 24小时缓存
    }

    /**
     * 移除消息
     */
    removeMessage(messageId) {
        // 从界面移除
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
        
        // 从历史记录移除
        this.messageHistory = this.messageHistory.filter(m => m.id !== messageId);
    }

    /**
     * 生成消息ID
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 日志记录
     */
    log(...args) {
        if (this.debugMode) {
            console.log('[ChatController]', ...args);
        }
    }

    /**
     * 错误记录
     */
    error(...args) {
        console.error('[ChatController]', ...args);
    }

    /**
     * 销毁控制器
     */
    destroy() {
        this.log('销毁聊天控制器...');
        
        // 断开WebSocket连接
        if (this.wsService) {
            this.wsService.disconnect();
        }
        
        // 保存状态
        this.saveChatState();
        
        // 清理定时器等资源
        // ...
        
        this.log('聊天控制器已销毁');
    }
}

// 默认导出
export default ChatController;
