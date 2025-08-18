/**
 * 简化版聊天控制器 - 重构版
 * 适配新的chat.html页面结构
 */

import { simpleAgentService } from '../services/simple-agent-service.js';
import { conversationService } from '../services/conversation-service.js';

export class SimpleChatController {
    constructor() {
        this.isInitialized = false;
        this.currentAgent = null;
        this.conversationId = null;
        this.availableAgents = [];
        
        // DOM 元素
        this.agentList = null;
        this.chatMessages = null;
        this.messageInput = null;
        this.sendButton = null;
        this.currentAgentName = null;
        
        console.log('🤖 SimpleChatController 初始化');
    }

    async init() {
        console.log('🔧 初始化聊天控制器...');
        
        try {
            // 获取DOM元素
            this.agentList = document.getElementById('agentList');
            this.chatMessages = document.getElementById('chatMessages');
            this.messageInput = document.getElementById('messageInput');
            this.sendButton = document.getElementById('sendButton');
            this.currentAgentName = document.getElementById('currentAgentName');

            // 验证必要元素
            if (!this.agentList || !this.chatMessages || !this.messageInput || !this.sendButton) {
                throw new Error('缺少必要的DOM元素');
            }

            // 绑定事件
            this.bindEvents();

            // 加载智能体列表
            await this.loadAgents();

            this.isInitialized = true;
            console.log('✅ 聊天控制器初始化完成');

        } catch (error) {
            console.error('❌ 聊天控制器初始化失败:', error);
            throw error;
        }
    }

    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 发送按钮点击事件
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // 输入框回车事件
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 输入框自动调整高度
        this.messageInput.addEventListener('input', () => {
            this.adjustTextareaHeight();
        });

        console.log('✅ 事件绑定完成');
    }

    /**
     * 加载智能体列表
     */
    async loadAgents() {
        try {
            console.log('🤖 加载智能体列表...');
            
            // 显示加载状态
            this.agentList.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                </div>
            `;

            const result = await simpleAgentService.getAgents({
                status: 'active',
                limit: '20'
            });

            if (result.success && result.agents.length > 0) {
                this.availableAgents = result.agents;
                this.renderAgents();
                
                // 自动选择第一个智能体
                this.selectAgent(result.agents[0]);
                
                console.log(`✅ 智能体加载成功: ${result.agents.length} 个`);
            } else {
                this.showNoAgentsMessage();
                console.warn('⚠️ 没有可用的智能体');
            }

        } catch (error) {
            console.error('❌ 智能体加载失败:', error);
            this.showErrorMessage('智能体加载失败: ' + error.message);
        }
    }

    /**
     * 渲染智能体列表
     */
    renderAgents() {
        const agentsHtml = this.availableAgents.map(agent => `
            <div class="agent-item" data-agent-id="${agent.id}">
                <div class="agent-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="agent-info">
                    <div class="agent-name">${agent.name}</div>
                    <div class="agent-description">${agent.description || '智能助手'}</div>
                </div>
            </div>
        `).join('');

        this.agentList.innerHTML = agentsHtml;

        // 绑定点击事件
        this.agentList.querySelectorAll('.agent-item').forEach(item => {
            item.addEventListener('click', () => {
                const agentId = item.dataset.agentId;
                const agent = this.availableAgents.find(a => a.id === agentId);
                if (agent) {
                    this.selectAgent(agent);
                }
            });
        });
    }

    /**
     * 选择智能体
     */
    selectAgent(agent) {
        console.log('🎯 选择智能体:', agent.name);

        // 更新当前智能体
        this.currentAgent = agent;
        this.conversationId = null; // 重置对话ID

        // 更新UI
        this.updateAgentSelection(agent.id);
        this.updateChatHeader(agent);
        this.clearMessages();
        this.showWelcomeMessage(agent);
    }

    /**
     * 更新智能体选择状态
     */
    updateAgentSelection(agentId) {
        // 移除所有active状态
        this.agentList.querySelectorAll('.agent-item').forEach(item => {
            item.classList.remove('active');
        });

        // 添加当前选中的active状态
        const selectedItem = this.agentList.querySelector(`[data-agent-id="${agentId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }
    }

    /**
     * 更新聊天头部
     */
    updateChatHeader(agent) {
        this.currentAgentName.innerHTML = `
            <i class="fas fa-robot me-2"></i>
            ${agent.name}
        `;
    }

    /**
     * 显示欢迎消息
     */
    showWelcomeMessage(agent) {
        this.addMessage('assistant', `你好！我是${agent.name}。${agent.description || '很高兴为您服务！'}`);
    }

    /**
     * 发送消息
     */
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        if (!this.currentAgent) {
            this.addMessage('system', '请先选择一个智能体');
            return;
        }

        // 清空输入框并禁用发送按钮
        this.messageInput.value = '';
        this.adjustTextareaHeight();
        this.setSendingState(true);

        try {
            // 添加用户消息
            this.addMessage('user', message);

            // 获取或创建对话
            if (!this.conversationId) {
                await this.createConversation();
            }

            // 发送消息给AI
            await this.sendToAI(message);

        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            this.addMessage('system', `发送失败: ${error.message}`);
        } finally {
            this.setSendingState(false);
        }
    }

    /**
     * 创建对话
     */
    async createConversation() {
        console.log('🔨 创建对话...');
        
        const result = await conversationService.createConversation({
            agent_id: this.currentAgent.id,
            title: `与${this.currentAgent.name}的对话`
        });

        if (result.success) {
            this.conversationId = result.conversation.id;
            console.log('✅ 对话创建成功:', this.conversationId);
        } else {
            throw new Error(result.error);
        }
    }

    /**
     * 发送消息给AI
     */
    async sendToAI(message) {
        // 显示AI思考状态
        const thinkingId = this.addMessage('assistant', '<i class="fas fa-spinner fa-spin me-2"></i>AI正在思考中...', true);

        try {
            const result = await conversationService.sendMessage(this.conversationId, {
                content: message,
                type: 'text'
            });

            // 移除思考消息
            this.removeMessage(thinkingId);

            if (result.success) {
                this.addMessage('assistant', result.aiResponse.answer);
                console.log('✅ AI回复成功');
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            this.removeMessage(thinkingId);
            throw error;
        }
    }

    /**
     * 添加消息
     */
    addMessage(type, content, isTemporary = false) {
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const messageElement = document.createElement('div');
        messageElement.id = messageId;
        messageElement.className = `message message-${type}`;
        
        if (isTemporary) {
            messageElement.dataset.temporary = 'true';
        }

        const timestamp = new Date().toLocaleTimeString();
        let senderName = '';
        let icon = '';

        switch (type) {
            case 'user':
                senderName = '我';
                icon = 'fas fa-user';
                break;
            case 'assistant':
                senderName = this.currentAgent ? this.currentAgent.name : 'AI助手';
                icon = 'fas fa-robot';
                break;
            case 'system':
                senderName = '系统';
                icon = 'fas fa-info-circle';
                break;
        }

        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span><i class="${icon} me-1"></i>${senderName}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-content">${content}</div>
            </div>
        `;

        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();

        return messageId;
    }

    /**
     * 移除消息
     */
    removeMessage(messageId) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.remove();
        }
    }

    /**
     * 清空消息
     */
    clearMessages() {
        this.chatMessages.innerHTML = '';
    }

    /**
     * 滚动到底部
     */
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    /**
     * 设置发送状态
     */
    setSendingState(isSending) {
        this.sendButton.disabled = isSending;
        if (isSending) {
            this.sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        } else {
            this.sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }

    /**
     * 调整输入框高度
     */
    adjustTextareaHeight() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    /**
     * 显示无智能体消息
     */
    showNoAgentsMessage() {
        this.agentList.innerHTML = `
            <div class="text-center text-muted p-3">
                <i class="fas fa-robot fa-2x mb-2"></i>
                <p>暂无可用智能体</p>
            </div>
        `;
    }

    /**
     * 显示错误消息
     */
    showErrorMessage(message) {
        this.agentList.innerHTML = `
            <div class="text-center text-danger p-3">
                <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                <p>${message}</p>
                <button class="btn btn-sm btn-outline-danger" onclick="location.reload()">
                    <i class="fas fa-redo me-1"></i>重试
                </button>
            </div>
        `;
    }
}
            }

            // 创建消息容器
            this.messageContainer = document.createElement('div');
            this.messageContainer.id = 'chatMessages';
            this.messageContainer.className = 'chat-messages h-100 p-3 overflow-auto';
            this.messageContainer.style.cssText = 'max-height: 60vh; background: #f8f9fa; border-radius: 8px;';
            
            // 清空chatArea并添加消息容器
            this.chatArea.innerHTML = '';
            this.chatArea.appendChild(this.messageContainer);

            console.log('✅ DOM元素查找和创建成功');

            // 绑定事件
            this.bindEvents();

            // 设置初始界面状态
            this.setupInitialState();

            // 加载可用智能体列表
            await this.loadAvailableAgents();

            this.isInitialized = true;
            console.log('✅ 简化版聊天控制器初始化完成');

        } catch (error) {
            console.error('❌ 聊天控制器初始化失败:', error);
            this.showError('聊天系统初始化失败: ' + error.message);
            throw error;
        }
    }

    bindEvents() {
        // 发送按钮点击事件
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // 回车键发送消息
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 输入框字符计数
        this.userInput.addEventListener('input', () => {
            this.updateCharCount();
        });

        // 代理选择事件
        const agentButtons = document.querySelectorAll('.agent-button');
        agentButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.selectAgent(e.target.dataset.agent);
            });
        });

        console.log('✅ 事件绑定完成');
    }

    setupInitialState() {
        // 显示欢迎消息
        this.addMessage('system', '欢迎使用DifyChat v2.0！请选择一个AI代理开始对话。');
        
        // 设置默认字符计数
        this.updateCharCount();
        
        // 设置连接状态
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.innerHTML = '<i class="fas fa-circle text-success"></i> 系统就绪';
        }

        console.log('✅ 初始状态设置完成');
    }

    /**
     * 加载可用智能体列表 - 使用简化服务
     */
    async loadAvailableAgents() {
        try {
            console.log('🔄 正在加载可用智能体...');
            
            // 首先检查API是否可访问
            const healthCheck = await this.agentService.checkHealth();
            if (!healthCheck) {
                console.warn('⚠️ API服务不可访问，使用备用数据');
                this.loadFallbackAgents();
                return;
            }
            
            console.log('✅ API健康检查通过，获取智能体列表...');
            
            // 获取智能体列表
            const result = await this.agentService.getAgents({
                status: 'active',
                limit: '50'
            });

            if (result.success && result.agents && result.agents.length > 0) {
                this.availableAgents = result.agents;
                console.log('✅ 智能体加载成功:', this.availableAgents.length + '个智能体');
                
                // 显示智能体详情
                this.availableAgents.forEach((agent, index) => {
                    console.log(`🤖 智能体 ${index + 1}: ${agent.name} (${agent.type}) - ${agent.description || '无描述'}`);
                });
                
                // 更新UI中的智能体选择器
                this.updateAgentSelector();
            } else {
                console.warn('⚠️ 智能体获取失败或无数据:', result.error);
                this.loadFallbackAgents();
            }
        } catch (error) {
            console.error('❌ 加载智能体失败:', error);
            
            // 不显示错误提示给用户，直接使用备用数据
            console.log('🔧 自动降级到备用智能体数据');
            this.loadFallbackAgents();
        }
    }

    /**
     * 加载备用智能体数据（当API失败时）
     */
    loadFallbackAgents() {
        console.log('🔧 使用备用智能体数据');
        this.availableAgents = [
            {
                id: 'fallback_chat',
                name: '智能助手',
                description: '通用智能助手，可以帮助解答各种问题',
                type: 'chatbot',
                avatar: null
            },
            {
                id: 'fallback_code',
                name: '代码助手',
                description: '专业的编程助手，帮助解决编程问题',
                type: 'chatbot',
                avatar: null
            },
            {
                id: 'fallback_translate',
                name: '翻译助手',
                description: '多语言翻译助手',
                type: 'chatbot',
                avatar: null
            },
            {
                id: 'fallback_write',
                name: '写作助手',
                description: '文章写作和编辑助手',
                type: 'chatbot',
                avatar: null
            }
        ];
        
        this.updateAgentSelector();
    }

    /**
     * 更新智能体选择器UI
     */
    updateAgentSelector() {
        try {
            const agentButtons = document.querySelectorAll('.agent-button');
            
            if (agentButtons.length === 0) {
                console.warn('⚠️ 未找到智能体按钮元素');
                return;
            }

            // 清除现有事件监听器并重新绑定
            agentButtons.forEach((button, index) => {
                const agent = this.availableAgents[index];
                if (agent) {
                    // 更新按钮数据和显示
                    button.dataset.agent = agent.id;
                    button.dataset.agentType = agent.type;
                    
                    // 更新按钮内容
                    const textElement = button.querySelector('.agent-text, span');
                    if (textElement) {
                        textElement.textContent = agent.name;
                    } else {
                        button.textContent = agent.name;
                    }
                    
                    // 添加提示信息
                    button.title = agent.description || agent.name;
                    
                    // 移除旧的事件监听器并添加新的
                    button.replaceWith(button.cloneNode(true));
                } else {
                    // 如果没有对应的智能体，隐藏按钮
                    button.style.display = 'none';
                }
            });

            // 重新绑定事件监听器
            this.bindAgentEvents();
            
            console.log('✅ 智能体选择器更新完成');
        } catch (error) {
            console.error('❌ 更新智能体选择器失败:', error);
        }
    }

    /**
     * 绑定智能体相关事件
     */
    bindAgentEvents() {
        const agentButtons = document.querySelectorAll('.agent-button');
        agentButtons.forEach(button => {
            if (button.style.display !== 'none') {
                button.addEventListener('click', (e) => {
                    const agentId = e.target.closest('.agent-button').dataset.agent;
                    if (agentId) {
                        this.selectAgent(agentId);
                    }
                });
            }
        });
    }

    selectAgent(agentId) {
        // 查找选中的智能体
        const selectedAgent = this.availableAgents.find(agent => agent.id === agentId);
        
        if (!selectedAgent) {
            console.error('❌ 未找到智能体:', agentId);
            this.showError('选择的智能体不存在');
            return;
        }

        this.currentAgent = selectedAgent;
        
        // 更新UI状态
        document.querySelectorAll('.agent-button').forEach(btn => {
            btn.classList.remove('active', 'btn-primary');
            btn.classList.add('btn-outline-primary');
        });

        const selectedButton = document.querySelector(`[data-agent="${agentId}"]`);
        if (selectedButton) {
            selectedButton.classList.remove('btn-outline-primary');
            selectedButton.classList.add('active', 'btn-primary');
        }

        // 显示选择消息
        this.addMessage('system', `已选择 ${selectedAgent.name}，现在可以开始对话了！\n描述：${selectedAgent.description}`);
        
        // 聚焦到输入框
        this.userInput.focus();

        console.log('✅ 选择智能体:', {
            id: selectedAgent.id,
            name: selectedAgent.name,
            type: selectedAgent.type
        });
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        
        if (!message) {
            this.showError('请输入消息内容');
            return;
        }

        if (!this.currentAgent) {
            this.showError('请先选择一个AI代理');
            return;
        }

        try {
            // 显示用户消息
            this.addMessage('user', message);
            
            // 清空输入框
            this.userInput.value = '';
            this.updateCharCount();

            // 显示加载状态
            const loadingId = this.addMessage('assistant', '正在思考...', true);

            // 模拟API调用（暂时）
            setTimeout(() => {
                this.removeMessage(loadingId);
                this.addMessage('assistant', `[${this.currentAgent.name}] 收到您的消息: "${message}"\n\n这是一个示例回复。实际的API集成正在开发中...\n\n智能体类型: ${this.currentAgent.type}\n智能体ID: ${this.currentAgent.id}`);
            }, 1500);

        } catch (error) {
            console.error('发送消息失败:', error);
            this.showError('发送消息失败: ' + error.message);
        }
    }

    addMessage(type, content, isLoading = false) {
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `message ${type}-message mb-3`;
        
        let iconClass = '';
        let senderName = '';
        
        switch (type) {
            case 'user':
                iconClass = 'fas fa-user';
                senderName = '用户';
                break;
            case 'assistant':
                iconClass = 'fas fa-robot';
                senderName = 'AI助手';
                break;
            case 'system':
                iconClass = 'fas fa-info-circle';
                senderName = '系统';
                break;
        }

        messageDiv.innerHTML = `
            <div class="d-flex">
                <div class="flex-shrink-0 me-3">
                    <div class="avatar ${type}-avatar">
                        <i class="${iconClass}"></i>
                    </div>
                </div>
                <div class="flex-grow-1">
                    <div class="message-header d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold">${senderName}</span>
                        <small class="text-muted">${new Date().toLocaleTimeString()}</small>
                    </div>
                    <div class="message-content">
                        ${isLoading ? '<i class="fas fa-spinner fa-spin me-2"></i>' : ''}
                        ${content.replace(/\n/g, '<br>')}
                    </div>
                </div>
            </div>
        `;

        this.messageContainer.appendChild(messageDiv);
        
        // 滚动到底部
        this.scrollToBottom();
        
        return messageId;
    }

    removeMessage(messageId) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.remove();
        }
    }

    updateCharCount() {
        const count = this.userInput.value.length;
        const charCountElement = document.getElementById('charCount');
        if (charCountElement) {
            charCountElement.textContent = count;
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        }, 100);
    }

    showError(message) {
        // 创建错误提示
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        alertDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);

        // 3秒后自动移除
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 3000);
    }

    // 标签切换功能
    switchTab(tabName) {
        // 移除所有活动状态
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        // 激活当前标签按钮
        const currentButton = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
        if (currentButton) {
            currentButton.classList.add('active');
        }
        
        // 显示对应内容
        const targetTab = document.getElementById(tabName + 'Tab');
        if (targetTab) {
            targetTab.style.display = 'block';
        }
        
        console.log('标签切换到:', tabName);
    }
}

// 导出全局函数供HTML调用
window.switchTab = function(tabName) {
    if (window.chatController && window.chatController.switchTab) {
        window.chatController.switchTab(tabName);
    }
};
