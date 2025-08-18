/**
 * DifyChat API客户端 - 兼容版本
 * 不使用ES6 modules，直接在全局作用域工作
 */

// 等待依赖项加载
(function() {
    'use strict';

    // 检查依赖
    function checkDependencies() {
        return window.ENV_CONFIG && window.GLOBAL_CONFIG;
    }

    // HTTP客户端
    class HttpClient {
        constructor(options = {}) {
            this.baseURL = options.baseURL || (window.ENV_CONFIG ? window.ENV_CONFIG.getApiUrl() : window.location.origin);
            this.timeouts = {
                default: window.ENV_CONFIG?.API_TIMEOUT || 30000,
                dify: window.ENV_CONFIG?.DIFY_TIMEOUT || 120000,
                upload: window.ENV_CONFIG?.UPLOAD_TIMEOUT || 180000,
                websocket: window.ENV_CONFIG?.WS_TIMEOUT || 60000
            };
            this.retryCount = 3;
            this.retryDelay = 1000;
        }

        async request(url, options = {}) {
            const controller = new AbortController();
            const timeoutMs = options.timeout || this.timeouts.default;
            
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const config = {
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                signal: controller.signal,
                ...options
            };

            if (options.body && typeof options.body === 'object') {
                config.body = JSON.stringify(options.body);
            }

            try {
                const response = await fetch(url, config);
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        }

        async get(url, options = {}) {
            return this.request(url, { ...options, method: 'GET' });
        }

        async post(url, data, options = {}) {
            return this.request(url, { 
                ...options, 
                method: 'POST', 
                body: data 
            });
        }

        async put(url, data, options = {}) {
            return this.request(url, { 
                ...options, 
                method: 'PUT', 
                body: data 
            });
        }

        async delete(url, options = {}) {
            return this.request(url, { ...options, method: 'DELETE' });
        }
    }

    // DifyAPI服务类
    class DifyApiService {
        constructor() {
            if (!checkDependencies()) {
                console.warn('等待配置文件加载...');
                return;
            }

            this.httpClient = new HttpClient();
            this.baseURL = window.ENV_CONFIG.getApiUrl();
            this.initialized = true;
        }

        // 健康检查
        async checkHealth() {
            try {
                const response = await this.httpClient.get(`${this.baseURL}/health`);
                return response.ok;
            } catch (error) {
                console.warn('健康检查失败:', error.message);
                return false;
            }
        }

        // 用户认证
        async login(credentials) {
            const response = await this.httpClient.post(`${this.baseURL}/auth/login`, credentials);
            return response.json();
        }

        async logout() {
            const token = localStorage.getItem('dify_access_token');
            if (token) {
                const response = await this.httpClient.post(`${this.baseURL}/auth/logout`, {}, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                return response.json();
            }
            return { success: true };
        }

        async refreshToken() {
            const refreshToken = localStorage.getItem('dify_refresh_token');
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await this.httpClient.post(`${this.baseURL}/auth/refresh`, {
                refresh_token: refreshToken
            });
            return response.json();
        }

        // 对话管理
        async getConversations() {
            const token = this.getAuthToken();
            const response = await this.httpClient.get(`${this.baseURL}/conversations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.json();
        }

        async createConversation(data) {
            const token = this.getAuthToken();
            const response = await this.httpClient.post(`${this.baseURL}/conversations`, data, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.json();
        }

        async deleteConversation(id) {
            const token = this.getAuthToken();
            const response = await this.httpClient.delete(`${this.baseURL}/conversations/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.json();
        }

        // 消息发送
        async sendMessage(conversationId, message, options = {}) {
            const token = this.getAuthToken();
            const response = await this.httpClient.post(
                `${this.baseURL}/conversations/${conversationId}/messages`, 
                {
                    content: message,
                    ...options
                },
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: this.httpClient.timeouts.dify
                }
            );
            return response.json();
        }

        // 获取认证token
        getAuthToken() {
            const token = localStorage.getItem('dify_access_token');
            if (!token) {
                throw new Error('No authentication token available');
            }
            return token;
        }

        // 检查是否已认证
        isAuthenticated() {
            return !!localStorage.getItem('dify_access_token');
        }

        // 获取用户信息
        getCurrentUser() {
            const userInfo = localStorage.getItem('dify_user_info');
            return userInfo ? JSON.parse(userInfo) : null;
        }
    }

    // 初始化函数
    function initialize() {
        if (!checkDependencies()) {
            setTimeout(initialize, 100);
            return;
        }

        // 创建全局实例
        window.httpClient = new HttpClient();
        window.DifyApiService = DifyApiService;

        console.log('✅ DifyAPI兼容版本已加载');
    }

    // 开始初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
