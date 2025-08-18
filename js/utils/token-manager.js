/**
 * Token管理器 - 处理访问令牌和刷新令牌
 * 兼容普通script标签使用
 */

const TokenManager = {
    ACCESS_TOKEN_KEY: 'dify_access_token',
    REFRESH_TOKEN_KEY: 'dify_refresh_token',
    USER_INFO_KEY: 'dify_user_info',

    /**
     * 设置访问令牌
     */
    setAccessToken(token) {
        if (token) {
            localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
        } else {
            localStorage.removeItem(this.ACCESS_TOKEN_KEY);
        }
    },

    /**
     * 获取访问令牌
     */
    getAccessToken() {
        return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    },

    /**
     * 设置刷新令牌
     */
    setRefreshToken(token) {
        if (token) {
            localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
        } else {
            localStorage.removeItem(this.REFRESH_TOKEN_KEY);
        }
    },

    /**
     * 获取刷新令牌
     */
    getRefreshToken() {
        return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    },

    /**
     * 设置用户信息
     */
    setUserInfo(userInfo) {
        if (userInfo) {
            localStorage.setItem(this.USER_INFO_KEY, JSON.stringify(userInfo));
        } else {
            localStorage.removeItem(this.USER_INFO_KEY);
        }
    },

    /**
     * 获取用户信息
     */
    getUserInfo() {
        const userInfoStr = localStorage.getItem(this.USER_INFO_KEY);
        try {
            return userInfoStr ? JSON.parse(userInfoStr) : null;
        } catch (error) {
            console.error('解析用户信息失败:', error);
            return null;
        }
    },

    /**
     * 检查是否已登录
     */
    isLoggedIn() {
        return !!this.getAccessToken();
    },

    /**
     * 清除所有令牌
     */
    clearTokens() {
        localStorage.removeItem(this.ACCESS_TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
        localStorage.removeItem(this.USER_INFO_KEY);
    },

    /**
     * 设置令牌对
     */
    setTokens(accessToken, refreshToken, userInfo) {
        this.setAccessToken(accessToken);
        this.setRefreshToken(refreshToken);
        if (userInfo) {
            this.setUserInfo(userInfo);
        }
    },

    /**
     * 获取认证头
     */
    getAuthHeader() {
        const token = this.getAccessToken();
        return token ? `Bearer ${token}` : null;
    }
};

// 兼容旧版本使用方式
if (typeof window !== 'undefined') {
    window.TokenManager = TokenManager;
}
