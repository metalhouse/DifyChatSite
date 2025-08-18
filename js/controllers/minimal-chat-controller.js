/**
 * 极简版聊天控制器
 * 专注于基本功能和简单的token过期处理
 */

import { simpleAgentService } from '../services/simple-agent-service.js';
import { conversationService } from '../services/conversation-service.js';

export class MinimalChatController {
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
        
        console.log('🤖 极简版聊天控制器已初始化');
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // 获取DOM元素
            this.agentList = document.getElementById('agentList');
            this.chatMessages = document.getElementById('chatMessages');
            this.messageInput = document.getElementById('messageInput');
            this.sendButton = document.getElementById('sendButton');
            this.currentAgentName = document.getElementById('currentAgentName');

            // 绑定事件
            this.bindEvents();

            // 初始化智能体列表
            await this.loadAgents();

            this.isInitialized = true;
            console.log('✅ 控制器初始化完成');
        } catch (error) {
            console.error('❌ 控制器初始化失败:', error);
        }
    }

    bindEvents() {
        // 发送按钮点击事件
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        // 输入框回车事件
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }

    async loadAgents() {
        try {
            console.log('📡 加载智能体列表...');
            const agents = await simpleAgentService.getAgents();
            
            if (agents && agents.length > 0) {
                this.availableAgents = agents;
                this.displayAgents(agents);
                
                // 自动选择第一个智能体
                await this.selectAgent(agents[0]);
            } else {
                this.showMessage('system', '未找到可用的智能体');
            }
        } catch (error) {
            console.error('❌ 加载智能体失败:', error);
            this.showMessage('system', '加载智能体失败: ' + error.message);
        }
    }

    displayAgents(agents) {
        if (!this.agentList) return;

        this.agentList.innerHTML = '';
        
        agents.forEach(agent => {
            const agentElement = document.createElement('div');
            agentElement.className = 'agent-item';
            agentElement.innerHTML = `
                <div class="agent-name">${agent.name}</div>
                <div class="agent-description">${agent.description || '暂无描述'}</div>
            `;
            
            agentElement.addEventListener('click', () => {
                this.selectAgent(agent);
            });
            
            this.agentList.appendChild(agentElement);
        });
    }

    async selectAgent(agent) {
        if (!agent) return;

        // 移除之前的选中状态
        const previousSelected = this.agentList.querySelector('.agent-item.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        // 设置新的选中状态
        const agentElements = this.agentList.querySelectorAll('.agent-item');
        const selectedIndex = this.availableAgents.findIndex(a => a.id === agent.id);
        if (selectedIndex >= 0 && agentElements[selectedIndex]) {
            agentElements[selectedIndex].classList.add('selected');
        }

        this.currentAgent = agent;
        this.conversationId = null; // 重置对话ID
        
        // 更新显示
        if (this.currentAgentName) {
            this.currentAgentName.textContent = agent.name;
        }
        
        // 清空聊天记录
        if (this.chatMessages) {
            this.chatMessages.innerHTML = '';
        }
        
        // 显示欢迎消息
        this.showMessage('system', `已选择智能体: ${agent.name}`);
        
        console.log('✅ 智能体选择成功:', agent.name);
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        if (!this.currentAgent) {
            this.showMessage('system', '请先选择一个智能体');
            return;
        }

        // 清空输入框并禁用发送按钮
        this.messageInput.value = '';
        this.setSendingState(true);

        try {
            // 显示用户消息
            this.showMessage('user', message);

            // 获取或创建对话
            if (!this.conversationId) {
                await this.createConversation();
            }

            // 显示AI思考中
            this.showMessage('assistant', '🤔 AI正在思考中...');

            // 发送消息
            const result = await conversationService.sendMessage(this.conversationId, {
                content: message,
                type: 'text'
            });

            // 移除思考消息
            this.removeLastMessage();

            if (result.success) {
                const aiResponse = result.aiResponse.content || result.aiResponse.answer || '抱歉，我没有回复内容';
                this.showMessage('assistant', aiResponse);
                console.log('✅ 消息发送成功');
            } else {
                throw new Error(result.error || '发送失败');
            }

        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            
            // 移除思考消息
            this.removeLastMessage();
            
            // 最简单的token过期检测
            if (error && error.message && error.message.includes('令牌已过期')) {
                console.log('🔐 检测到token过期，跳转到登录页面');
                
                this.showMessage('system', '登录已过期，即将跳转到登录页面...');
                
                // 清除本地存储
                localStorage.clear();
                
                // 1.5秒后跳转
                setTimeout(() => {
                    window.location.href = './login.html';
                }, 1500);
                
                return;
            }
            
            // 其他错误正常显示
            this.showMessage('system', `发送失败: ${error.message}`);
        } finally {
            this.setSendingState(false);
        }
    }

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
            throw new Error(result ? result.error : '创建对话失败');
        }
    }

    showMessage(type, content) {
        if (!this.chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message message-${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        let senderName = '';
        let icon = '';

        switch (type) {
            case 'user':
                senderName = '我';
                icon = '👤';
                break;
            case 'assistant':
                senderName = this.currentAgent?.name || 'AI助手';
                icon = '🤖';
                break;
            case 'system':
                senderName = '系统';
                icon = 'ℹ️';
                break;
        }

        messageElement.innerHTML = `
            <div class="message-header">
                <span class="sender-icon">${icon}</span>
                <span class="sender-name">${senderName}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${this.formatContent(content)}</div>
        `;

        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    removeLastMessage() {
        if (!this.chatMessages) return;
        
        const messages = this.chatMessages.querySelectorAll('.message');
        if (messages.length > 0) {
            messages[messages.length - 1].remove();
        }
    }

    formatContent(content) {
        // 基本的内容格式化
        return content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    setSendingState(isSending) {
        if (this.sendButton) {
            this.sendButton.disabled = isSending;
            this.sendButton.textContent = isSending ? '发送中...' : '发送';
        }
        
        if (this.messageInput) {
            this.messageInput.disabled = isSending;
        }
    }

    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
}

// 创建控制器实例
const minimalChatController = new MinimalChatController();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    minimalChatController.initialize();
});

// 导出控制器实例供其他地方使用
export default minimalChatController;
