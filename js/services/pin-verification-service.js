/**
 * PIN验证服务
 * 为应用提供PIN验证功能，包括敏感区域访问验证和自动锁定
 */

class PinVerificationService {
    constructor() {
        this.settings = {
            enabled: false,
            hasPin: false,
            lockTimeMinutes: 5
        };
        this.verificationAttempts = 0;
        this.maxAttempts = 3;
        this.currentPromise = null;
        this.autoLockTimer = null;
        
        // 从localStorage加载设置
        this.loadSettings();
    }

    /**
     * 加载PIN设置
     */
    loadSettings() {
        try {
            const stored = localStorage.getItem('pinSettings');
            if (stored) {
                this.settings = { ...this.settings, ...JSON.parse(stored) };
            }
        } catch (error) {
            console.warn('加载PIN设置失败:', error);
        }
    }

    /**
     * 保存PIN设置
     */
    saveSettings() {
        try {
            localStorage.setItem('pinSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('保存PIN设置失败:', error);
        }
    }

    /**
     * 检查是否启用PIN验证
     */
    isEnabled() {
        return this.settings.enabled && this.settings.hasPin;
    }

    /**
     * 获取自动锁定超时时间（毫秒）
     */
    getLockTimeout() {
        return (this.settings.lockTimeMinutes || 5) * 60 * 1000;
    }

    /**
     * 获取API基础URL
     */
    getApiUrl(path = '') {
        // 优先使用全局环境配置
        if (window.ENV_CONFIG && window.ENV_CONFIG.getApiUrl) {
            return window.ENV_CONFIG.getApiUrl(path);
        }
        
        // 降级方案：根据当前域名构建API URL
        const hostname = window.location.hostname;
        const baseUrl = (hostname === 'localhost' || hostname === '127.0.0.1') 
            ? 'http://localhost:4005/api' 
            : `http://${hostname}:4005/api`;
        
        return path ? `${baseUrl}${path.startsWith('/') ? path : '/' + path}` : baseUrl;
    }

    /**
     * 检查PIN状态
     */
    async checkPinStatus() {
        try {
            // 使用全局的 apiClient 或创建简单的请求
            const token = localStorage.getItem('dify_access_token');
            if (!token) {
                throw new Error('用户未登录');
            }

            const url = this.getApiUrl('/pin/status');
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data.hasPin !== undefined) {
                this.settings.hasPin = data.hasPin;
                this.saveSettings();
            }
            return data;
        } catch (error) {
            console.error('检查PIN状态失败:', error);
            throw error;
        }
    }

    /**
     * 设置PIN码
     */
    async setPin(pin) {
        try {
            if (!this.validatePinFormat(pin)) {
                throw new Error('PIN必须是4到6位数字');
            }

            const token = localStorage.getItem('dify_access_token');
            if (!token) {
                throw new Error('用户未登录');
            }

            const url = this.getApiUrl('/pin/set');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pin })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'PIN设置失败');
            }

            this.settings.hasPin = true;
            this.saveSettings();
            return data;
        } catch (error) {
            console.error('设置PIN失败:', error);
            throw error;
        }
    }

    /**
     * 修改PIN码
     */
    async changePin(oldPin, newPin) {
        try {
            if (!oldPin) {
                throw new Error('请输入当前PIN码');
            }

            if (!this.validatePinFormat(newPin)) {
                throw new Error('新PIN必须是4到6位数字');
            }

            if (oldPin === newPin) {
                throw new Error('新PIN不能与当前PIN相同');
            }

            const token = localStorage.getItem('dify_access_token');
            if (!token) {
                throw new Error('用户未登录');
            }

            const url = this.getApiUrl('/pin/change');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ oldPin, newPin })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'PIN修改失败');
            }

            return data;
        } catch (error) {
            console.error('修改PIN失败:', error);
            throw error;
        }
    }

    /**
     * 验证PIN码
     */
    async verifyPin(pin) {
        try {
            const token = localStorage.getItem('dify_access_token');
            if (!token) {
                throw new Error('用户未登录');
            }

            const url = this.getApiUrl('/pin/verify');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pin })
            });

            const data = await response.json();
            return data.success === true;
        } catch (error) {
            console.error('验证PIN失败:', error);
            return false;
        }
    }

    /**
     * 验证PIN格式
     */
    validatePinFormat(pin) {
        if (!pin || pin.length < 4 || pin.length > 6) {
            return false;
        }
        return /^\d+$/.test(pin);
    }

    /**
     * 显示PIN验证对话框
     */
    showVerificationDialog(message = '请输入PIN码以继续访问', showCancel = true) {
        return new Promise((resolve, reject) => {
            // 如果已经有验证对话框打开，先关闭它
            this.closePinModal();

            // 创建模态框
            const modal = this.createPinModal(message, showCancel);
            
            // 设置当前Promise
            this.currentPromise = { resolve, reject };
            this.verificationAttempts = 0;

            // 显示模态框
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();

            // 设置背景z-index（需要在显示后设置）
            setTimeout(() => {
                const modalBackdrop = document.querySelector('.modal-backdrop');
                if (modalBackdrop) {
                    modalBackdrop.style.zIndex = '9999';
                }
                
                const input = modal.querySelector('.pin-input');
                if (input) input.focus();
            }, 300);
        });
    }

    /**
     * 创建PIN验证模态框
     */
    createPinModal(message, showCancel) {
        const modalId = 'dynamicPinVerifyModal';
        
        // 移除已存在的模态框
        const existing = document.getElementById(modalId);
        if (existing) {
            existing.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = modalId;
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('data-bs-backdrop', 'false'); // 禁用默认背景，因为可能已有锁定遮罩
        modal.setAttribute('data-bs-keyboard', 'false');
        
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content" style="border: 2px solid #28a745;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #28a745, #20c997); color: white;">
                        <h5 class="modal-title" style="color: white;">
                            <i class="fas fa-lock me-2"></i>
                            PIN验证
                        </h5>
                    </div>
                    <div class="modal-body" style="padding: 1.5rem;">
                        <p class="text-muted mb-3">
                            <i class="fas fa-shield-alt me-1"></i>
                            ${message}
                        </p>
                        <div class="form-group">
                            <label class="form-label" for="dynamicVerifyPin">PIN码 *</label>
                            <input type="password" class="form-control pin-input" id="dynamicVerifyPin" 
                                   placeholder="请输入PIN码" maxlength="6" 
                                   pattern="[0-9]*" inputmode="numeric" required
                                   style="font-family: monospace; font-size: 1.1rem; letter-spacing: 0.2em; text-align: center;">
                            <div class="invalid-feedback" id="dynamicPinVerifyError"></div>
                        </div>
                        <div class="pin-verify-attempts" id="dynamicPinVerifyAttempts" style="display: none; margin-top: 1rem; padding: 0.5rem; background-color: rgba(255, 193, 7, 0.1); border-radius: 0.25rem;">
                            <small class="text-warning">
                                <i class="fas fa-exclamation-triangle me-1"></i>
                                <span id="dynamicAttemptsText">剩余尝试次数: 3</span>
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        ${showCancel ? '<button type="button" class="btn btn-secondary" onclick="window.pinVerificationService.cancelVerification()">取消</button>' : ''}
                        <button type="button" class="btn btn-primary" onclick="window.pinVerificationService.confirmVerification()">
                            <i class="fas fa-unlock"></i>
                            验证
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 确保模态框有足够高的z-index，超过锁定遮罩
        modal.style.zIndex = '10001';
        
        // 由于禁用了默认背景，不需要设置backdrop的z-index

        // 绑定回车键事件
        const input = modal.querySelector('#dynamicVerifyPin');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.confirmVerification();
                }
            });
        }

        return modal;
    }

    /**
     * 确认PIN验证
     */
    async confirmVerification() {
        const pin = document.getElementById('dynamicVerifyPin')?.value;
        const errorElement = document.getElementById('dynamicPinVerifyError');
        const inputElement = document.getElementById('dynamicVerifyPin');

        if (!pin) {
            this.showPinVerifyError('请输入PIN码');
            return;
        }

        try {
            const isValid = await this.verifyPin(pin);
            
            if (isValid) {
                // 验证成功
                this.closePinModal();
                if (this.currentPromise) {
                    this.currentPromise.resolve(true);
                    this.currentPromise = null;
                }
            } else {
                // 验证失败
                this.verificationAttempts++;
                
                if (this.verificationAttempts >= this.maxAttempts) {
                    this.showPinVerifyError('PIN验证失败次数过多，请稍后再试');
                    setTimeout(() => {
                        this.closePinModal();
                        if (this.currentPromise) {
                            this.currentPromise.reject(new Error('PIN验证失败次数过多'));
                            this.currentPromise = null;
                        }
                    }, 2000);
                } else {
                    this.showPinVerifyError('PIN验证失败，请重试');
                    this.updateAttemptsDisplay();
                    inputElement.value = '';
                    inputElement.focus();
                }
            }
        } catch (error) {
            console.error('PIN验证请求失败:', error);
            this.showPinVerifyError('验证请求失败，请稍后重试');
        }
    }

    /**
     * 取消PIN验证
     */
    cancelVerification() {
        this.closePinModal();
        if (this.currentPromise) {
            this.currentPromise.reject(new Error('用户取消PIN验证'));
            this.currentPromise = null;
        }
    }

    /**
     * 关闭PIN模态框
     */
    closePinModal() {
        const modal = document.getElementById('dynamicPinVerifyModal');
        if (modal) {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) {
                bootstrapModal.hide();
            }
            setTimeout(() => modal.remove(), 300);
        }
    }

    /**
     * 显示PIN验证错误
     */
    showPinVerifyError(message) {
        const errorElement = document.getElementById('dynamicPinVerifyError');
        const inputElement = document.getElementById('dynamicVerifyPin');
        
        if (errorElement && inputElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            inputElement.classList.add('is-invalid');
            
            setTimeout(() => {
                inputElement.classList.remove('is-invalid');
            }, 3000);
        }
    }

    /**
     * 更新尝试次数显示
     */
    updateAttemptsDisplay() {
        const attemptsElement = document.getElementById('dynamicPinVerifyAttempts');
        const attemptsText = document.getElementById('dynamicAttemptsText');
        
        if (this.verificationAttempts > 0 && attemptsElement && attemptsText) {
            const remaining = this.maxAttempts - this.verificationAttempts;
            attemptsText.textContent = `剩余尝试次数: ${remaining}`;
            attemptsElement.style.display = 'block';
        } else if (attemptsElement) {
            attemptsElement.style.display = 'none';
        }
    }

    /**
     * 启用/禁用PIN验证
     */
    setEnabled(enabled) {
        this.settings.enabled = enabled;
        this.saveSettings();
    }

    /**
     * 设置自动锁定时间
     */
    setLockTimeMinutes(minutes) {
        this.settings.lockTimeMinutes = minutes;
        this.saveSettings();
    }

    /**
     * 标记已有PIN
     */
    setHasPin(hasPin) {
        this.settings.hasPin = hasPin;
        this.saveSettings();
    }

    /**
     * 获取设置
     */
    getSettings() {
        return { ...this.settings };
    }
}

// 创建全局实例
if (typeof window !== 'undefined') {
    window.PinVerificationService = PinVerificationService;
    window.pinVerificationService = new PinVerificationService();
    
    // 为兼容性保留旧的接口
    window.pinVerification = {
        isEnabled: () => window.pinVerificationService.isEnabled(),
        getLockTimeout: () => window.pinVerificationService.getLockTimeout(),
        showVerification: (message, cancelCallback) => {
            const showCancel = typeof cancelCallback === 'function';
            const promise = window.pinVerificationService.showVerificationDialog(message, showCancel);
            
            if (showCancel) {
                promise.catch((error) => {
                    if (error.message === '用户取消PIN验证') {
                        cancelCallback();
                    }
                });
            }
            
            return promise;
        },
        verify: (pin) => window.pinVerificationService.verifyPin(pin)
    };
}
