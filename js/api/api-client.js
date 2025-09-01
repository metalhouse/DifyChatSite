/**
 * HTTP客户端 - 基于DifyChatBack v2.0 API指南
 * 提供按场景区分的超时配置和错误处理
 * 基于前端对接API指南重新整理.md第3章基础配置
 */

// 导入环境配置
import { ENV_CONFIG } from '../../config/env.js';
import { API_ENDPOINTS } from './endpoints.js';

class HttpClient {
    constructor(options = {}) {
        // 基础URL配置 - 基于指南第3.1节
        this.baseURL = options.baseURL || ENV_CONFIG.getApiUrl();
        
        // 超时配置 - 基于指南第3.6节按场景区分
        this.timeouts = {
            default: options.timeout || ENV_CONFIG.API_TIMEOUT,      // 通用API 30秒
            dify: ENV_CONFIG.DIFY_TIMEOUT,                          // AI对话 120秒  
            upload: ENV_CONFIG.UPLOAD_TIMEOUT,                       // 文件上传 180秒
            websocket: ENV_CONFIG.WS_TIMEOUT                         // WebSocket 60秒
        };
        
        // 默认请求头
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
        };
        
        // 调试信息
        if (ENV_CONFIG.isDebug()) {
            console.log('🔧 HttpClient初始化:', {
                baseURL: this.baseURL,
                timeouts: this.timeouts,
                environment: ENV_CONFIG.ENVIRONMENT,
                hasAuth: typeof this.getAuthHeaders === 'function'
            });
        }
    }

    /**
     * 获取认证头 - 基于指南第4章JWT认证
     */
    getAuthHeaders() {
        const token = localStorage.getItem('dify_access_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🔑 认证头配置:', {
                hasToken: !!token,
                tokenLength: token ? token.length : 0,
                headers: headers
            });
        }
        return headers;
    }

    /**
     * 根据端点类型获取超时时间
     * @param {string} url - 请求URL
     * @returns {number} 超时时间（毫秒）
     */
    getTimeoutForUrl(url) {
        // AI对话相关端点使用更长超时
        if (url.includes('/conversations') && url.includes('/messages')) {
            return this.timeouts.dify;
        }
        
        // 文件上传端点
        if (url.includes('/files/upload')) {
            return this.timeouts.upload;
        }
        
        // 默认超时
        return this.timeouts.default;
    }

    /**
     * 核心请求方法 - 增强错误处理和超时管理
     */
    async request(method, url, data = null, options = {}) {
        // 修复URL构建逻辑 - 如果URL已经是完整路径或以/api开头，直接使用baseURL拼接
        let fullUrl;
        if (url.startsWith('http')) {
            fullUrl = url;
        } else if (url.startsWith('/api')) {
            // 如果URL已经包含/api前缀，使用API_BASE_URL拼接
            fullUrl = `${ENV_CONFIG.API_BASE_URL}${url}`;
        } else {
            // 否则使用完整的API URL（包含/api前缀）
            fullUrl = `${this.baseURL}${url.startsWith('/') ? url : '/' + url}`;
        }
        
        const timeout = options.timeout || this.getTimeoutForUrl(url);
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🌐 HTTP请求开始:', {
                method: method.toUpperCase(),
                url: url,
                fullUrl: fullUrl,
                timeout: timeout,
                hasData: !!data,
                dataType: data ? typeof data : 'null'
            });
        }
        
        const config = {
            method: method.toUpperCase(),
            headers: {
                ...this.defaultHeaders,
                ...this.getAuthHeaders(),
                ...options.headers
            }
        };

        if (ENV_CONFIG.isDebug()) {
            console.log('📡 请求配置:', {
                method: config.method,
                headers: config.headers,
                fullUrl: fullUrl,
                timeout: timeout
            });
        }

        // 添加请求体
        if (data && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
            if (data instanceof FormData) {
                delete config.headers['Content-Type']; // 让浏览器自动设置
                config.body = data;
            } else {
                config.body = JSON.stringify(data);
            }
        }

        // 添加超时控制 - 使用动态超时时间
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        config.signal = controller.signal;

        try {
            const response = await fetch(fullUrl, config);
            clearTimeout(timeoutId);
            
            // 记录响应状态
            if (ENV_CONFIG.isDebug()) {
                console.log('📨 HTTP响应:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    url: fullUrl
                });
            }
            
            // 首先检查HTTP状态
            if (!response.ok) {
                // 尝试解析错误响应 - 基于指南第8章错误处理规范
                let errorData = null;
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        errorData = await response.json();
                        // 详细记录错误响应内容
                        if (ENV_CONFIG.isDebug()) {
                            console.error('❌ API错误响应详情:', {
                                status: response.status,
                                url: fullUrl,
                                errorData: JSON.stringify(errorData, null, 2)
                            });
                        }
                    } else {
                        // 非JSON响应，可能是HTML错误页面
                        const text = await response.text();
                        errorData = { message: text.substring(0, 200) };
                    }
                } catch (parseError) {
                    console.warn('⚠️ 错误响应解析失败:', parseError.message);
                    errorData = { message: `HTTP ${response.status} ${response.statusText}` };
                }
                
                const errorResponse = {
                    success: false,
                    error_code: errorData?.error_code || `HTTP_${response.status}`,
                    message: errorData?.message || `HTTP错误 ${response.status}: ${response.statusText}`,
                    data: errorData?.data || null,
                    status: response.status,
                    timestamp: new Date().toISOString()
                };
                
                // 特殊处理401错误 - 简化版
                if (response.status === 401) {
                    console.log('🔐 API客户端检测到401错误');
                    
                    // 简单的处理：在下一个事件循环中清理并跳转
                    setTimeout(() => {
                        // 清除认证信息
                        localStorage.removeItem('dify_access_token');
                        localStorage.removeItem('dify_refresh_token');
                        localStorage.removeItem('userInfo');
                        localStorage.removeItem('currentUser');
                        
                        // 如果不在登录页面，则跳转
                        if (!window.location.pathname.includes('login.html')) {
                            const returnUrl = encodeURIComponent(window.location.href);
                            window.location.href = `./login.html?return=${returnUrl}`;
                        }
                    }, 100);
                }
                
                return errorResponse;
            }
            
            // 尝试解析响应JSON
            let result;
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    // 非JSON响应，可能是纯文本
                    const text = await response.text();
                    result = { message: text, success: true };
                }
            } catch (parseError) {
                console.error('❌ 响应JSON解析失败:', parseError.message);
                return {
                    success: false,
                    error_code: 'PARSE_ERROR',
                    message: '服务器响应格式错误，无法解析JSON',
                    data: null,
                    status: response.status,
                    timestamp: new Date().toISOString()
                };
            }
            
            // 记录成功响应（调试模式）
            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 请求成功:', {
                    url: fullUrl,
                    status: response.status,
                    hasSuccess: result.success !== undefined,
                    dataType: typeof result.data
                });
            }
            
            // 确保返回标准化成功响应 - 基于指南响应格式
            if (result.success !== undefined) {
                return {
                    ...result,
                    status: response.status,
                    timestamp: result.timestamp || new Date().toISOString()
                };
            } else {
                // 兼容旧格式或非标准响应
                return {
                    success: true,
                    message: result.message || '请求成功',
                    data: result,
                    status: response.status,
                    timestamp: new Date().toISOString()
                };
            }
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            // 详细的错误处理 - 基于指南第8章错误处理规范
            let errorResponse = {
                success: false,
                data: null,
                timestamp: new Date().toISOString()
            };
            
            if (error.name === 'AbortError') {
                errorResponse.error_code = 'TIMEOUT_ERROR';
                errorResponse.message = `请求超时（${timeout/1000}秒），请检查网络连接`;
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorResponse.error_code = 'NETWORK_ERROR';
                errorResponse.message = '网络连接失败，请检查网络状态';
            } else {
                errorResponse.error_code = 'UNKNOWN_ERROR';
                errorResponse.message = error.message || '未知错误';
            }
            
            if (ENV_CONFIG.isDebug()) {
                console.error('❌ 请求异常:', {
                    url: fullUrl,
                    error: error.name,
                    message: error.message,
                    timeout: timeout
                });
            }
            
            return errorResponse;
        }
    }

    /**
     * 流式请求处理 - 基于指南第5.3.2节流式模式
     * 支持Server-Sent Events (SSE)响应
     */
    async requestStream(url, data = null, options = {}) {
        const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
        const timeout = options.timeout || this.timeouts.dify; // 流式请求使用AI超时
        
        const config = {
            method: 'POST',
            headers: {
                ...this.defaultHeaders,
                ...this.getAuthHeaders(),
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                ...options.headers
            }
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        if (ENV_CONFIG.isDebug()) {
            console.log('🌊 开始流式请求:', {
                url: fullUrl,
                timeout: timeout,
                hasData: !!data
            });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        config.signal = controller.signal;

        try {
            const response = await fetch(fullUrl, config);
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response; // 返回Response对象供调用者处理流式数据
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (ENV_CONFIG.isDebug()) {
                console.error('❌ 流式请求失败:', {
                    url: fullUrl,
                    error: error.message
                });
            }
            
            throw error;
        }
    }

    /**
     * HTTP方法快捷方式
     */
    get(url, params = null, options = {}) {
        if (params) {
            const searchParams = new URLSearchParams();
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    searchParams.append(key, params[key]);
                }
            });
            const queryString = searchParams.toString();
            if (queryString) {
                url += (url.includes('?') ? '&' : '?') + queryString;
            }
        }
        return this.request('GET', url, null, options);
    }

    post(url, data = null, options = {}) {
        return this.request('POST', url, data, options);
    }

    put(url, data = null, options = {}) {
        return this.request('PUT', url, data, options);
    }

    patch(url, data = null, options = {}) {
        return this.request('PATCH', url, data, options);
    }

    delete(url, options = {}) {
        return this.request('DELETE', url, null, options);
    }

    /**
     * 文件上传 - 支持自定义超时
     */
    upload(url, file, fieldName = 'file', options = {}) {
        const formData = new FormData();
        formData.append(fieldName, file);
        
        // 文件上传使用专用超时
        const uploadOptions = {
            timeout: this.timeouts.upload,
            ...options
        };
        
        return this.post(url, formData, uploadOptions);
    }

    /**
     * 批量请求 - 带并发控制
     */
    async batch(requests, maxConcurrency = 5) {
        const results = [];
        
        for (let i = 0; i < requests.length; i += maxConcurrency) {
            const batch = requests.slice(i, i + maxConcurrency);
            const promises = batch.map(req => 
                this.request(req.method, req.url, req.data, req.options)
            );
            const batchResults = await Promise.all(promises);
            results.push(...batchResults);
        }
        
        return results;
    }

    /**
     * 健康检查 - 基于指南第7章
     */
    async healthCheck() {
        try {
            const result = await this.get('/health', null, { timeout: 5000 });
            return result;
        } catch (error) {
            return {
                success: false,
                error_code: 'HEALTH_CHECK_FAILED',
                message: '服务器健康检查失败',
                data: null
            };
        }
    }
}

// 创建全局实例供其他模块使用 - 符合API指南命名
const apiClient = new HttpClient();
window.HttpClient = HttpClient;
window.apiClient = apiClient;

// ES模块导出 - 符合API指南
export { HttpClient };
export default apiClient;
