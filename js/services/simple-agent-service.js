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
            const response = await fetch(`${this.baseURL}/health`, {
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
     * 获取智能体列表 - 基于成功的测试实现
     */
    async getAgents(params = {}) {
        try {
            // 构建查询参数
            const queryParams = new URLSearchParams({
                status: 'active',
                limit: '20',
                ...params
            });

            const url = `${this.baseURL}${this.apiPrefix}/agents?${queryParams}`;
            console.log('📡 请求智能体列表:', url);

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
            console.log('📦 智能体API响应:', data);

            if (data.success && data.data && data.data.agents) {
                console.log(`✅ 成功获取 ${data.data.agents.length} 个智能体`);
                return {
                    success: true,
                    agents: data.data.agents,
                    total: data.data.total || data.data.agents.length
                };
            } else {
                console.warn('⚠️ 智能体数据格式异常:', data);
                return {
                    success: false,
                    error: '数据格式异常',
                    agents: []
                };
            }

        } catch (error) {
            console.error('❌ 获取智能体失败:', error);
            return {
                success: false,
                error: error.message,
                agents: []
            };
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
