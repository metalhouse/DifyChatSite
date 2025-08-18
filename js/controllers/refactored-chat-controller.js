/**
 * 重构后的聊天页面控制器 - DifyChat v2.0
 * 保持原有UI设计，使用新的模块化架构
 */

import { ENV_CONFIG } from '../../config/env.js';
import { LoadingManager } from '../utils/loading.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { AuthService } from '../services/auth-service.js';
import { DifyAPI } from '../api/dify-api.js';

export class RefactoredChatController {
    constructor() {
        this.loadingManager = new LoadingManager();
        this.errorHandler = new ErrorHandler();
        this.authService = new AuthService();
        this.difyAPI = new DifyAPI();
        
        // 状态管理
        this.currentAgent = null;
        this.currentConversation = null;
        this.messageHistory = [];
        this.conversations = JSON.parse(localStorage.getItem('chat_conversations') || '[]');
        this.messageAnswerVersions = {};
        
        // DOM 元素引用
        this.chatArea = null;
        this.messageInput = null;
        this.sendBtn = null;
        this.stopBtn = null;
        this.charCount = null;
        
        // 绑定方法
        this.sendMessage = this.sendMessage.bind(this);
        this.stopMessage = this.stopMessage.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
    }

    /**
     * 初始化聊天控制器
     */
    async init() {
        console.log('🚀 初始化重构后的聊天控制器...');
        
        try {
            // 检查登录状态
            if (!this.authService.isAuthenticated()) {
                console.log('❌ 用户未登录，跳转到登录页');
                window.location.href = './login.html';
                return;
            }

            // 初始化DOM引用
            this.initDOMReferences();
            
            // 绑定事件
            this.bindEvents();
            
            // 加载智能体列表
            await this.loadAgents();
            
            // 加载会话历史
            this.loadConversations();
            
            // 恢复最近的对话
            this.restoreRecentConversation();
            
            // 初始化主题
            this.loadThemeSettings();
            
            // 更新用户信息
            this.updateUserInfo();
            
            console.log('✅ 重构后的聊天控制器初始化完成');
            
        } catch (error) {
            console.error('❌ 聊天控制器初始化失败:', error);
            this.errorHandler.showError('系统初始化失败，请刷新页面重试');
        }
    }

    /**
     * 初始化DOM元素引用
     */
    initDOMReferences() {
        this.chatArea = document.getElementById('chatArea');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.charCount = document.getElementById('charCount');
        
        if (!this.chatArea) {
            throw new Error('未找到消息容器元素');
        }
        
        console.log('✅ DOM元素引用初始化完成');
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 发送按钮
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', this.sendMessage);
        }
        
        // 停止按钮
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', this.stopMessage);
        }
        
        // 输入框事件
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', this.handleKeyPress);
            this.messageInput.addEventListener('input', this.updateCharCount.bind(this));
            this.messageInput.addEventListener('input', this.autoResizeInput.bind(this));
        }
        
        // 退出登录按钮
        const logoutBtn = document.getElementById('nav-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.logout.bind(this));
        }
        
        // 全局方法（保持向后兼容）
        window.sendMessage = this.sendMessage;
        window.stopMessage = this.stopMessage;
        window.selectAgent = this.selectAgent.bind(this);
        window.newConversation = this.newConversation.bind(this);
        window.clearChat = this.clearChat.bind(this);
        window.exportChat = this.exportChat.bind(this);
        window.toggleSidebar = this.toggleSidebar.bind(this);
        
        console.log('✅ 事件监听器绑定完成');
    }

    /**
     * 处理键盘按键
     */
    handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    /**
     * 更新字符计数
     */
    updateCharCount() {
        if (this.charCount && this.messageInput) {
            this.charCount.textContent = this.messageInput.value.length;
        }
    }

    /**
     * 自动调整输入框高度
     */
    autoResizeInput() {
        if (this.messageInput) {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        }
    }

    /**
     * 加载智能体列表
     */
    async loadAgents() {
        const agentList = document.getElementById('agentList');
        if (!agentList) return;

        try {
            this.loadingManager.showElementLoading(agentList);
            
            const agents = await this.difyAPI.getAgents();
            
            if (!agents || agents.length === 0) {
                agentList.innerHTML = '<div class="text-center text-muted p-3">暂无可用的智能体</div>';
                return;
            }

            agentList.innerHTML = '';
            agents.forEach(agent => {
                const agentElement = document.createElement('div');
                agentElement.className = 'agent-item';
                agentElement.onclick = () => this.selectAgent(agent, agentElement);
                agentElement.innerHTML = `
                    <div class="fw-bold">${agent.name || '未命名智能体'}</div>
                    <small class="text-muted">${agent.description || '暂无描述'}</small>
                `;
                agentList.appendChild(agentElement);
            });

        } catch (error) {
            console.error('❌ 加载智能体失败:', error);
            agentList.innerHTML = '<div class="text-center text-danger p-3">加载智能体失败</div>';
        } finally {
            this.loadingManager.hideElementLoading(agentList);
        }
    }

    /**
     * 选择智能体
     */
    selectAgent(agent, element = null) {
        try {
            this.currentAgent = agent;
            
            // 更新UI状态
            document.querySelectorAll('.agent-item').forEach(item => {
                item.classList.remove('active');
            });
            
            if (element) {
                element.classList.add('active');
            }
            
            // 更新聊天区域
            this.chatArea.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-robot fa-3x mb-3 opacity-50"></i>
                    <h5>您正在与 ${agent.name} 对话</h5>
                    <p>${agent.description || '请输入您的问题开始对话'}</p>
                </div>
            `;
            
            // 更新标题
            const chatHeader = document.querySelector('.chat-header h4');
            if (chatHeader) {
                chatHeader.innerHTML = `<i class="fas fa-robot me-2"></i>${agent.name}`;
            }
            
            // 关闭移动端侧边栏
            this.closeSidebarOnMobile();
            
            console.log('✅ 已选择智能体:', agent.name);
            
        } catch (error) {
            console.error('❌ 选择智能体失败:', error);
            this.errorHandler.showError('选择智能体失败');
        }
    }

    /**
     * 发送消息
     */
    async sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message) return;
        if (!this.currentAgent) {
            this.errorHandler.showError('请先选择一个智能体');
            return;
        }
        
        // 切换按钮状态
        this.sendBtn.style.display = 'none';
        this.stopBtn.style.display = 'inline-block';
        
        // 清空输入框
        this.messageInput.value = '';
        this.updateCharCount();
        
        try {
            // 添加用户消息
            this.addMessage(message, 'user');
            
            // 添加到历史记录
            this.messageHistory.push({ role: 'user', content: message });
            
            // 创建AI消息容器
            const aiMessageDiv = this.addStreamingMessage();
            let accumulatedContent = '';
            
            // 发送消息到API
            await this.difyAPI.sendMessage(
                this.currentAgent.id,
                message,
                this.currentConversation?.id,
                (chunk) => {
                    // 处理流式响应
                    accumulatedContent += chunk;
                    this.updateStreamingMessage(aiMessageDiv, accumulatedContent);
                },
                (tokenUsage) => {
                    // 处理token使用信息
                    console.log('Token使用:', tokenUsage);
                }
            );
            
            // 完成消息
            this.finishStreamingMessage(aiMessageDiv, null, Date.now().toString());
            
            // 保存对话
            this.saveCurrentConversation();
            
        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            this.errorHandler.showError('发送消息失败: ' + error.message);
            
            // 移除可能的AI消息容器
            const lastMessage = this.chatArea.lastElementChild;
            if (lastMessage && lastMessage.classList.contains('assistant')) {
                lastMessage.remove();
            }
            
        } finally {
            // 恢复按钮状态
            this.sendBtn.style.display = 'inline-block';
            this.stopBtn.style.display = 'none';
        }
    }

    /**
     * 停止消息
     */
    async stopMessage() {
        try {
            // 这里可以添加停止请求的逻辑
            console.log('🛑 停止消息请求');
            
        } catch (error) {
            console.error('❌ 停止消息失败:', error);
        } finally {
            // 恢复按钮状态
            this.sendBtn.style.display = 'inline-block';
            this.stopBtn.style.display = 'none';
        }
    }

    /**
     * 添加消息到聊天区域
     */
    addMessage(content, type, addToHistory = true) {
        // 如果是第一条消息，清空欢迎信息
        if (this.chatArea.innerHTML.includes('请输入您的问题开始对话') || 
            this.chatArea.innerHTML.includes('欢迎使用 DifyChatSite') ||
            this.chatArea.innerHTML.includes('您正在与')) {
            this.chatArea.innerHTML = '';
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        
        if (type === 'user') {
            messageDiv.innerHTML = `
                <div class="message-bubble">
                    <div class="message-content">${content.replace(/\n/g, '<br>')}</div>
                    <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div class="message-actions-inline">
                            <button class="message-action-btn-inline" onclick="editUserMessage(this.closest('.message'), '${content.replace(/'/g, "\\'")}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="message-action-btn-inline" onclick="copyToClipboard('${content.replace(/'/g, "\\'")}')">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <small class="opacity-75">${timestamp}</small>
                    </div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-bubble">
                    <div class="message-content">${content.replace(/\n/g, '<br>')}</div>
                    <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div class="message-actions-inline">
                            <button class="message-action-btn-inline" onclick="copyToClipboard('${content.replace(/'/g, "\\'")}')">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="message-action-btn-inline rating-btn-like" onclick="rateMessage('${Date.now()}', 'like', this)">
                                <i class="fas fa-thumbs-up"></i>
                            </button>
                            <button class="message-action-btn-inline rating-btn-dislike" onclick="rateMessage('${Date.now()}', 'dislike', this)">
                                <i class="fas fa-thumbs-down"></i>
                            </button>
                        </div>
                        <small class="opacity-75">${timestamp}</small>
                    </div>
                </div>
            `;
        }
        
        this.chatArea.appendChild(messageDiv);
        this.chatArea.scrollTop = this.chatArea.scrollHeight;
        
        // 添加到历史记录
        if (addToHistory) {
            this.messageHistory.push({ role: type === 'user' ? 'user' : 'assistant', content });
        }
        
        return messageDiv;
    }

    /**
     * 添加流式消息容器
     */
    addStreamingMessage() {
        // 清空欢迎信息
        if (this.chatArea.innerHTML.includes('请输入您的问题开始对话') || 
            this.chatArea.innerHTML.includes('欢迎使用 DifyChatSite') ||
            this.chatArea.innerHTML.includes('您正在与')) {
            this.chatArea.innerHTML = '';
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        messageDiv.innerHTML = `
            <div class="processing-indicator">
                AI正在思考<span class="processing-dots"></span>
            </div>
            <div class="message-bubble" style="display: none;">
                <div class="message-content"></div>
                <span class="typing-cursor">|</span>
            </div>
        `;
        
        this.chatArea.appendChild(messageDiv);
        this.chatArea.scrollTop = this.chatArea.scrollHeight;
        
        return messageDiv;
    }

    /**
     * 更新流式消息内容
     */
    updateStreamingMessage(messageDiv, content) {
        const processingIndicator = messageDiv.querySelector('.processing-indicator');
        const messageBubble = messageDiv.querySelector('.message-bubble');
        const contentSpan = messageDiv.querySelector('.message-content');
        
        // 第一次收到内容时，隐藏处理指示器，显示气泡
        if (processingIndicator && processingIndicator.style.display !== 'none') {
            processingIndicator.style.display = 'none';
            messageBubble.style.display = 'block';
        }
        
        // 更新内容
        contentSpan.innerHTML = content.trim().replace(/\n/g, '<br>');
        
        // 自动滚动
        this.chatArea.scrollTop = this.chatArea.scrollHeight;
    }

    /**
     * 完成流式消息
     */
    finishStreamingMessage(messageDiv, tokenUsage = null, messageId = null) {
        const cursor = messageDiv.querySelector('.typing-cursor');
        const processingIndicator = messageDiv.querySelector('.processing-indicator');
        const bubble = messageDiv.querySelector('.message-bubble');
        const contentSpan = messageDiv.querySelector('.message-content');
        
        // 移除光标
        if (cursor) cursor.remove();
        
        // 确保气泡显示
        if (processingIndicator && processingIndicator.style.display !== 'none') {
            processingIndicator.style.display = 'none';
            bubble.style.display = 'block';
        }
        
        // 获取最终内容
        const finalContent = contentSpan.innerHTML.replace(/<br>/g, '\n').trim();
        contentSpan.innerHTML = finalContent.replace(/\n/g, '<br>');
        
        // 添加到历史记录
        this.messageHistory.push({ role: 'assistant', content: finalContent });
        
        // 添加操作按钮
        const timestamp = new Date().toLocaleTimeString();
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'margin-top: 8px; display: flex; justify-content: space-between; align-items: center;';
        actionsDiv.innerHTML = `
            <div class="message-actions-inline">
                <button class="message-action-btn-inline" onclick="copyToClipboard('${finalContent.replace(/'/g, "\\'")}')">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="message-action-btn-inline rating-btn-like" onclick="rateMessage('${messageId || Date.now()}', 'like', this)">
                    <i class="fas fa-thumbs-up"></i>
                </button>
                <button class="message-action-btn-inline rating-btn-dislike" onclick="rateMessage('${messageId || Date.now()}', 'dislike', this)">
                    <i class="fas fa-thumbs-down"></i>
                </button>
            </div>
            <small class="opacity-75">${timestamp}</small>
        `;
        bubble.appendChild(actionsDiv);
    }

    /**
     * 新建对话
     */
    newConversation() {
        this.currentConversation = null;
        this.messageHistory = [];
        
        if (this.currentAgent) {
            this.chatArea.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-robot fa-3x mb-3 opacity-50"></i>
                    <h5>您正在与 ${this.currentAgent.name} 对话</h5>
                    <p>${this.currentAgent.description || '请输入您的问题开始对话'}</p>
                </div>
            `;
        } else {
            this.chatArea.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-comments fa-3x mb-3 opacity-50"></i>
                    <h5>欢迎使用 DifyChatSite</h5>
                    <p>请从左侧选择一个智能体开始对话</p>
                </div>
            `;
        }
    }

    /**
     * 清空聊天
     */
    clearChat() {
        this.newConversation();
    }

    /**
     * 导出聊天记录
     */
    exportChat() {
        if (this.messageHistory.length === 0) {
            this.errorHandler.showError('暂无对话内容可导出');
            return;
        }
        
        const content = this.messageHistory.map(msg => 
            `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`
        ).join('\n\n');
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * 移动端侧边栏控制
     */
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
    }

    closeSidebarOnMobile() {
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        }
    }

    /**
     * 加载会话历史
     */
    loadConversations() {
        // 实现会话历史加载逻辑
        console.log('会话历史功能待实现');
    }

    /**
     * 保存当前对话
     */
    saveCurrentConversation() {
        // 实现对话保存逻辑
        console.log('对话保存功能待实现');
    }

    /**
     * 恢复最近的对话
     */
    restoreRecentConversation() {
        // 实现最近对话恢复逻辑
        console.log('对话恢复功能待实现');
    }

    /**
     * 加载主题设置
     */
    loadThemeSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('dify_settings') || '{}');
            const theme = settings.theme || 'light';
            document.documentElement.setAttribute('data-theme', theme);
            console.log('✅ 已加载主题:', theme);
        } catch (error) {
            console.error('❌ 加载主题设置失败:', error);
        }
    }

    /**
     * 更新用户信息
     */
    updateUserInfo() {
        try {
            const userInfo = this.authService.getUserInfo();
            const userNameElement = document.getElementById('nav-username');
            if (userNameElement && userInfo) {
                userNameElement.textContent = userInfo.username || userInfo.email || '用户';
            }
        } catch (error) {
            console.error('❌ 更新用户信息失败:', error);
        }
    }

    /**
     * 退出登录
     */
    logout() {
        this.authService.logout();
        window.location.href = './login.html';
    }
}

// 兼容性函数（保持向后兼容）
window.copyToClipboard = async function(text) {
    try {
        await navigator.clipboard.writeText(text);
        // 简单的toast提示
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 9999;
            background: #28a745; color: white; padding: 10px 20px;
            border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        toast.textContent = '已复制到剪贴板';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 2000);
    } catch (err) {
        console.error('复制失败:', err);
    }
};

window.editUserMessage = function(messageElement, originalText) {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.value = originalText;
        messageInput.focus();
        messageElement.classList.add('editing');
    }
};

window.rateMessage = function(messageId, rating, buttonElement) {
    console.log('评价消息:', messageId, rating);
    // 这里可以添加评价逻辑
};

export default RefactoredChatController;
