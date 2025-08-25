/**
 * 反向代理部署配置
 * 针对 https://nas.pznas.com:7990 反代部署的专用配置
 */

// 反代服务器配置
const REVERSE_PROXY_CONFIG = {
    // 反代服务器信息
    PROXY_DOMAIN: 'nas.pznas.com',
    PROXY_PORT: 7990,
    PROXY_PROTOCOL: 'https',
    
    // 后端服务配置
    BACKEND: {
        // 后端API地址（通过反代访问）
        BASE_URL: 'https://nas.pznas.com:7990',
        API_PREFIX: '/api',
        
        // WebSocket配置（通过反代访问）
        WS_URL: 'wss://nas.pznas.com:7990',
        WS_PREFIX: '/ws',
        
        // 超时配置（考虑反代延迟）
        API_TIMEOUT: 45000,        // 45秒（增加15秒考虑反代延迟）
        DIFY_TIMEOUT: 150000,      // 150秒（增加30秒考虑AI处理时间）
        UPLOAD_TIMEOUT: 300000,    // 300秒（增加120秒考虑文件上传通过反代的时间）
        WS_TIMEOUT: 90000,         // 90秒（增加30秒考虑WebSocket反代延迟）
        
        // 重试配置
        RETRY_COUNT: 3,
        RETRY_DELAY: 2000          // 增加重试延迟
    },
    
    // CORS配置
    CORS: {
        WITH_CREDENTIALS: true,
        ALLOWED_HEADERS: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin'
        ]
    },
    
    // 安全配置
    SECURITY: {
        SECURE_MODE: true,
        SSL_VERIFY: true,
        ENFORCE_HTTPS: true,
        ENABLE_CSP: true
    },
    
    // 性能优化配置
    PERFORMANCE: {
        // 启用更激进的缓存策略
        ENABLE_CACHING: true,
        CACHE_TTL: 300000,         // 5分钟缓存
        
        // 启用请求去重
        ENABLE_REQUEST_DEDUP: true,
        
        // 启用请求队列管理
        MAX_CONCURRENT_REQUESTS: 6, // 减少并发请求数量
        REQUEST_QUEUE_SIZE: 20
    },
    
    // 监控配置
    MONITORING: {
        ENABLE_HEALTH_CHECK: true,
        HEALTH_CHECK_INTERVAL: 60000,  // 1分钟检查一次
        ENABLE_PERFORMANCE_LOG: true,
        LOG_SLOW_REQUESTS: true,
        SLOW_REQUEST_THRESHOLD: 5000   // 5秒以上的请求记录
    }
};

/**
 * 检测是否为反代部署环境
 */
function isReverseProxyEnvironment() {
    return window.location.hostname === REVERSE_PROXY_CONFIG.PROXY_DOMAIN;
}

/**
 * 获取反代配置
 */
function getReverseProxyConfig() {
    if (!isReverseProxyEnvironment()) {
        return null;
    }
    return REVERSE_PROXY_CONFIG;
}

/**
 * 应用反代配置到全局配置
 */
function applyReverseProxyConfig() {
    if (!isReverseProxyEnvironment()) {
        return false;
    }
    
    const config = REVERSE_PROXY_CONFIG;
    
    // 更新环境配置
    if (window.ENV_CONFIG) {
        window.ENV_CONFIG.API_BASE_URL = config.BACKEND.BASE_URL;
        window.ENV_CONFIG.WS_URL = config.BACKEND.WS_URL;
        window.ENV_CONFIG.API_TIMEOUT = config.BACKEND.API_TIMEOUT;
        window.ENV_CONFIG.DIFY_TIMEOUT = config.BACKEND.DIFY_TIMEOUT;
        window.ENV_CONFIG.UPLOAD_TIMEOUT = config.BACKEND.UPLOAD_TIMEOUT;
        window.ENV_CONFIG.WS_TIMEOUT = config.BACKEND.WS_TIMEOUT;
        window.ENV_CONFIG.WITH_CREDENTIALS = config.CORS.WITH_CREDENTIALS;
        window.ENV_CONFIG.SECURE_MODE = config.SECURITY.SECURE_MODE;
        window.ENV_CONFIG.SSL_VERIFY = config.SECURITY.SSL_VERIFY;
    }
    
    // 更新全局配置
    if (window.GLOBAL_CONFIG) {
        window.GLOBAL_CONFIG.BACKEND.BASE_URL = config.BACKEND.BASE_URL;
        window.GLOBAL_CONFIG.BACKEND.API_BASE_URL = config.BACKEND.BASE_URL + config.BACKEND.API_PREFIX;
        window.GLOBAL_CONFIG.BACKEND.WEBSOCKET_URL = config.BACKEND.WS_URL;
        window.GLOBAL_CONFIG.BACKEND.TIMEOUT = config.BACKEND.API_TIMEOUT;
        window.GLOBAL_CONFIG.BACKEND.DIFY_TIMEOUT = config.BACKEND.DIFY_TIMEOUT;
        window.GLOBAL_CONFIG.BACKEND.UPLOAD_TIMEOUT = config.BACKEND.UPLOAD_TIMEOUT;
        window.GLOBAL_CONFIG.BACKEND.WS_TIMEOUT = config.BACKEND.WS_TIMEOUT;
        window.GLOBAL_CONFIG.BACKEND.RETRY_COUNT = config.BACKEND.RETRY_COUNT;
        window.GLOBAL_CONFIG.BACKEND.RETRY_DELAY = config.BACKEND.RETRY_DELAY;
    }
    
    // 更新应用配置
    if (window.APP_CONFIG) {
        window.APP_CONFIG.API.BASE_URL = config.BACKEND.BASE_URL + config.BACKEND.API_PREFIX;
        window.APP_CONFIG.API.TIMEOUT = config.BACKEND.API_TIMEOUT;
        window.APP_CONFIG.API.RETRY_ATTEMPTS = config.BACKEND.RETRY_COUNT;
        window.APP_CONFIG.API.RETRY_DELAY = config.BACKEND.RETRY_DELAY;
    }
    
    console.log('🔧 反代配置已应用:', {
        domain: config.PROXY_DOMAIN,
        port: config.PROXY_PORT,
        protocol: config.PROXY_PROTOCOL,
        backendUrl: config.BACKEND.BASE_URL,
        wsUrl: config.BACKEND.WS_URL,
        timeouts: {
            api: config.BACKEND.API_TIMEOUT,
            dify: config.BACKEND.DIFY_TIMEOUT,
            upload: config.BACKEND.UPLOAD_TIMEOUT,
            websocket: config.BACKEND.WS_TIMEOUT
        }
    });
    
    return true;
}

/**
 * 反代环境健康检查
 */
async function reverseProxyHealthCheck() {
    if (!isReverseProxyEnvironment()) {
        return { status: 'not_applicable', message: '非反代环境' };
    }
    
    const config = REVERSE_PROXY_CONFIG;
    
    try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
        
        const response = await fetch(`${config.BACKEND.BASE_URL}${config.BACKEND.API_PREFIX}/health`, {
            method: 'GET',
            signal: controller.signal,
            mode: 'cors',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
            return {
                status: 'healthy',
                message: '反代服务正常',
                responseTime: responseTime,
                url: `${config.BACKEND.BASE_URL}${config.BACKEND.API_PREFIX}/health`
            };
        } else {
            return {
                status: 'unhealthy',
                message: `HTTP ${response.status}: ${response.statusText}`,
                responseTime: responseTime,
                url: `${config.BACKEND.BASE_URL}${config.BACKEND.API_PREFIX}/health`
            };
        }
        
    } catch (error) {
        return {
            status: 'error',
            message: error.message,
            url: `${config.BACKEND.BASE_URL}${config.BACKEND.API_PREFIX}/health`
        };
    }
}

// 导出配置和工具函数
window.REVERSE_PROXY_CONFIG = REVERSE_PROXY_CONFIG;
window.isReverseProxyEnvironment = isReverseProxyEnvironment;
window.getReverseProxyConfig = getReverseProxyConfig;
window.applyReverseProxyConfig = applyReverseProxyConfig;
window.reverseProxyHealthCheck = reverseProxyHealthCheck;

// 自动应用反代配置
if (isReverseProxyEnvironment()) {
    console.log('🌐 检测到反代环境，自动应用反代配置...');
    // 延迟应用配置，确保其他配置文件已加载
    setTimeout(() => {
        applyReverseProxyConfig();
    }, 100);
}

export {
    REVERSE_PROXY_CONFIG,
    isReverseProxyEnvironment,
    getReverseProxyConfig,
    applyReverseProxyConfig,
    reverseProxyHealthCheck
};
