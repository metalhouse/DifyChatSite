/**
 * 全局配置文件 - 基于DifyChatBack v2.0 API指南
 * 默认后端地址：http://localhost:4005
 * 
 * 基于前端对接API指南重新整理.md第3章基础配置
 * 
 * 如需修改后端地址，有以下几种方法：
 * 
 * 方法1：修改代码中的 DEFAULT_BACKEND_URL 常量
 * 方法2：在浏览器控制台执行：window.updateBackendUrl('http://your-backend:4005')
 * 方法3：在HTML中添加meta标签：<meta name="backend-url" content="http://your-backend:4005">
 * 
 * 优先级：localStorage > meta标签 > 默认配置
 */

// 导入环境配置
import { ENV_CONFIG } from './env.js';

// 配置版本 - 更新版本号以匹配后端v2.0
const CONFIG_VERSION = '2.0.0';

// 默认后端地址配置 - 基于API指南第3.1节服务器连接配置
const DEFAULT_BACKEND_URL = ENV_CONFIG.API_BASE_URL;

// 前端基础配置
const FRONTEND_BASE_URL = window.location.origin;
const IS_DEVELOPMENT = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.startsWith('192.168.') ||
                      window.location.hostname.startsWith('10.') ||
                      window.location.hostname.startsWith('172.');

/**
 * 获取后端基础地址
 * 优先级：localStorage > 环境变量 > 自动检测
 */
function getBackendBaseUrl() {
    // 1. 检查 localStorage 中的自定义配置
    const storageUrl = localStorage.getItem('backend_base_url');
    if (storageUrl && storageUrl.match(/^https?:\/\/.+/)) {
        return storageUrl;
    }
    
    // 2. 检查环境变量或meta标签
    const metaBackend = document.querySelector('meta[name="backend-url"]');
    if (metaBackend && metaBackend.content) {
        return metaBackend.content;
    }
    
    // 3. 使用默认配置地址
    return DEFAULT_BACKEND_URL;
}

// 动态获取后端地址
const DYNAMIC_BACKEND_URL = getBackendBaseUrl();

/**
 * 全局配置对象 - 基于DifyChatBack v2.0 API规范
 */
window.GLOBAL_CONFIG = {
    // 后端服务配置 - 基于API指南第3.1节
    BACKEND: {
        BASE_URL: DYNAMIC_BACKEND_URL,
        API_BASE_URL: ENV_CONFIG.getApiUrl(),
        WEBSOCKET_URL: ENV_CONFIG.getWsUrl(),
        
        // 超时配置（毫秒）- 基于API指南第3.6节按场景区分
        TIMEOUT: ENV_CONFIG.API_TIMEOUT,          // 通用API 30秒
        DIFY_TIMEOUT: ENV_CONFIG.DIFY_TIMEOUT,    // Dify AI对话 120秒
        UPLOAD_TIMEOUT: ENV_CONFIG.UPLOAD_TIMEOUT, // 文件上传 180秒
        WS_TIMEOUT: ENV_CONFIG.WS_TIMEOUT,        // WebSocket 60秒
        
        // 重试配置
        RETRY_COUNT: 3,
        RETRY_DELAY: 1000
    },
    
    // 前端配置
    FRONTEND: {
        BASE_URL: FRONTEND_BASE_URL,
        IS_DEVELOPMENT: ENV_CONFIG.isDevelopment(),
        DEBUG_MODE: ENV_CONFIG.isDebug()
    },
    
    // 版本信息
    VERSION: CONFIG_VERSION,
    
    // API端点定义 - 基于API指南完整更新
    API: {
        // 用户认证模块 - 基于指南第4章
        AUTH: {
            LOGIN: '/auth/login',                    // 支持用户名/邮箱/手机号登录
            LOGOUT: '/auth/logout',
            REGISTER: '/auth/register',
            REFRESH: '/auth/refresh',                // JWT刷新机制
            VERIFY_EMAIL: '/auth/verify-email',      // 邮箱验证
            SEND_VERIFICATION: '/auth/send-verification',
            FORGOT_PASSWORD: '/auth/forgot-password',
            RESET_PASSWORD: '/auth/reset-password'
        },
        
        // 对话管理模块 - 基于指南第5章（核心变化：不再是agents而是conversations）
        CONVERSATIONS: {
            LIST: '/conversations',                   // 获取对话列表
            CREATE: '/conversations',                 // 创建对话
            DETAIL: '/conversations/{id}',            // 获取对话详情
            UPDATE: '/conversations/{id}',            // 更新对话
            DELETE: '/conversations/{id}',            // 删除对话
            BATCH_DELETE: '/conversations/batch',     // 批量删除
            MESSAGES: '/conversations/{id}/messages', // 消息管理
            MESSAGE_FEEDBACK: '/conversations/messages/{messageId}/feedback', // 消息反馈
            STATS: '/conversations/user/stats'        // 用户统计
        },
        
        // WebSocket群聊房间 - 基于指南第6章（全新功能）
        CHAT_ROOMS: {
            LIST: '/chat-rooms',                      // 获取房间列表
            CREATE: '/chat-rooms',                    // 创建房间
            DETAIL: '/chat-rooms/{id}',               // 房间详情
            JOIN: '/chat-rooms/{id}/join',            // 加入房间
            LEAVE: '/chat-rooms/{id}/leave',          // 离开房间
            MEMBERS: '/chat-rooms/{id}/members',      // 房间成员
            MESSAGES: '/chat-rooms/{id}/messages',    // 房间消息
            INVITE: '/chat-rooms/{id}/invite'         // 邀请成员
        },
        
        // 系统健康检查 - 基于指南第7章
        SYSTEM: {
            HEALTH: '/health',                        // 系统健康检查
            STATUS: '/system/status',                 // 系统状态
            DATABASE: '/system/database',             // 数据库状态
            REDIS: '/system/redis'                    // Redis状态
        }
    },
    
    // WebSocket事件定义 - 基于指南第6章
    WEBSOCKET: {
        EVENTS: {
            // 连接相关
            CONNECT: 'connect',
            DISCONNECT: 'disconnect',
            AUTHENTICATED: 'authenticated',
            
            // 房间相关
            JOIN_ROOM: 'join_room',
            LEAVE_ROOM: 'leave_room',
            ROOM_JOINED: 'room_joined',
            ROOM_LEFT: 'room_left',
            
            // 消息相关
            NEW_MESSAGE: 'new_message',
            MESSAGE_SENT: 'message_sent',
            USER_TYPING: 'user_typing',
            
            // 用户状态
            USER_JOINED: 'user_joined',
            USER_LEFT: 'user_left',
            ONLINE_USERS: 'online_users'
        }
    },
    
    // 调试配置
    DEBUG: {
        ENABLED: ENV_CONFIG.isDebug(),
        LOG_LEVEL: ENV_CONFIG.isDevelopment() ? 'debug' : 'warn'
    }
};

/**
 * 获取完整的API URL - 基于环境配置
 * @param {string} endpoint - 端点路径
 * @returns {string} 完整的URL
 */
window.getApiUrl = function(endpoint) {
    if (endpoint.startsWith('http')) {
        return endpoint;
    }
    
    // 使用环境配置的API URL生成器
    return ENV_CONFIG.getApiUrl(endpoint);
};

/**
 * 获取WebSocket URL - 基于环境配置
 * @param {string} path - WebSocket路径
 * @returns {string} WebSocket URL
 */
window.getWebSocketUrl = function(path = '') {
    return ENV_CONFIG.getWsUrl() + (path.startsWith('/') ? path : (path ? '/' + path : ''));
};

/**
 * 动态更新后端地址
 * @param {string} newUrl - 新的后端地址
 * @returns {boolean} 是否更新成功
 */
window.updateBackendUrl = function(newUrl) {
    if (!newUrl || !newUrl.match(/^https?:\/\/.+/)) {
        console.error('Invalid backend URL format:', newUrl);
        return false;
    }
    
    localStorage.setItem('backend_base_url', newUrl);
    console.log('Backend URL updated to:', newUrl);
    console.log('Please refresh the page to apply changes.');
    return true;
};

/**
 * 重置为自动检测的后端地址
 */
window.resetBackendUrl = function() {
    localStorage.removeItem('backend_base_url');
    console.log('Backend URL reset to auto-detection mode.');
    console.log('Please refresh the page to apply changes.');
};

/**
 * 获取当前后端连接状态
 * @returns {Promise<boolean>} 连接状态
 */
window.checkBackendConnection = async function() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(window.getApiUrl('/health'), {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.warn('Backend connection check failed:', error.message);
        return false;
    }
};

/**
 * 显示当前配置信息
 */
window.showConfig = function() {
    console.log('🌐 Current Configuration:', {
        backend: DYNAMIC_BACKEND_URL,
        default: DEFAULT_BACKEND_URL,
        frontend: FRONTEND_BASE_URL,
        environment: IS_DEVELOPMENT ? 'development' : 'production',
        version: CONFIG_VERSION,
        timestamp: new Date().toISOString()
    });
    
    console.log('📋 如需修改后端地址，请使用以下方法之一：');
    console.log('1. window.updateBackendUrl("http://your-backend:5000")');
    console.log('2. 修改代码中的 DEFAULT_BACKEND_URL');
    console.log('3. window.resetBackendUrl() 重置为默认地址');
};

/**
 * 获取当前使用的后端地址
 */
window.getCurrentBackendUrl = function() {
    return DYNAMIC_BACKEND_URL;
};

/**
 * 获取默认后端地址
 */
window.getDefaultBackendUrl = function() {
    return DEFAULT_BACKEND_URL;
};

// 版本检查和缓存清理
if (typeof localStorage !== 'undefined') {
    const oldVersion = localStorage.getItem('global_config_version');
    if (oldVersion !== CONFIG_VERSION) {
        console.log('🔄 Configuration updated from', oldVersion, 'to', CONFIG_VERSION);
        localStorage.setItem('global_config_version', CONFIG_VERSION);
    }
}

// 开发环境下显示配置信息
if (IS_DEVELOPMENT) {
    console.log('🔧 Development mode active');
    window.showConfig();
}

// 导出配置供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.GLOBAL_CONFIG;
}
