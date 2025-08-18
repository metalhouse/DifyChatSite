/**
 * 简化的认证服务 - 兼容普通script标签使用
 */

const AuthService = {
    get baseURL() {
        // 优先使用环境配置
        if (window.ENV_CONFIG && window.ENV_CONFIG.getApiUrl) {
            return window.ENV_CONFIG.getApiUrl();
        }
        return globalConfig ? globalConfig.api.baseURL : 'http://localhost:4005/api';
    },

    /**
     * 获取当前用户信息
     */
    async getCurrentUser() {
        const token = TokenManager.getAccessToken();
        if (!token) {
            throw new Error('用户未登录');
        }

        // 先尝试从本地存储获取
        const cachedUserInfo = TokenManager.getUserInfo();
        if (cachedUserInfo) {
            return cachedUserInfo;
        }

        // 如果本地没有，从API获取
        try {
            const response = await fetch(`${this.baseURL}/auth/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': TokenManager.getAuthHeader(),
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token过期，清除并跳转登录
                    TokenManager.clearTokens();
                    window.location.href = './login.html';
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            if (result.success && result.data) {
                // 缓存用户信息
                TokenManager.setUserInfo(result.data);
                return result.data;
            } else {
                throw new Error(result.message || '获取用户信息失败');
            }
        } catch (error) {
            console.error('获取用户信息失败:', error);
            throw error;
        }
    },

    /**
     * 登录
     */
    async login(credentials) {
        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || '登录失败');
            }

            if (result.success && result.data) {
                // 保存令牌和用户信息
                TokenManager.setTokens(
                    result.data.access_token,
                    result.data.refresh_token,
                    result.data.user
                );
                return result.data;
            } else {
                throw new Error(result.message || '登录失败');
            }
        } catch (error) {
            console.error('登录请求失败:', error);
            throw error;
        }
    },

    /**
     * 退出登录
     */
    async logout() {
        try {
            const token = TokenManager.getAccessToken();
            if (token) {
                // 尝试调用退出API
                await fetch(`${this.baseURL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': TokenManager.getAuthHeader(),
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.warn('退出API调用失败:', error);
        } finally {
            // 无论API调用是否成功，都清除本地令牌
            TokenManager.clearTokens();
        }
    },

    /**
     * 检查是否已登录
     */
    isLoggedIn() {
        return TokenManager.isLoggedIn();
    },

    /**
     * 刷新令牌
     */
    async refreshToken() {
        const refreshToken = TokenManager.getRefreshToken();
        if (!refreshToken) {
            throw new Error('没有刷新令牌');
        }

        try {
            const response = await fetch(`${this.baseURL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || '刷新令牌失败');
            }

            if (result.success && result.data) {
                // 更新令牌
                TokenManager.setAccessToken(result.data.access_token);
                if (result.data.refresh_token) {
                    TokenManager.setRefreshToken(result.data.refresh_token);
                }
                return result.data;
            } else {
                throw new Error(result.message || '刷新令牌失败');
            }
        } catch (error) {
            // 刷新失败，清除令牌并跳转登录
            TokenManager.clearTokens();
            window.location.href = './login.html';
            throw error;
        }
    }
};

// 兼容性导出
if (typeof window !== 'undefined') {
    window.AuthService = AuthService;
}
