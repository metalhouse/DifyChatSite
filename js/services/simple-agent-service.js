/**
 * 简化智能体服务 - 直接使用fetch，避免复杂依赖
 * 基于test-agent-api.html的成功实现
 */

import { ENV_CONFIG } from '../../config/env.js';

export class SimpleAgentService {
    constructor() {
        // 使用环境配置而不是硬编码
        this.baseURL = ENV_CONFIG?.API_BASE_URL || window.ENV_CONFIG?.API_BASE_URL || 'http://localhost:4005';
        this.apiPrefix = '/api';
        console.log('🤖 SimpleAgentService 初始化完成，baseURL:', this.baseURL);
    }

    /**
     * 检查API健康状态
     */
    async checkHealth() {
        try {
            const healthUrl = ENV_CONFIG?.getApiUrl('/health') || `${this.baseURL}${this.apiPrefix}/health`;
            const response = await fetch(healthUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            return response.ok;
        } catch (error) {
            console.log('🏥 API健康检查失败:', error.message);
            return false;
        }
    }

    /**
     * 获取当前用户可访问的智能体列表
     * ✅ 使用修复后的权限系统 - 包括公开智能体、用户创建的、被授权访问的私有智能体
     */
    async getAgents(params = {}) {
        try {
            // 构建查询参数
            const queryParams = new URLSearchParams({
                status: 'active',
                limit: '50',
                ...params
            });

            const url = `${this.baseURL}${this.apiPrefix}/agents?${queryParams}`;
            console.log('📡 请求智能体列表:', url);

            // 获取认证token
            const token = localStorage.getItem('dify_access_token');
            
            // 构建请求头，如果有token则添加认证信息
            const headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                console.log('🔐 使用认证token请求智能体列表');
                
                // 解析token显示用户信息（调试用）
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    console.log('👤 当前用户:', payload.username, `(${payload.role})`);
                } catch (e) {
                    console.warn('⚠️ token解析失败，但继续请求');
                }
            } else {
                console.log('👤 未登录用户，只能获取公开智能体');
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📦 智能体API响应:', data);

            if (data.success && data.data && Array.isArray(data.data.agents)) {
                const agents = data.data.agents;
                const total = data.data.total || agents.length;
                
                console.log(`✅ 成功获取 ${agents.length} 个可访问智能体 (总计: ${total})`);
                
                // 数据一致性验证
                if (agents.length !== total && total > 0) {
                    console.warn(`⚠️ 数据不一致: agents数组长度(${agents.length}) 与 total(${total}) 不匹配`);
                }
                
                // 如果有token且有智能体，显示权限统计
                if (token && agents.length > 0) {
                    const currentUserId = this.getCurrentUserId(token);
                    if (currentUserId) {
                        const ownedCount = agents.filter(a => 
                            a.ownerId === currentUserId || 
                            a.creator_id === currentUserId ||
                            a.createdBy === currentUserId
                        ).length;
                        const publicCount = agents.filter(a => a.visibility === 'public').length;
                        
                        console.log(`📊 智能体权限统计:`);
                        console.log(`   - 总数: ${agents.length}`);
                        console.log(`   - 自己创建: ${ownedCount}`);
                        console.log(`   - 公开智能体: ${publicCount}`);
                        console.log(`   - 被授权访问: ${Math.max(0, agents.length - Math.max(ownedCount, publicCount))}`);
                    }
                }

                return {
                    success: true,
                    agents: agents,
                    total: total
                };
            } else {
                console.warn('⚠️ 智能体数据格式异常:', data);
                return {
                    success: false,
                    error: data.message || '数据格式异常',
                    agents: []
                };
            }

        } catch (error) {
            console.error('❌ 获取智能体列表失败:', error);
            
            // 如果是认证相关错误，尝试获取公开智能体作为降级方案
            if (error.message.includes('401') || error.message.includes('403')) {
                console.log('🔄 认证失败，降级到公开智能体');
                return await this.getPublicAgents(params);
            }
            
            return {
                success: false,
                error: error.message,
                agents: []
            };
        }
    }

    /**
     * 从token中获取当前用户ID（用于统计）
     */
    getCurrentUserId(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.userId;
        } catch (e) {
            return null;
        }
    }

    /**
     * 获取公开智能体
     */
    async getPublicAgents(params = {}) {
        try {
            const queryParams = new URLSearchParams({
                limit: '10',
                ...params
            });

            const url = `${this.baseURL}${this.apiPrefix}/agents/public?${queryParams}`;
            console.log('📡 请求公开智能体:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success) {
                return {
                    success: true,
                    agents: data.data || [],
                    total: data.data?.length || 0
                };
            } else {
                return {
                    success: false,
                    error: data.message || '获取公开智能体失败',
                    agents: []
                };
            }

        } catch (error) {
            console.error('❌ 获取公开智能体失败:', error);
            return {
                success: false,
                error: error.message,
                agents: []
            };
        }
    }

    /**
     * 获取智能体详情
     */
    async getAgentDetail(agentId) {
        try {
            const url = `${this.baseURL}${this.apiPrefix}/agents/${agentId}`;
            console.log('📡 请求智能体详情:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success) {
                return {
                    success: true,
                    agent: data.data
                };
            } else {
                return {
                    success: false,
                    error: data.message || '获取智能体详情失败'
                };
            }

        } catch (error) {
            console.error('❌ 获取智能体详情失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 创建全局实例
export const simpleAgentService = new SimpleAgentService();
