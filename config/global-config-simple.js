/**
 * 简化的全局配置 - 兼容普通script标签使用
 */

const globalConfig = {
    // API配置
    api: {
        baseURL: 'http://localhost:4005/api',
        timeout: 10000
    },
    
    // WebSocket配置
    websocket: {
        url: 'http://localhost:4005',
        options: {
            transports: ['websocket', 'polling'],
            timeout: 10000,
            forceNew: true
        }
    },

    // 应用配置
    app: {
        name: 'DifyChat',
        version: '2.0.0',
        debug: true
    },

    // 存储键名
    storage: {
        ACCESS_TOKEN: 'dify_access_token',
        REFRESH_TOKEN: 'dify_refresh_token',
        USER_INFO: 'dify_user_info'
    }
};

// 动态获取后端地址的方法
globalConfig.getBackendUrl = function() {
    // 优先级：localStorage > meta标签 > 默认配置
    const stored = localStorage.getItem('backend_url');
    if (stored) {
        return stored;
    }

    const metaTag = document.querySelector('meta[name="backend-url"]');
    if (metaTag) {
        return metaTag.content;
    }

    return 'http://localhost:4005';
};

// 更新API和WebSocket地址
globalConfig.updateUrls = function() {
    const backendUrl = this.getBackendUrl();
    this.api.baseURL = backendUrl + '/api';
    this.websocket.url = backendUrl;
};

// 初始化时更新地址
globalConfig.updateUrls();

// 导出到全局
if (typeof window !== 'undefined') {
    window.globalConfig = globalConfig;
}
