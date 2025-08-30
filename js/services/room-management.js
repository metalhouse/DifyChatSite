/**
 * 群聊房间管理服务 - 综合群聊功能管理
 * 基于DifyChatBack v2.0 API指南第5章
 * 提供群聊房间的创建、管理、成员管理等功能
 */

// 导入依赖
import { ENV_CONFIG } from '../../config/env.js';
import httpClient from '../api/api-client.js';
import { API_ENDPOINTS, EndpointBuilder } from '../api/endpoints.js';
import difySdk from '../api/dify-api.js';

/**
 * 群聊房间管理服务类
 * 提供完整的群聊房间管理功能
 */
class RoomManagementService {
    constructor() {
        this.rooms = new Map(); // 本地房间缓存
        this.roomMembers = new Map(); // 房间成员缓存
        this.roomAgents = new Map(); // 房间智能体缓存
        this.userRoles = new Map(); // 用户角色缓存
        
        if (ENV_CONFIG.isDebug()) {
            console.log('🏠 RoomManagementService初始化');
        }
    }

    // ========================================
    // 🏠 房间基础管理
    // ========================================

    /**
     * 创建新的群聊房间
     * @param {Object} roomData 房间数据
     * @param {string} roomData.name 房间名称
     * @param {string} [roomData.description] 房间描述
     * @param {string} [roomData.avatar] 房间头像URL
     * @param {Array} [roomData.agents] 初始智能体列表
     * @param {Object} [roomData.settings] 房间设置
     * @returns {Promise<Object>} 创建的房间信息
     */
    async createRoom(roomData) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('🆕 创建群聊房间:', roomData.name);
            }

            const response = await httpClient.post(API_ENDPOINTS.CHAT_ROOMS.CREATE, {
                name: roomData.name,
                description: roomData.description || '',
                avatar: roomData.avatar || null,
                agents: roomData.agents || [],
                settings: {
                    isPublic: roomData.settings?.isPublic || false,
                    allowAgentInteraction: roomData.settings?.allowAgentInteraction || true,
                    maxMembers: roomData.settings?.maxMembers || 100,
                    requireApproval: roomData.settings?.requireApproval || false,
                    ...roomData.settings
                }
            });

            const room = response.data;
            
            // 缓存房间信息
            this._cacheRoom(room);
            
            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 房间创建成功:', room.id);
            }

            return room;
        } catch (error) {
            console.error('❌ 创建房间失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取用户的群聊房间列表
     * @param {Object} options 查询选项
     * @param {number} [options.page=1] 页码
     * @param {number} [options.limit=20] 每页数量
     * @param {string} [options.sort='updated_at'] 排序字段
     * @param {string} [options.order='desc'] 排序顺序
     * @returns {Promise<Object>} 房间列表和分页信息
     */
    async getRooms(options = {}) {
        try {
            const params = {
                page: options.page || 1,
                limit: options.limit || 20,
                sort: options.sort || 'updated_at',
                order: options.order || 'desc'
            };

            const response = await httpClient.get(API_ENDPOINTS.CHAT_ROOMS.LIST, { params });
            
            // 缓存房间列表
            response.data.rooms.forEach(room => {
                this._cacheRoom(room);
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('📋 获取房间列表:', response.data.total);
            }

            return response.data;
        } catch (error) {
            console.error('❌ 获取房间列表失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取指定房间详情
     * @param {string} roomId 房间ID
     * @param {boolean} [useCache=true] 是否使用缓存
     * @returns {Promise<Object>} 房间详情
     */
    async getRoomDetails(roomId, useCache = true) {
        try {
            // 检查缓存
            if (useCache && this.rooms.has(roomId)) {
                const cached = this.rooms.get(roomId);
                // 缓存时间检查（5分钟）
                if (Date.now() - cached.cachedAt < 5 * 60 * 1000) {
                    return cached.data;
                }
            }

            const response = await httpClient.get(
                EndpointBuilder.build(API_ENDPOINTS.CHAT_ROOMS.DETAIL, { id: roomId })
            );

            const room = response.data;
            this._cacheRoom(room);

            if (ENV_CONFIG.isDebug()) {
                console.log('🏠 获取房间详情:', roomId);
            }

            return room;
        } catch (error) {
            console.error('❌ 获取房间详情失败:', error.message);
            throw error;
        }
    }

    /**
     * 更新房间信息
     * @param {string} roomId 房间ID
     * @param {Object} updateData 更新数据
     * @returns {Promise<Object>} 更新后的房间信息
     */
    async updateRoom(roomId, updateData) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('✏️ 更新房间信息:', roomId);
            }

            const response = await httpClient.put(
                EndpointBuilder.build(API_ENDPOINTS.CHAT_ROOMS.UPDATE, { id: roomId }),
                updateData
            );

            const updatedRoom = response.data;
            this._cacheRoom(updatedRoom);

            return updatedRoom;
        } catch (error) {
            console.error('❌ 更新房间失败:', error.message);
            throw error;
        }
    }

    /**
     * 删除房间
     * @param {string} roomId 房间ID
     * @returns {Promise<boolean>} 删除是否成功
     */
    async deleteRoom(roomId) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('🗑️ 删除房间:', roomId);
            }

            await httpClient.delete(
                EndpointBuilder.build(API_ENDPOINTS.CHAT_ROOMS.DELETE, { id: roomId })
            );

            // 清除缓存
            this._clearRoomCache(roomId);

            return true;
        } catch (error) {
            console.error('❌ 删除房间失败:', error.message);
            throw error;
        }
    }

    /**
     * 离开房间
     * @param {string} roomId 房间ID
     * @returns {Promise<Object>} 操作结果
     */
    async leaveRoom(roomId) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('🚪 离开房间:', roomId);
            }

            const response = await httpClient.post(
                EndpointBuilder.build(API_ENDPOINTS.CHAT_ROOMS.LEAVE, { id: roomId })
            );

            // 清除本地缓存
            this._clearRoomCache(roomId);

            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 离开房间成功:', roomId);
            }

            return response.data;
        } catch (error) {
            console.error('❌ 离开房间失败:', error.message);
            throw error;
        }
    }

    // ========================================
    // 👥 成员管理
    // ========================================

    /**
     * 获取房间成员列表
     * @param {string} roomId 房间ID
     * @param {Object} options 查询选项
     * @returns {Promise<Array>} 成员列表
     */
    async getRoomMembers(roomId, options = {}) {
        try {
            const params = {
                page: options.page || 1,
                limit: options.limit || 50,
                role: options.role || null
            };

            const response = await httpClient.get(
                API_ENDPOINTS.CHAT_ROOMS.MEMBERS.replace('{id}', roomId),
                { params }
            );

            // 缓存成员列表
            this.roomMembers.set(roomId, {
                data: response.data.members || response.data,
                cachedAt: Date.now()
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('👥 获取房间成员:', roomId, response.data.total || response.data.length);
            }

            return response.data.members || response.data;
        } catch (error) {
            console.error('❌ 获取房间成员失败:', error.message);
            throw error;
        }
    }

    /**
     * 邀请用户加入房间
     * @param {string} roomId 房间ID
     * @param {Array} userIds 用户ID列表
     * @param {string} [role='member'] 用户角色
     * @returns {Promise<Object>} 邀请结果
     */
    async inviteUsers(roomId, userIds, role = 'member') {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('📧 邀请用户加入房间:', { roomId, userIds, role });
                console.log('📤 请求数据结构:', {
                    endpoint: API_ENDPOINTS.FRIENDS.INVITE_TO_ROOM,
                    requestBody: {
                        roomId: roomId,
                        friendIds: userIds,
                        // 尝试不同的参数名
                        room_id: roomId,
                        friend_ids: userIds
                    }
                });
            }

            // 使用好友API端点邀请用户到房间（后端已修复参数兼容性）
            const requestData = {
                roomId: roomId,
                friendIds: userIds
            };
            
            // 确保参数不为空
            if (!roomId || !userIds || userIds.length === 0) {
                throw new Error('房间ID或好友列表为空');
            }
            
            console.log('🚀 最终发送的请求数据:', requestData);
            console.log('🌐 API端点:', API_ENDPOINTS.FRIENDS.INVITE_TO_ROOM);
            
            const response = await httpClient.post(
                API_ENDPOINTS.FRIENDS.INVITE_TO_ROOM,
                requestData
            );

            // 检查响应是否成功
            if (response && response.success === false) {
                // API返回了错误
                throw new Error(response.message || '邀请失败');
            }

            // 清除成员缓存，强制重新获取
            this.roomMembers.delete(roomId);

            return response;
        } catch (error) {
            console.error('❌ 邀请用户失败:', error.message);
            console.error('❌ 完整错误信息:', error);
            throw error;
        }
    }

    /**
     * 移除房间成员
     * @param {string} roomId 房间ID
     * @param {string} userId 用户ID
     * @returns {Promise<boolean>} 移除是否成功
     */
    async removeMember(roomId, userId) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('👤➖ 移除房间成员:', { roomId, userId });
            }

            await httpClient.delete(
                API_ENDPOINTS.CHAT_ROOMS.KICK.replace('{id}', roomId),
                {
                    data: { userId }
                }
            );

            // 清除成员缓存
            this.roomMembers.delete(roomId);

            return true;
        } catch (error) {
            console.error('❌ 移除成员失败:', error.message);
            throw error;
        }
    }

    /**
     * 更新成员角色
     * @param {string} roomId 房间ID
     * @param {string} userId 用户ID
     * @param {string} newRole 新角色
     * @returns {Promise<Object>} 更新结果
     */
    async updateMemberRole(roomId, userId, newRole) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('👤🔄 更新成员角色:', { roomId, userId, newRole });
            }

            const response = await httpClient.put(
                API_ENDPOINTS.CHAT_ROOMS.MEMBERS.ROLE
                    .replace(':roomId', roomId)
                    .replace(':userId', userId),
                { role: newRole }
            );

            // 更新角色缓存
            const roleKey = `${roomId}:${userId}`;
            this.userRoles.set(roleKey, newRole);

            return response.data;
        } catch (error) {
            console.error('❌ 更新成员角色失败:', error.message);
            throw error;
        }
    }

    // ========================================
    // 🤖 智能体管理
    // ========================================

    /**
     * 获取房间智能体列表
     * @param {string} roomId 房间ID
     * @returns {Promise<Array>} 智能体列表
     */
    async getRoomAgents(roomId) {
        try {
            const response = await httpClient.get(
                API_ENDPOINTS.CHAT_ROOMS.AGENTS.LIST.replace(':roomId', roomId)
            );

            // 缓存智能体列表
            this.roomAgents.set(roomId, {
                data: response.data.agents,
                cachedAt: Date.now()
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('🤖 获取房间智能体:', roomId, response.data.agents.length);
            }

            return response.data.agents;
        } catch (error) {
            console.error('❌ 获取房间智能体失败:', error.message);
            throw error;
        }
    }

    /**
     * 添加智能体到房间
     * @param {string} roomId 房间ID
     * @param {string} agentId 智能体ID
     * @param {Object} [config] 智能体配置
     * @returns {Promise<Object>} 添加结果
     */
    async addAgent(roomId, agentId, config = {}) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('🤖➕ 添加智能体到房间:', { roomId, agentId });
            }

            const response = await httpClient.post(
                API_ENDPOINTS.CHAT_ROOMS.AGENTS.ADD.replace(':roomId', roomId),
                {
                    agentId,
                    config: {
                        autoReply: config.autoReply || true,
                        mentionOnly: config.mentionOnly || false,
                        priority: config.priority || 1,
                        ...config
                    }
                }
            );

            // 清除智能体缓存
            this.roomAgents.delete(roomId);

            return response.data;
        } catch (error) {
            console.error('❌ 添加智能体失败:', error.message);
            throw error;
        }
    }

    /**
     * 从房间移除智能体
     * @param {string} roomId 房间ID
     * @param {string} agentId 智能体ID
     * @returns {Promise<boolean>} 移除是否成功
     */
    async removeAgent(roomId, agentId) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('🤖➖ 从房间移除智能体:', { roomId, agentId });
            }

            await httpClient.delete(
                API_ENDPOINTS.CHAT_ROOMS.AGENTS.REMOVE
                    .replace(':roomId', roomId)
                    .replace(':agentId', agentId)
            );

            // 清除智能体缓存
            this.roomAgents.delete(roomId);

            return true;
        } catch (error) {
            console.error('❌ 移除智能体失败:', error.message);
            throw error;
        }
    }

    /**
     * 更新智能体配置
     * @param {string} roomId 房间ID
     * @param {string} agentId 智能体ID
     * @param {Object} config 新配置
     * @returns {Promise<Object>} 更新结果
     */
    async updateAgentConfig(roomId, agentId, config) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('🤖🔧 更新智能体配置:', { roomId, agentId });
            }

            const response = await httpClient.put(
                API_ENDPOINTS.CHAT_ROOMS.AGENTS.CONFIG
                    .replace(':roomId', roomId)
                    .replace(':agentId', agentId),
                { config }
            );

            // 清除智能体缓存
            this.roomAgents.delete(roomId);

            return response.data;
        } catch (error) {
            console.error('❌ 更新智能体配置失败:', error.message);
            throw error;
        }
    }

    // ========================================
    // 💬 消息管理
    // ========================================

    /**
     * 获取房间消息历史
     * @param {string} roomId 房间ID
     * @param {Object} options 查询选项
     * @returns {Promise<Object>} 消息列表和分页信息
     */
    async getRoomMessages(roomId, options = {}) {
        try {
            const params = {
                page: options.page || 1,
                limit: options.limit || 50,
                before: options.before || null,
                after: options.after || null,
                type: options.type || null,
                sender: options.sender || null
            };

            const url = API_ENDPOINTS.CHAT_ROOMS.MESSAGES.replace('{id}', roomId);
            console.log('🌐 [RoomManagement] 准备调用API:', {
                url: url,
                roomId: roomId,
                params: params,
                fullEndpoint: API_ENDPOINTS.CHAT_ROOMS.MESSAGES
            });

            const response = await httpClient.get(url, params);

            console.log('📨 [RoomManagement] API响应结果:', {
                success: response?.data?.success,
                messageCount: response?.data?.messages?.length || 0,
                total: response?.data?.total || response?.data?.pagination?.total || 0,
                hasData: !!response?.data,
                responseStructure: Object.keys(response?.data || {})
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('💬 获取房间消息:', roomId, response.data.total);
            }

            return response.data;
        } catch (error) {
            console.error('❌ 获取房间消息失败:', error.message);
            console.error('🔧 [RoomManagement] 错误详情:', {
                roomId: roomId,
                url: API_ENDPOINTS.CHAT_ROOMS.MESSAGES.replace('{id}', roomId),
                errorType: error.constructor.name,
                errorMessage: error.message
            });
            throw error;
        }
    }

    /**
     * 发送消息到群聊房间
     * @param {string} roomId 房间ID
     * @param {string} content 消息内容
     * @param {Object} options 消息选项
     * @returns {Promise<Object>} 发送结果
     */
    async sendMessage(roomId, content, options = {}) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('📤 发送群聊消息:', { 
                    roomId, 
                    contentLength: content.length,
                    hasMention: !!options.mentionAgent
                });
            }

            // 使用DifySDK的群聊消息发送功能
            const result = await difySdk.sendGroupMessage(roomId, content, {
                type: options.type || 'text',
                mentionAgent: options.mentionAgent,
                replyTo: options.replyTo,
                attachments: options.attachments || []
            });

            return result;
        } catch (error) {
            console.error('❌ 发送群聊消息失败:', error.message);
            throw error;
        }
    }

    // ========================================
    // 🛠️ 工具方法
    // ========================================

    /**
     * 缓存房间信息
     * @private
     */
    _cacheRoom(room) {
        this.rooms.set(room.id, {
            data: room,
            cachedAt: Date.now()
        });
    }

    /**
     * 清除房间缓存
     * @private
     */
    _clearRoomCache(roomId) {
        this.rooms.delete(roomId);
        this.roomMembers.delete(roomId);
        this.roomAgents.delete(roomId);
        
        // 清除相关的用户角色缓存
        for (const [key] of this.userRoles.entries()) {
            if (key.startsWith(`${roomId}:`)) {
                this.userRoles.delete(key);
            }
        }
    }

    /**
     * 获取用户在房间中的角色
     * @param {string} roomId 房间ID
     * @param {string} userId 用户ID
     * @returns {Promise<string>} 用户角色
     */
    async getUserRole(roomId, userId) {
        const roleKey = `${roomId}:${userId}`;
        
        // 检查缓存
        if (this.userRoles.has(roleKey)) {
            return this.userRoles.get(roleKey);
        }

        try {
            // 从成员列表中查找
            const members = await this.getRoomMembers(roomId);
            const member = members.members.find(m => m.userId === userId);
            
            if (member) {
                this.userRoles.set(roleKey, member.role);
                return member.role;
            }
            
            return null;
        } catch (error) {
            console.error('❌ 获取用户角色失败:', error.message);
            return null;
        }
    }

    /**
     * 检查用户是否有权限执行操作
     * @param {string} roomId 房间ID
     * @param {string} userId 用户ID
     * @param {string} action 操作类型
     * @returns {Promise<boolean>} 是否有权限
     */
    async checkPermission(roomId, userId, action) {
        try {
            const role = await this.getUserRole(roomId, userId);
            
            // 权限定义
            const permissions = {
                'owner': ['*'], // 所有权限
                'admin': ['invite', 'remove', 'manage_agents', 'send_message'],
                'moderator': ['send_message', 'manage_agents'],
                'member': ['send_message']
            };

            const userPermissions = permissions[role] || [];
            return userPermissions.includes('*') || userPermissions.includes(action);
        } catch (error) {
            console.error('❌ 检查权限失败:', error.message);
            return false;
        }
    }

    /**
     * 获取缓存状态
     * @returns {Object} 缓存状态信息
     */
    getCacheStatus() {
        return {
            rooms: this.rooms.size,
            members: this.roomMembers.size,
            agents: this.roomAgents.size,
            roles: this.userRoles.size
        };
    }

    /**
     * 清除所有缓存
     */
    clearCache() {
        this.rooms.clear();
        this.roomMembers.clear();
        this.roomAgents.clear();
        this.userRoles.clear();

        if (ENV_CONFIG.isDebug()) {
            console.log('🧹 房间管理服务缓存已清除');
        }
    }
}

// 创建全局实例
const roomManagementService = new RoomManagementService();

// 导出服务类和实例
window.RoomManagementService = RoomManagementService;
window.roomManagementService = roomManagementService;

export { RoomManagementService };
export default roomManagementService;
