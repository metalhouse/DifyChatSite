/**
 * 简化版聊天控制器 - 重构版
 * 适配新的chat.html页面结构
 */

import { simpleAgentService } from '../services/simple-agent-service.js';
import { conversationService } from '../services/conversation-service.js';
import apiClient from '../api/api-client.js';

export class SimpleChatController {
    constructor() {
        this.isInitialized = false;
        this.currentAgent = null;
        this.conversationId = null;
        this.availableAgents = [];
        
        // 存储消息的多个版本
        this.messageVersions = new Map(); // messageId -> [version1, version2, ...]
        this.currentVersions = new Map(); // messageId -> currentVersionIndex
        this.messageRelations = new Map(); // aiMessageId -> userMessageId
        
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
            
            // 检查是否为令牌过期错误
            if (this.isTokenExpiredError(error)) {
                this.handleTokenExpired();
                return;
            }
            
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
            const userMessageId = this.addMessage('user', message);

            // 获取或创建对话
            if (!this.conversationId) {
                await this.createConversation();
            }

            // 发送消息给AI，传递用户消息ID
            await this.sendToAI(message, userMessageId);

        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            console.log('🔍 错误对象详情:', {
                error: error,
                message: error?.message,
                type: typeof error,
                hasMessage: !!error?.message,
                messageContent: error?.message
            });
            
            // 最简单直接的方式：检测到"令牌已过期"立即跳转
            if (error && error.message && error.message.includes('令牌已过期')) {
                console.log('🔐 ✅ 检测到令牌已过期，立即跳转到登录页面');
                
                // 清除认证信息
                localStorage.removeItem('dify_access_token');
                localStorage.removeItem('dify_refresh_token');
                localStorage.removeItem('userInfo');
                localStorage.removeItem('currentUser');
                console.log('🧹 localStorage已清理');
                
                // 显示跳转提示
                this.addMessage('system', '登录已过期，即将跳转到登录页面...');
                
                // 1.5秒后跳转
                setTimeout(() => {
                    const returnUrl = encodeURIComponent(window.location.href);
                    console.log('🚀 执行跳转到登录页面:', `./login.html?return=${returnUrl}`);
                    window.location.href = `./login.html?return=${returnUrl}`;
                }, 1500);
                
                return;
            } else {
                console.log('❌ 不是令牌过期错误，继续正常处理');
            }
            
            // 其他错误正常显示
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

        if (result && result.success) {
            this.conversationId = result.conversation.id;
            console.log('✅ 对话创建成功:', this.conversationId);
        } else {
            const errorMsg = result ? result.error : '创建对话失败';
            throw new Error(errorMsg);
        }
    }

    /**
     * 发送消息给AI（流式模式）
     */
    async sendToAI(message, userMessageId = null) {
        // 显示AI思考状态
        const thinkingId = this.addMessage('assistant', '<i class="fas fa-spinner fa-spin me-2"></i><span class="thinking-text">AI正在思考中</span>', true);
        
        // 准备流式回复消息容器
        let streamingMessageId = null;

        try {
            const result = await conversationService.sendMessage(this.conversationId, {
                content: message,
                type: 'text'
            }, (chunk, fullContent) => {
                // 流式回调：实时更新AI回复
                if (!streamingMessageId) {
                    // 首次回调：移除思考消息，创建AI回复消息
                    this.removeMessage(thinkingId);
                    streamingMessageId = this.addMessage('assistant', fullContent);
                    
                    // 为这个消息准备版本数据（第一个版本将在流式完成后设置）
                    this.messageVersions.set(streamingMessageId, []);
                    this.currentVersions.set(streamingMessageId, 0);
                    
                    // 记录AI消息和用户消息的关系
                    if (userMessageId) {
                        this.messageRelations.set(streamingMessageId, userMessageId);
                    }
                } else {
                    // 后续回调：更新现有消息内容
                    this.updateMessage(streamingMessageId, fullContent);
                }
            });

            // 确保移除思考消息（如果还存在）
            this.removeMessage(thinkingId);

            if (result.success) {
                const finalContent = result.aiResponse.content || result.aiResponse.answer;
                
                // 如果没有创建流式消息（可能AI回复很快），创建最终消息
                if (!streamingMessageId) {
                    streamingMessageId = this.addMessage('assistant', finalContent, false, result.aiResponse.usage);
                    // 为这个消息准备版本数据
                    this.messageVersions.set(streamingMessageId, []);
                    this.currentVersions.set(streamingMessageId, 0);
                    // 记录AI消息和用户消息的关系
                    if (userMessageId) {
                        this.messageRelations.set(streamingMessageId, userMessageId);
                    }
                } else {
                    // 确保最终内容正确
                    this.updateMessage(streamingMessageId, finalContent);
                    // 添加token使用量信息到已存在的消息
                    if (result.aiResponse.usage) {
                        this.addTokenUsage(streamingMessageId, result.aiResponse.usage);
                    }
                }
                
                // 设置第一个版本
                if (this.messageVersions.has(streamingMessageId)) {
                    const versions = this.messageVersions.get(streamingMessageId);
                    versions[0] = finalContent;
                }
                
                console.log('✅ AI流式回复成功');
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            this.removeMessage(thinkingId);
            if (streamingMessageId) {
                this.removeMessage(streamingMessageId);
            }
            
            // 检查是否是认证错误
            if (this.isTokenExpiredError(error)) {
                console.log('🔐 发送AI消息时检测到认证错误');
                // 重新抛出让上层的sendMessage方法处理
                throw error;
            }
            
            throw error;
        }
    }

    /**
     * 添加消息
     */
    addMessage(type, content, isTemporary = false, usage = null) {
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

        // 生成Token使用量信息
        let tokenUsageHtml = '';
        if (type === 'assistant' && usage && !isTemporary) {
            tokenUsageHtml = `
                <div class="token-usage">
                    <span class="token-usage-item">
                        <span class="label">输入:</span>
                        <span class="value">${usage.prompt_tokens || 0}</span>
                    </span>
                    <span class="token-usage-item">
                        <span class="label">输出:</span>
                        <span class="value">${usage.completion_tokens || 0}</span>
                    </span>
                    <span class="token-usage-item">
                        <span class="label">总计:</span>
                        <span class="value">${usage.total_tokens || 0}</span>
                    </span>
                    ${usage.latency ? `
                    <span class="token-usage-item">
                        <span class="label">耗时:</span>
                        <span class="value">${parseFloat(usage.latency).toFixed(2)}s</span>
                    </span>
                    ` : ''}
                </div>
            `;
        }

        // 生成操作按钮
        let actionButtons = '';
        if (type === 'user' && !isTemporary) {
            actionButtons = `
                <div class="message-actions">
                    <button class="message-action-btn" onclick="copyMessage(this)" title="复制" data-content="${content.replace(/"/g, '&quot;')}">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="message-action-btn" onclick="editMessage(this)" title="编辑" data-content="${content.replace(/"/g, '&quot;')}">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            `;
        } else if (type === 'assistant' && !isTemporary) {
            // 初始化版本数据
            if (!this.messageVersions.has(messageId)) {
                this.messageVersions.set(messageId, [content]);
                this.currentVersions.set(messageId, 0);
            }
            
            actionButtons = `
                <div class="message-actions">
                    <div class="version-navigation" style="display: none;">
                        <button class="version-btn" onclick="previousVersion('${messageId}')" title="上一个版本">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span class="version-info">1/1</span>
                        <button class="version-btn" onclick="nextVersion('${messageId}')" title="下一个版本">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                    <button class="message-action-btn" onclick="copyMessage(this)" title="复制" data-content="${content.replace(/"/g, '&quot;')}">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="message-action-btn" onclick="regenerateMessage(this)" title="重新生成">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            `;
        }

        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span><i class="${icon} me-1"></i>${senderName}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-content">${content}</div>
                ${tokenUsageHtml}
                ${actionButtons}
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
     * 添加系统消息
     */
    addSystemMessage(content) {
        return this.addMessage('system', content, false, null);
    }

    /**
     * 添加Token使用量信息到已存在的消息
     */
    addTokenUsage(messageId, usage) {
        const messageElement = document.getElementById(messageId);
        if (messageElement && usage) {
            const messageBubble = messageElement.querySelector('.message-bubble');
            if (messageBubble) {
                // 先移除已存在的token usage信息（如果有）
                const existingUsage = messageBubble.querySelector('.token-usage');
                if (existingUsage) {
                    existingUsage.remove();
                }
                
                const tokenUsageHtml = `
                    <div class="token-usage">
                        <span class="token-usage-item">
                            <span class="label">输入:</span>
                            <span class="value">${usage.prompt_tokens || 0}</span>
                        </span>
                        <span class="token-usage-item">
                            <span class="label">输出:</span>
                            <span class="value">${usage.completion_tokens || 0}</span>
                        </span>
                        <span class="token-usage-item">
                            <span class="label">总计:</span>
                            <span class="value">${usage.total_tokens || 0}</span>
                        </span>
                        ${usage.latency ? `
                        <span class="token-usage-item">
                            <span class="label">耗时:</span>
                            <span class="value">${parseFloat(usage.latency).toFixed(2)}s</span>
                        </span>
                        ` : ''}
                    </div>
                `;
                
                // 在操作按钮之前插入token使用量信息
                const messageActions = messageBubble.querySelector('.message-actions');
                if (messageActions) {
                    messageActions.insertAdjacentHTML('beforebegin', tokenUsageHtml);
                } else {
                    messageBubble.insertAdjacentHTML('beforeend', tokenUsageHtml);
                }
            }
        }
    }

    /**
     * 更新消息内容（用于流式回复）
     */
    updateMessage(messageId, newContent) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            const contentElement = messageElement.querySelector('.message-content');
            if (contentElement) {
                // 将换行符转换为<br>标签以正确显示换行
                const formattedContent = newContent.replace(/\n/g, '<br>');
                contentElement.innerHTML = formattedContent;
                this.scrollToBottom();
            }
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
    
    /**
     * 添加新的AI回复版本
     */
    addMessageVersion(messageId, newContent) {
        if (this.messageVersions.has(messageId)) {
            const versions = this.messageVersions.get(messageId);
            versions.push(newContent);
            this.currentVersions.set(messageId, versions.length - 1);
            
            // 更新消息内容和导航
            this.updateMessageContent(messageId, newContent);
            this.updateVersionNavigation(messageId);
        }
    }

    /**
     * 更新版本导航显示
     */
    updateVersionNavigation(messageId) {
        const messageElement = document.getElementById(messageId);
        if (!messageElement) return;

        const versions = this.messageVersions.get(messageId);
        const currentIndex = this.currentVersions.get(messageId);
        
        if (versions && versions.length > 1) {
            const versionNav = messageElement.querySelector('.version-navigation');
            const versionInfo = messageElement.querySelector('.version-info');
            
            if (versionNav && versionInfo) {
                versionNav.style.display = 'flex';
                versionInfo.textContent = `${currentIndex + 1}/${versions.length}`;
                
                // 更新按钮状态
                const prevBtn = versionNav.querySelector('.version-btn:first-child');
                const nextBtn = versionNav.querySelector('.version-btn:last-child');
                
                if (prevBtn) prevBtn.disabled = currentIndex === 0;
                if (nextBtn) nextBtn.disabled = currentIndex === versions.length - 1;
            }
        }
    }

    /**
     * 切换到指定版本
     */
    switchToVersion(messageId, versionIndex) {
        const versions = this.messageVersions.get(messageId);
        if (!versions || versionIndex < 0 || versionIndex >= versions.length) return;

        this.currentVersions.set(messageId, versionIndex);
        this.updateMessageContent(messageId, versions[versionIndex]);
        this.updateVersionNavigation(messageId);
    }

    /**
     * 更新消息内容
     */
    updateMessageContent(messageId, content) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            const contentElement = messageElement.querySelector('.message-content');
            if (contentElement) {
                contentElement.innerHTML = content;
                
                // 更新复制按钮的内容
                const copyBtn = messageElement.querySelector('[onclick*="copyMessage"]');
                if (copyBtn) {
                    copyBtn.setAttribute('data-content', content.replace(/"/g, '&quot;'));
                }
            }
        }
    }

    /**
     * 重新生成AI回复（简化版本：直接重新发送用户消息）
     */
    async regenerateAIResponse(existingMessageId) {
        if (!this.currentAgent) {
            throw new Error('没有选择智能体');
        }

        // 找到对应的用户消息
        const userMessageId = this.messageRelations.get(existingMessageId);
        if (!userMessageId) {
            throw new Error('找不到对应的用户消息');
        }

        // 获取用户消息内容
        const userMessageElement = document.getElementById(userMessageId);
        if (!userMessageElement) {
            throw new Error('用户消息元素不存在');
        }

        const messageContent = userMessageElement.querySelector('.message-content');
        if (!messageContent) {
            throw new Error('找不到用户消息内容');
        }

        const userMessage = messageContent.textContent || messageContent.innerText;
        if (!userMessage.trim()) {
            throw new Error('用户消息内容为空');
        }

        try {
            // 获取或创建对话
            if (!this.conversationId) {
                await this.createConversation();
            }

            // 先添加一个空版本到现有消息
            const versions = this.messageVersions.get(existingMessageId);
            if (versions) {
                versions.push(''); // 添加空的新版本
                const newVersionIndex = versions.length - 1;
                this.currentVersions.set(existingMessageId, newVersionIndex);
                this.updateVersionNavigation(existingMessageId);
                this.updateMessageContent(existingMessageId, '<i class="fas fa-spinner fa-spin me-2"></i><span class="thinking-text">重新生成中</span>');
            }

            // 直接调用现有的sendToAI方法，就像正常发送消息一样
            // 但是不添加新的用户消息，只是重新生成AI回复
            const result = await conversationService.sendMessage(this.conversationId, {
                content: userMessage.trim(),
                type: 'text'
            }, (chunk, fullContent) => {
                // 流式回调：更新当前版本内容
                const versions = this.messageVersions.get(existingMessageId);
                if (versions) {
                    const currentIndex = this.currentVersions.get(existingMessageId);
                    versions[currentIndex] = fullContent;
                    this.updateMessageContent(existingMessageId, fullContent);
                }
            });

            if (result.success) {
                const finalContent = result.aiResponse.content || result.aiResponse.answer || '回复生成完成';
                
                // 更新最终版本内容
                const versions = this.messageVersions.get(existingMessageId);
                if (versions) {
                    const currentIndex = this.currentVersions.get(existingMessageId);
                    versions[currentIndex] = finalContent;
                    this.updateMessageContent(existingMessageId, finalContent);
                    this.updateVersionNavigation(existingMessageId);
                    
                    // 添加token使用量信息
                    if (result.aiResponse.usage) {
                        this.addTokenUsage(existingMessageId, result.aiResponse.usage);
                    }
                }
                
                console.log('✅ AI回复重新生成成功');
                return { success: true, content: finalContent };
            } else {
                throw new Error(result.error || 'AI回复生成失败');
            }

        } catch (error) {
            console.error('❌ 重新生成AI回复失败:', error);
            
            // 如果失败，移除刚添加的空版本，恢复到原来的版本
            const versions = this.messageVersions.get(existingMessageId);
            if (versions && versions.length > 1) {
                versions.pop();
                const prevIndex = versions.length - 1;
                this.currentVersions.set(existingMessageId, prevIndex);
                this.updateMessageContent(existingMessageId, versions[prevIndex]);
                this.updateVersionNavigation(existingMessageId);
            }
            
            throw error;
        }
    }

    /**
     * 切换会话
     */
    async switchConversation(conversationId) {
        try {
            console.log('🔄 切换到会话:', conversationId);
            
            if (!conversationId) {
                throw new Error('会话ID不能为空');
            }
            
            // 清空当前消息
            this.clearMessages();
            
            // 设置新的会话ID
            this.conversationId = conversationId;
            
            // 加载会话历史消息
            await this.loadConversationHistory(conversationId);
            
            console.log('✅ 会话切换成功');
            
        } catch (error) {
            console.error('❌ 切换会话失败:', error);
            this.addSystemMessage(`切换会话失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 加载会话历史消息
     */
    async loadConversationHistory(conversationId) {
        try {
            console.log('📜 加载会话历史消息:', conversationId);
            
            // 直接使用 apiClient 获取历史消息
            const response = await apiClient.get(`/conversations/${conversationId}/messages`, {
                page: 1,
                limit: 100, // 加载最新的100条消息
                order: 'desc' // 按时间倒序，最新的在前面
            });
            
            console.log('📦 消息历史API响应:', response);
            
            if (response.success && response.data && response.data.messages) {
                const messages = response.data.messages;
                console.log('📨 获取到历史消息数量:', messages.length);
                
                // 由于API返回的是倒序（最新在前），我们需要反转数组以便正确显示（最早在上，最新在下）
                const sortedMessages = messages.reverse();
                
                // 渲染历史消息
                this.renderHistoryMessages(sortedMessages);
                
                // 添加系统消息表示切换成功
                this.addSystemMessage(`已加载最新 ${messages.length} 条历史消息`);
                
            } else {
                console.warn('⚠️ 未获取到历史消息，响应:', response);
                this.addSystemMessage(`已切换到会话 ${conversationId.substring(0, 8)}`);
            }
            
        } catch (error) {
            console.error('❌ 加载会话历史失败:', error);
            this.addSystemMessage('加载会话历史失败，请刷新页面重试');
            throw error;
        }
    }
    
    /**
     * 渲染历史消息
     */
    renderHistoryMessages(messages) {
        console.log('🎨 渲染历史消息:', messages.length, '条');
        
        messages.forEach((message, index) => {
            try {
                // 确定消息类型
                let messageType = 'system';
                if (message.role === 'user') {
                    messageType = 'user';
                } else if (message.role === 'assistant') {
                    messageType = 'assistant';
                }
                
                // 处理使用量信息
                let usage = null;
                if (message.metadata && message.metadata.usage) {
                    usage = message.metadata.usage;
                }
                
                // 添加消息到界面
                const messageId = this.addMessage(messageType, message.content, false, usage);
                
                // 设置消息的实际ID和时间戳
                const messageElement = document.getElementById(messageId);
                if (messageElement) {
                    messageElement.dataset.originalId = message.id;
                    messageElement.dataset.createdAt = message.created_at;
                    
                    // 更新时间显示
                    const timeElement = messageElement.querySelector('.message-time');
                    if (timeElement) {
                        const messageTime = new Date(message.created_at);
                        timeElement.textContent = messageTime.toLocaleString('zh-CN');
                    }
                }
                
                console.log(`📝 已渲染消息 ${index + 1}/${messages.length}:`, {
                    id: message.id,
                    type: messageType,
                    content: message.content.substring(0, 50) + '...',
                    timestamp: message.created_at
                });
                
            } catch (error) {
                console.error('❌ 渲染单条消息失败:', error, message);
            }
        });
        
        // 滚动到底部
        this.scrollToBottom();
        
        console.log('✅ 历史消息渲染完成');
    }

    /**
     * 检查是否为令牌过期错误
     */
    isTokenExpiredError(error) {
        if (!error || !error.message) return false;
        
        const message = error.message.toLowerCase();
        return message.includes('令牌已过期') || 
               message.includes('token') && message.includes('过期') ||
               message.includes('expired') ||
               message.includes('unauthorized') ||
               message.includes('401');
    }
    
    /**
     * 处理令牌过期
     */
    handleTokenExpired() {
        console.warn('🔐 检测到令牌过期，准备跳转到登录页');
        
        // 清理本地存储
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem('dify_access_token');
            window.localStorage.removeItem('user_info');
        }
        
        // 显示提示并跳转
        alert('登录已过期，即将跳转到登录页面');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }
}
