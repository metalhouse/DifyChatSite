/**
 * 简化的错误处理工具
 * 专注于基本的错误处理和认证错误重定向
 */

class ErrorHandler {
    constructor() {
        console.log('🔧 简化错误处理器已初始化');
    }

    // 基础错误处理
    handleError(error, context = '未知操作') {
        console.error(`❌ ${context} 错误:`, error);
        
        // 简单的错误显示
        if (typeof error === 'string') {
            this.showError(error);
        } else if (error.message) {
            this.showError(error.message);
        } else {
            this.showError('操作失败，请重试');
        }
    }

    // 显示错误消息
    showError(message) {
        console.log('📢 显示错误:', message);
        
        // 简单的警告框显示
        alert(`错误: ${message}`);
    }

    // 基础的API错误处理
    handleApiError(error) {
        console.log('🔍 API错误处理:', error);
        
        if (error.response && error.response.status === 401) {
            console.log('🔐 401错误 - 跳转到登录页面');
            
            // 清理认证信息
            localStorage.removeItem('dify_access_token');
            localStorage.removeItem('dify_refresh_token');
            localStorage.removeItem('userInfo');
            localStorage.removeItem('currentUser');
            
            // 跳转到登录页面
            if (!window.location.pathname.includes('login.html')) {
                const returnUrl = encodeURIComponent(window.location.href);
                window.location.href = `./login.html?return=${returnUrl}`;
            }
        } else {
            // 其他API错误的基本处理
            const message = error.response?.data?.message || error.message || '网络请求失败';
            this.showError(message);
        }
    }
}

// 创建全局实例
const errorHandler = new ErrorHandler();

// 挂载到全局对象上，供其他模块使用
window.ErrorHandler = ErrorHandler;
window.errorHandler = errorHandler;
