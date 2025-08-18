/**
 * 登录页面控制器 - 基于新的认证服务集成
 * 集成表单验证、错误处理、Loading状态、用户体验优化
 */

// 导入依赖
import authService from '../../js/services/auth-service.js';
import formValidator from '../../js/utils/validation.js';
import errorHandler from '../../js/utils/error-handler.js';
import loadingManager from '../../js/utils/loading.js';
import { ENV_CONFIG } from '../../config/env.js';

/**
 * 登录页面控制器类
 */
class LoginPageController {
    constructor() {
        this.form = null;
        this.submitButton = null;
        this.elements = {};
        this.isSubmitting = false;
        
        // 初始化
        this._initialize();
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🔑 LoginPageController初始化');
        }
    }

    // ========================================
    // 🚀 初始化
    // ========================================

    /**
     * 初始化登录页面
     * @private
     */
    _initialize() {
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this._setup();
            });
        } else {
            this._setup();
        }
    }

    /**
     * 设置页面
     * @private
     */
    _setup() {
        try {
            // 检查是否已登录
            if (authService.isAuthenticated()) {
                this._handleAlreadyLoggedIn();
                return;
            }

            // 获取DOM元素
            this._initializeElements();
            
            // 设置事件监听器
            this._setupEventListeners();
            
            // 设置表单验证
            this._setupFormValidation();
            
            // 处理URL参数
            this._handleUrlParams();
            
            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 登录页面设置完成');
            }
        } catch (error) {
            console.error('❌ 登录页面设置失败:', error.message);
            errorHandler.showError('页面初始化失败，请刷新重试');
        }
    }

    /**
     * 初始化DOM元素
     * @private
     */
    _initializeElements() {
        // 表单元素
        this.form = document.getElementById('loginForm');
        this.submitButton = document.getElementById('loginSubmit');
        
        // 输入字段
        this.elements = {
            identifier: document.getElementById('identifier'),
            password: document.getElementById('password'),
            rememberMe: document.getElementById('rememberMe'),
            showPassword: document.getElementById('showPassword')
        };
        
        // 链接元素
        this.elements.registerLink = document.getElementById('registerLink');
        this.elements.forgotPasswordLink = document.getElementById('forgotPasswordLink');
        
        // 验证必要元素存在
        if (!this.form) {
            throw new Error('登录表单不存在');
        }
        
        if (!this.submitButton) {
            throw new Error('提交按钮不存在');
        }

        // 创建错误提示容器
        this._createErrorContainers();
    }

    /**
     * 创建错误提示容器
     * @private
     */
    _createErrorContainers() {
        Object.keys(this.elements).forEach(key => {
            const element = this.elements[key];
            if (element && element.type !== 'checkbox' && key !== 'showPassword') {
                const container = element.parentNode;
                if (!container.querySelector('.error-message')) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'error-message';
                    errorDiv.style.display = 'none';
                    container.appendChild(errorDiv);
                }
            }
        });
    }

    // ========================================
    // 📡 事件监听器
    // ========================================

    /**
     * 设置事件监听器
     * @private
     */
    _setupEventListeners() {
        // 表单提交
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleSubmit();
        });

        // 显示/隐藏密码
        if (this.elements.showPassword) {
            this.elements.showPassword.addEventListener('change', () => {
                this._togglePasswordVisibility();
            });
        }

        // Enter键快捷提交
        Object.values(this.elements).forEach(element => {
            if (element && element.addEventListener) {
                element.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !this.isSubmitting) {
                        this._handleSubmit();
                    }
                });
            }
        });

        // 认证服务事件
        authService.on('login', (user) => {
            this._handleLoginSuccess(user);
        });

        authService.on('logout', () => {
            this._handleLogout();
        });
    }

    /**
     * 设置表单验证
     * @private
     */
    _setupFormValidation() {
        // 实时验证用户名/邮箱
        if (this.elements.identifier) {
            formValidator.setupRealTimeValidation(
                this.elements.identifier, 
                'identifier'
            );
        }

        // 实时验证密码
        if (this.elements.password) {
            this.elements.password.addEventListener('input', () => {
                this._validatePassword();
            });
        }
    }

    // ========================================
    // 🔍 表单验证
    // ========================================

    /**
     * 验证登录标识（用户名/邮箱/手机号）
     * @private
     */
    _validateIdentifier() {
        const identifier = this.elements.identifier.value.trim();
        
        if (!identifier) {
            return { valid: false, message: '请输入用户名、邮箱或手机号' };
        }

        // 检测输入类型并验证
        if (identifier.includes('@')) {
            // 邮箱格式验证
            return formValidator.validateEmail(identifier);
        } else if (/^\d+$/.test(identifier)) {
            // 手机号验证
            return formValidator.validatePhone(identifier);
        } else {
            // 用户名验证
            return formValidator.validateUsername(identifier);
        }
    }

    /**
     * 验证密码
     * @private
     */
    _validatePassword() {
        const password = this.elements.password.value;
        
        if (!password) {
            return { valid: false, message: '请输入密码' };
        }

        return { valid: true };
    }

    /**
     * 验证整个表单
     * @private
     */
    _validateForm() {
        const errors = {};
        let isValid = true;

        // 验证登录标识
        const identifierResult = this._validateIdentifier();
        if (!identifierResult.valid) {
            errors.identifier = identifierResult.message;
            isValid = false;
        }

        // 验证密码
        const passwordResult = this._validatePassword();
        if (!passwordResult.valid) {
            errors.password = passwordResult.message;
            isValid = false;
        }

        // 显示错误信息
        this._displayValidationErrors(errors);

        return { isValid, errors };
    }

    /**
     * 显示验证错误
     * @private
     */
    _displayValidationErrors(errors) {
        // 清除所有错误状态
        Object.keys(this.elements).forEach(key => {
            const element = this.elements[key];
            if (element) {
                element.classList.remove('error');
                const errorElement = element.parentNode?.querySelector('.error-message');
                if (errorElement) {
                    errorElement.style.display = 'none';
                    errorElement.textContent = '';
                }
            }
        });

        // 显示新的错误
        Object.keys(errors).forEach(key => {
            const element = this.elements[key];
            if (element) {
                element.classList.add('error');
                const errorElement = element.parentNode?.querySelector('.error-message');
                if (errorElement) {
                    errorElement.textContent = errors[key];
                    errorElement.style.display = 'block';
                }
            }
        });
    }

    // ========================================
    // 📤 表单提交
    // ========================================

    /**
     * 处理表单提交
     * @private
     */
    async _handleSubmit() {
        if (this.isSubmitting) {
            return;
        }

        try {
            // 表单验证
            const validation = this._validateForm();
            if (!validation.isValid) {
                // 聚焦到第一个错误字段
                const firstErrorField = Object.keys(validation.errors)[0];
                if (this.elements[firstErrorField]) {
                    this.elements[firstErrorField].focus();
                }
                return;
            }

            this.isSubmitting = true;

            // 收集表单数据
            const formData = {
                identifier: this.elements.identifier.value.trim(),
                password: this.elements.password.value,
                rememberMe: this.elements.rememberMe?.checked || false
            };

            if (ENV_CONFIG.isDebug()) {
                console.log('📤 提交登录表单:', {
                    identifier: formData.identifier,
                    rememberMe: formData.rememberMe
                });
            }

            // 调用登录服务
            const result = await authService.login(formData, this.submitButton);

            if (!result.success) {
                // 登录失败，聚焦到密码字段
                this.elements.password.focus();
                this.elements.password.select();
            }

        } catch (error) {
            console.error('❌ 登录提交失败:', error.message);
            errorHandler.showError('登录过程出现异常，请稍后重试');
        } finally {
            this.isSubmitting = false;
        }
    }

    /**
     * 处理登录成功
     * @private
     */
    _handleLoginSuccess(user) {
        if (ENV_CONFIG.isDebug()) {
            console.log('✅ 登录成功回调:', user.username);
        }

        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
            this._redirectAfterLogin();
        }, 1000);
    }

    /**
     * 登录后重定向
     * @private
     */
    _redirectAfterLogin() {
        // 获取重定向URL
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get('redirect');

        let targetUrl = '/index.html'; // 默认跳转

        if (redirectUrl) {
            try {
                // 验证重定向URL的安全性
                const url = new URL(redirectUrl, window.location.origin);
                if (url.origin === window.location.origin) {
                    targetUrl = redirectUrl;
                }
            } catch (error) {
                console.warn('⚠️ 无效的重定向URL:', redirectUrl);
            }
        }

        if (ENV_CONFIG.isDebug()) {
            console.log('🔗 登录后重定向到:', targetUrl);
        }

        window.location.href = targetUrl;
    }

    // ========================================
    // 🛠️ 工具方法
    // ========================================

    /**
     * 切换密码可见性
     * @private
     */
    _togglePasswordVisibility() {
        const passwordInput = this.elements.password;
        const showPasswordCheckbox = this.elements.showPassword;

        if (passwordInput && showPasswordCheckbox) {
            passwordInput.type = showPasswordCheckbox.checked ? 'text' : 'password';
        }
    }

    /**
     * 处理已登录状态
     * @private
     */
    _handleAlreadyLoggedIn() {
        if (ENV_CONFIG.isDebug()) {
            console.log('👤 用户已登录，重定向到首页');
        }
        
        // 显示提示并重定向
        errorHandler.showInfo('您已登录，正在跳转...');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 1000);
    }

    /**
     * 处理URL参数
     * @private
     */
    _handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // 处理邮箱验证成功消息
        if (urlParams.get('verified') === 'true') {
            errorHandler.showSuccess('邮箱验证成功！请登录您的账户');
        }
        
        // 处理注册成功消息
        if (urlParams.get('registered') === 'true') {
            errorHandler.showSuccess('注册成功！请登录您的账户');
        }
        
        // 处理密码重置消息
        if (urlParams.get('password_reset') === 'true') {
            errorHandler.showSuccess('密码重置成功！请使用新密码登录');
        }
        
        // 处理登出消息
        if (urlParams.get('logout') === 'true') {
            errorHandler.showInfo('您已安全登出');
        }

        // 预填充用户名
        const username = urlParams.get('username');
        if (username && this.elements.identifier) {
            this.elements.identifier.value = decodeURIComponent(username);
        }
    }

    /**
     * 处理登出事件
     * @private
     */
    _handleLogout() {
        // 清空表单
        if (this.form) {
            this.form.reset();
        }
        
        // 清除错误状态
        this._displayValidationErrors({});
    }

    // ========================================
    // 🔗 页面跳转方法
    // ========================================

    /**
     * 跳转到注册页面
     */
    goToRegister() {
        window.location.href = '/register.html';
    }

    /**
     * 跳转到忘记密码页面
     */
    goToForgotPassword() {
        window.location.href = '/forgot-password.html';
    }

    // ========================================
    // 🎨 UI辅助方法
    // ========================================

    /**
     * 设置表单只读状态
     * @param {boolean} readonly 是否只读
     */
    setFormReadonly(readonly) {
        Object.values(this.elements).forEach(element => {
            if (element && element.type !== 'checkbox') {
                element.readOnly = readonly;
            }
        });
        
        if (this.submitButton) {
            this.submitButton.disabled = readonly;
        }
    }

    /**
     * 聚焦到第一个输入字段
     */
    focusFirstInput() {
        if (this.elements.identifier) {
            this.elements.identifier.focus();
        }
    }
}

// 创建页面控制器实例
const loginPageController = new LoginPageController();

// 导出控制器（供全局使用）
window.loginPageController = loginPageController;

export default loginPageController;