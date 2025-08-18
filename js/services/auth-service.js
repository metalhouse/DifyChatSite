/**
 * 认证服务集成器 - 整合所有认证相关功能
 * 基于DifyChatBack v2.0 API指南第4章
 * 集成API调用、存储管理、错误处理、用户体验
 */

// 导入依赖
import { ENV_CONFIG } from '../../config/env.js';
import difySdk from '../api/dify-api.js';
import storageManager from '../utils/storage.js';
import errorHandler from '../utils/error-handler.js';
import loadingManager from '../utils/loading.js';
import formValidator from '../utils/validation.js';

/**
 * 认证服务集成器类
 * 提供完整的用户认证流程管理
 */
class AuthService {
    constructor() {
        this.currentUser = null;
        this.authState = 'unauthenticated'; // unauthenticated, authenticating, authenticated, expired
        this.refreshTokenTimer = null;
        this.eventListeners = new Map();
        
        // 初始化
        this._initialize();
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🔐 AuthService初始化');
        }
    }

    // ========================================
    // 🚀 初始化和状态管理
    // ========================================

    /**
     * 初始化认证服务
     * @private
     */
    async _initialize() {
        try {
            // 检查现有登录状态
            await this._checkExistingAuth();
            
            // 设置自动刷新Token
            this._setupTokenRefresh();
            
            // 设置页面可见性监听
            this._setupVisibilityHandlers();
            
            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 认证服务初始化完成，状态:', this.authState);
            }
        } catch (error) {
            console.error('❌ 认证服务初始化失败:', error.message);
            this.authState = 'error';
        }
    }

    /**
     * 检查现有认证状态
     * @private
     */
    async _checkExistingAuth() {
        const accessToken = storageManager.getAccessToken();
        const userInfo = storageManager.getUserInfo();
        
        if (!accessToken || !userInfo) {
            this.authState = 'unauthenticated';
            return;
        }

        // 检查Token是否过期
        if (storageManager.isTokenExpired()) {
            // 尝试刷新Token
            try {
                await this.refreshToken();
            } catch (error) {
                console.warn('⚠️ Token刷新失败，需要重新登录');
                this.logout();
                return;
            }
        }

        // 验证用户信息
        try {
            const currentUserInfo = await difySdk.getCurrentUserInfo();
            this.currentUser = currentUserInfo;
            this.authState = 'authenticated';
            this._emitAuthEvent('login', this.currentUser);
        } catch (error) {
            console.warn('⚠️ 用户信息验证失败，需要重新登录');
            this.logout();
        }
    }

    // ========================================
    // 📝 用户注册
    // ========================================

    /**
     * 用户注册
     * @param {Object} formData 注册表单数据
     * @param {HTMLElement} [submitButton] 提交按钮（用于Loading状态）
     * @returns {Promise<Object>} 注册结果
     */
    async register(formData, submitButton = null) {
        try {
            // 表单验证
            const validation = formValidator.validateRegistrationForm(formData);
            if (!validation.isValid) {
                const firstError = Object.values(validation.errors)[0];
                errorHandler.showError(firstError);
                return { success: false, errors: validation.errors };
            }

            // 设置Loading状态
            if (submitButton) {
                loadingManager.setButtonLoading(submitButton, true, loadingManager.getMessage('register'));
            }

            this.authState = 'authenticating';

            if (ENV_CONFIG.isDebug()) {
                console.log('📝 开始用户注册:', formData.username);
            }

            // 调用注册API
            const response = await difySdk.register({
                username: formData.username,
                email: formData.email,
                password: formData.password,
                confirmPassword: formData.confirmPassword,
                nickname: formData.nickname || '',
                phone: formData.phone || ''
            });

            // 注册成功处理
            if (response.success) {
                errorHandler.showSuccess('注册成功！请查收邮箱验证邮件');
                
                // 如果返回了Token，直接登录
                if (response.data.accessToken) {
                    await this._handleLoginSuccess(response.data);
                }
                
                this._emitAuthEvent('register', response.data.user);
                
                return { 
                    success: true, 
                    data: response.data,
                    needEmailVerification: !response.data.accessToken
                };
            } else {
                throw new Error(response.message || '注册失败');
            }

        } catch (error) {
            this.authState = 'unauthenticated';
            
            // 处理错误
            const handledError = errorHandler.handleApiError(error);
            
            if (ENV_CONFIG.isDebug()) {
                console.error('❌ 注册失败:', error);
            }

            return { 
                success: false, 
                error: error.message,
                handledError
            };
        } finally {
            // 取消Loading状态
            if (submitButton) {
                loadingManager.setButtonLoading(submitButton, false);
            }
        }
    }

    /**
     * 发送邮箱验证
     * @param {string} email 邮箱地址
     * @returns {Promise<Object>} 发送结果
     */
    async sendEmailVerification(email) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('📧 发送邮箱验证:', email);
            }

            const response = await difySdk.sendEmailVerification(email);
            
            if (response.success) {
                errorHandler.showSuccess('验证邮件已发送，请查收邮箱');
                return { success: true };
            } else {
                throw new Error(response.message || '发送验证邮件失败');
            }
        } catch (error) {
            errorHandler.handleApiError(error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 验证邮箱
     * @param {string} token 验证令牌
     * @returns {Promise<Object>} 验证结果
     */
    async verifyEmail(token) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('✉️ 验证邮箱令牌');
            }

            const response = await difySdk.verifyEmail(token);
            
            if (response.success) {
                errorHandler.showSuccess('邮箱验证成功！');
                
                // 如果返回了登录Token，自动登录
                if (response.data.accessToken) {
                    await this._handleLoginSuccess(response.data);
                }
                
                return { success: true, data: response.data };
            } else {
                throw new Error(response.message || '邮箱验证失败');
            }
        } catch (error) {
            errorHandler.handleApiError(error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // 🔑 用户登录
    // ========================================

    /**
     * 用户登录
     * @param {Object} formData 登录表单数据
     * @param {HTMLElement} [submitButton] 提交按钮
     * @returns {Promise<Object>} 登录结果
     */
    async login(formData, submitButton = null) {
        try {
            // 表单验证
            const validation = formValidator.validateLoginForm(formData);
            if (!validation.isValid) {
                const firstError = Object.values(validation.errors)[0];
                errorHandler.showError(firstError);
                return { success: false, errors: validation.errors };
            }

            // 设置Loading状态
            if (submitButton) {
                loadingManager.setButtonLoading(submitButton, true, loadingManager.getMessage('login'));
            }

            this.authState = 'authenticating';

            if (ENV_CONFIG.isDebug()) {
                console.log('🔑 开始用户登录:', formData.identifier);
            }

            // 调用登录API - 根据identifier类型决定字段名
            const loginData = {
                password: formData.password,
                rememberMe: formData.rememberMe || false
            };
            
            // 根据标识符类型设置相应字段
            const identifier = formData.identifier;
            if (identifier.includes('@')) {
                // 包含@符号，认为是邮箱
                loginData.email = identifier;
            } else if (/^1[3-9]\d{9}$/.test(identifier)) {
                // 匹配中国手机号格式
                loginData.phone = identifier;
            } else {
                // 其他情况作为用户名
                loginData.username = identifier;
            }
            
            const response = await difySdk.login(loginData);

            // 登录成功处理
            if (response.success) {
                await this._handleLoginSuccess(response.data);
                
                return { success: true, data: response.data };
            } else {
                throw new Error(response.message || '登录失败');
            }

        } catch (error) {
            this.authState = 'unauthenticated';
            
            // 处理错误
            errorHandler.handleApiError(error);
            
            if (ENV_CONFIG.isDebug()) {
                console.error('❌ 登录失败:', error);
            }

            return { 
                success: false, 
                error: error.message 
            };
        } finally {
            // 取消Loading状态
            if (submitButton) {
                loadingManager.setButtonLoading(submitButton, false);
            }
        }
    }

    /**
     * 处理登录成功
     * @private
     */
    async _handleLoginSuccess(authData) {
        const { accessToken, refreshToken, expiresIn, user } = authData;
        
        // 存储Token和用户信息
        storageManager.setTokens(accessToken, refreshToken, expiresIn);
        storageManager.setUserInfo(user);
        
        // 更新状态
        this.currentUser = user;
        this.authState = 'authenticated';
        
        // 设置自动刷新
        this._setupTokenRefresh();
        
        // 触发登录事件
        this._emitAuthEvent('login', user);
        
        if (ENV_CONFIG.isDebug()) {
            console.log('✅ 登录成功:', user.username);
        }
    }

    // ========================================
    // 🔄 Token管理
    // ========================================

    /**
     * 刷新访问令牌
     * @returns {Promise<Object>} 刷新结果
     */
    async refreshToken() {
        try {
            const refreshToken = storageManager.getRefreshToken();
            if (!refreshToken) {
                throw new Error('刷新令牌不存在');
            }

            if (ENV_CONFIG.isDebug()) {
                console.log('🔄 刷新访问令牌');
            }

            const response = await difySdk.refreshToken(refreshToken);
            
            if (response.success) {
                const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
                
                // 更新存储的Token
                storageManager.setTokens(accessToken, newRefreshToken, expiresIn);
                
                // 重新设置自动刷新
                this._setupTokenRefresh();
                
                if (ENV_CONFIG.isDebug()) {
                    console.log('✅ Token刷新成功');
                }
                
                return { success: true };
            } else {
                throw new Error(response.message || 'Token刷新失败');
            }
        } catch (error) {
            console.error('❌ Token刷新失败:', error.message);
            
            // Token刷新失败，需要重新登录
            this.logout();
            
            throw error;
        }
    }

    /**
     * 设置自动Token刷新
     * @private
     */
    _setupTokenRefresh() {
        // 清除现有定时器
        if (this.refreshTokenTimer) {
            clearTimeout(this.refreshTokenTimer);
        }

        const expiresAtStr = storageManager._getItem(storageManager.constructor.name === 'StorageManager' ? 
            'dify_token_expires_at' : null);
        
        if (!expiresAtStr) return;

        const expiresAt = parseInt(expiresAtStr);
        const now = Date.now();
        const refreshTime = expiresAt - (5 * 60 * 1000); // 提前5分钟刷新

        if (refreshTime > now) {
            const delay = refreshTime - now;
            this.refreshTokenTimer = setTimeout(() => {
                this.refreshToken().catch(console.error);
            }, delay);

            if (ENV_CONFIG.isDebug()) {
                console.log('⏰ 设置Token自动刷新，延迟:', Math.round(delay / 1000) + '秒');
            }
        }
    }

    // ========================================
    // 🚪 登出和清理
    // ========================================

    /**
     * 用户登出
     * @param {boolean} [callApi=true] 是否调用登出API
     * @returns {Promise<void>}
     */
    async logout(callApi = true) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('🚪 用户登出');
            }

            // 调用登出API
            if (callApi && this.authState === 'authenticated') {
                try {
                    await difySdk.logout();
                } catch (error) {
                    console.warn('⚠️ 登出API调用失败:', error.message);
                }
            }

            // 清理本地状态
            await this._cleanup();
            
            // 触发登出事件
            this._emitAuthEvent('logout');
            
            errorHandler.showInfo('已安全登出');
            
        } catch (error) {
            console.error('❌ 登出过程出错:', error.message);
            // 即使出错也要清理本地状态
            await this._cleanup();
        }
    }

    /**
     * 清理认证状态
     * @private
     */
    async _cleanup() {
        // 清理定时器
        if (this.refreshTokenTimer) {
            clearTimeout(this.refreshTokenTimer);
            this.refreshTokenTimer = null;
        }

        // 清理存储
        storageManager.clearTokens();
        storageManager.clearUserInfo();

        // 重置状态
        this.currentUser = null;
        this.authState = 'unauthenticated';
        
        // 清理WebSocket连接
        if (window.socketManager) {
            window.socketManager.disconnect();
        }

        if (ENV_CONFIG.isDebug()) {
            console.log('🧹 认证状态已清理');
        }
    }

    // ========================================
    // 👀 页面可见性处理
    // ========================================

    /**
     * 设置页面可见性监听器
     * @private
     */
    _setupVisibilityHandlers() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.authState === 'authenticated') {
                // 页面变为可见时，检查Token是否需要刷新
                if (storageManager.isTokenExpired()) {
                    this.refreshToken().catch(() => {
                        // Token刷新失败，自动登出
                        this.logout();
                    });
                }
            }
        });
    }

    // ========================================
    // 📡 事件管理
    // ========================================

    /**
     * 注册认证事件监听器
     * @param {string} event 事件名称 (login, logout, register, token-refresh)
     * @param {Function} handler 事件处理函数
     */
    on(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(handler);
    }

    /**
     * 移除认证事件监听器
     * @param {string} event 事件名称
     * @param {Function} handler 事件处理函数
     */
    off(event, handler) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(handler);
        }
    }

    /**
     * 触发认证事件
     * @private
     */
    _emitAuthEvent(event, data = null) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`❌ 认证事件处理器错误 (${event}):`, error.message);
                }
            });
        }

        if (ENV_CONFIG.isDebug()) {
            console.log('📡 触发认证事件:', event, data?.username || '');
        }
    }

    // ========================================
    // 🔍 状态查询
    // ========================================

    /**
     * 检查是否已登录
     * @returns {boolean} 是否已登录
     */
    isAuthenticated() {
        return this.authState === 'authenticated' && 
               this.currentUser !== null && 
               !storageManager.isTokenExpired();
    }

    /**
     * 获取当前用户信息
     * @returns {Object|null} 用户信息
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * 获取认证状态
     * @returns {string} 认证状态
     */
    getAuthState() {
        return this.authState;
    }

    /**
     * 获取用户权限
     * @returns {Array} 权限列表
     */
    getUserPermissions() {
        return this.currentUser?.permissions || [];
    }

    /**
     * 检查用户是否有特定权限
     * @param {string} permission 权限名称
     * @returns {boolean} 是否有权限
     */
    hasPermission(permission) {
        const permissions = this.getUserPermissions();
        return permissions.includes(permission) || permissions.includes('*');
    }

    // ========================================
    // 🛠️ 工具方法
    // ========================================

    /**
     * 需要登录的页面重定向
     * @param {string} [redirectUrl] 登录成功后的重定向URL
     */
    requireAuth(redirectUrl = null) {
        if (!this.isAuthenticated()) {
            const currentUrl = redirectUrl || window.location.href;
            const loginUrl = `/login.html?redirect=${encodeURIComponent(currentUrl)}`;
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🔒 需要登录，重定向到:', loginUrl);
            }
            
            window.location.href = loginUrl;
            return false;
        }
        
        return true;
    }

    /**
     * 获取认证头
     * @returns {Object} 认证头对象
     */
    getAuthHeaders() {
        const token = storageManager.getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }

    /**
     * 重置密码请求
     * @param {string} email 邮箱地址
     * @returns {Promise<Object>} 请求结果
     */
    async requestPasswordReset(email) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('🔑 请求重置密码:', email);
            }

            const response = await difySdk.requestPasswordReset(email);
            
            if (response.success) {
                errorHandler.showSuccess('重置密码邮件已发送');
                return { success: true };
            } else {
                throw new Error(response.message || '发送重置邮件失败');
            }
        } catch (error) {
            errorHandler.handleApiError(error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 重置密码
     * @param {string} token 重置令牌
     * @param {string} newPassword 新密码
     * @returns {Promise<Object>} 重置结果
     */
    async resetPassword(token, newPassword) {
        try {
            // 密码验证
            const passwordValidation = formValidator.validatePassword(newPassword);
            if (!passwordValidation.valid) {
                errorHandler.showError(passwordValidation.message);
                return { success: false, error: passwordValidation.message };
            }

            if (ENV_CONFIG.isDebug()) {
                console.log('🔑 重置密码');
            }

            const response = await difySdk.resetPassword(token, newPassword);
            
            if (response.success) {
                errorHandler.showSuccess('密码重置成功，请重新登录');
                return { success: true };
            } else {
                throw new Error(response.message || '密码重置失败');
            }
        } catch (error) {
            errorHandler.handleApiError(error);
            return { success: false, error: error.message };
        }
    }
}

// 创建全局实例
const authService = new AuthService();

// 导出认证服务类和实例
window.AuthService = AuthService;
window.authService = authService;

export { AuthService };
export default authService;
