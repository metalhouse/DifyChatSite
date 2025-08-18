/**
 * 错误处理工具 - 统一的错误处理和用户友好提示
 * 基于DifyChatBack v2.0 API指南错误码规范
 * 提供API错误、网络错误、WebSocket错误的统一处理
 */

// 导入依赖
import { ENV_CONFIG } from '../../config/env.js';

/**
 * 错误码定义 - 基于API指南错误码规范
 */
const ERROR_CODES = {
    // 🔐 认证相关错误 (4000-4099)
    AUTH: {
        INVALID_CREDENTIALS: 4001,
        TOKEN_EXPIRED: 4002,
        TOKEN_INVALID: 4003,
        REFRESH_TOKEN_EXPIRED: 4004,
        USER_NOT_FOUND: 4005,
        USER_DISABLED: 4006,
        EMAIL_NOT_VERIFIED: 4007,
        LOGIN_REQUIRED: 4008,
        PERMISSION_DENIED: 4009,
        ACCOUNT_LOCKED: 4010
    },
    
    // 👤 用户相关错误 (4100-4199)
    USER: {
        USER_EXISTS: 4101,
        EMAIL_EXISTS: 4102,
        PHONE_EXISTS: 4103,
        INVALID_EMAIL_FORMAT: 4104,
        INVALID_PHONE_FORMAT: 4105,
        PASSWORD_TOO_WEAK: 4106,
        USERNAME_INVALID: 4107,
        VERIFICATION_CODE_INVALID: 4108,
        VERIFICATION_CODE_EXPIRED: 4109
    },
    
    // 💬 对话相关错误 (4200-4299)
    CONVERSATION: {
        CONVERSATION_NOT_FOUND: 4201,
        MESSAGE_TOO_LONG: 4202,
        AGENT_NOT_AVAILABLE: 4203,
        CONVERSATION_LIMIT_EXCEEDED: 4204,
        MESSAGE_RATE_LIMITED: 4205,
        INVALID_MESSAGE_TYPE: 4206
    },
    
    // 🏠 群聊相关错误 (4300-4399)
    ROOM: {
        ROOM_NOT_FOUND: 4301,
        ROOM_ACCESS_DENIED: 4302,
        ROOM_FULL: 4303,
        USER_NOT_IN_ROOM: 4304,
        AGENT_NOT_IN_ROOM: 4305,
        ROOM_NAME_EXISTS: 4306,
        INVALID_ROOM_CONFIG: 4307
    },
    
    // 🌐 网络相关错误 (5000-5099)
    NETWORK: {
        TIMEOUT: 5001,
        CONNECTION_FAILED: 5002,
        SERVER_UNAVAILABLE: 5003,
        RATE_LIMITED: 5004,
        BANDWIDTH_EXCEEDED: 5005
    },
    
    // 🔗 WebSocket相关错误 (5100-5199)
    WEBSOCKET: {
        CONNECTION_FAILED: 5101,
        AUTHENTICATION_FAILED: 5102,
        ROOM_JOIN_FAILED: 5103,
        MESSAGE_SEND_FAILED: 5104,
        PROTOCOL_ERROR: 5105,
        RECONNECTION_FAILED: 5106
    },
    
    // 🎭 客户端错误 (6000-6099)
    CLIENT: {
        VALIDATION_FAILED: 6001,
        STORAGE_FULL: 6002,
        BROWSER_NOT_SUPPORTED: 6003,
        FEATURE_NOT_AVAILABLE: 6004,
        ENCRYPTION_FAILED: 6005,
        DECRYPTION_FAILED: 6006
    }
};

/**
 * 用户友好错误消息
 */
const ERROR_MESSAGES = {
    // 认证相关
    [ERROR_CODES.AUTH.INVALID_CREDENTIALS]: '用户名或密码错误',
    [ERROR_CODES.AUTH.TOKEN_EXPIRED]: '登录已过期，请重新登录',
    [ERROR_CODES.AUTH.TOKEN_INVALID]: '登录状态异常，请重新登录',
    [ERROR_CODES.AUTH.REFRESH_TOKEN_EXPIRED]: '登录会话已过期，请重新登录',
    [ERROR_CODES.AUTH.USER_NOT_FOUND]: '用户不存在',
    [ERROR_CODES.AUTH.USER_DISABLED]: '用户账号已被禁用',
    [ERROR_CODES.AUTH.EMAIL_NOT_VERIFIED]: '邮箱未验证，请先验证邮箱',
    [ERROR_CODES.AUTH.LOGIN_REQUIRED]: '请先登录',
    [ERROR_CODES.AUTH.PERMISSION_DENIED]: '权限不足',
    [ERROR_CODES.AUTH.ACCOUNT_LOCKED]: '账号已被锁定，请联系管理员',

    // 用户相关
    [ERROR_CODES.USER.USER_EXISTS]: '用户名已存在',
    [ERROR_CODES.USER.EMAIL_EXISTS]: '邮箱已被注册',
    [ERROR_CODES.USER.PHONE_EXISTS]: '手机号已被注册',
    [ERROR_CODES.USER.INVALID_EMAIL_FORMAT]: '邮箱格式不正确',
    [ERROR_CODES.USER.INVALID_PHONE_FORMAT]: '手机号格式不正确',
    [ERROR_CODES.USER.PASSWORD_TOO_WEAK]: '密码强度不够',
    [ERROR_CODES.USER.USERNAME_INVALID]: '用户名格式不正确',
    [ERROR_CODES.USER.VERIFICATION_CODE_INVALID]: '验证码不正确',
    [ERROR_CODES.USER.VERIFICATION_CODE_EXPIRED]: '验证码已过期',

    // 对话相关
    [ERROR_CODES.CONVERSATION.CONVERSATION_NOT_FOUND]: '对话不存在',
    [ERROR_CODES.CONVERSATION.MESSAGE_TOO_LONG]: '消息内容过长',
    [ERROR_CODES.CONVERSATION.AGENT_NOT_AVAILABLE]: '智能体当前不可用',
    [ERROR_CODES.CONVERSATION.CONVERSATION_LIMIT_EXCEEDED]: '对话数量已达上限',
    [ERROR_CODES.CONVERSATION.MESSAGE_RATE_LIMITED]: '发送消息过于频繁，请稍后再试',
    [ERROR_CODES.CONVERSATION.INVALID_MESSAGE_TYPE]: '不支持的消息类型',

    // 群聊相关
    [ERROR_CODES.ROOM.ROOM_NOT_FOUND]: '群聊不存在',
    [ERROR_CODES.ROOM.ROOM_ACCESS_DENIED]: '无权访问此群聊',
    [ERROR_CODES.ROOM.ROOM_FULL]: '群聊人数已满',
    [ERROR_CODES.ROOM.USER_NOT_IN_ROOM]: '用户不在群聊中',
    [ERROR_CODES.ROOM.AGENT_NOT_IN_ROOM]: '智能体不在群聊中',
    [ERROR_CODES.ROOM.ROOM_NAME_EXISTS]: '群聊名称已存在',
    [ERROR_CODES.ROOM.INVALID_ROOM_CONFIG]: '群聊配置无效',

    // 网络相关
    [ERROR_CODES.NETWORK.TIMEOUT]: '请求超时，请检查网络连接',
    [ERROR_CODES.NETWORK.CONNECTION_FAILED]: '网络连接失败',
    [ERROR_CODES.NETWORK.SERVER_UNAVAILABLE]: '服务器暂时不可用',
    [ERROR_CODES.NETWORK.RATE_LIMITED]: '请求过于频繁，请稍后再试',
    [ERROR_CODES.NETWORK.BANDWIDTH_EXCEEDED]: '网络带宽不足',

    // WebSocket相关
    [ERROR_CODES.WEBSOCKET.CONNECTION_FAILED]: '实时连接失败',
    [ERROR_CODES.WEBSOCKET.AUTHENTICATION_FAILED]: '实时连接认证失败',
    [ERROR_CODES.WEBSOCKET.ROOM_JOIN_FAILED]: '加入群聊失败',
    [ERROR_CODES.WEBSOCKET.MESSAGE_SEND_FAILED]: '消息发送失败',
    [ERROR_CODES.WEBSOCKET.PROTOCOL_ERROR]: '通信协议错误',
    [ERROR_CODES.WEBSOCKET.RECONNECTION_FAILED]: '重新连接失败',

    // 客户端相关
    [ERROR_CODES.CLIENT.VALIDATION_FAILED]: '输入数据验证失败',
    [ERROR_CODES.CLIENT.STORAGE_FULL]: '本地存储空间不足',
    [ERROR_CODES.CLIENT.BROWSER_NOT_SUPPORTED]: '浏览器版本过低，请更新浏览器',
    [ERROR_CODES.CLIENT.FEATURE_NOT_AVAILABLE]: '功能暂不可用',
    [ERROR_CODES.CLIENT.ENCRYPTION_FAILED]: '加密失败',
    [ERROR_CODES.CLIENT.DECRYPTION_FAILED]: '解密失败',

    // 默认消息
    DEFAULT: '操作失败，请稍后重试',
    UNKNOWN: '未知错误，请联系技术支持'
};

/**
 * 错误处理器类
 */
class ErrorHandler {
    constructor() {
        this.errorQueue = []; // 错误队列
        this.retryStrategies = new Map(); // 重试策略
        this.globalErrorHandlers = new Set(); // 全局错误处理器
        
        // 设置全局错误监听
        this._setupGlobalErrorHandlers();
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🛡️ ErrorHandler初始化');
        }
    }

    // ========================================
    // 🔍 错误识别和分类
    // ========================================

    /**
     * 解析API错误
     * @param {Object} error 错误对象
     * @returns {Object} 解析后的错误信息
     */
    parseApiError(error) {
        try {
            // HTTP错误
            if (error.response) {
                const { status, data } = error.response;
                
                return {
                    type: 'api',
                    code: data?.code || status,
                    message: data?.message || ERROR_MESSAGES.DEFAULT,
                    details: data?.details || null,
                    status: status,
                    timestamp: Date.now()
                };
            }
            
            // 网络错误
            if (error.request) {
                return {
                    type: 'network',
                    code: ERROR_CODES.NETWORK.CONNECTION_FAILED,
                    message: ERROR_MESSAGES[ERROR_CODES.NETWORK.CONNECTION_FAILED],
                    details: error.message,
                    timestamp: Date.now()
                };
            }
            
            // 请求配置错误
            return {
                type: 'client',
                code: ERROR_CODES.CLIENT.VALIDATION_FAILED,
                message: error.message || ERROR_MESSAGES.DEFAULT,
                details: null,
                timestamp: Date.now()
            };
        } catch (parseError) {
            console.error('❌ 解析错误失败:', parseError);
            return this._createUnknownError(error);
        }
    }

    /**
     * 解析网络错误
     * @param {Object} error 错误对象
     * @returns {Object} 解析后的错误信息
     */
    parseNetworkError(error) {
        if (error.code === 'TIMEOUT') {
            return {
                type: 'network',
                code: ERROR_CODES.NETWORK.TIMEOUT,
                message: ERROR_MESSAGES[ERROR_CODES.NETWORK.TIMEOUT],
                details: error.message,
                timestamp: Date.now()
            };
        }

        return {
            type: 'network',
            code: ERROR_CODES.NETWORK.CONNECTION_FAILED,
            message: ERROR_MESSAGES[ERROR_CODES.NETWORK.CONNECTION_FAILED],
            details: error.message,
            timestamp: Date.now()
        };
    }

    /**
     * 解析WebSocket错误
     * @param {Object} error 错误对象
     * @returns {Object} 解析后的错误信息
     */
    parseSocketError(error) {
        const errorMap = {
            'connection_failed': ERROR_CODES.WEBSOCKET.CONNECTION_FAILED,
            'auth_failed': ERROR_CODES.WEBSOCKET.AUTHENTICATION_FAILED,
            'join_failed': ERROR_CODES.WEBSOCKET.ROOM_JOIN_FAILED,
            'send_failed': ERROR_CODES.WEBSOCKET.MESSAGE_SEND_FAILED,
            'protocol_error': ERROR_CODES.WEBSOCKET.PROTOCOL_ERROR,
            'reconnect_failed': ERROR_CODES.WEBSOCKET.RECONNECTION_FAILED
        };

        const code = errorMap[error.type] || ERROR_CODES.WEBSOCKET.CONNECTION_FAILED;
        
        return {
            type: 'websocket',
            code: code,
            message: ERROR_MESSAGES[code],
            details: error.message,
            timestamp: Date.now()
        };
    }

    // ========================================
    // 💊 错误处理策略
    // ========================================

    /**
     * 处理API错误
     * @param {Object} error 错误对象
     * @param {Object} options 处理选项
     * @returns {Object} 处理结果
     */
    handleApiError(error, options = {}) {
        const parsedError = this.parseApiError(error);
        
        if (ENV_CONFIG.isDebug()) {
            console.error('🔴 API错误:', parsedError);
        }

        // 特殊错误处理
        switch (parsedError.code) {
            case ERROR_CODES.AUTH.TOKEN_EXPIRED:
            case ERROR_CODES.AUTH.TOKEN_INVALID:
                return this._handleAuthError(parsedError, options);
                
            case ERROR_CODES.NETWORK.RATE_LIMITED:
                return this._handleRateLimitError(parsedError, options);
                
            default:
                return this._handleGenericError(parsedError, options);
        }
    }

    /**
     * 处理网络错误
     * @param {Object} error 错误对象
     * @param {Object} options 处理选项
     * @returns {Object} 处理结果
     */
    handleNetworkError(error, options = {}) {
        const parsedError = this.parseNetworkError(error);
        
        if (ENV_CONFIG.isDebug()) {
            console.error('🌐 网络错误:', parsedError);
        }

        return this._handleGenericError(parsedError, options);
    }

    /**
     * 处理WebSocket错误
     * @param {Object} error 错误对象
     * @param {Object} options 处理选项
     * @returns {Object} 处理结果
     */
    handleSocketError(error, options = {}) {
        const parsedError = this.parseSocketError(error);
        
        if (ENV_CONFIG.isDebug()) {
            console.error('🔗 WebSocket错误:', parsedError);
        }

        return this._handleGenericError(parsedError, options);
    }

    // ========================================
    // 🔄 重试机制
    // ========================================

    /**
     * 注册重试策略
     * @param {string} errorType 错误类型
     * @param {Function} strategy 重试策略函数
     */
    registerRetryStrategy(errorType, strategy) {
        this.retryStrategies.set(errorType, strategy);
    }

    /**
     * 执行重试
     * @param {Function} operation 操作函数
     * @param {Object} options 重试选项
     * @returns {Promise} 重试结果
     */
    async withRetry(operation, options = {}) {
        const {
            maxRetries = 3,
            backoffFactor = 2,
            initialDelay = 1000,
            maxDelay = 10000
        } = options;

        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries) {
                    break;
                }

                // 计算延迟时间
                const delay = Math.min(
                    initialDelay * Math.pow(backoffFactor, attempt),
                    maxDelay
                );

                if (ENV_CONFIG.isDebug()) {
                    console.log(`🔄 重试 ${attempt + 1}/${maxRetries}，${delay}ms后重试`);
                }

                await this._delay(delay);
            }
        }

        throw lastError;
    }

    // ========================================
    // 📱 用户界面错误提示
    // ========================================

    /**
     * 显示错误提示
     * @param {string|Object} error 错误信息
     * @param {Object} options 显示选项
     */
    showError(error, options = {}) {
        const errorInfo = typeof error === 'string' ? 
            { message: error } : 
            error;

        const {
            duration = 5000,
            type = 'error',
            position = 'top-right',
            showDetails = false,
            allowClose = true
        } = options;

        // 创建错误提示元素
        const errorElement = this._createErrorElement(errorInfo, {
            duration,
            type,
            position,
            showDetails,
            allowClose
        });

        // 添加到页面
        document.body.appendChild(errorElement);

        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                this._removeErrorElement(errorElement);
            }, duration);
        }

        if (ENV_CONFIG.isDebug()) {
            console.log('💬 显示错误提示:', errorInfo.message);
        }
    }

    /**
     * 显示成功提示
     * @param {string} message 成功消息
     * @param {Object} options 显示选项
     */
    showSuccess(message, options = {}) {
        this.showError({ message, type: 'success' }, {
            ...options,
            type: 'success',
            duration: options.duration || 3000
        });
    }

    /**
     * 显示警告提示
     * @param {string} message 警告消息
     * @param {Object} options 显示选项
     */
    showWarning(message, options = {}) {
        this.showError({ message, type: 'warning' }, {
            ...options,
            type: 'warning'
        });
    }

    /**
     * 显示信息提示
     * @param {string} message 信息消息
     * @param {Object} options 显示选项
     */
    showInfo(message, options = {}) {
        this.showError({ message, type: 'info' }, {
            ...options,
            type: 'info'
        });
    }

    // ========================================
    // 🛠️ 内部工具方法
    // ========================================

    /**
     * 设置全局错误监听器
     * @private
     */
    _setupGlobalErrorHandlers() {
        // 未捕获的Promise错误
        window.addEventListener('unhandledrejection', (event) => {
            this.handleApiError(event.reason, { global: true });
            if (ENV_CONFIG.isDebug()) {
                console.error('🔴 未捕获的Promise错误:', event.reason);
            }
        });

        // 全局JavaScript错误
        window.addEventListener('error', (event) => {
            const error = {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            };
            
            if (ENV_CONFIG.isDebug()) {
                console.error('🔴 全局JavaScript错误:', error);
            }
        });
    }

    /**
     * 处理认证错误 - 简化版：直接跳转登录页面
     * @private
     */
    _handleAuthError(error, options) {
        console.log('🔐 处理认证错误:', error);
        
        // 清除本地存储的认证信息
        localStorage.removeItem('dify_access_token');
        localStorage.removeItem('dify_refresh_token');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('currentUser');
        
        // 显示提示信息
        if (!options.silent) {
            this.showError(error.message || '登录已过期，即将跳转到登录页面');
        }

        // 跳转到登录页面
        if (!options.silent && typeof window !== 'undefined') {
            setTimeout(() => {
                // 记录当前页面，登录后可以返回
                const returnUrl = encodeURIComponent(window.location.href);
                window.location.href = `./login.html?return=${returnUrl}`;
            }, 1500);
        }

        return { handled: true, action: 'redirect_login' };
    }

    /**
     * 处理限流错误
     * @private
     */
    _handleRateLimitError(error, options) {
        const retryAfter = error.details?.retryAfter || 60;
        
        if (!options.silent) {
            this.showWarning(`请求过于频繁，请在${retryAfter}秒后重试`);
        }

        return { handled: true, action: 'rate_limited', retryAfter };
    }

    /**
     * 处理通用错误
     * @private
     */
    _handleGenericError(error, options) {
        if (!options.silent) {
            this.showError(error.message || ERROR_MESSAGES.DEFAULT, {
                showDetails: ENV_CONFIG.isDebug()
            });
        }

        return { handled: true, action: 'show_message' };
    }

    /**
     * 创建未知错误对象
     * @private
     */
    _createUnknownError(originalError) {
        return {
            type: 'unknown',
            code: 0,
            message: ERROR_MESSAGES.UNKNOWN,
            details: originalError?.message || 'Unknown error',
            timestamp: Date.now()
        };
    }

    /**
     * 创建错误提示元素
     * @private
     */
    _createErrorElement(error, options) {
        const element = document.createElement('div');
        element.className = `error-toast error-toast-${options.type} error-toast-${options.position}`;
        
        const iconMap = {
            error: '❌',
            success: '✅',
            warning: '⚠️',
            info: 'ℹ️'
        };

        element.innerHTML = `
            <div class="error-toast-content">
                <span class="error-toast-icon">${iconMap[options.type] || '❌'}</span>
                <span class="error-toast-message">${error.message}</span>
                ${options.allowClose ? '<span class="error-toast-close">×</span>' : ''}
            </div>
            ${options.showDetails && error.details ? 
                `<div class="error-toast-details">${error.details}</div>` : ''}
        `;

        // 添加样式
        element.style.cssText = `
            position: fixed;
            z-index: 10000;
            max-width: 400px;
            padding: 12px 16px;
            margin: 8px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 14px;
            line-height: 1.4;
            word-wrap: break-word;
            animation: slideIn 0.3s ease-out;
            ${this._getPositionStyles(options.position)}
            ${this._getTypeStyles(options.type)}
        `;

        // 关闭按钮事件
        if (options.allowClose) {
            const closeBtn = element.querySelector('.error-toast-close');
            closeBtn.onclick = () => this._removeErrorElement(element);
            closeBtn.style.cssText = `
                float: right;
                margin-left: 8px;
                cursor: pointer;
                font-weight: bold;
                opacity: 0.7;
            `;
        }

        return element;
    }

    /**
     * 获取位置样式
     * @private
     */
    _getPositionStyles(position) {
        const positions = {
            'top-right': 'top: 20px; right: 20px;',
            'top-left': 'top: 20px; left: 20px;',
            'bottom-right': 'bottom: 20px; right: 20px;',
            'bottom-left': 'bottom: 20px; left: 20px;',
            'top-center': 'top: 20px; left: 50%; transform: translateX(-50%);',
            'bottom-center': 'bottom: 20px; left: 50%; transform: translateX(-50%);'
        };
        
        return positions[position] || positions['top-right'];
    }

    /**
     * 获取类型样式
     * @private
     */
    _getTypeStyles(type) {
        const styles = {
            error: 'background: #fee; border-left: 4px solid #f56565; color: #c53030;',
            success: 'background: #f0fff4; border-left: 4px solid #38a169; color: #2f855a;',
            warning: 'background: #fffbeb; border-left: 4px solid #ed8936; color: #c05621;',
            info: 'background: #ebf8ff; border-left: 4px solid #4299e1; color: #3182ce;'
        };
        
        return styles[type] || styles.error;
    }

    /**
     * 移除错误提示元素
     * @private
     */
    _removeErrorElement(element) {
        if (element && element.parentNode) {
            element.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }, 300);
        }
    }

    /**
     * 延迟函数
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes slideOut {
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(-20px);
    }
}
`;
document.head.appendChild(style);

// 创建全局实例
const errorHandler = new ErrorHandler();

// 导出错误处理器类和实例
window.ErrorHandler = ErrorHandler;
window.errorHandler = errorHandler;
window.ERROR_CODES = ERROR_CODES;

export { ErrorHandler, ERROR_CODES, ERROR_MESSAGES };
export default errorHandler;
