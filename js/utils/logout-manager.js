/**
 * 通用退出登录工具
 * 可在任何页面使用的退出登录功能
 */

class LogoutManager {
    /**
     * 执行退出登录操作
     * @param {Object} options 配置选项
     * @param {boolean} options.confirm 是否显示确认对话框
     * @param {string} options.redirectUrl 退出后跳转的URL
     * @param {function} options.onSuccess 成功回调
     * @param {function} options.onError 错误回调
     */
    static async logout(options = {}) {
        const {
            confirm = true,
            redirectUrl = './login.html',
            onSuccess = null,
            onError = null
        } = options;

        try {
            // 显示确认对话框
            if (confirm && !window.confirm('确定要退出登录吗？')) {
                return false;
            }

            // 调用API退出登录
            if (window.difyApi) {
                await window.difyApi.logout();
            }

            // 清除本地存储的用户数据
            this.clearUserData();

            // 执行成功回调
            if (onSuccess) {
                onSuccess();
            } else {
                // 默认成功处理
                this.showToast('已成功退出登录', 'success');
            }

            // 延迟跳转
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 1500);

            return true;

        } catch (error) {
            console.error('退出登录失败:', error);
            
            // 执行错误回调
            if (onError) {
                onError(error);
            } else {
                // 默认错误处理
                this.showToast('退出登录失败，请重试', 'error');
            }

            return false;
        }
    }

    /**
     * 清除用户数据
     */
    static clearUserData() {
        // 清除认证相关的localStorage
        const keysToRemove = [
            'dify_access_token',
            'dify_refresh_token', 
            'dify_user_info',
            'dify_user_profile',
            'remember_me'
        ];

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });

        // 清除认证相关的sessionStorage
        const sessionKeysToRemove = [
            'dify_session_id',
            'dify_current_conversation'
        ];

        sessionKeysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
        });
    }

    /**
     * 检查登录状态
     * @returns {boolean} 是否已登录
     */
    static isLoggedIn() {
        const token = localStorage.getItem('dify_access_token');
        return !!token;
    }

    /**
     * 强制退出（无确认）
     * @param {string} redirectUrl 跳转URL
     */
    static forceLogout(redirectUrl = './login.html') {
        this.clearUserData();
        window.location.href = redirectUrl;
    }

    /**
     * 显示Toast提示
     * @param {string} message 消息内容
     * @param {string} type 类型 (success, error, warning, info)
     */
    static showToast(message, type = 'info') {
        // 如果页面有showToast函数，使用页面的
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }

        // 简单的alert回退
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 尝试使用Bootstrap Toast
        if (typeof bootstrap !== 'undefined') {
            this.createBootstrapToast(message, type);
        } else {
            // 回退到alert
            alert(message);
        }
    }

    /**
     * 创建Bootstrap Toast
     * @param {string} message 消息内容  
     * @param {string} type 类型
     */
    static createBootstrapToast(message, type) {
        // 确保有toast容器
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(container);
        }

        const toastId = 'toast-' + Date.now();
        const bgClass = {
            'success': 'bg-success',
            'error': 'bg-danger', 
            'warning': 'bg-warning',
            'info': 'bg-info'
        }[type] || 'bg-info';

        const iconClass = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle', 
            'info': 'fa-info-circle'
        }[type] || 'fa-info-circle';

        const toastHTML = `
            <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
                <div class="toast-body">
                    <i class="fas ${iconClass} me-2"></i>
                    ${message}
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', toastHTML);

        const toastElement = document.getElementById(toastId);
        const bsToast = new bootstrap.Toast(toastElement, { delay: 3000 });
        bsToast.show();

        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    /**
     * 绑定退出登录按钮事件
     * @param {string|Element} selector 按钮选择器或元素
     * @param {Object} options 配置选项
     */
    static bindLogoutButton(selector, options = {}) {
        const button = typeof selector === 'string' ? 
            document.querySelector(selector) : selector;
            
        if (button) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout(options);
            });
        }
    }

    /**
     * 自动绑定所有退出登录按钮
     * 自动查找具有特定类名或ID的退出按钮
     */
    static autoBindLogoutButtons() {
        // 常见的退出登录按钮选择器
        const selectors = [
            '#logoutBtn',
            '#user-logout', 
            '#nav-logout',
            '.logout-btn',
            '[data-action="logout"]'
        ];

        selectors.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(button => {
                this.bindLogoutButton(button);
            });
        });
    }
}

// 页面加载完成后自动绑定退出登录按钮
document.addEventListener('DOMContentLoaded', () => {
    LogoutManager.autoBindLogoutButtons();
});

// 全局导出
window.LogoutManager = LogoutManager;
