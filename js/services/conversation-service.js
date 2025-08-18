/**
 * 对话API服务
 * 基于API指南第5章对话管理模块实现
 */

import apiClient from '../api/api-client.js';
import { ENV_CONFIG } from '../../config/env.js';

export class ConversationService {
    constructor() {
        console.log('🗣️ ConversationService 初始化');
    }

    /**
     * 创建对话
     * @param {Object} options - 对话选项
     * @param {string} options.agent_id - 智能体ID
     * @param {string} [options.title] - 对话标题
     * @param {boolean} [options.auto_generate_title] - 自动生成标题
     * @returns {Promise<Object>} 对话信息
     */
    async createConversation(options) {
        try {
            console.log('🔨 创建新对话:', options);
            
            const response = await apiClient.post('/conversations', {
                agent_id: options.agent_id,
                title: options.title || `与智能体的对话`,
                auto_generate_title: options.auto_generate_title !== false
            });

            console.log('📦 对话创建响应:', response);
            console.log('📦 响应数据结构检查:', {
                hasSuccess: 'success' in response,
                hasData: 'data' in response,
                responseKeys: Object.keys(response),
                successValue: response.success,
                status: response.status,
                errorCode: response.error_code
            });

            // 先检查HTTP状态和错误码，识别认证错误
            if (response.status === 401 || response.error_code === 'HTTP_401') {
                console.log('🔐 在响应中检测到401错误');
                const authError = new Error(response.message || '令牌已过期');
                authError.response = { status: 401, data: response };
                authError.isAuthError = true;
                console.log('🔐 抛出认证错误:', authError);
                throw authError;
            }

            // 根据API客户端的响应结构处理
            if (response.success) {
                // 检查数据位置
                let conversationData = null;
                if (response.data && typeof response.data === 'object' && response.data.id) {
                    // 标准格式：{success: true, data: {...}}
                    conversationData = response.data;
                } else if (response.id) {
                    // 直接格式：服务器直接返回对话数据，被api-client包装
                    conversationData = response;
                }

                if (conversationData) {
                    console.log('✅ 对话创建成功:', conversationData);
                    return {
                        success: true,
                        conversation: conversationData
                    };
                } else {
                    console.error('❌ 对话数据格式异常:', response);
                    throw new Error('对话数据格式异常');
                }
            } else {
                console.error('❌ 响应成功标志为false:', response);
                
                // 直接抛出错误，包含完整的响应信息
                const errorMsg = response.message || '创建对话失败';
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('❌ 创建对话失败:', error);
            
            // 直接抛出错误，不进行复杂处理
            throw error;
        }
    }

    /**
     * 发送消息（流式模式）- 适应长时间AI处理
     * @param {string} conversationId - 对话ID
     * @param {Object} messageData - 消息数据
     * @param {string} messageData.content - 消息内容
     * @param {string} [messageData.type] - 消息类型（默认text）
     * @param {Object} [messageData.inputs] - 应用输入参数
     * @param {Function} [onChunk] - 流式数据回调函数
     * @returns {Promise<Object>} AI回复结果
     */
    async sendMessage(conversationId, messageData, onChunk = null) {
        try {
            console.log('📤 发送消息（流式模式）:', { conversationId, messageData });
            
            // 使用流式模式避免长时间等待导致的连接重置
            const payload = {
                content: messageData.content,
                type: messageData.type || 'text',
                response_mode: 'streaming',  // 使用流式模式
                auto_generate_name: true,
                ...messageData.inputs && { inputs: messageData.inputs }
            };

            // 获取认证token
            const token = localStorage.getItem('dify_access_token');
            if (!token) {
                throw new Error('未找到认证token，请重新登录');
            }

            // 使用fetch进行流式请求
            const apiBaseUrl = ENV_CONFIG?.getApiUrl() || window.ENV_CONFIG?.getApiUrl() || 'http://localhost:4005/api';
            const response = await fetch(`${apiBaseUrl}/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('� 开始接收流式响应...');

            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            let aiResponse = {
                id: null,
                content: '',
                conversation_id: conversationId,
                created_at: new Date().toISOString(),
                usage: null  // 添加usage字段
            };

            let userMessage = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            console.log('📦 流式数据:', data);
                            
                            if (data.event === 'message' && data.answer) {
                                // 累积AI回复内容
                                aiResponse.content += data.answer;
                                aiResponse.id = data.message_id;
                                
                                // 调用流式回调函数
                                if (onChunk && typeof onChunk === 'function') {
                                    onChunk(data.answer, aiResponse.content);
                                }
                                
                            } else if (data.event === 'message_end') {
                                // 流式响应完成
                                console.log('✅ 流式响应完成:', data);
                                aiResponse.id = data.message_id;
                                
                                // 提取usage信息
                                if (data.metadata && data.metadata.usage) {
                                    aiResponse.usage = data.metadata.usage;
                                    console.log('📊 Token使用量:', aiResponse.usage);
                                }
                                
                                // 处理用户消息信息（如果有）
                                if (data.metadata && data.metadata.user_message) {
                                    userMessage = data.metadata.user_message;
                                }
                                
                            } else if (data.event === 'error') {
                                throw new Error(data.message || '流式响应错误');
                            }
                        } catch (parseError) {
                            console.error('❌ 解析流式数据失败:', parseError, '原始数据:', line);
                        }
                    }
                }
            }

            console.log('✅ 流式消息发送成功');
            return {
                success: true,
                userMessage: userMessage || {
                    content: messageData.content,
                    conversation_id: conversationId,
                    created_at: new Date().toISOString()
                },
                aiResponse: aiResponse,
                conversationId: conversationId
            };

        } catch (error) {
            console.error('❌ 流式消息发送失败:', error);
            return {
                success: false,
                error: error.message || '发送消息失败'
            };
        }
    }

    /**
     * 获取对话列表
     * @param {Object} [params] - 查询参数
     * @param {number} [params.page] - 页码
     * @param {number} [params.limit] - 每页数量
     * @param {string} [params.status] - 对话状态
     * @returns {Promise<Object>} 对话列表
     */
    async getConversations(params = {}) {
        try {
            console.log('📋 获取对话列表:', params);
            
            const response = await apiClient.get('/conversations', { params });

            if (response.data.success) {
                console.log('✅ 对话列表获取成功:', response.data.data);
                return {
                    success: true,
                    conversations: response.data.data.conversations,
                    pagination: response.data.data.pagination
                };
            } else {
                throw new Error(response.data.message || '获取对话列表失败');
            }
        } catch (error) {
            console.error('❌ 获取对话列表失败:', error);
            return {
                success: false,
                error: error.message || '获取对话列表失败',
                conversations: [],
                pagination: null
            };
        }
    }

    /**
     * 获取对话详情
     * @param {string} conversationId - 对话ID
     * @param {Object} [params] - 查询参数
     * @param {number} [params.message_page] - 消息页码
     * @param {number} [params.message_limit] - 消息每页数量
     * @returns {Promise<Object>} 对话详情
     */
    async getConversation(conversationId, params = {}) {
        try {
            console.log('📖 获取对话详情:', { conversationId, params });
            
            const response = await apiClient.get(`/conversations/${conversationId}`, { params });

            if (response.data.success) {
                console.log('✅ 对话详情获取成功:', response.data.data);
                return {
                    success: true,
                    conversation: response.data.data.conversation,
                    messages: response.data.data.messages,
                    pagination: response.data.data.pagination
                };
            } else {
                throw new Error(response.data.message || '获取对话详情失败');
            }
        } catch (error) {
            console.error('❌ 获取对话详情失败:', error);
            return {
                success: false,
                error: error.message || '获取对话详情失败'
            };
        }
    }

    /**
     * 删除对话
     * @param {string} conversationId - 对话ID
     * @returns {Promise<Object>} 删除结果
     */
    async deleteConversation(conversationId) {
        try {
            console.log('🗑️ 删除对话:', conversationId);
            
            const response = await apiClient.delete(`/conversations/${conversationId}`);

            if (response.data.success) {
                console.log('✅ 对话删除成功');
                return {
                    success: true,
                    message: '对话删除成功'
                };
            } else {
                throw new Error(response.data.message || '删除对话失败');
            }
        } catch (error) {
            console.error('❌ 删除对话失败:', error);
            return {
                success: false,
                error: error.message || '删除对话失败'
            };
        }
    }

    /**
     * 更新对话标题
     * @param {string} conversationId - 对话ID
     * @param {string} title - 新标题
     * @returns {Promise<Object>} 更新结果
     */
    async updateConversationTitle(conversationId, title) {
        try {
            console.log('✏️ 更新对话标题:', { conversationId, title });
            
            const response = await apiClient.patch(`/conversations/${conversationId}`, {
                name: title
            });

            if (response.data.success) {
                console.log('✅ 对话标题更新成功');
                return {
                    success: true,
                    conversation: response.data.data
                };
            } else {
                throw new Error(response.data.message || '更新对话标题失败');
            }
        } catch (error) {
            console.error('❌ 更新对话标题失败:', error);
            return {
                success: false,
                error: error.message || '更新对话标题失败'
            };
        }
    }

    /**
     * 获取对话消息历史
     * @param {string} conversationId - 对话ID
     * @param {Object} options - 查询选项
     * @param {number} [options.page] - 页码，默认为1
     * @param {number} [options.limit] - 每页条数，默认为50
     * @param {string} [options.order] - 排序方式，asc/desc，默认desc
     * @returns {Promise<Object>} 消息列表
     */
    async getMessages(conversationId, options = {}) {
        try {
            console.log('📨 获取对话消息历史:', conversationId, options);
            
            const params = {
                page: options.page || 1,
                limit: options.limit || 50,
                order: options.order || 'desc'
            };
            
            const response = await apiClient.get(`/conversations/${conversationId}/messages`, params);
            
            console.log('📦 消息历史API响应:', response);
            
            if (response.success && response.data) {
                return {
                    success: true,
                    data: response.data,
                    messages: response.data.messages || [],
                    pagination: response.data.pagination || {}
                };
            } else {
                throw new Error(response.message || '获取消息历史失败');
            }
            
        } catch (error) {
            console.error('❌ 获取消息历史失败:', error);
            return {
                success: false,
                error: error.message || '获取消息历史失败'
            };
        }
    }
}

// 创建全局实例
export const conversationService = new ConversationService();
