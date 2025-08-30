/**
 * API端点配置 - 基于DifyChatBack v2.0 API指南
 * 符合前端对接API指南重新整理.md标准
 */

// 导入环境配置
import { ENV_CONFIG } from '../../config/env.js';

const API_ENDPOINTS = {
    // 基础配置 - 基于指南第3.1节
    BASE_URL: ENV_CONFIG.getApiUrl(),
    
    // 超时配置 - 基于指南第3.6节按场景区分
    TIMEOUT: ENV_CONFIG.API_TIMEOUT,        // 通用API 30秒
    DIFY_TIMEOUT: ENV_CONFIG.DIFY_TIMEOUT,  // AI对话专用 120秒
    UPLOAD_TIMEOUT: ENV_CONFIG.UPLOAD_TIMEOUT, // 文件上传 180秒

    // 用户认证模块端点 - 基于指南第4章
    AUTH: {
        LOGIN: '/auth/login',                    // 支持用户名/邮箱/手机号
        REGISTER: '/auth/register',
        LOGOUT: '/auth/logout',
        REFRESH: '/auth/refresh',                // JWT双Token机制
        VERIFY_EMAIL: '/auth/verify-email',      // 邮箱验证
        SEND_VERIFICATION: '/auth/send-verification',
        FORGOT_PASSWORD: '/auth/forgot-password',
        RESET_PASSWORD: '/auth/reset-password'
    },

    // 对话管理模块端点 - 基于指南第5章（核心变化）
    CONVERSATIONS: {
        LIST: '/conversations',                   // 获取对话列表
        CREATE: '/conversations',                 // 创建对话
        DETAIL: '/conversations/{id}',            // 获取对话详情
        UPDATE: '/conversations/{id}',            // 更新对话
        DELETE: '/conversations/{id}',            // 删除对话
        BATCH_DELETE: '/conversations/batch',     // 批量删除
        MESSAGES: '/conversations/{id}/messages', // 消息管理（支持流式/阻塞）
        MESSAGE_FEEDBACK: '/conversations/messages/{messageId}/feedback', // 消息反馈
        STATS: '/conversations/user/stats'        // 用户统计
    },

    // WebSocket群聊房间端点 - 基于指南第6章（全新功能）
    CHAT_ROOMS: {
        LIST: '/chat-rooms',                      // 获取房间列表
        CREATE: '/chat-rooms',                    // 创建房间
        DETAIL: '/chat-rooms/{id}',               // 房间详情
        UPDATE: '/chat-rooms/{id}',               // 更新房间
        DELETE: '/chat-rooms/{id}',               // 删除房间
        JOIN: '/chat-rooms/{id}/join',            // 加入房间
        LEAVE: '/chat-rooms/{id}/leave',          // 离开房间
        MEMBERS: '/chat-rooms/{id}/members',      // 房间成员
        MESSAGES: '/rooms/{id}/messages',         // 房间消息（/api前缀由ENV_CONFIG.getApiUrl()自动添加）
        INVITE: '/chat-rooms/{id}/invite',        // 邀请成员
        KICK: '/chat-rooms/{id}/kick',            // 踢出成员
        TRANSFER: '/chat-rooms/{id}/transfer'     // 转移房主
    },

    // 智能体管理模块端点 - 基于指南第8章
    AGENTS: {
        LIST: '/agents',                          // 获取智能体列表
        CREATE: '/agents',                        // 创建智能体
        DETAIL: '/agents/{id}',                   // 获取智能体详情
        UPDATE: '/agents/{id}',                   // 更新智能体
        DELETE: '/agents/{id}',                   // 删除智能体
        USER_AGENTS: '/agents/user/{userId}',     // 获取用户的智能体列表
        PUBLIC: '/agents/public',                 // 获取公开智能体
        CATEGORIES: '/agents/categories',         // 智能体分类
        RATE: '/agents/{id}/rate',               // 评价智能体
        CLONE: '/agents/{id}/clone',             // 克隆智能体
        TOGGLE_STATUS: '/agents/{id}/toggle-status', // 切换状态
        STATS: '/agents/{id}/stats'              // 智能体统计
    },

    // 好友系统模块端点 - 基于指南第6章
    FRIENDS: {
        LIST: '/friends',                         // 获取好友列表
        REQUESTS: '/friends/requests',            // 好友请求列表
        SEND_REQUEST: '/friends/request',         // 发送好友请求
        ACCEPT_REQUEST: '/friends/accept/{requestId}', // 接受好友请求
        REJECT_REQUEST: '/friends/reject/{requestId}', // 拒绝好友请求
        REMOVE_FRIEND: '/friends/{friendshipId}', // 删除好友
        INVITE_TO_ROOM: '/friends/invite-to-room', // 邀请好友到房间
        SEARCH_USERS: '/users/search'            // 搜索用户
    },

    // 用户相关端点
    // 系统健康检查端点 - 基于指南第7章
    SYSTEM: {
        HEALTH: '/health',                        // 系统健康检查
        STATUS: '/system/status',                 // 系统状态  
        DATABASE: '/system/database',             // 数据库状态
        REDIS: '/system/redis'                    // Redis状态
    },

    // 文件相关端点（如果后续需要）
    FILES: {
        UPLOAD: '/files/upload',
        DOWNLOAD: '/files/{id}/download',
        DELETE: '/files/{id}'
    }
};

// WebSocket事件配置 - 基于指南第6章
const WEBSOCKET_EVENTS = {
    // 连接相关事件
    CONNECTION: {
        CONNECT: 'connect',
        DISCONNECT: 'disconnect',
        AUTHENTICATED: 'authenticated',
        CONNECT_ERROR: 'connect_error'
    },
    
    // 房间相关事件
    ROOM: {
        JOIN: 'join_room',
        LEAVE: 'leave_room',
        JOINED: 'room_joined', 
        LEFT: 'room_left',
        ERROR: 'room_error'
    },
    
    // 消息相关事件
    MESSAGE: {
        NEW: 'new_message',
        SENT: 'message_sent',
        TYPING: 'user_typing',
        STOP_TYPING: 'user_stop_typing'
    },
    
    // 用户状态事件
    USER: {
        JOINED: 'user_joined',
        LEFT: 'user_left',
        ONLINE: 'online_users',
        STATUS_CHANGE: 'user_status_change'
    }
};

// 端点URL构建器 - 增强版本
class EndpointBuilder {
    /**
     * 构建完整的API URL
     * @param {string} endpoint - 端点路径
     * @param {Object} params - 路径参数
     * @returns {string} 完整的URL
     */
    static build(endpoint, params = {}) {
        let url = endpoint;
        
        // 替换路径参数
        Object.keys(params).forEach(key => {
            url = url.replace(`{${key}}`, params[key]);
        });
        
        return url;
    }

    /**
     * 构建带查询参数的URL
     * @param {string} endpoint - 端点路径
     * @param {Object} pathParams - 路径参数
     * @param {Object} queryParams - 查询参数
     * @returns {string} 完整的URL
     */
    static buildWithQuery(endpoint, pathParams = {}, queryParams = {}) {
        let url = this.build(endpoint, pathParams);
        
        if (Object.keys(queryParams).length > 0) {
            const searchParams = new URLSearchParams();
            Object.keys(queryParams).forEach(key => {
                if (queryParams[key] !== undefined && queryParams[key] !== null) {
                    searchParams.append(key, queryParams[key]);
                }
            });
            
            const queryString = searchParams.toString();
            if (queryString) {
                url += (url.includes('?') ? '&' : '?') + queryString;
            }
        }
        
        return url;
    }

    /**
     * 获取对话详情端点
     * @param {string} conversationId - 对话ID
     * @returns {string} 端点URL
     */
    static getConversationDetail(conversationId) {
        return this.build(API_ENDPOINTS.CONVERSATIONS.DETAIL, { id: conversationId });
    }

    /**
     * 获取对话消息端点
     * @param {string} conversationId - 对话ID
     * @returns {string} 端点URL
     */
    static getConversationMessages(conversationId) {
        return this.build(API_ENDPOINTS.CONVERSATIONS.MESSAGES, { id: conversationId });
    }

    /**
     * 获取聊天室详情端点
     * @param {string} roomId - 聊天室ID
     * @returns {string} 端点URL
     */
    static getChatRoomDetail(roomId) {
        return this.build(API_ENDPOINTS.CHAT_ROOMS.DETAIL, { id: roomId });
    }

    /**
     * 获取聊天室加入端点
     * @param {string} roomId - 聊天室ID
     * @returns {string} 端点URL
     */
    static getChatRoomJoin(roomId) {
        return this.build(API_ENDPOINTS.CHAT_ROOMS.JOIN, { id: roomId });
    }

    /**
     * 获取消息反馈端点
     * @param {string} messageId - 消息ID
     * @returns {string} 端点URL
     */
    static getMessageFeedback(messageId) {
        return this.build(API_ENDPOINTS.CONVERSATIONS.MESSAGE_FEEDBACK, { messageId });
    }

    /**
     * 获取文件下载端点
     * @param {string} fileId - 文件ID
     * @returns {string} 端点URL
     */
    static getFileDownload(fileId) {
        return this.build(API_ENDPOINTS.FILES.DOWNLOAD, { id: fileId });
    }
}

// 导出配置和工具
window.API_ENDPOINTS = API_ENDPOINTS;
window.WEBSOCKET_EVENTS = WEBSOCKET_EVENTS;
window.EndpointBuilder = EndpointBuilder;

export { API_ENDPOINTS, WEBSOCKET_EVENTS, EndpointBuilder };
export default API_ENDPOINTS;

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_ENDPOINTS,
        EndpointBuilder
    };
}
