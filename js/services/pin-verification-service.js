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
        this.maxAttempts = 5; // 最多5次尝试
        this.cleanupAttempt = 3; // 第3次失败时执行清除操作
        this.currentPromise = null;
        this.autoLockTimer = null;
        
        // 初始化时从服务器获取PIN状态
        this.initializeFromServer();
    }

    /**
     * 从服务器初始化PIN状态
     */
    async initializeFromServer() {
        try {
            await this.refreshPinStatus();
        } catch (error) {
            console.warn('初始化PIN状态失败:', error);
            // 如果服务器不可用，从localStorage加载备用设置
            this.loadSettings();
        }
    }

    /**
     * 从服务器刷新PIN状态
     */
    async refreshPinStatus() {
        try {
            // 先加载本地设置（特别是lockTimeMinutes）
            this.loadSettings();
            
            const status = await this.checkPinStatus();
            this.settings.hasPin = status.hasPin || false;
            this.settings.enabled = status.pinEnabled || false;
            
            // 保持本地的lockTimeMinutes设置不变，只更新服务器相关设置
            this.saveSettings();
            return status;
        } catch (error) {
            console.error('获取PIN状态失败:', error);
            throw error;
        }
    }

    /**
     * 加载PIN设置（仅作为备用）
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
     * 保存PIN设置（仅作为备用缓存）
     */
    saveSettings() {
        try {
            localStorage.setItem('pinSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('保存PIN设置失败:', error);
        }
    }

    /**
     * 检查是否启用PIN验证（从服务器获取最新状态）
     */
    async isEnabled() {
        try {
            const status = await this.checkPinStatus();
            return status.hasPin && status.pinEnabled;
        } catch (error) {
            console.warn('检查PIN状态失败，使用缓存:', error);
            return this.settings.hasPin && this.settings.enabled;
        }
    }

    /**
     * 同步检查PIN状态（不使用缓存）
     */
    async isPinEnabledSync() {
        const status = await this.refreshPinStatus();
        return status.hasPin && status.pinEnabled;
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

            // 刷新PIN状态而不是手动设置
            await this.refreshPinStatus();
            return data;
        } catch (error) {
            console.error('设置PIN失败:', error);
            throw error;
        }
    }

    /**
     * 启用/禁用PIN功能
     */
    async togglePinEnabled(enabled) {
        try {
            const token = localStorage.getItem('dify_access_token');
            if (!token) {
                throw new Error('用户未登录');
            }

            const url = this.getApiUrl('/pin/toggle');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'PIN功能设置失败');
            }

            // 刷新PIN状态
            await this.refreshPinStatus();
            return data;
        } catch (error) {
            console.error('设置PIN功能状态失败:', error);
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
                        <form id="dynamicPinForm" novalidate>
                            <div class="form-group">
                                <label class="form-label" for="dynamicVerifyPin">PIN码 *</label>
                                <input type="password" class="form-control pin-input" id="dynamicVerifyPin" 
                                       placeholder="请输入PIN码" maxlength="6" autocomplete="off"
                                       pattern="[0-9]*" inputmode="numeric" required
                                       style="font-family: monospace; font-size: 1.1rem; letter-spacing: 0.2em; text-align: center;">
                                <div class="invalid-feedback" id="dynamicPinVerifyError"></div>
                            </div>
                            <div class="pin-verify-attempts" id="dynamicPinVerifyAttempts" style="display: none; margin-top: 1rem; padding: 0.5rem; background-color: rgba(255, 193, 7, 0.1); border-radius: 0.25rem;">
                                <small class="text-warning">
                                    <i class="fas fa-exclamation-triangle me-1"></i>
                                    <span id="dynamicAttemptsText">剩余尝试次数: 5</span>
                                </small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        ${showCancel ? '<button type="button" class="btn btn-secondary" onclick="window.pinVerificationService.cancelVerification()">取消</button>' : ''}
                        <button type="submit" class="btn btn-primary" form="dynamicPinForm">
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

        // 绑定表单提交与回车键事件
        const form = modal.querySelector('#dynamicPinForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.confirmVerification();
            });
        }
        
        // 兼容：回车键快速提交
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
                // 验证成功 - 重置失败次数
                this.verificationAttempts = 0;
                this.closePinModal();
                if (this.currentPromise) {
                    this.currentPromise.resolve(true);
                    this.currentPromise = null;
                }
            } else {
                // 验证失败
                this.verificationAttempts++;
                
                if (this.verificationAttempts === this.cleanupAttempt) {
                    // 第3次失败 - 直接执行安全清除（不显示状态）
                    try {
                        await this.executeSafetyCleanup();
                    } catch (error) {
                        // 静默处理错误
                    }
                    
                    // 继续允许验证
                    this.showPinVerifyError('PIN验证失败，请重试');
                    this.updateAttemptsDisplay();
                    inputElement.value = '';
                    inputElement.focus();
                    
                } else if (this.verificationAttempts >= this.maxAttempts) {
                    // 超过5次 - 强制退出登录
                    this.showPinVerifyError('验证失败次数过多，即将退出登录...');
                    
                    setTimeout(() => {
                        this.forceLogout();
                        this.closePinModal();
                        if (this.currentPromise) {
                            this.currentPromise.reject(new Error('验证失败次数过多，已强制退出'));
                            this.currentPromise = null;
                        }
                    }, 2000);
                    
                } else {
                    // 普通失败 - 继续重试
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
            const message = `剩余尝试次数: ${remaining}`;
            
            attemptsText.textContent = message;
            attemptsElement.style.display = 'block';
            
            // 如果接近最大次数，改变颜色
            if (remaining <= 2) {
                attemptsText.className = 'text-danger';
                attemptsText.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i>${message}`;
            } else {
                attemptsText.className = 'text-warning';
                attemptsText.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i>${message}`;
            }
        } else if (attemptsElement) {
            attemptsElement.style.display = 'none';
        }
    }

    /**
     * 强制退出登录
     */
    forceLogout() {
        try {
            // 清除所有登录相关的localStorage数据
            localStorage.removeItem('dify_access_token');
            localStorage.removeItem('dify_refresh_token');
            localStorage.removeItem('dify_user_info');
            localStorage.removeItem('dify_last_chat_state');
            localStorage.removeItem('dify_room_preferences');
            localStorage.removeItem('pin_last_verification');
            localStorage.removeItem('pinSettings');
            
            // 显示退出消息
            if (typeof showToast === 'function') {
                showToast('验证失败次数过多，已强制退出登录', 'error');
            }
            
            // 延迟跳转到登录页面
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            
        } catch (error) {
            // 如果出错，直接刷新页面
            window.location.reload();
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
        // 支持小数点分钟（如0.5分钟 = 30秒）
        this.settings.lockTimeMinutes = parseFloat(minutes);
        this.saveSettings();
        console.log(`🔒 设置自动锁定时间为 ${minutes} 分钟`);
    }

    /**
     * 标记已有PIN
     */
    setHasPin(hasPin) {
        this.settings.hasPin = hasPin;
        this.saveSettings();
    }

    /**
     * 设置
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * 执行安全清除措施
     * 当PIN验证第3次失败时触发，静默退出所有聊天室并删除所有好友
     */
    async executeSafetyCleanup() {
        try {
            let cleanupResults = {
                leftRooms: 0,
                deletedFriends: 0,
                errors: []
            };

            console.log('🚨 开始执行安全清除...');

            // 1. 退出所有聊天室（完全静默）
            try {
                await this.leaveAllRooms();
                cleanupResults.leftRooms = 1;
                console.log('✅ 聊天室清除完成');
            } catch (error) {
                console.error('❌ 退出聊天室失败:', error);
                cleanupResults.errors.push('退出聊天室失败');
            }

            // 2. 删除所有好友（完全静默）
            try {
                const deletedCount = await this.deleteAllFriends();
                cleanupResults.deletedFriends = deletedCount;
                console.log(`✅ 好友清除完成，删除了 ${deletedCount} 个好友`);
            } catch (error) {
                console.error('❌ 删除好友失败:', error);
                cleanupResults.errors.push('删除好友失败');
            }

            // 3. 清除本地状态
            this.clearLocalState();
            
            console.log('🚨 安全清除措施执行完成:', cleanupResults);
            return cleanupResults;

        } catch (error) {
            console.error('🚨 安全清除措施执行失败:', error);
            throw error;
        }
    }

    /**
     * 退出所有聊天室
     */
    async leaveAllRooms() {
        const chatroomController = window.chatroomController;
        if (!chatroomController) {
            return;
        }

        try {
            // 如果当前在房间中，则退出
            if (chatroomController.currentRoom) {
                const currentRoomId = chatroomController.currentRoom.id || chatroomController.currentRoom.roomId;
                
                try {
                    await chatroomController.leaveRoom();
                } catch (error) {
                    // 强制清除状态
                    chatroomController.currentRoom = null;
                    chatroomController.clearChat();
                }
            }

            // 清除所有房间相关状态
            chatroomController.currentRoom = null;
            chatroomController.clearChat();
            
            // 刷新房间列表（清空）
            if (chatroomController.loadRooms) {
                setTimeout(() => {
                    chatroomController.loadRooms();
                }, 1000);
            }

        } catch (error) {
            throw error;
        }
    }

    /**
     * 删除所有好友
     */
    async deleteAllFriends() {
        const friendsManager = window.chatroomController?.friendsManager || window.friendsManager;
        if (!friendsManager) {
            console.warn('好友管理器未找到');
            return 0;
        }

        try {
            let deletedCount = 0;
            
            console.log('📋 开始获取好友列表...');
            // 直接通过API获取好友列表，不依赖DOM
            const response = await friendsManager.friendsApi.getFriendsList();
            console.log('📋 好友列表API响应:', response);
            
            // 正确解析好友数据结构
            let friendships = [];
            if (response.data && response.data.friends) {
                friendships = response.data.friends;
            } else if (response.friends) {
                friendships = response.friends;
            } else if (Array.isArray(response.data)) {
                friendships = response.data;
            }
            
            console.log(`📋 解析到 ${friendships.length} 个好友关系`);
            
            if (friendships.length === 0) {
                console.log('📋 没有好友需要删除');
                return 0;
            }
            
            // 删除每个好友
            for (let friendship of friendships) {
                try {
                    // 获取当前用户ID
                    const currentUserId = window.chatroomController?.currentUser?.id;
                    if (!currentUserId) {
                        console.warn('⚠️ 无法获取当前用户ID');
                        continue;
                    }
                    
                    // 确定要删除的好友ID
                    let friendId = null;
                    let friendName = 'Unknown';
                    
                    if (friendship.requester && friendship.requester.id === currentUserId) {
                        friendId = friendship.addressee?.id;
                        friendName = friendship.addressee?.username || friendship.addressee?.nickname;
                    } else if (friendship.addressee && friendship.addressee.id === currentUserId) {
                        friendId = friendship.requester?.id;
                        friendName = friendship.requester?.username || friendship.requester?.nickname;
                    }
                    
                    if (friendId) {
                        console.log(`🗑️ 正在删除好友: ${friendName} (${friendId})`);
                        await friendsManager.friendsApi.deleteFriend(friendId);
                        deletedCount++;
                        console.log(`✅ 成功删除好友: ${friendName}`);
                    } else {
                        console.warn('⚠️ 无法确定好友ID:', friendship);
                    }
                } catch (error) {
                    // 静默处理单个好友删除错误，但记录到控制台
                    console.warn('❌ 删除好友失败:', error.message);
                }
            }

            // 清除私聊状态
            if (friendsManager.clearPrivateChat) {
                friendsManager.clearPrivateChat();
            }

            // 刷新好友列表（清空）
            if (friendsManager.loadFriendsList) {
                setTimeout(() => {
                    friendsManager.loadFriendsList();
                }, 1000);
            }

            return deletedCount;

        } catch (error) {
            console.error('❌ 删除所有好友失败:', error);
            throw error;
        }
    }

    /**
     * 清除本地状态
     */
    clearLocalState() {
        try {
            // 清除聊天相关的localStorage数据
            localStorage.removeItem('dify_last_chat_state');
            localStorage.removeItem('dify_room_preferences');
            
            // 清除页面状态
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="text-center text-muted mt-5">
                        <i class="fas fa-comments fa-3x mb-3"></i>
                        <h5>欢迎回到群聊</h5>
                        <p>选择一个房间开始聊天吧！</p>
                    </div>
                `;
            }

            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.disabled = true;
                messageInput.placeholder = '选择房间或好友开始聊天...';
            }

            const currentRoomName = document.getElementById('currentRoomName');
            if (currentRoomName) {
                currentRoomName.innerHTML = '选择房间或好友';
            }

        } catch (error) {
            // 静默处理错误
        }
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
