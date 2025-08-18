/**
 * 智能体API服务 - 基于DifyChatBack v2.0 API指南第8章
 * 智能体管理模块的完整实现
 */

import { HttpClient } from './api-client.js';
import { API_ENDPOINTS } from './endpoints.js';
import { ENV_CONFIG } from '../../config/env.js';

export class AgentAPI {
    constructor() {
        // 创建HttpClient实例
        this.httpClient = new HttpClient({
            timeout: ENV_CONFIG.API_TIMEOUT // 使用通用API超时（30秒）
        });
        
        console.log('🤖 AgentAPI 初始化完成');
    }

    /**
     * 获取智能体列表 - 基于API指南第8.2.3节
     * @param {Object} params - 查询参数
     * @param {number} params.page - 页码（默认1）
     * @param {number} params.limit - 每页条数（默认20）
     * @param {string} params.search - 搜索关键词
     * @param {string} params.type - 智能体类型
     * @param {string} params.status - 智能体状态
     * @param {string} params.visibility - 可见性
     * @param {string} params.sortBy - 排序字段
     * @param {string} params.sortOrder - 排序顺序
     * @returns {Promise} API响应
     */
    async getAgentList(params = {}) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('📋 获取智能体列表:', {
                    url: API_ENDPOINTS.AGENTS.LIST,
                    params
                });
            }

            const response = await this.httpClient.get(API_ENDPOINTS.AGENTS.LIST, params, {
                requireAuth: false // 获取公开智能体不需要认证
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 智能体列表获取成功:', {
                    total: response.data.total,
                    count: response.data.agents?.length || 0
                });
            }

            return response;
        } catch (error) {
            console.error('❌ 获取智能体列表失败:', error);
            throw this._handleError(error, '获取智能体列表失败');
        }
    }

    /**
     * 获取智能体详情 - 基于API指南第8.2.2节
     * @param {string} agentId - 智能体ID
     * @returns {Promise} API响应
     */
    async getAgentDetail(agentId) {
        try {
            if (!agentId) {
                throw new Error('智能体ID不能为空');
            }

            const url = API_ENDPOINTS.AGENTS.DETAIL.replace('{id}', agentId);
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🔍 获取智能体详情:', { agentId, url });
            }

            const response = await this.httpClient.get(url, {
                requireAuth: false // 公开智能体详情不需要认证
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 智能体详情获取成功:', {
                    id: response.data.id,
                    name: response.data.name,
                    type: response.data.type
                });
            }

            return response;
        } catch (error) {
            console.error('❌ 获取智能体详情失败:', error);
            throw this._handleError(error, '获取智能体详情失败');
        }
    }

    /**
     * 获取用户的智能体列表 - 基于API指南第8.2.4节
     * @param {string} userId - 用户ID
     * @returns {Promise} API响应
     */
    async getUserAgents(userId) {
        try {
            if (!userId) {
                throw new Error('用户ID不能为空');
            }

            const url = API_ENDPOINTS.AGENTS.USER_AGENTS.replace('{userId}', userId);
            
            if (ENV_CONFIG.isDebug()) {
                console.log('👤 获取用户智能体列表:', { userId, url });
            }

            const response = await this.httpClient.get(url, {
                requireAuth: true // 需要认证才能访问用户智能体
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 用户智能体列表获取成功:', {
                    userId,
                    count: response.data?.length || 0
                });
            }

            return response;
        } catch (error) {
            console.error('❌ 获取用户智能体列表失败:', error);
            throw this._handleError(error, '获取用户智能体列表失败');
        }
    }

    /**
     * 获取公开智能体列表
     * @param {Object} params - 查询参数
     * @returns {Promise} API响应
     */
    async getPublicAgents(params = {}) {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('🌐 获取公开智能体列表:', { params });
            }

            const response = await this.httpClient.get(API_ENDPOINTS.AGENTS.PUBLIC, params, {
                requireAuth: false
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 公开智能体列表获取成功:', {
                    count: response.data?.length || 0
                });
            }

            return response;
        } catch (error) {
            console.error('❌ 获取公开智能体列表失败:', error);
            throw this._handleError(error, '获取公开智能体列表失败');
        }
    }

    /**
     * 创建智能体 - 基于API指南第8.2.1节
     * @param {Object} agentData - 智能体数据
     * @returns {Promise} API响应
     */
    async createAgent(agentData) {
        try {
            if (!agentData.name || !agentData.description) {
                throw new Error('智能体名称和描述不能为空');
            }

            if (ENV_CONFIG.isDebug()) {
                console.log('➕ 创建智能体:', {
                    name: agentData.name,
                    type: agentData.type,
                    visibility: agentData.visibility
                });
            }

            const response = await this.httpClient.post(API_ENDPOINTS.AGENTS.CREATE, agentData, {
                requireAuth: true // 创建智能体需要认证
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 智能体创建成功:', {
                    id: response.data.id,
                    name: response.data.name
                });
            }

            return response;
        } catch (error) {
            console.error('❌ 创建智能体失败:', error);
            throw this._handleError(error, '创建智能体失败');
        }
    }

    /**
     * 更新智能体
     * @param {string} agentId - 智能体ID
     * @param {Object} updateData - 更新数据
     * @returns {Promise} API响应
     */
    async updateAgent(agentId, updateData) {
        try {
            if (!agentId) {
                throw new Error('智能体ID不能为空');
            }

            const url = API_ENDPOINTS.AGENTS.UPDATE.replace('{id}', agentId);
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🔄 更新智能体:', { agentId, updateData });
            }

            const response = await this.httpClient.put(url, updateData, {
                requireAuth: true
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 智能体更新成功:', { agentId });
            }

            return response;
        } catch (error) {
            console.error('❌ 更新智能体失败:', error);
            throw this._handleError(error, '更新智能体失败');
        }
    }

    /**
     * 删除智能体
     * @param {string} agentId - 智能体ID
     * @returns {Promise} API响应
     */
    async deleteAgent(agentId) {
        try {
            if (!agentId) {
                throw new Error('智能体ID不能为空');
            }

            const url = API_ENDPOINTS.AGENTS.DELETE.replace('{id}', agentId);
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🗑️ 删除智能体:', { agentId });
            }

            const response = await this.httpClient.delete(url, {
                requireAuth: true
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 智能体删除成功:', { agentId });
            }

            return response;
        } catch (error) {
            console.error('❌ 删除智能体失败:', error);
            throw this._handleError(error, '删除智能体失败');
        }
    }

    /**
     * 评价智能体
     * @param {string} agentId - 智能体ID
     * @param {Object} ratingData - 评价数据
     * @returns {Promise} API响应
     */
    async rateAgent(agentId, ratingData) {
        try {
            if (!agentId) {
                throw new Error('智能体ID不能为空');
            }

            const url = API_ENDPOINTS.AGENTS.RATE.replace('{id}', agentId);
            
            const response = await this.httpClient.post(url, ratingData, {
                requireAuth: true
            });

            return response;
        } catch (error) {
            console.error('❌ 评价智能体失败:', error);
            throw this._handleError(error, '评价智能体失败');
        }
    }

    /**
     * 获取智能体分类
     * @returns {Promise} API响应
     */
    async getAgentCategories() {
        try {
            if (ENV_CONFIG.isDebug()) {
                console.log('📂 获取智能体分类');
            }

            const response = await this.httpClient.get(API_ENDPOINTS.AGENTS.CATEGORIES, {
                requireAuth: false
            });

            if (ENV_CONFIG.isDebug()) {
                console.log('✅ 智能体分类获取成功:', {
                    count: response.data?.length || 0
                });
            }

            return response;
        } catch (error) {
            console.error('❌ 获取智能体分类失败:', error);
            throw this._handleError(error, '获取智能体分类失败');
        }
    }

    /**
     * 统一错误处理
     * @private
     */
    _handleError(error, defaultMessage) {
        if (error.response) {
            // HTTP错误响应
            const { status, data } = error.response;
            return new Error(data.message || `HTTP ${status}: ${defaultMessage}`);
        } else if (error.request) {
            // 网络错误
            return new Error('网络连接失败，请检查网络设置');
        } else {
            // 其他错误
            return new Error(error.message || defaultMessage);
        }
    }
}

// 创建全局实例
export const agentAPI = new AgentAPI();
