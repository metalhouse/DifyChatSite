// ===========================
// 应用配置文件
// ===========================

window.APP_CONFIG = {
    // 应用基础信息
    APP_NAME: 'DifyChat',
    APP_VERSION: '1.0.0',
    APP_DESCRIPTION: '智能对话Web应用',
    
    // API配置
    API: {
        // 从全局配置继承，避免硬编码
        BASE_URL: window.GLOBAL_CONFIG?.BACKEND?.BASE_URL || (window.getApiUrl ? window.getApiUrl('') : window.location.origin),
        VERSION: 'v1',
        TIMEOUT: 30000,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000
    },
    
    // 认证配置
    AUTH: {
        TOKEN_KEY: 'dify_access_token',
        REFRESH_TOKEN_KEY: 'dify_refresh_token',
        USER_KEY: 'dify_user_info',
        AUTO_REFRESH: true,
        REFRESH_THRESHOLD: 300 // 5分钟前刷新
    },
    
    // 缓存配置
    CACHE: {
        ENABLED: true,
        PREFIX: 'dify_cache_',
        DEFAULT_TTL: 300000, // 5分钟
        CONVERSATION_TTL: 1800000, // 30分钟
        AGENT_TTL: 3600000 // 1小时
    },
    
    // 聊天配置
    CHAT: {
        MAX_MESSAGE_LENGTH: 4000,
        TYPING_DELAY: 50,
        SSE_RETRY_INTERVAL: 3000,
        AUTO_SCROLL_THRESHOLD: 100,
        MESSAGE_PAGE_SIZE: 20
    },
    
    // 文件上传配置
    UPLOAD: {
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_TYPES: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'text/plain',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        CHUNK_SIZE: 1024 * 1024 // 1MB
    },
    
    // 主题配置
    THEME: {
        DEFAULT: 'light',
        AUTO_DETECT: true,
        STORAGE_KEY: 'dify_theme'
    },
    
    // 语音配置
    VOICE: {
        SAMPLE_RATE: 16000,
        CHANNELS: 1,
        MAX_DURATION: 60000, // 60秒
        SILENCE_THRESHOLD: 0.01
    },
    
    // 调试配置
    DEBUG: {
        ENABLED: true,
        LOG_LEVEL: 'info', // debug, info, warn, error
        PERFORMANCE_MONITORING: true
    },
    
    // 功能开关
    FEATURES: {
        VOICE_INPUT: true,
        VOICE_OUTPUT: true,
        FILE_UPLOAD: true,
        DARK_MODE: true,
        PWA: true,
        OFFLINE_MODE: false
    },
    
    // 路由配置
    ROUTES: {
        DEFAULT: '/chat',
        LOGIN: '/login',
        REGISTER: '/register',
        CHAT: '/chat',
        SETTINGS: '/settings',
        PROFILE: '/profile'
    },
    
    // 错误消息
    ERROR_MESSAGES: {
        NETWORK_ERROR: '网络连接失败，请检查网络设置',
        AUTH_EXPIRED: '登录已过期，请重新登录',
        SERVER_ERROR: '服务器异常，请稍后重试',
        VALIDATION_ERROR: '输入信息有误，请检查后重试',
        UPLOAD_ERROR: '文件上传失败，请重试',
        VOICE_ERROR: '语音功能不可用，请检查麦克风权限'
    },
    
    // 成功消息
    SUCCESS_MESSAGES: {
        LOGIN_SUCCESS: '登录成功',
        LOGOUT_SUCCESS: '已安全退出',
        MESSAGE_SENT: '消息发送成功',
        FILE_UPLOADED: '文件上传成功',
        SETTINGS_SAVED: '设置已保存'
    }
};

// 根据环境设置不同的配置
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 开发环境配置
    window.APP_CONFIG.DEBUG.ENABLED = true;
    // 从全局配置继承，避免硬编码
    window.APP_CONFIG.API.BASE_URL = window.GLOBAL_CONFIG?.BACKEND?.BASE_URL || (window.getApiUrl ? window.getApiUrl('') : window.location.origin);
} else if (window.location.hostname === 'nas.pznas.com') {
    // 反代生产环境配置
    window.APP_CONFIG.DEBUG.ENABLED = false;
    window.APP_CONFIG.API.BASE_URL = 'https://nas.pznas.com:7990/api';
} else {
    // 其他生产环境配置
    window.APP_CONFIG.DEBUG.ENABLED = false;
    window.APP_CONFIG.API.BASE_URL = 'https://your-production-api.com';
}

// 冻结配置对象，防止意外修改
Object.freeze(window.APP_CONFIG);
