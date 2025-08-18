/**
 * 表单验证工具 - 统一的表单验证规则
 * 基于DifyChatBack v2.0 API指南验证要求
 * 提供前端表单验证和错误处理
 */

// 导入依赖
import { ENV_CONFIG } from '../../config/env.js';

/**
 * 验证规则定义
 * 基于API指南第4章用户认证要求
 */
const VALIDATION_RULES = {
    USERNAME: {
        MIN_LENGTH: 3,
        MAX_LENGTH: 50,
        PATTERN: /^[a-zA-Z0-9_]+$/,
        RESERVED_WORDS: ['admin', 'root', 'system', 'api', 'null', 'undefined']
    },
    
    EMAIL: {
        PATTERN: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        MAX_LENGTH: 100
    },
    
    PHONE: {
        // 中国手机号格式
        PATTERN: /^1[3-9]\d{9}$/,
        INTERNATIONAL_PATTERN: /^\+\d{1,3}\d{10,11}$/
    },
    
    PASSWORD: {
        MIN_LENGTH: 8,
        MAX_LENGTH: 100,
        // 至少包含大写字母、小写字母、数字、特殊字符中的三种
        STRENGTH_PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
    },
    
    NICKNAME: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 30,
        PATTERN: /^[\u4e00-\u9fa5a-zA-Z0-9_\s]+$/ // 中文、英文、数字、下划线、空格
    },
    
    ROOM_NAME: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 50,
        PATTERN: /^[\u4e00-\u9fa5a-zA-Z0-9_\s\-#]+$/ // 房间名允许更多字符
    },
    
    MESSAGE: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 10000
    }
};

/**
 * 错误消息定义
 */
const ERROR_MESSAGES = {
    REQUIRED: '此字段为必填项',
    INVALID_FORMAT: '格式不正确',
    TOO_SHORT: '长度不能少于{min}个字符',
    TOO_LONG: '长度不能超过{max}个字符',
    PATTERN_MISMATCH: '格式不符合要求',
    RESERVED_WORD: '不能使用保留关键词',
    PASSWORD_WEAK: '密码强度不够，需要包含大小写字母、数字和特殊字符',
    EMAIL_INVALID: '邮箱格式不正确',
    PHONE_INVALID: '手机号格式不正确',
    PASSWORDS_NOT_MATCH: '两次输入的密码不一致',
    USERNAME_INVALID: '用户名只能包含字母、数字和下划线',
    NICKNAME_INVALID: '昵称只能包含中文、英文、数字、下划线和空格'
};

/**
 * 表单验证器类
 */
class FormValidator {
    constructor() {
        this.rules = VALIDATION_RULES;
        this.messages = ERROR_MESSAGES;
        
        if (ENV_CONFIG.isDebug()) {
            console.log('✅ FormValidator初始化');
        }
    }

    // ========================================
    // 🔍 基础验证方法
    // ========================================

    /**
     * 验证是否为空
     * @param {any} value 值
     * @returns {boolean} 是否为空
     */
    isEmpty(value) {
        return value === null || 
               value === undefined || 
               value === '' || 
               (Array.isArray(value) && value.length === 0) ||
               (typeof value === 'object' && Object.keys(value).length === 0);
    }

    /**
     * 验证字符串长度
     * @param {string} value 值
     * @param {number} min 最小长度
     * @param {number} max 最大长度
     * @returns {Object} 验证结果
     */
    validateLength(value, min, max) {
        if (this.isEmpty(value)) {
            return { valid: false, message: this.messages.REQUIRED };
        }

        const length = value.toString().length;
        
        if (length < min) {
            return { 
                valid: false, 
                message: this.messages.TOO_SHORT.replace('{min}', min) 
            };
        }
        
        if (length > max) {
            return { 
                valid: false, 
                message: this.messages.TOO_LONG.replace('{max}', max) 
            };
        }

        return { valid: true };
    }

    /**
     * 验证正则表达式
     * @param {string} value 值
     * @param {RegExp} pattern 正则表达式
     * @param {string} message 错误消息
     * @returns {Object} 验证结果
     */
    validatePattern(value, pattern, message) {
        if (this.isEmpty(value)) {
            return { valid: false, message: this.messages.REQUIRED };
        }

        if (!pattern.test(value)) {
            return { valid: false, message };
        }

        return { valid: true };
    }

    // ========================================
    // 👤 用户相关验证
    // ========================================

    /**
     * 验证用户名
     * @param {string} username 用户名
     * @returns {Object} 验证结果
     */
    validateUsername(username) {
        // 长度验证
        const lengthResult = this.validateLength(
            username, 
            this.rules.USERNAME.MIN_LENGTH, 
            this.rules.USERNAME.MAX_LENGTH
        );
        
        if (!lengthResult.valid) {
            return lengthResult;
        }

        // 格式验证
        const patternResult = this.validatePattern(
            username,
            this.rules.USERNAME.PATTERN,
            this.messages.USERNAME_INVALID
        );
        
        if (!patternResult.valid) {
            return patternResult;
        }

        // 保留词检查
        if (this.rules.USERNAME.RESERVED_WORDS.includes(username.toLowerCase())) {
            return { valid: false, message: this.messages.RESERVED_WORD };
        }

        return { valid: true };
    }

    /**
     * 验证邮箱
     * @param {string} email 邮箱
     * @returns {Object} 验证结果
     */
    validateEmail(email) {
        if (this.isEmpty(email)) {
            return { valid: false, message: this.messages.REQUIRED };
        }

        // 长度验证
        if (email.length > this.rules.EMAIL.MAX_LENGTH) {
            return { 
                valid: false, 
                message: this.messages.TOO_LONG.replace('{max}', this.rules.EMAIL.MAX_LENGTH) 
            };
        }

        // 格式验证
        return this.validatePattern(
            email,
            this.rules.EMAIL.PATTERN,
            this.messages.EMAIL_INVALID
        );
    }

    /**
     * 验证手机号
     * @param {string} phone 手机号
     * @param {boolean} international 是否允许国际号码
     * @returns {Object} 验证结果
     */
    validatePhone(phone, international = false) {
        if (this.isEmpty(phone)) {
            return { valid: false, message: this.messages.REQUIRED };
        }

        const pattern = international ? 
            this.rules.PHONE.INTERNATIONAL_PATTERN : 
            this.rules.PHONE.PATTERN;

        return this.validatePattern(
            phone,
            pattern,
            this.messages.PHONE_INVALID
        );
    }

    /**
     * 验证密码强度
     * @param {string} password 密码
     * @returns {Object} 验证结果
     */
    validatePassword(password) {
        // 长度验证
        const lengthResult = this.validateLength(
            password,
            this.rules.PASSWORD.MIN_LENGTH,
            this.rules.PASSWORD.MAX_LENGTH
        );
        
        if (!lengthResult.valid) {
            return lengthResult;
        }

        // 强度验证（至少包含三种字符类型）
        const hasLower = /[a-z]/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasDigit = /\d/.test(password);
        const hasSpecial = /[@$!%*?&]/.test(password);
        
        const typeCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
        
        if (typeCount < 3) {
            return { valid: false, message: this.messages.PASSWORD_WEAK };
        }

        return { valid: true };
    }

    /**
     * 验证确认密码
     * @param {string} password 原密码
     * @param {string} confirmPassword 确认密码
     * @returns {Object} 验证结果
     */
    validateConfirmPassword(password, confirmPassword) {
        if (this.isEmpty(confirmPassword)) {
            return { valid: false, message: this.messages.REQUIRED };
        }

        if (password !== confirmPassword) {
            return { valid: false, message: this.messages.PASSWORDS_NOT_MATCH };
        }

        return { valid: true };
    }

    /**
     * 验证昵称
     * @param {string} nickname 昵称
     * @returns {Object} 验证结果
     */
    validateNickname(nickname) {
        if (this.isEmpty(nickname)) {
            return { valid: true }; // 昵称是可选的
        }

        // 长度验证
        const lengthResult = this.validateLength(
            nickname,
            this.rules.NICKNAME.MIN_LENGTH,
            this.rules.NICKNAME.MAX_LENGTH
        );
        
        if (!lengthResult.valid) {
            return lengthResult;
        }

        // 格式验证
        return this.validatePattern(
            nickname,
            this.rules.NICKNAME.PATTERN,
            this.messages.NICKNAME_INVALID
        );
    }

    // ========================================
    // 🏠 房间相关验证
    // ========================================

    /**
     * 验证房间名称
     * @param {string} roomName 房间名称
     * @returns {Object} 验证结果
     */
    validateRoomName(roomName) {
        // 长度验证
        const lengthResult = this.validateLength(
            roomName,
            this.rules.ROOM_NAME.MIN_LENGTH,
            this.rules.ROOM_NAME.MAX_LENGTH
        );
        
        if (!lengthResult.valid) {
            return lengthResult;
        }

        // 格式验证
        return this.validatePattern(
            roomName,
            this.rules.ROOM_NAME.PATTERN,
            '房间名称格式不正确'
        );
    }

    // ========================================
    // 💬 消息相关验证
    // ========================================

    /**
     * 验证消息内容
     * @param {string} message 消息内容
     * @returns {Object} 验证结果
     */
    validateMessage(message) {
        return this.validateLength(
            message,
            this.rules.MESSAGE.MIN_LENGTH,
            this.rules.MESSAGE.MAX_LENGTH
        );
    }

    // ========================================
    // 📋 表单验证综合方法
    // ========================================

    /**
     * 验证注册表单
     * @param {Object} formData 表单数据
     * @returns {Object} 验证结果
     */
    validateRegistrationForm(formData) {
        const errors = {};
        let isValid = true;

        // 用户名验证
        const usernameResult = this.validateUsername(formData.username);
        if (!usernameResult.valid) {
            errors.username = usernameResult.message;
            isValid = false;
        }

        // 邮箱验证
        const emailResult = this.validateEmail(formData.email);
        if (!emailResult.valid) {
            errors.email = emailResult.message;
            isValid = false;
        }

        // 密码验证
        const passwordResult = this.validatePassword(formData.password);
        if (!passwordResult.valid) {
            errors.password = passwordResult.message;
            isValid = false;
        }

        // 确认密码验证
        const confirmPasswordResult = this.validateConfirmPassword(
            formData.password, 
            formData.confirmPassword
        );
        if (!confirmPasswordResult.valid) {
            errors.confirmPassword = confirmPasswordResult.message;
            isValid = false;
        }

        // 昵称验证（可选）
        if (formData.nickname) {
            const nicknameResult = this.validateNickname(formData.nickname);
            if (!nicknameResult.valid) {
                errors.nickname = nicknameResult.message;
                isValid = false;
            }
        }

        // 手机号验证（可选）
        if (formData.phone) {
            const phoneResult = this.validatePhone(formData.phone);
            if (!phoneResult.valid) {
                errors.phone = phoneResult.message;
                isValid = false;
            }
        }

        return { isValid, errors };
    }

    /**
     * 验证登录表单
     * @param {Object} formData 表单数据
     * @returns {Object} 验证结果
     */
    validateLoginForm(formData) {
        const errors = {};
        let isValid = true;

        // 登录标识验证（可以是用户名、邮箱或手机号）
        if (this.isEmpty(formData.identifier)) {
            errors.identifier = this.messages.REQUIRED;
            isValid = false;
        }

        // 密码验证
        if (this.isEmpty(formData.password)) {
            errors.password = this.messages.REQUIRED;
            isValid = false;
        }

        return { isValid, errors };
    }

    /**
     * 验证创建房间表单
     * @param {Object} formData 表单数据
     * @returns {Object} 验证结果
     */
    validateCreateRoomForm(formData) {
        const errors = {};
        let isValid = true;

        // 房间名称验证
        const roomNameResult = this.validateRoomName(formData.name);
        if (!roomNameResult.valid) {
            errors.name = roomNameResult.message;
            isValid = false;
        }

        // 描述验证（可选）
        if (formData.description && formData.description.length > 500) {
            errors.description = '描述不能超过500个字符';
            isValid = false;
        }

        return { isValid, errors };
    }

    // ========================================
    // 🛠️ 工具方法
    // ========================================

    /**
     * 实时验证输入框
     * @param {HTMLElement} input 输入框元素
     * @param {string} validationType 验证类型
     * @param {Object} options 选项
     */
    setupRealTimeValidation(input, validationType, options = {}) {
        if (!input) return;

        const validateInput = () => {
            const value = (input.value || '').trim();
            let result;

            switch (validationType) {
                case 'username':
                    result = this.validateUsername(value);
                    break;
                case 'email':
                    result = this.validateEmail(value);
                    break;
                case 'phone':
                    result = this.validatePhone(value, options.international);
                    break;
                case 'password':
                    result = this.validatePassword(value);
                    break;
                case 'nickname':
                    result = this.validateNickname(value);
                    break;
                case 'roomName':
                    result = this.validateRoomName(value);
                    break;
                case 'message':
                    result = this.validateMessage(value);
                    break;
                default:
                    return;
            }

            this._updateInputStatus(input, result);
        };

        // 绑定事件
        input.addEventListener('input', validateInput);
        input.addEventListener('blur', validateInput);
    }

    /**
     * 更新输入框状态
     * @private
     */
    _updateInputStatus(input, result) {
        const errorElement = input.parentNode.querySelector('.error-message');
        
        if (result.valid) {
            input.classList.remove('error');
            input.classList.add('valid');
            if (errorElement) {
                errorElement.textContent = '';
                errorElement.style.display = 'none';
            }
        } else {
            input.classList.remove('valid');
            input.classList.add('error');
            if (errorElement) {
                errorElement.textContent = result.message;
                errorElement.style.display = 'block';
            }
        }
    }

    /**
     * 获取验证规则（供外部使用）
     * @returns {Object} 验证规则
     */
    getRules() {
        return this.rules;
    }

    /**
     * 获取错误消息（供外部使用）
     * @returns {Object} 错误消息
     */
    getMessages() {
        return this.messages;
    }
}

// 创建验证器实例
const validators = {
    // 基础验证方法
    username: (value) => new FormValidator().validateUsername(value),
    email: (value) => new FormValidator().validateEmail(value),
    phone: (value, international = false) => new FormValidator().validatePhone(value, international),
    password: (value) => new FormValidator().validatePassword(value),
    confirmPassword: (password, confirmPassword) => new FormValidator().validateConfirmPassword(password, confirmPassword),
    nickname: (value) => new FormValidator().validateNickname(value),
    roomName: (value) => new FormValidator().validateRoomName(value),
    message: (value) => new FormValidator().validateMessage(value),
    
    // 表单验证方法
    registrationForm: (formData) => new FormValidator().validateRegistrationForm(formData),
    loginForm: (formData) => new FormValidator().validateLoginForm(formData),
    createRoomForm: (formData) => new FormValidator().validateCreateRoomForm(formData)
};

// 创建全局实例
const formValidator = new FormValidator();

// 导出验证器类和实例
window.FormValidator = FormValidator;
window.formValidator = formValidator;
window.validators = validators;

export { FormValidator, validators };
export default formValidator;
