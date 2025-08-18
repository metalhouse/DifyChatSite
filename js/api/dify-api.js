/**
 * DifyChat API客户端 - 基于DifyChatBack v2.0 API指南
 * 完全重构以匹配新的API架构和功能
 * 基于前端对接API指南重新整理.md第4-6章
 */

// 导入依赖
import { ENV_CONFIG } from '../../config/env.js';
import { API_ENDPOINTS, EndpointBuilder } from './endpoints.js';
import httpClient from './api-client.js';

// 依赖检查
function checkDependencies() {
    if (!httpClient) {
        console.error('❌ HttpClient未加载，请确保api-client.js已加载');
        return false;
    }
    
    if (!API_ENDPOINTS) {
        console.error('❌ API_ENDPOINTS未加载，请确保endpoints.js已加载');
        return false;
    }
    
    if (ENV_CONFIG.isDebug()) {
        console.log('✅ DifyChat API依赖检查通过');
    }
    
    return true;
}

// API配置 - 基于新的环境配置
const API_CONFIG = {
    BASE_URL: ENV_CONFIG.getApiUrl(),
    TIMEOUT: ENV_CONFIG.API_TIMEOUT,
    DIFY_TIMEOUT: ENV_CONFIG.DIFY_TIMEOUT,
    DEBUG_MODE: ENV_CONFIG.isDebug(),
    
    // 连接状态
    PRODUCTION_MODE: ENV_CONFIG.isProduction(),
    VERSION: '2.0.0' // 匹配后端版本
};

/**
 * DifyChat API服务类 - 基于新API指南重构
 * 提供完整的用户认证、对话管理、WebSocket群聊功能
 */
class DifyApiService {
    constructor() {
        // 依赖检查
        if (!checkDependencies()) {
            console.warn('⚠️ 依赖检查失败，API功能可能受限');
        }
        
        this.httpClient = httpClient;
        this.endpoints = API_ENDPOINTS;
        
        if (API_CONFIG.DEBUG_MODE) {
            console.log('🚀 DifyApiService初始化:', {
                baseURL: API_CONFIG.BASE_URL,
                version: API_CONFIG.VERSION,
                endpoints: Object.keys(this.endpoints)
            });
        }
    }

    // ========================================
    // 🔐 用户认证模块 - 基于指南第4章
    // ========================================

    /**
     * 用户注册 - 基于指南第4.2节
     * @param {Object} userData 注册数据
     * @param {string} userData.username 用户名（3-50字符）
     * @param {string} userData.email 邮箱地址
     * @param {string} userData.password 密码（8-100字符，复杂度要求）
     * @param {string} userData.confirmPassword 确认密码
     * @param {string} [userData.nickname] 昵称
     * @param {string} [userData.phone] 手机号
     * @returns {Promise<Object>} 注册结果
     */
    async register(userData) {
        try {
            const response = await this.httpClient.post(this.endpoints.AUTH.REGISTER, userData);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('📝 用户注册:', {
                    success: response.success,
                    hasMessage: !!response.message
                });
            }
            
            return response;
        } catch (error) {
            console.error('❌ 注册失败:', error.message);
            throw error;
        }
    }

    /**
     * 用户登录 - 基于指南第4.3节，支持多种登录方式
     * @param {Object} credentials 登录凭据
     * @param {string} [credentials.username] 用户名
     * @param {string} [credentials.email] 邮箱
     * @param {string} [credentials.phone] 手机号
     * @param {string} credentials.password 密码
     * @returns {Promise<Object>} 登录结果，包含access_token和refresh_token
     */
    async login(credentials) {
        try {
            const response = await this.httpClient.post(this.endpoints.AUTH.LOGIN, credentials);
            
            if (response.success && response.data) {
                // 存储Token - 基于指南JWT双Token机制
                const { access_token, refresh_token, user } = response.data;
                
                if (access_token) {
                    localStorage.setItem('dify_access_token', access_token);
                }
                if (refresh_token) {
                    localStorage.setItem('dify_refresh_token', refresh_token);
                }
                if (user) {
                    localStorage.setItem('dify_user_info', JSON.stringify(user));
                }
                
                if (API_CONFIG.DEBUG_MODE) {
                    console.log('🔑 登录成功:', {
                        user: user?.username || user?.email,
                        hasAccessToken: !!access_token,
                        hasRefreshToken: !!refresh_token
                    });
                }
            }
            
            return response;
        } catch (error) {
            console.error('❌ 登录失败:', error.message);
            throw error;
        }
    }

    /**
     * 用户注销 - 基于指南第4.5节
     * @returns {Promise<Object>} 注销结果
     */
    async logout() {
        try {
            const response = await this.httpClient.post(this.endpoints.AUTH.LOGOUT);
            
            // 清理本地存储
            localStorage.removeItem('dify_access_token');
            localStorage.removeItem('dify_refresh_token');
            localStorage.removeItem('dify_user_info');
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('👋 注销成功');
            }
            
            return response;
        } catch (error) {
            console.error('❌ 注销失败:', error.message);
            // 即使请求失败也清理本地存储
            localStorage.removeItem('dify_access_token');
            localStorage.removeItem('dify_refresh_token');
            localStorage.removeItem('dify_user_info');
            throw error;
        }
    }

    /**
     * 刷新Token - 基于指南第4.4节
     * @returns {Promise<Object>} 刷新结果
     */
    async refreshToken() {
        try {
            const refreshToken = localStorage.getItem('dify_refresh_token');
            if (!refreshToken) {
                throw new Error('没有有效的刷新令牌');
            }
            
            const response = await this.httpClient.post(this.endpoints.AUTH.REFRESH, {
                refreshToken
            });
            
            if (response.success && response.data) {
                const { access_token, refresh_token } = response.data;
                
                if (access_token) {
                    localStorage.setItem('dify_access_token', access_token);
                }
                if (refresh_token) {
                    localStorage.setItem('dify_refresh_token', refresh_token);
                }
                
                if (API_CONFIG.DEBUG_MODE) {
                    console.log('🔄 Token刷新成功');
                }
            }
            
            return response;
        } catch (error) {
            console.error('❌ Token刷新失败:', error.message);
            // 刷新失败，清理Token
            localStorage.removeItem('dify_access_token');
            localStorage.removeItem('dify_refresh_token');
            throw error;
        }
    }

    /**
     * 发送邮箱验证 - 基于指南第4.6.1节
     * @param {string} email 邮箱地址
     * @returns {Promise<Object>} 发送结果
     */
    async sendEmailVerification(email) {
        try {
            const response = await this.httpClient.post(this.endpoints.AUTH.SEND_VERIFICATION, {
                email
            });
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('📧 验证邮件已发送:', email);
            }
            
            return response;
        } catch (error) {
            console.error('❌ 发送验证邮件失败:', error.message);
            throw error;
        }
    }

    /**
     * 验证邮箱 - 基于指南第4.6.2节
     * @param {string} email 邮箱地址
     * @param {string} code 验证码
     * @returns {Promise<Object>} 验证结果
     */
    async verifyEmail(email, code) {
        try {
            const response = await this.httpClient.post(this.endpoints.AUTH.VERIFY_EMAIL, {
                email,
                code
            });
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('✅ 邮箱验证成功:', email);
            }
            
            return response;
        } catch (error) {
            console.error('❌ 邮箱验证失败:', error.message);
            throw error;
        }
    }

    /**
     * 忘记密码 - 基于指南第4.7.1节
     * @param {Object} data 重置数据
     * @param {string} [data.email] 邮箱地址
     * @param {string} [data.phone] 手机号
     * @returns {Promise<Object>} 重置结果
     */
    async forgotPassword(data) {
        try {
            const response = await this.httpClient.post(this.endpoints.AUTH.FORGOT_PASSWORD, data);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('📧 密码重置邮件已发送');
            }
            
            return response;
        } catch (error) {
            console.error('❌ 发送重置邮件失败:', error.message);
            throw error;
        }
    }

    /**
     * 重置密码 - 基于指南第4.7.2节
     * @param {Object} data 重置数据
     * @param {string} [data.email] 邮箱地址
     * @param {string} [data.phone] 手机号
     * @param {string} data.code 验证码
     * @param {string} data.newPassword 新密码
     * @param {string} data.confirmPassword 确认新密码
     * @returns {Promise<Object>} 重置结果
     */
    async resetPassword(data) {
        try {
            const response = await this.httpClient.post(this.endpoints.AUTH.RESET_PASSWORD, data);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('🔐 密码重置成功');
            }
            
            return response;
        } catch (error) {
            console.error('❌ 密码重置失败:', error.message);
            throw error;
        }
    }

    // ========================================
    // 💬 对话管理模块 - 基于指南第5章
    // ========================================

    /**
     * 获取对话列表 - 基于指南第5.2.2节
     * @param {Object} params 查询参数
     * @param {number} [params.page=1] 页码
     * @param {number} [params.limit=20] 每页条数
     * @param {string} [params.status] 对话状态
     * @param {string} [params.sort] 排序字段
     * @returns {Promise<Object>} 对话列表
     */
    async getConversations(params = {}) {
        try {
            const response = await this.httpClient.get(this.endpoints.CONVERSATIONS.LIST, params);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('📜 获取对话列表:', {
                    count: response.data?.conversations?.length || 0,
                    page: params.page || 1
                });
            }
            
            return response;
        } catch (error) {
            console.error('❌ 获取对话列表失败:', error.message);
            throw error;
        }
    }

    /**
     * 创建对话 - 基于指南第5.2.1节
     * @param {Object} data 对话数据
     * @param {string} data.agent_id 智能体ID
     * @param {string} [data.chatroom_id] 聊天室ID
     * @param {string} [data.title] 对话标题
     * @param {boolean} [data.auto_generate_title=true] 自动生成标题
     * @returns {Promise<Object>} 创建结果
     */
    async createConversation(data) {
        try {
            const response = await this.httpClient.post(this.endpoints.CONVERSATIONS.CREATE, data);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('➕ 创建对话:', {
                    agent_id: data.agent_id,
                    success: response.success
                });
            }
            
            return response;
        } catch (error) {
            console.error('❌ 创建对话失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取对话详情 - 基于指南第5.2.3节
     * @param {string} conversationId 对话ID
     * @param {Object} params 查询参数
     * @param {number} [params.message_page=1] 消息页码
     * @param {number} [params.message_limit=50] 消息每页条数
     * @returns {Promise<Object>} 对话详情
     */
    async getConversationDetail(conversationId, params = {}) {
        try {
            const url = EndpointBuilder.getConversationDetail(conversationId);
            const response = await this.httpClient.get(url, params);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('📄 获取对话详情:', {
                    conversationId,
                    messageCount: response.data?.messages?.length || 0
                });
            }
            
            return response;
        } catch (error) {
            console.error('❌ 获取对话详情失败:', error.message);
            throw error;
        }
    }

    /**
     * 发送消息 - 基于指南第5.3.1节（阻塞模式）
     * @param {string} conversationId 对话ID
     * @param {Object} messageData 消息数据
     * @param {string} messageData.content 消息内容
     * @param {string} [messageData.type='text'] 消息类型
     * @param {Object} [messageData.inputs] 应用输入参数
     * @param {Array} [messageData.files] 附件文件列表
     * @param {boolean} [messageData.auto_generate_name=true] 自动生成名称
     * @param {string} [messageData.response_mode='blocking'] 响应模式
     * @returns {Promise<Object>} 发送结果
     */
    async sendMessage(conversationId, messageData) {
        try {
            const url = EndpointBuilder.getConversationMessages(conversationId);
            
            // 默认使用阻塞模式
            const data = {
                response_mode: 'blocking',
                type: 'text',
                auto_generate_name: true,
                ...messageData
            };
            
            // 对于AI消息使用专用超时
            const options = {
                timeout: API_CONFIG.DIFY_TIMEOUT
            };
            
            const response = await this.httpClient.post(url, data, options);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('💬 发送消息:', {
                    conversationId,
                    mode: data.response_mode,
                    success: response.success
                });
            }
            
            return response;
        } catch (error) {
            console.error('❌ 发送消息失败:', error.message);
            throw error;
        }
    }

    /**
     * 发送流式消息 - 基于指南第5.3.2节（流式模式）
     * @param {string} conversationId 对话ID
     * @param {Object} messageData 消息数据
     * @returns {Promise<Response>} 流式响应对象
     */
    async sendMessageStream(conversationId, messageData) {
        try {
            const url = EndpointBuilder.getConversationMessages(conversationId);
            
            const data = {
                response_mode: 'streaming',
                type: 'text',
                auto_generate_name: true,
                ...messageData
            };
            
            // 使用流式请求方法
            const response = await this.httpClient.requestStream(url, data);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('🌊 开始流式消息:', {
                    conversationId,
                    content: messageData.content?.substring(0, 50) + '...'
                });
            }
            
            return response;
        } catch (error) {
            console.error('❌ 发送流式消息失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取消息历史 - 基于指南第5.4.1节
     * @param {string} conversationId 对话ID
     * @param {Object} params 查询参数
     * @param {number} [params.page=1] 页码
     * @param {number} [params.limit=50] 每页条数
     * @param {string} [params.order='desc'] 排序方式
     * @returns {Promise<Object>} 消息历史
     */
    async getMessageHistory(conversationId, params = {}) {
        try {
            const url = EndpointBuilder.getConversationMessages(conversationId);
            const response = await this.httpClient.get(url, params);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('📚 获取消息历史:', {
                    conversationId,
                    count: response.data?.messages?.length || 0
                });
            }
            
            return response;
        } catch (error) {
            console.error('❌ 获取消息历史失败:', error.message);
            throw error;
        }
    }

    /**
     * 删除对话 - 基于指南第5.2.5节
     * @param {string} conversationId 对话ID
     * @returns {Promise<Object>} 删除结果
     */
    async deleteConversation(conversationId) {
        try {
            const url = EndpointBuilder.getConversationDetail(conversationId);
            const response = await this.httpClient.delete(url);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('🗑️ 删除对话:', conversationId);
            }
            
            return response;
        } catch (error) {
            console.error('❌ 删除对话失败:', error.message);
            throw error;
        }
    }

    // ========================================
    // 🏠 WebSocket群聊模块 - 基于指南第6章
    // ========================================

    /**
     * 获取群聊房间列表
     * @param {Object} params 查询参数
     * @returns {Promise<Object>} 房间列表
     */
    async getChatRooms(params = {}) {
        try {
            const response = await this.httpClient.get(this.endpoints.CHAT_ROOMS.LIST, params);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('🏠 获取群聊房间列表:', {
                    count: response.data?.rooms?.length || 0
                });
            }
            
            return response;
        } catch (error) {
            console.error('❌ 获取群聊房间失败:', error.message);
            throw error;
        }
    }

    /**
     * 创建群聊房间
     * @param {Object} data 房间数据
     * @returns {Promise<Object>} 创建结果
     */
    async createChatRoom(data) {
        try {
            const response = await this.httpClient.post(this.endpoints.CHAT_ROOMS.CREATE, data);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('➕ 创建群聊房间:', data.name);
            }
            
            return response;
        } catch (error) {
            console.error('❌ 创建群聊房间失败:', error.message);
            throw error;
        }
    }

    /**
     * 加入群聊房间
     * @param {string} roomId 房间ID
     * @returns {Promise<Object>} 加入结果
     */
    async joinChatRoom(roomId) {
        try {
            const url = EndpointBuilder.getChatRoomJoin(roomId);
            const response = await this.httpClient.post(url);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('🚪 加入群聊房间:', roomId);
            }
            
            return response;
        } catch (error) {
            console.error('❌ 加入群聊房间失败:', error.message);
            throw error;
        }
    }

    // ========================================
    // 🔧 系统健康检查 - 基于指南第7章
    // ========================================

    /**
     * 系统健康检查
     * @returns {Promise<Object>} 健康状态
     */
    async healthCheck() {
        try {
            const response = await this.httpClient.get(this.endpoints.SYSTEM.HEALTH);
            
            if (API_CONFIG.DEBUG_MODE) {
                console.log('💚 系统健康检查:', response.data?.status);
            }
            
            return response;
        } catch (error) {
            console.error('❌ 健康检查失败:', error.message);
            throw error;
        }
    }

    // ========================================
    // 🛠️ 工具方法
    // ========================================

    /**
     * 获取当前用户信息
     * @returns {Object|null} 用户信息
     */
    getCurrentUser() {
        try {
            const userInfo = localStorage.getItem('dify_user_info');
            return userInfo ? JSON.parse(userInfo) : null;
        } catch (error) {
            console.error('❌ 获取用户信息失败:', error.message);
            return null;
        }
    }

    /**
     * 检查是否已登录
     * @returns {boolean} 登录状态
     */
    isAuthenticated() {
        const token = localStorage.getItem('dify_access_token');
        return !!token;
    }

    /**
     * 获取访问令牌
     * @returns {string|null} 访问令牌
     */
    getAccessToken() {
        return localStorage.getItem('dify_access_token');
    }
}

// 创建全局实例
const difyApiService = new DifyApiService();

// 导出服务实例和类
window.DifyApiService = DifyApiService;
window.difyApiService = difyApiService;

export { DifyApiService };
export default difyApiService;
