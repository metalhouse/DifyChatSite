/**
 * 加载状态管理工具 - 统一的Loading状态管理
 * 基于用户体验最佳实践
 * 提供按钮Loading、页面Loading、组件Loading等功能
 */

// 导入依赖
import { ENV_CONFIG } from '../../config/env.js';

/**
 * 加载状态管理器类
 */
class LoadingManager {
    constructor() {
        this.activeLoadings = new Map(); // 活跃的加载状态
        this.loadingStack = []; // 加载状态栈
        this.defaultMessages = {
            default: '加载中...',
            login: '登录中...',
            register: '注册中...',
            sending: '发送中...',
            saving: '保存中...',
            loading: '加载中...',
            connecting: '连接中...',
            processing: '处理中...',
            uploading: '上传中...',
            downloading: '下载中...'
        };
        
        this._createLoadingStyles();
        
        if (ENV_CONFIG.isDebug()) {
            console.log('⏳ LoadingManager初始化');
        }
    }

    // ========================================
    // 🔄 全局页面Loading
    // ========================================

    /**
     * 显示全局页面Loading
     * @param {string} [message] 加载消息
     * @param {Object} [options] 选项
     */
    showPageLoading(message = '加载中...', options = {}) {
        const {
            backdrop = true,
            spinner = true,
            progress = false,
            timeout = 30000
        } = options;

        // 移除现有的页面Loading
        this.hidePageLoading();

        // 创建Loading元素
        const loadingElement = this._createPageLoadingElement(message, {
            backdrop,
            spinner,
            progress
        });

        // 添加到页面
        document.body.appendChild(loadingElement);
        
        // 设置超时
        if (timeout > 0) {
            setTimeout(() => {
                this.hidePageLoading();
            }, timeout);
        }

        // 记录状态
        this.activeLoadings.set('page', {
            element: loadingElement,
            startTime: Date.now(),
            message
        });

        if (ENV_CONFIG.isDebug()) {
            console.log('🌍 显示页面Loading:', message);
        }
    }

    /**
     * 隐藏全局页面Loading
     */
    hidePageLoading() {
        const loading = this.activeLoadings.get('page');
        if (loading && loading.element) {
            this._removeElement(loading.element);
            this.activeLoadings.delete('page');
            
            if (ENV_CONFIG.isDebug()) {
                const duration = Date.now() - loading.startTime;
                console.log('🌍 隐藏页面Loading，耗时:', duration + 'ms');
            }
        }
    }

    /**
     * 更新页面Loading消息
     * @param {string} message 新消息
     */
    updatePageLoadingMessage(message) {
        const loading = this.activeLoadings.get('page');
        if (loading && loading.element) {
            const messageElement = loading.element.querySelector('.loading-message');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
    }

    // ========================================
    // 🎯 按钮Loading状态
    // ========================================

    /**
     * 设置按钮Loading状态
     * @param {HTMLElement|string} button 按钮元素或选择器
     * @param {boolean} [loading=true] 是否显示Loading
     * @param {string} [message] Loading消息
     */
    setButtonLoading(button, loading = true, message = null) {
        const buttonElement = typeof button === 'string' ? 
            document.querySelector(button) : button;
            
        if (!buttonElement) {
            console.warn('⚠️ 按钮元素不存在');
            return;
        }

        const buttonId = buttonElement.id || 
            `btn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (loading) {
            // 保存原始状态
            const originalState = {
                disabled: buttonElement.disabled,
                innerHTML: buttonElement.innerHTML,
                classList: Array.from(buttonElement.classList)
            };

            this.activeLoadings.set(`button_${buttonId}`, {
                element: buttonElement,
                originalState,
                startTime: Date.now()
            });

            // 设置Loading状态
            buttonElement.disabled = true;
            buttonElement.classList.add('loading');
            
            const loadingMessage = message || this.defaultMessages.default;
            buttonElement.innerHTML = `
                <span class="loading-spinner"></span>
                <span class="loading-text">${loadingMessage}</span>
            `;

            if (ENV_CONFIG.isDebug()) {
                console.log('🔘 设置按钮Loading:', buttonId);
            }
        } else {
            // 恢复原始状态
            const loading = this.activeLoadings.get(`button_${buttonId}`);
            if (loading) {
                const { originalState } = loading;
                buttonElement.disabled = originalState.disabled;
                buttonElement.innerHTML = originalState.innerHTML;
                buttonElement.classList.remove('loading');
                
                this.activeLoadings.delete(`button_${buttonId}`);
                
                if (ENV_CONFIG.isDebug()) {
                    const duration = Date.now() - loading.startTime;
                    console.log('🔘 取消按钮Loading:', buttonId, duration + 'ms');
                }
            }
        }
    }

    /**
     * 自动管理按钮Loading（适用于异步操作）
     * @param {HTMLElement|string} button 按钮元素或选择器
     * @param {Function} asyncOperation 异步操作函数
     * @param {string} [message] Loading消息
     * @returns {Promise} 操作结果
     */
    async withButtonLoading(button, asyncOperation, message = null) {
        this.setButtonLoading(button, true, message);
        
        try {
            const result = await asyncOperation();
            return result;
        } catch (error) {
            throw error;
        } finally {
            this.setButtonLoading(button, false);
        }
    }

    // ========================================
    // 🧩 组件Loading状态
    // ========================================

    /**
     * 显示组件Loading
     * @param {HTMLElement|string} container 容器元素或选择器
     * @param {string} [message] Loading消息
     * @param {Object} [options] 选项
     */
    showComponentLoading(container, message = '加载中...', options = {}) {
        const containerElement = typeof container === 'string' ? 
            document.querySelector(container) : container;
            
        if (!containerElement) {
            console.warn('⚠️ 容器元素不存在');
            return;
        }

        const {
            overlay = true,
            spinner = true,
            size = 'medium'
        } = options;

        const containerId = containerElement.id || 
            containerElement.className || 
            `comp_${Date.now()}`;

        // 移除现有Loading
        this.hideComponentLoading(containerElement);

        // 创建Loading元素
        const loadingElement = this._createComponentLoadingElement(message, {
            overlay,
            spinner,
            size
        });

        // 设置容器样式
        const originalPosition = containerElement.style.position;
        if (!originalPosition || originalPosition === 'static') {
            containerElement.style.position = 'relative';
        }

        // 添加Loading
        containerElement.appendChild(loadingElement);

        // 记录状态
        this.activeLoadings.set(`component_${containerId}`, {
            element: loadingElement,
            container: containerElement,
            originalPosition,
            startTime: Date.now(),
            message
        });

        if (ENV_CONFIG.isDebug()) {
            console.log('🧩 显示组件Loading:', containerId);
        }
    }

    /**
     * 隐藏组件Loading
     * @param {HTMLElement|string} container 容器元素或选择器
     */
    hideComponentLoading(container) {
        const containerElement = typeof container === 'string' ? 
            document.querySelector(container) : container;
            
        if (!containerElement) return;

        const containerId = containerElement.id || 
            containerElement.className || 
            `comp_${Date.now()}`;

        const loading = this.activeLoadings.get(`component_${containerId}`);
        if (loading) {
            // 移除Loading元素
            if (loading.element && loading.element.parentNode) {
                loading.element.parentNode.removeChild(loading.element);
            }

            // 恢复容器样式
            if (loading.originalPosition) {
                containerElement.style.position = loading.originalPosition;
            } else {
                containerElement.style.position = '';
            }

            this.activeLoadings.delete(`component_${containerId}`);
            
            if (ENV_CONFIG.isDebug()) {
                const duration = Date.now() - loading.startTime;
                console.log('🧩 隐藏组件Loading:', containerId, duration + 'ms');
            }
        }
    }

    // ========================================
    // 📊 进度Loading
    // ========================================

    /**
     * 显示进度Loading
     * @param {string} [message] Loading消息
     * @param {number} [initialProgress=0] 初始进度
     * @returns {Object} 进度控制器
     */
    showProgressLoading(message = '处理中...', initialProgress = 0) {
        // 移除现有进度Loading
        this.hideProgressLoading();

        // 创建进度Loading元素
        const loadingElement = this._createProgressLoadingElement(message, initialProgress);

        // 添加到页面
        document.body.appendChild(loadingElement);

        // 进度控制器
        const controller = {
            updateProgress: (progress, newMessage = null) => {
                this._updateProgress(loadingElement, progress, newMessage);
            },
            close: () => {
                this.hideProgressLoading();
            }
        };

        // 记录状态
        this.activeLoadings.set('progress', {
            element: loadingElement,
            controller,
            startTime: Date.now()
        });

        if (ENV_CONFIG.isDebug()) {
            console.log('📊 显示进度Loading:', message);
        }

        return controller;
    }

    /**
     * 隐藏进度Loading
     */
    hideProgressLoading() {
        const loading = this.activeLoadings.get('progress');
        if (loading && loading.element) {
            this._removeElement(loading.element);
            this.activeLoadings.delete('progress');
            
            if (ENV_CONFIG.isDebug()) {
                const duration = Date.now() - loading.startTime;
                console.log('📊 隐藏进度Loading，耗时:', duration + 'ms');
            }
        }
    }

    // ========================================
    // 🛠️ 工具方法
    // ========================================

    /**
     * 获取Loading消息
     * @param {string} type 类型
     * @returns {string} Loading消息
     */
    getMessage(type) {
        return this.defaultMessages[type] || this.defaultMessages.default;
    }

    /**
     * 设置默认消息
     * @param {Object} messages 消息对象
     */
    setDefaultMessages(messages) {
        Object.assign(this.defaultMessages, messages);
    }

    /**
     * 清除所有Loading状态
     */
    clearAll() {
        this.activeLoadings.forEach((loading, key) => {
            if (loading.element && loading.element.parentNode) {
                loading.element.parentNode.removeChild(loading.element);
            }
            
            // 恢复按钮状态
            if (key.startsWith('button_') && loading.originalState) {
                const button = loading.element;
                button.disabled = loading.originalState.disabled;
                button.innerHTML = loading.originalState.innerHTML;
                button.classList.remove('loading');
            }
            
            // 恢复容器状态
            if (key.startsWith('component_') && loading.originalPosition !== undefined) {
                loading.container.style.position = loading.originalPosition || '';
            }
        });

        this.activeLoadings.clear();
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🧹 清除所有Loading状态');
        }
    }

    /**
     * 获取Loading状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        const status = {};
        this.activeLoadings.forEach((loading, key) => {
            status[key] = {
                startTime: loading.startTime,
                duration: Date.now() - loading.startTime,
                message: loading.message
            };
        });
        
        return {
            activeCount: this.activeLoadings.size,
            details: status
        };
    }

    // ========================================
    // 🎨 私有方法 - UI创建
    // ========================================

    /**
     * 创建页面Loading元素
     * @private
     */
    _createPageLoadingElement(message, options) {
        const element = document.createElement('div');
        element.className = 'page-loading-overlay';
        
        element.innerHTML = `
            <div class="page-loading-content">
                ${options.spinner ? '<div class="loading-spinner large"></div>' : ''}
                <div class="loading-message">${message}</div>
                ${options.progress ? '<div class="loading-progress"><div class="loading-progress-bar"></div></div>' : ''}
            </div>
        `;

        return element;
    }

    /**
     * 创建组件Loading元素
     * @private
     */
    _createComponentLoadingElement(message, options) {
        const element = document.createElement('div');
        element.className = `component-loading-overlay${options.overlay ? ' with-overlay' : ''}`;
        
        element.innerHTML = `
            <div class="component-loading-content ${options.size}">
                ${options.spinner ? `<div class="loading-spinner ${options.size}"></div>` : ''}
                <div class="loading-message">${message}</div>
            </div>
        `;

        return element;
    }

    /**
     * 创建进度Loading元素
     * @private
     */
    _createProgressLoadingElement(message, initialProgress) {
        const element = document.createElement('div');
        element.className = 'progress-loading-overlay';
        
        element.innerHTML = `
            <div class="progress-loading-content">
                <div class="loading-message">${message}</div>
                <div class="loading-progress">
                    <div class="loading-progress-bar" style="width: ${initialProgress}%"></div>
                </div>
                <div class="loading-percentage">${initialProgress}%</div>
            </div>
        `;

        return element;
    }

    /**
     * 更新进度
     * @private
     */
    _updateProgress(element, progress, message) {
        const progressBar = element.querySelector('.loading-progress-bar');
        const percentage = element.querySelector('.loading-percentage');
        const messageElement = element.querySelector('.loading-message');

        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }

        if (percentage) {
            percentage.textContent = `${Math.round(progress)}%`;
        }

        if (message && messageElement) {
            messageElement.textContent = message;
        }
    }

    /**
     * 移除元素（带动画）
     * @private
     */
    _removeElement(element) {
        if (element && element.parentNode) {
            element.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }, 300);
        }
    }

    /**
     * 创建Loading样式
     * @private
     */
    _createLoadingStyles() {
        if (document.getElementById('loading-manager-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'loading-manager-styles';
        style.textContent = `
            /* 页面Loading */
            .page-loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                animation: fadeIn 0.3s ease-out;
            }

            .page-loading-content {
                text-align: center;
                padding: 24px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            /* 组件Loading */
            .component-loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                animation: fadeIn 0.3s ease-out;
            }

            .component-loading-overlay.with-overlay {
                background: rgba(255, 255, 255, 0.8);
            }

            .component-loading-content {
                text-align: center;
                padding: 16px;
            }

            .component-loading-content.small {
                padding: 8px;
            }

            .component-loading-content.large {
                padding: 24px;
            }

            /* 进度Loading */
            .progress-loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                animation: fadeIn 0.3s ease-out;
            }

            .progress-loading-content {
                background: white;
                padding: 24px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                min-width: 300px;
                text-align: center;
            }

            /* Loading Spinner */
            .loading-spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 8px;
                vertical-align: middle;
            }

            .loading-spinner.small {
                width: 16px;
                height: 16px;
                border-width: 1px;
            }

            .loading-spinner.large {
                width: 32px;
                height: 32px;
                border-width: 3px;
                margin-right: 0;
                margin-bottom: 16px;
            }

            /* Loading Progress */
            .loading-progress {
                width: 100%;
                height: 8px;
                background: #f0f0f0;
                border-radius: 4px;
                overflow: hidden;
                margin: 12px 0;
            }

            .loading-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #3498db, #2ecc71);
                border-radius: 4px;
                transition: width 0.3s ease;
            }

            /* Loading Message */
            .loading-message {
                color: #666;
                font-size: 14px;
                margin: 8px 0;
            }

            .loading-percentage {
                color: #666;
                font-size: 12px;
                margin-top: 8px;
            }

            /* 按钮Loading */
            .loading .loading-text {
                margin-left: 4px;
            }

            /* 动画 */
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;

        document.head.appendChild(style);
    }
}

// 创建全局实例
const loadingManager = new LoadingManager();

// 导出加载管理器类和实例
window.LoadingManager = LoadingManager;
window.loadingManager = loadingManager;

export { LoadingManager };
export default loadingManager;
