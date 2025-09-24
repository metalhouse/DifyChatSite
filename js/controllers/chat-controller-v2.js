/**
 * 简化版聊天控制器 - 重构版
 * 适配新的chat.html页面结构
 */

import { simpleAgentService } from '../services/simple-agent-service.js';
import { conversationService } from '../services/conversation-service.js';
import apiClient from '../api/api-client.js';

export class SimpleChatController {
    /**
     * 格式化消息内容，处理换行和Markdown
     */
    static formatMessageContent(content) {
        if (!content) return '';
        
        return content
            // 处理换行符
            .replace(/\n/g, '<br>')
            // 处理加粗 **text**
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // 处理斜体 *text*
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // 处理行内代码 `code`
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // 处理标题 ### title
            .replace(/^### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^## (.*$)/gim, '<h3>$1</h3>')
            .replace(/^# (.*$)/gim, '<h2>$1</h2>');
    }

    constructor() {
        this.isInitialized = false;
        this.currentAgent = null;
        this.conversationId = null;
        this.availableAgents = [];
        
        // 存储消息的多个版本
        this.messageVersions = new Map(); // messageId -> [version1, version2, ...]
        this.currentVersions = new Map(); // messageId -> currentVersionIndex
        this.messageRelations = new Map(); // aiMessageId -> userMessageId
        
        // 初始化图片优化服务
        this.imageOptimizer = null;
        
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

            // 初始化图片优化服务
            if (window.imageOptimizer) {
                this.imageOptimizer = window.imageOptimizer;
                console.log('✅ [私聊] 图片优化服务已连接');
            } else {
                console.warn('⚠️ [私聊] 图片优化服务未找到，将使用默认图片加载');
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
                
                // 尝试恢复上次选择的智能体
                const lastAgentId = localStorage.getItem('lastSelectedAgent');
                console.log('🔍 检查localStorage中的lastSelectedAgent:', lastAgentId);
                let selectedAgent = null;
                
                if (lastAgentId) {
                    // 查找上次选择的智能体
                    selectedAgent = result.agents.find(agent => agent.id === lastAgentId);
                    if (selectedAgent) {
                        console.log('🔄 恢复上次选择的智能体:', selectedAgent.name);
                    } else {
                        console.log('⚠️ 上次选择的智能体不存在，使用默认智能体。可用智能体:', result.agents.map(a => a.id));
                    }
                } else {
                    console.log('📝 首次使用，将自动选择第一个智能体');
                }
                
                // 选择智能体（优先使用上次选择的，否则使用第一个）
                this.selectAgent(selectedAgent || result.agents[0]);
                
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
        // 从localStorage恢复排序
        this.restoreAgentOrder();
        
        const agentsHtml = this.availableAgents.map((agent, index) => `
            <div class="agent-item" data-agent-id="${agent.id}" draggable="true" data-index="${index}">
                <div class="drag-handle">
                    <i class="fas fa-grip-vertical"></i>
                </div>
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

        // 绑定点击事件（支持移动端触摸）
        this.agentList.querySelectorAll('.agent-item').forEach((item, index) => {
            const agentId = item.dataset.agentId;
            const agent = this.availableAgents.find(a => a.id === agentId);
            
            if (agent) {
                // 创建全局处理函数
                const globalFunctionName = `selectAgent_${agentId.replace(/[^a-zA-Z0-9]/g, '_')}`;
                window[globalFunctionName] = () => {
                    console.log('📱 全局函数调用 - 选择智能体:', agent.name);
                    console.log('📱 当前屏幕宽度:', window.innerWidth);
                    
                    // 调用选择智能体
                    this.selectAgent.call(this, agent);
                    
                    // 移动端关闭侧边栏
                    if (window.innerWidth <= 768) {
                        console.log('📱 移动端 - 关闭侧边栏');
                        const sidebar = document.getElementById('sidebar');
                        const overlay = document.querySelector('.sidebar-overlay');
                        
                        if (sidebar) {
                            sidebar.classList.remove('show');
                            console.log('📱 侧边栏已关闭');
                        }
                        
                        if (overlay) {
                            overlay.style.display = 'none';
                            overlay.classList.remove('show');
                            console.log('📱 遮罩已隐藏');
                        }
                    }
                };
                
                // 添加onclick属性
                item.setAttribute('onclick', `${globalFunctionName}()`);
                
                // 添加触摸视觉反馈
                item.addEventListener('touchstart', (e) => {
                    item.style.transform = 'scale(0.98)';
                    item.style.transition = 'transform 0.1s ease';
                }, { passive: true });
                
                item.addEventListener('touchend', (e) => {
                    setTimeout(() => {
                        item.style.transform = '';
                    }, 150);
                }, { passive: true });
                
                item.addEventListener('touchcancel', () => {
                    item.style.transform = '';
                });
            }
        });
        
        // 添加拖动事件
        this.addDragAndDropEvents();
    }

    /**
     * 添加拖拽事件
     */
    addDragAndDropEvents() {
        // 移动端禁用拖动功能
        if (window.innerWidth <= 768) {
            console.log('📱 移动端环境，禁用拖动功能');
            return;
        }
        
        const agentItems = this.agentList.querySelectorAll('.agent-item');
        
        agentItems.forEach((item) => {
            // 拖动开始
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', item.outerHTML);
                e.dataTransfer.setData('text/plain', item.dataset.agentId);
                console.log('🎯 开始拖动智能体:', item.dataset.agentId);
            });

            // 拖动结束
            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
                console.log('✅ 拖动结束');
            });

            // 拖动进入
            item.addEventListener('dragenter', (e) => {
                e.preventDefault();
                item.classList.add('drag-over');
            });

            // 拖动悬停
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            // 拖动离开
            item.addEventListener('dragleave', (e) => {
                item.classList.remove('drag-over');
            });

            // 放置
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                
                const draggedAgentId = e.dataTransfer.getData('text/plain');
                const targetAgentId = item.dataset.agentId;
                
                if (draggedAgentId !== targetAgentId) {
                    this.reorderAgents(draggedAgentId, targetAgentId);
                }
            });
        });
    }

    /**
     * 重新排序智能体
     */
    reorderAgents(draggedAgentId, targetAgentId) {
        console.log('🔄 重新排序智能体:', draggedAgentId, '->', targetAgentId);
        
        const draggedIndex = this.availableAgents.findIndex(agent => agent.id === draggedAgentId);
        const targetIndex = this.availableAgents.findIndex(agent => agent.id === targetAgentId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            // 移动元素
            const [draggedAgent] = this.availableAgents.splice(draggedIndex, 1);
            this.availableAgents.splice(targetIndex, 0, draggedAgent);
            
            // 保存新的排序
            this.saveAgentOrder();
            
            // 重新渲染
            this.renderAgents();
            
            console.log('✅ 智能体排序已更新');
        }
    }

    /**
     * 保存智能体排序
     */
    saveAgentOrder() {
        const order = this.availableAgents.map(agent => agent.id);
        localStorage.setItem('agentOrder', JSON.stringify(order));
        console.log('💾 已保存智能体排序:', order);
    }

    /**
     * 恢复智能体排序
     */
    restoreAgentOrder() {
        const savedOrder = localStorage.getItem('agentOrder');
        if (savedOrder) {
            try {
                const order = JSON.parse(savedOrder);
                console.log('🔄 恢复智能体排序:', order);
                
                // 按照保存的顺序重新排列
                const orderedAgents = [];
                order.forEach(agentId => {
                    const agent = this.availableAgents.find(a => a.id === agentId);
                    if (agent) {
                        orderedAgents.push(agent);
                    }
                });
                
                // 添加任何新的智能体到末尾
                this.availableAgents.forEach(agent => {
                    if (!orderedAgents.find(a => a.id === agent.id)) {
                        orderedAgents.push(agent);
                    }
                });
                
                this.availableAgents = orderedAgents;
            } catch (error) {
                console.error('恢复智能体排序失败:', error);
            }
        }
    }

    /**
     * 选择智能体
     */
    selectAgent(agent) {
        console.log('🎯 选择智能体:', agent.name);

        // 更新当前智能体
        this.currentAgent = agent;
        this.conversationId = null; // 重置对话ID

        // 保存选择到localStorage
        localStorage.setItem('lastSelectedAgent', agent.id);
        console.log('💾 已保存智能体选择:', agent.id);

        // 更新UI
        this.updateAgentSelection(agent.id);
        this.updateChatHeader(agent);
        this.clearMessages();
        this.showWelcomeMessage(agent);

        // 移动端自动关闭侧边栏（由触摸事件直接处理，这里不再重复）
        // 保留这个逻辑作为备用方案
        /*
        if (window.innerWidth <= 768) {
            console.log('📱 检测到移动端，准备关闭侧边栏');
            // ... 关闭逻辑已移到触摸事件处理中
        }
        */
    }

    /**
     * 关闭侧边栏（移动端）
     */
    closeSidebar() {
        console.log('📱 尝试关闭侧边栏...');
        console.log('📱 当前屏幕宽度:', window.innerWidth);
        
        const sidebar = document.getElementById('sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        console.log('📱 侧边栏元素:', sidebar);
        console.log('📱 遮罩元素:', overlay);
        
        if (sidebar) {
            console.log('📱 侧边栏类名:', sidebar.className);
            console.log('📱 是否有show类:', sidebar.classList.contains('show'));
            
            if (sidebar.classList.contains('show')) {
                console.log('📱 移动端自动关闭侧边栏');
                sidebar.classList.remove('show');
                if (overlay) {
                    overlay.style.display = 'none';
                    overlay.classList.remove('show');
                }
            } else {
                console.log('📱 侧边栏没有show类，但强制关闭');
                sidebar.classList.remove('show');
                if (overlay) {
                    overlay.style.display = 'none';
                    overlay.classList.remove('show');
                }
            }
        } else {
            console.log('❌ 未找到侧边栏元素');
        }
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
            
            // 检测token过期，弹出登录模态框
            if (error && error.message && (
                error.message.includes('令牌已过期') || 
                error.message.includes('登录已过期') ||
                error.message.includes('未授权') ||
                (error.response && error.response.status === 401)
            )) {
                console.log('🔐 检测到令牌已过期，显示登录超时模态框');
                
                // 显示登录超时模态框
                if (typeof window.showLoginTimeoutModal === 'function') {
                    window.showLoginTimeoutModal();
                } else {
                    // 兜底方案：直接跳转
                    const returnUrl = encodeURIComponent(window.location.href);
                    window.location.href = `./login.html?return=${returnUrl}`;
                }
                
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
        // 确保原始内容用于复制和编辑，避免HTML转义问题
        const escapedContent = content.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        
        if (type === 'user' && !isTemporary) {
            actionButtons = `
                <div class="message-actions">
                    <button class="message-action-btn" onclick="copyMessage(this)" title="复制" data-content="${escapedContent}">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="message-action-btn" onclick="editMessage(this)" title="编辑" data-content="${escapedContent}">
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
                    <button class="message-action-btn" onclick="copyMessage(this)" title="复制" data-content="${escapedContent}">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="message-action-btn" onclick="regenerateMessage(this)" title="重新生成">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            `;
        }

        // 格式化消息内容
        const formattedContent = SimpleChatController.formatMessageContent(content);

        messageElement.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span><i class="${icon} me-1"></i>${senderName}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-content">${formattedContent}</div>
                ${tokenUsageHtml}
                ${actionButtons}
            </div>
        `;

        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();

        return messageId;
    }

    /**
     * 添加带附件的消息（支持图片优化）
     */
    addMessageWithAttachments(type, content, attachments = [], isTemporary = false, usage = null) {
        const messageId = this.addMessage(type, content, isTemporary, usage);
        
        // 如果有附件，处理附件显示
        if (attachments && attachments.length > 0) {
            const messageElement = document.getElementById(messageId);
            const messageContent = messageElement.querySelector('.message-content');
            
            // 创建附件容器
            const attachmentsContainer = document.createElement('div');
            attachmentsContainer.className = 'message-attachments';
            
            // 处理每个附件
            attachments.forEach(attachment => {
                this.renderAttachment(attachment, attachmentsContainer);
            });
            
            // 将附件容器添加到消息内容后面
            messageContent.appendChild(attachmentsContainer);
        }
        
        return messageId;
    }

    /**
     * 渲染附件（特别处理图片）
     */
    renderAttachment(attachment, container) {
        // 判断是否为图片
        const isImage = this.isImageFile(attachment);
        
        if (isImage) {
            // 使用图片优化服务渲染图片
            this.renderImageAttachment(attachment, container);
        } else {
            // 处理其他类型的附件
            this.renderGenericAttachment(attachment, container);
        }
    }

    /**
     * 渲染图片附件（使用图片优化服务）
     */
    renderImageAttachment(attachment, container) {
        const fileName = attachment.name || attachment.filename || '图片';
        const fileId = attachment.id || attachment.fileId;
        
        if (this.imageOptimizer && fileId) {
            console.log('🖼️ [私聊] 使用图片优化服务渲染图片:', fileId);
            const imageContainer = this.imageOptimizer.progressiveLoadImage(fileId, fileName);
            container.appendChild(imageContainer);
        } else {
            // 降级方案：直接显示图片
            console.log('⚠️ [私聊] 图片优化服务不可用，使用降级方案');
            const img = document.createElement('img');
            img.className = 'message-image img-fluid';
            img.alt = fileName;
            img.src = attachment.url || attachment.src || '';
            img.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px; cursor: pointer;';
            img.onclick = () => {
                window.open(img.src, '_blank');
            };
            container.appendChild(img);
        }
    }

    /**
     * 渲染通用附件
     */
    renderGenericAttachment(attachment, container) {
        const fileName = attachment.name || attachment.filename || '文件';
        const fileUrl = attachment.url || attachment.src || '#';
        
        const attachmentElement = document.createElement('div');
        attachmentElement.className = 'message-attachment';
        attachmentElement.innerHTML = `
            <div class="attachment-info">
                <i class="fas fa-file me-2"></i>
                <a href="${fileUrl}" target="_blank" class="attachment-link">${fileName}</a>
            </div>
        `;
        
        container.appendChild(attachmentElement);
    }

    /**
     * 判断是否为图片文件
     */
    isImageFile(attachment) {
        const fileName = attachment.name || attachment.filename || '';
        const mimeType = attachment.mimeType || attachment.type || '';
        
        // 通过MIME类型判断
        if (mimeType && mimeType.startsWith('image/')) {
            return true;
        }
        
        // 通过文件扩展名判断
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
        return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
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
        if (!this.chatMessages) return;
        
        const forceScrollToBottom = () => {
            // 计算真正的最大滚动位置
            const maxScrollTop = this.chatMessages.scrollHeight - this.chatMessages.clientHeight;
            this.chatMessages.scrollTop = maxScrollTop;
            
            // 如果仍然没有到底部，使用更直接的方法
            if (this.chatMessages.scrollTop < maxScrollTop) {
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }
            
            // 使用最后一个消息的 scrollIntoView 作为最终保障
            const lastMessage = this.chatMessages.lastElementChild;
            if (lastMessage && !lastMessage.classList.contains('text-center')) {
                lastMessage.scrollIntoView({ 
                    behavior: 'instant', 
                    block: 'end',
                    inline: 'nearest' 
                });
            }
            
            console.log('🔄 [聊天滚动调试]', {
                scrollHeight: this.chatMessages.scrollHeight,
                clientHeight: this.chatMessages.clientHeight,
                scrollTop: this.chatMessages.scrollTop,
                maxScrollTop: maxScrollTop,
                isAtBottom: this.chatMessages.scrollTop >= maxScrollTop - 5
            });
        };
        
        // 立即滚动
        forceScrollToBottom();
        
        // 使用双重 requestAnimationFrame 确保DOM完全更新
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                forceScrollToBottom();
                
                // 短延时后再次检查和修正
                setTimeout(() => {
                    const maxScrollTop = this.chatMessages.scrollHeight - this.chatMessages.clientHeight;
                    const isAtBottom = this.chatMessages.scrollTop >= maxScrollTop - 10;
                    if (!isAtBottom) {
                        console.log('🔄 [聊天滚动修正] 未完全到达底部，再次滚动');
                        forceScrollToBottom();
                    }
                }, 150);
                
                // 最终保险滚动
                setTimeout(() => {
                    forceScrollToBottom();
                }, 500);
            });
        });
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
                
                // 检查是否有附件
                const attachments = message.attachments || [];
                
                // 添加消息到界面（支持附件）
                const messageId = attachments.length > 0 
                    ? this.addMessageWithAttachments(messageType, message.content, attachments, false, usage)
                    : this.addMessage(messageType, message.content, false, usage);
                
                console.log('📎 [私聊历史] 消息附件:', {
                    messageId,
                    attachmentCount: attachments.length,
                    attachments: attachments.map(att => ({
                        id: att.id,
                        name: att.name,
                        type: att.type || att.mimeType,
                        isImage: this.isImageFile(att)
                    }))
                });
                
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
        
        // 滚动到底部 - 增加延时确保DOM更新完成
        setTimeout(() => {
            this.scrollToBottom();
        }, 200);
        
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
