/**
 * 好友系统API服务类
 * 基于后端好友API实现用户搜索、好友请求管理、好友聊天等功能
 */

class FriendsApiService {
    constructor() {
        // 不在构造函数中设置baseURL，改为动态获取
        this.endpoints = {
            FRIENDS: {
                SEARCH: '/api/friends/search',
                LIST: '/api/friends',
                DELETE: '/api/friends',  // 删除好友的基础端点，实际使用时会添加/{userId}
                SUGGESTIONS: '/api/friends/suggestions'
            },
            REQUESTS: {
                SEND: '/api/friends/request',
                RECEIVED: '/api/friends/requests/received',
                SENT: '/api/friends/requests/sent',
                HANDLE: '/api/friends/requests'
            },
            MESSAGES: {
                SEND: '/api/friends/messages/send',
                HISTORY: '/api/friends/messages/history',
                MARK_READ: '/api/friends/messages/mark-read',
                MARK_AS_READ: '/api/friends/messages/mark-as-read',
                UNREAD_COUNTS: '/api/friends/messages/unread-counts',
                READ_STATUS: '/api/friends/messages/read-status',
                DELETE: '/api/friends/messages',
                SEARCH: '/api/friends/messages/search'
            },
            INVITE: {
                TO_ROOM: '/api/friends/invite-to-room'
            }
        };
    }

    /**
     * 动态获取API基础URL
     * @returns {string} API基础URL
     */
    getBaseURL() {
        // 优先使用ENV_CONFIG
        if (window.ENV_CONFIG?.API_BASE_URL) {
            return window.ENV_CONFIG.API_BASE_URL;
        }
        
        // 降级方案：根据当前页面环境构建URL
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // 本地开发环境
            return 'http://localhost:4005';
        } else {
            // 生产环境通过Nginx代理
            return `${protocol}//${window.location.host}`;
        }
    }

    /**
     * 获取认证头
     * @returns {Object} 请求头
     */
    getHeaders() {
        // 按照API文档，优先使用access_token
        let token = localStorage.getItem('access_token');
        
        // 如果没有access_token，尝试其他可能的键名
        if (!token || token === 'null' || token === 'undefined') {
            const fallbackKeys = [
                'dify_access_token',
                'jwt_token', 
                'auth_token',
                'user_token'
            ];
            
            for (const key of fallbackKeys) {
                const fallbackToken = localStorage.getItem(key);
                if (fallbackToken && fallbackToken !== 'null' && fallbackToken !== 'undefined') {
                    token = fallbackToken;
                    console.log(`🔄 使用备用Token键: ${key}`);
                    break;
                }
            }
        }

        if (!token || token === 'null' || token === 'undefined') {
            console.error('❌ 未找到有效的访问令牌');
            console.warn('📋 localStorage中的Token相关键:', 
                Object.keys(localStorage).filter(key => 
                    key.toLowerCase().includes('token') || 
                    key.toLowerCase().includes('access')
                ).map(key => ({ 
                    key, 
                    value: localStorage.getItem(key)?.substring(0, 20) + '...',
                    hasValue: !!localStorage.getItem(key) && localStorage.getItem(key) !== 'null'
                }))
            );
            throw new Error('用户未登录或Token已过期，请重新登录');
        }
        
        // 按照API文档的标准格式：Bearer {token}
        // 确保token没有重复的Bearer前缀
        const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
        const authHeader = `Bearer ${cleanToken}`;
        
        console.log('🔑 使用认证头:', authHeader.substring(0, 30) + '...');
        
        return {
            'Content-Type': 'application/json',
            'Authorization': authHeader
        };
    }

    /**
     * 发送HTTP请求
     * @param {string} method HTTP方法
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @returns {Promise} 请求结果
     */
    async request(method, url, data = null) {
        const config = {
            method,
            headers: this.getHeaders()
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
            config.body = JSON.stringify(data);
        }

        const fullURL = `${this.getBaseURL()}${url}`;
        console.log(`🌐 [FriendsApi] ${method} ${fullURL}`, data ? { data } : '');

        try {
            const response = await fetch(fullURL, config);
            
            console.log(`📡 [FriendsApi] Response Status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ [FriendsApi] Error Response:`, errorText);
                
                let errorMessage;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorJson.error || `HTTP ${response.status}`;
                } catch {
                    errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log(`✅ [FriendsApi] Success Response:`, result);
            return result;
            
        } catch (error) {
            console.error(`❌ [FriendsApi] Request Failed:`, {
                method,
                url: fullURL,
                data,
                error: error.message
            });
            throw error;
        }
    }

    // ========================================
    // 🔍 用户搜索相关
    // ========================================

    /**
     * 搜索用户
     * @param {string} username 用户名关键词
     * @param {number} page 页码，默认为1
     * @returns {Promise<Object>} 搜索结果
     */
    async searchUsers(username, page = 1) {
        try {
            const params = new URLSearchParams();
            params.append('username', username);
            params.append('page', page.toString());
            
            const url = `${this.endpoints.FRIENDS.SEARCH}?${params.toString()}`;
            const response = await this.request('GET', url);
            
            console.log('🔍 搜索用户结果:', response);
            return response;
        } catch (error) {
            console.error('❌ 搜索用户失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取好友建议
     * @returns {Promise<Object>} 好友建议列表
     */
    async getFriendSuggestions() {
        try {
            const response = await this.request('GET', this.endpoints.FRIENDS.SUGGESTIONS);
            console.log('💡 获取好友建议:', response);
            return response;
        } catch (error) {
            console.error('❌ 获取好友建议失败:', error.message);
            throw error;
        }
    }

    // ========================================
    // 👥 好友请求管理
    // ========================================

    /**
     * 发送好友请求
     * @param {string} targetUsername 目标用户名
     * @param {string} message 请求消息（可选）
     * @returns {Promise<Object>} 发送结果
     */
    async sendFriendRequest(targetUsername, message = '') {
        console.log(`🤝 [FriendsApi] 准备发送好友请求给: ${targetUsername}`);
        
        try {
            // 检查Token
            const headers = this.getHeaders();
            if (!headers.Authorization || headers.Authorization === 'Bearer null' || headers.Authorization === 'Bearer undefined') {
                throw new Error('用户未登录或Token已过期，请重新登录');
            }
            
            const data = { 
                targetUsername,
                ...(message && { message })
            };
            
            console.log(`📤 [FriendsApi] 发送数据:`, data);
            
            const response = await this.request('POST', this.endpoints.REQUESTS.SEND, data);
            console.log('✅ [FriendsApi] 好友请求发送成功:', response);
            return response;
            
        } catch (error) {
            console.error('❌ [FriendsApi] 发送好友请求失败:', {
                targetUsername,
                message,
                error: error.message,
                baseURL: this.getBaseURL(),
                endpoint: this.endpoints.REQUESTS.SEND
            });
            throw error;
        }
    }

    /**
     * 获取收到的好友请求
     * @param {number} page 页码，默认为1
     * @returns {Promise<Object>} 收到的请求列表
     */
    async getReceivedRequests(page = 1) {
        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            
            const url = `${this.endpoints.REQUESTS.RECEIVED}?${params.toString()}`;
            const response = await this.request('GET', url);
            
            console.log('📥 获取收到的请求:', response);
            return response;
        } catch (error) {
            console.error('❌ 获取收到的请求失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取发送的好友请求
     * @param {number} page 页码，默认为1
     * @returns {Promise<Object>} 发送的请求列表
     */
    async getSentRequests(page = 1) {
        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            
            const url = `${this.endpoints.REQUESTS.SENT}?${params.toString()}`;
            const response = await this.request('GET', url);
            
            console.log('📤 获取发送的请求:', response);
            return response;
        } catch (error) {
            console.error('❌ 获取发送的请求失败:', error.message);
            throw error;
        }
    }

    /**
     * 处理好友请求
     * @param {string} requestId 请求ID
     * @param {string} action 操作类型 ('accept' | 'decline')
     * @returns {Promise<Object>} 处理结果
     */
    async handleFriendRequest(requestId, action) {
        try {
            // 修复API路径构造 - 应该是 /api/friends/requests/{id}/handle
            const url = `${this.endpoints.REQUESTS.HANDLE}/${requestId}/handle`;
            const data = { action };
            
            console.log(`🔄 处理好友请求 - 请求ID: ${requestId}, 操作: ${action}`);
            console.log(`🌐 请求URL: ${this.getBaseURL()}${url}`);
            
            const response = await this.request('POST', url, data);
            console.log(`✅ ${action === 'accept' ? '接受' : '拒绝'}好友请求:`, response);
            return response;
        } catch (error) {
            console.error(`❌ 处理好友请求失败:`, error.message);
            throw error;
        }
    }

    // ========================================
    // 📋 好友列表管理
    // ========================================

    /**
     * 获取好友列表
     * @param {number} page 页码，默认为1
     * @param {string} search 搜索关键词（可选）
     * @returns {Promise<Object>} 好友列表
     */
    async getFriends(page = 1, search = '') {
        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            if (search) params.append('search', search);
            
            const url = `${this.endpoints.FRIENDS.LIST}?${params.toString()}`;
            const response = await this.request('GET', url);
            
            console.log('👥 获取好友列表:', response);
            return response;
        } catch (error) {
            console.error('❌ 获取好友列表失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取好友列表（别名方法，用于兼容）
     * @param {number} page 页码，默认为1
     * @param {string} search 搜索关键词（可选）
     * @returns {Promise<Object>} 好友列表
     */
    async getFriendsList(page = 1, search = '') {
        return this.getFriends(page, search);
    }

    /**
     * 删除好友
     * @param {string} userId 好友用户ID
     * @returns {Promise<Object>} 删除结果
     */
    async deleteFriend(userId) {
        try {
            const url = `${this.endpoints.FRIENDS.DELETE}/${userId}`;
            const response = await this.request('DELETE', url);
            
            console.log('🗑️ 删除好友:', response);
            return response;
        } catch (error) {
            console.error('❌ 删除好友失败:', error.message);
            throw error;
        }
    }

    // ========================================
    // 🏠 房间邀请相关
    // ========================================

    /**
     * 邀请好友入群
     * @param {string} roomId 房间ID
     * @param {string[]} friendIds 好友ID数组
     * @returns {Promise<Object>} 邀请结果
     */
    async inviteFriendsToRoom(roomId, friendIds) {
        try {
            const data = { roomId, friendIds };
            const response = await this.request('POST', this.endpoints.INVITE.TO_ROOM, data);
            
            console.log('🎉 邀请好友入群:', response);
            return response;
        } catch (error) {
            console.error('❌ 邀请好友入群失败:', error.message);
            throw error;
        }
    }

    // ========================================
    // 🛠️ 工具方法
    // ========================================

    /**
     * 获取好友状态描述
     * @param {string} status 好友状态
     * @returns {string} 状态描述
     */
    getFriendshipStatusText(status) {
        const statusMap = {
            'none': '可以添加',
            'pending': '待处理',
            'accepted': '已是好友',
            'declined': '已拒绝'
        };
        
        return statusMap[status] || '未知状态';
    }

    /**
     * 获取好友状态样式类
     * @param {string} status 好友状态
     * @returns {string} CSS类名
     */
    getFriendshipStatusClass(status) {
        const classMap = {
            'none': 'text-primary',
            'pending': 'text-warning',
            'accepted': 'text-success',
            'declined': 'text-muted'
        };
        
        return classMap[status] || 'text-muted';
    }

    /**
     * 生成用户头像字符
     * @param {string} name 用户名或昵称
     * @returns {string} 头像字符
     */
    getAvatarChar(name) {
        if (!name || typeof name !== 'string') return '?';
        const firstChar = name.trim().charAt(0).toUpperCase();
        return /[A-Z]/.test(firstChar) ? firstChar : name.charAt(0);
    }

    /**
     * 格式化时间显示
     * @param {string} dateString 时间字符串
     * @returns {string} 格式化后的时间
     */
    formatTime(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        // 一分钟内
        if (diff < 60000) {
            return '刚刚';
        }
        
        // 一小时内
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}分钟前`;
        }
        
        // 一天内
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}小时前`;
        }
        
        // 超过一天
        const days = Math.floor(diff / 86400000);
        if (days < 30) {
            return `${days}天前`;
        }
        
        // 显示具体日期
        return date.toLocaleDateString('zh-CN');
    }

    // ========================================
    // 私聊消息相关API方法
    // ========================================

    /**
     * 发送私聊消息
     * @param {string} receiverId 接收者ID
     * @param {string} content 消息内容
     * @param {string} messageType 消息类型 (默认: text)
     * @param {Array} attachments 附件ID数组 (可选)
     * @returns {Promise<Object>} 发送结果
     */
    async sendPrivateMessage(receiverId, content, messageType = 'text', attachments = null) {
        try {
            const url = this.endpoints.MESSAGES.SEND;
            const data = {
                receiverId,
                content,
                messageType
            };
            
            // 如果有附件，添加到请求数据中
            if (attachments && attachments.length > 0) {
                data.attachments = attachments;
            }
            
            console.log(`💬 发送私聊消息到 ${receiverId}:`, content, { messageType, attachments });
            const response = await this.request('POST', url, data);
            console.log('✅ 私聊消息发送成功:', response);
            return response;
        } catch (error) {
            console.error('❌ 发送私聊消息失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取私聊历史记录
     * @param {string} friendId 好友ID
     * @param {number} page 页码
     * @param {number} limit 每页数量
     * @returns {Promise<Object>} 聊天记录
     */
    async getChatHistory(friendId, page = 1, limit = 20) {
        try {
            const url = `${this.endpoints.MESSAGES.HISTORY}?friendId=${friendId}&page=${page}&limit=${limit}`;
            
            console.log(`📜 获取与 ${friendId} 的聊天记录 - 第${page}页`);
            const response = await this.request('GET', url);
            console.log('✅ 聊天记录获取成功:', response.data.messages?.length || 0, '条消息');
            return response;
        } catch (error) {
            console.error('❌ 获取聊天记录失败:', error.message);
            throw error;
        }
    }

    /**
     * 标记消息为已读
     * @param {string} friendId 好友ID
     * @param {Array} messageIds 消息ID数组（可选）
     * @returns {Promise<Object>} 标记结果
     */
    async markMessagesAsRead(friendId, messageIds = null) {
        try {
            const url = this.endpoints.MESSAGES.MARK_READ;
            const data = {
                friendId,
                ...(messageIds && { messageIds })
            };
            
            console.log(`✅ 标记与 ${friendId} 的消息为已读`);
            const response = await this.request('POST', url, data);
            console.log('✅ 消息标记已读成功');
            return response;
        } catch (error) {
            console.error('❌ 标记消息已读失败:', error.message);
            throw error;
        }
    }

    /**
     * 标记消息为已读(新版API)
     * @param {Array} messageIds 消息ID数组
     * @returns {Promise<Object>} 标记结果
     */
    async markMessagesAsReadNew(messageIds) {
        try {
            const url = this.endpoints.MESSAGES.MARK_AS_READ;
            const data = { messageIds };
            
            const response = await this.request('POST', url, data);
            console.log(`✅ 成功标记 ${response.data?.updatedCount || messageIds.length} 条消息为已读`);
            return response;
        } catch (error) {
            console.error('❌ 标记消息已读失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取消息的已读状态
     * @param {string} friendId 好友ID
     * @param {Array} messageIds 消息ID数组
     * @returns {Promise<Object>} 已读状态信息
     */
    async getMessageReadStatus(friendId, messageIds) {
        try {
            const url = `${this.endpoints.MESSAGES.READ_STATUS}?friendId=${friendId}&messageIds=${messageIds.join(',')}`;
            const response = await this.request('GET', url);
            return response;
        } catch (error) {
            console.error('❌ 获取消息已读状态失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取未读消息统计
     * @returns {Promise<Object>} 未读消息统计
     */
    async getUnreadMessageCounts() {
        try {
            const url = this.endpoints.MESSAGES.UNREAD_COUNTS;
            
            console.log('📊 获取未读消息统计');
            const response = await this.request('GET', url);
            console.log('✅ 未读消息统计获取成功:', response.data.totalUnread || 0, '条未读');
            return response;
        } catch (error) {
            console.error('❌ 获取未读消息统计失败:', error.message);
            throw error;
        }
    }

    /**
     * 删除消息
     * @param {string} messageId 消息ID
     * @returns {Promise<Object>} 删除结果
     */
    async deleteMessage(messageId) {
        try {
            const url = `${this.endpoints.MESSAGES.DELETE}/${messageId}`;
            const response = await this.request('DELETE', url);
            return response;
        } catch (error) {
            console.error('❌ 删除消息失败:', error.message);
            throw error;
        }
    }

    /**
     * 批量删除消息
     * @param {Array} messageIds 消息ID数组
     * @returns {Promise<Object>} 删除结果
     */
    async deleteMessages(messageIds) {
        try {
            const url = `${this.endpoints.MESSAGES.DELETE}/batch`;
            const data = { messageIds };
            const response = await this.request('DELETE', url, data);
            return response;
        } catch (error) {
            console.error('❌ 批量删除消息失败:', error.message);
            throw error;
        }
    }

    /**
     * 搜索聊天记录
     * @param {string} friendId 好友ID
     * @param {string} keyword 搜索关键词
     * @param {Object} options 搜索选项
     * @returns {Promise<Object>} 搜索结果
     */
    async searchMessages(friendId, keyword, options = {}) {
        try {
            const url = this.endpoints.MESSAGES.SEARCH;
            const data = {
                friendId,
                keyword,
                page: options.page || 1,
                limit: options.limit || 20,
                dateRange: options.dateRange || null,
                messageType: options.messageType || null
            };
            
            console.log(`🔍 搜索与 ${friendId} 的聊天记录: "${keyword}"`);
            const response = await this.request('POST', url, data);
            console.log('✅ 聊天记录搜索成功:', response.data?.messages?.length || 0, '条结果');
            return response;
        } catch (error) {
            console.error('❌ 搜索聊天记录失败:', error.message);
            throw error;
        }
    }
}

// 全局实例
window.FriendsApi = new FriendsApiService();

console.log('✅ 好友API服务已初始化');
