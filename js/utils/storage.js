/**
 * 本地存储管理工具 - 统一的本地存储管理
 * 基于DifyChatBack v2.0 API指南存储要求
 * 提供Token、用户信息、设置等的安全存储
 */

// 导入依赖
import { ENV_CONFIG } from '../../config/env.js';

/**
 * 存储键名定义
 */
const STORAGE_KEYS = {
    // 认证相关
    ACCESS_TOKEN: 'dify_access_token',
    REFRESH_TOKEN: 'dify_refresh_token',
    TOKEN_EXPIRES_AT: 'dify_token_expires_at',
    USER_INFO: 'dify_user_info',
    
    // 应用设置
    APP_SETTINGS: 'dify_app_settings',
    THEME: 'dify_theme',
    LANGUAGE: 'dify_language',
    
    // 聊天相关
    CHAT_HISTORY: 'dify_chat_history',
    CONVERSATION_LIST: 'dify_conversations',
    ROOM_LIST: 'dify_rooms',
    DRAFT_MESSAGES: 'dify_draft_messages',
    
    // 缓存相关
    AGENTS_CACHE: 'dify_agents_cache',
    ROOMS_CACHE: 'dify_rooms_cache',
    CACHE_TIMESTAMP: 'dify_cache_timestamp',
    
    // 临时数据
    TEMP_DATA: 'dify_temp_data',
    SESSION_DATA: 'dify_session_data'
};

/**
 * 默认设置
 */
const DEFAULT_SETTINGS = {
    theme: 'light',
    language: 'zh-CN',
    autoSaveChat: true,
    notificationEnabled: true,
    soundEnabled: true,
    encryptionEnabled: false,
    autoLogin: false,
    messagePreview: true,
    typingIndicator: true,
    onlineStatus: true
};

/**
 * 本地存储管理器类
 */
class StorageManager {
    constructor() {
        this.isLocalStorageAvailable = this._checkLocalStorageAvailability();
        this.isSessionStorageAvailable = this._checkSessionStorageAvailability();
        this.encryptionKey = null;
        
        if (ENV_CONFIG.isDebug()) {
            console.log('💾 StorageManager初始化:', {
                localStorage: this.isLocalStorageAvailable,
                sessionStorage: this.isSessionStorageAvailable
            });
        }
    }

    // ========================================
    // 🔐 Token管理
    // ========================================

    /**
     * 设置访问令牌
     * @param {string} accessToken 访问令牌
     * @param {number} [expiresIn] 过期时间（秒，仅用于记录）
     */
    setAccessToken(accessToken, expiresIn) {
        try {
            this._setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
            
            // 可选：记录过期时间用于调试，但不用于验证
            if (expiresIn) {
                const expiresAt = Date.now() + (expiresIn * 1000);
                this._setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
            }

            if (ENV_CONFIG.isDebug()) {
                console.log('🔑 设置访问令牌', expiresIn ? `，预期${expiresIn}秒后过期` : '');
            }
        } catch (error) {
            console.error('❌ 设置访问令牌失败:', error.message);
        }
    }

    /**
     * 获取访问令牌
     * @returns {string|null} 访问令牌
     */
    getAccessToken() {
        try {
            // 简化逻辑：直接返回token，让后端通过401响应判断是否过期
            return this._getItem(STORAGE_KEYS.ACCESS_TOKEN);
        } catch (error) {
            console.error('❌ 获取访问令牌失败:', error.message);
            return null;
        }
    }

    /**
     * 设置刷新令牌
     * @param {string} refreshToken 刷新令牌
     */
    setRefreshToken(refreshToken) {
        try {
            this._setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🔄 设置刷新令牌');
            }
        } catch (error) {
            console.error('❌ 设置刷新令牌失败:', error.message);
        }
    }

    /**
     * 获取刷新令牌
     * @returns {string|null} 刷新令牌
     */
    getRefreshToken() {
        try {
            return this._getItem(STORAGE_KEYS.REFRESH_TOKEN);
        } catch (error) {
            console.error('❌ 获取刷新令牌失败:', error.message);
            return null;
        }
    }

    /**
     * 同时设置访问令牌和刷新令牌
     * @param {string} accessToken 访问令牌
     * @param {string} refreshToken 刷新令牌
     * @param {number} [expiresIn] 过期时间（秒）
     */
    setTokens(accessToken, refreshToken, expiresIn) {
        this.setAccessToken(accessToken, expiresIn);
        this.setRefreshToken(refreshToken);
    }

    /**
     * 检查令牌是否过期
     * @returns {boolean} 是否过期
     */
    isTokenExpired() {
        try {
            const expiresAt = this._getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
            // 如果没有过期时间记录，认为Token无效（已过期）
            if (!expiresAt) return true;
            
            return Date.now() > parseInt(expiresAt);
        } catch (error) {
            console.error('❌ 检查令牌过期状态失败:', error.message);
            return true;
        }
    }

    /**
     * 清除所有令牌
     */
    clearTokens() {
        try {
            this._removeItem(STORAGE_KEYS.ACCESS_TOKEN);
            this._removeItem(STORAGE_KEYS.REFRESH_TOKEN);
            this._removeItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🗑️ 清除所有令牌');
            }
        } catch (error) {
            console.error('❌ 清除令牌失败:', error.message);
        }
    }

    // ========================================
    // 👤 用户信息管理
    // ========================================

    /**
     * 设置用户信息
     * @param {Object} userInfo 用户信息
     */
    setUserInfo(userInfo) {
        try {
            const userData = {
                ...userInfo,
                updatedAt: Date.now()
            };
            
            this._setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userData));
            
            if (ENV_CONFIG.isDebug()) {
                console.log('👤 设置用户信息:', userInfo.username || userInfo.email);
            }
        } catch (error) {
            console.error('❌ 设置用户信息失败:', error.message);
        }
    }

    /**
     * 获取用户信息
     * @returns {Object|null} 用户信息
     */
    getUserInfo() {
        try {
            const userInfoStr = this._getItem(STORAGE_KEYS.USER_INFO);
            return userInfoStr ? JSON.parse(userInfoStr) : null;
        } catch (error) {
            console.error('❌ 获取用户信息失败:', error.message);
            return null;
        }
    }

    /**
     * 更新用户信息
     * @param {Object} updates 更新的字段
     */
    updateUserInfo(updates) {
        try {
            const currentUser = this.getUserInfo();
            if (currentUser) {
                const updatedUser = {
                    ...currentUser,
                    ...updates,
                    updatedAt: Date.now()
                };
                this.setUserInfo(updatedUser);
            }
        } catch (error) {
            console.error('❌ 更新用户信息失败:', error.message);
        }
    }

    /**
     * 清除用户信息
     */
    clearUserInfo() {
        try {
            this._removeItem(STORAGE_KEYS.USER_INFO);
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🗑️ 清除用户信息');
            }
        } catch (error) {
            console.error('❌ 清除用户信息失败:', error.message);
        }
    }

    // ========================================
    // ⚙️ 应用设置管理
    // ========================================

    /**
     * 设置应用配置
     * @param {string} key 配置键
     * @param {any} value 配置值
     */
    setSetting(key, value) {
        try {
            const settings = this.getAllSettings();
            settings[key] = value;
            settings.updatedAt = Date.now();
            
            this._setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(settings));
            
            if (ENV_CONFIG.isDebug()) {
                console.log('⚙️ 设置应用配置:', key, value);
            }
        } catch (error) {
            console.error('❌ 设置应用配置失败:', error.message);
        }
    }

    /**
     * 获取应用配置
     * @param {string} key 配置键
     * @param {any} [defaultValue] 默认值
     * @returns {any} 配置值
     */
    getSetting(key, defaultValue = null) {
        try {
            const settings = this.getAllSettings();
            return settings.hasOwnProperty(key) ? settings[key] : defaultValue;
        } catch (error) {
            console.error('❌ 获取应用配置失败:', error.message);
            return defaultValue;
        }
    }

    /**
     * 获取所有应用设置
     * @returns {Object} 所有设置
     */
    getAllSettings() {
        try {
            const settingsStr = this._getItem(STORAGE_KEYS.APP_SETTINGS);
            const settings = settingsStr ? JSON.parse(settingsStr) : {};
            
            // 合并默认设置
            return {
                ...DEFAULT_SETTINGS,
                ...settings
            };
        } catch (error) {
            console.error('❌ 获取应用设置失败:', error.message);
            return { ...DEFAULT_SETTINGS };
        }
    }

    /**
     * 重置应用设置
     */
    resetSettings() {
        try {
            this._setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify({
                ...DEFAULT_SETTINGS,
                updatedAt: Date.now()
            }));
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🔄 重置应用设置');
            }
        } catch (error) {
            console.error('❌ 重置应用设置失败:', error.message);
        }
    }

    // ========================================
    // 💬 聊天数据管理
    // ========================================

    /**
     * 保存对话列表
     * @param {Array} conversations 对话列表
     */
    setConversations(conversations) {
        try {
            const data = {
                conversations,
                updatedAt: Date.now()
            };
            
            this._setItem(STORAGE_KEYS.CONVERSATION_LIST, JSON.stringify(data));
            
            if (ENV_CONFIG.isDebug()) {
                console.log('💬 保存对话列表:', conversations.length);
            }
        } catch (error) {
            console.error('❌ 保存对话列表失败:', error.message);
        }
    }

    /**
     * 获取对话列表
     * @returns {Array} 对话列表
     */
    getConversations() {
        try {
            const dataStr = this._getItem(STORAGE_KEYS.CONVERSATION_LIST);
            const data = dataStr ? JSON.parse(dataStr) : { conversations: [] };
            return data.conversations || [];
        } catch (error) {
            console.error('❌ 获取对话列表失败:', error.message);
            return [];
        }
    }

    /**
     * 保存群聊房间列表
     * @param {Array} rooms 房间列表
     */
    setRooms(rooms) {
        try {
            const data = {
                rooms,
                updatedAt: Date.now()
            };
            
            this._setItem(STORAGE_KEYS.ROOM_LIST, JSON.stringify(data));
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🏠 保存房间列表:', rooms.length);
            }
        } catch (error) {
            console.error('❌ 保存房间列表失败:', error.message);
        }
    }

    /**
     * 获取群聊房间列表
     * @returns {Array} 房间列表
     */
    getRooms() {
        try {
            const dataStr = this._getItem(STORAGE_KEYS.ROOM_LIST);
            const data = dataStr ? JSON.parse(dataStr) : { rooms: [] };
            return data.rooms || [];
        } catch (error) {
            console.error('❌ 获取房间列表失败:', error.message);
            return [];
        }
    }

    /**
     * 保存草稿消息
     * @param {string} conversationId 对话ID
     * @param {string} draft 草稿内容
     */
    saveDraft(conversationId, draft) {
        try {
            const drafts = this.getAllDrafts();
            drafts[conversationId] = {
                content: draft,
                updatedAt: Date.now()
            };
            
            this._setItem(STORAGE_KEYS.DRAFT_MESSAGES, JSON.stringify(drafts));
        } catch (error) {
            console.error('❌ 保存草稿失败:', error.message);
        }
    }

    /**
     * 获取草稿消息
     * @param {string} conversationId 对话ID
     * @returns {string} 草稿内容
     */
    getDraft(conversationId) {
        try {
            const drafts = this.getAllDrafts();
            const draft = drafts[conversationId];
            return draft ? draft.content : '';
        } catch (error) {
            console.error('❌ 获取草稿失败:', error.message);
            return '';
        }
    }

    /**
     * 删除草稿消息
     * @param {string} conversationId 对话ID
     */
    removeDraft(conversationId) {
        try {
            const drafts = this.getAllDrafts();
            delete drafts[conversationId];
            
            this._setItem(STORAGE_KEYS.DRAFT_MESSAGES, JSON.stringify(drafts));
        } catch (error) {
            console.error('❌ 删除草稿失败:', error.message);
        }
    }

    /**
     * 获取所有草稿
     * @private
     */
    getAllDrafts() {
        try {
            const draftsStr = this._getItem(STORAGE_KEYS.DRAFT_MESSAGES);
            return draftsStr ? JSON.parse(draftsStr) : {};
        } catch (error) {
            console.error('❌ 获取草稿列表失败:', error.message);
            return {};
        }
    }

    // ========================================
    // 🗂️ 缓存管理
    // ========================================

    /**
     * 设置缓存数据
     * @param {string} key 缓存键
     * @param {any} data 缓存数据
     * @param {number} [ttl] 生存时间（毫秒）
     */
    setCache(key, data, ttl = 5 * 60 * 1000) { // 默认5分钟
        try {
            const cacheData = {
                data,
                createdAt: Date.now(),
                expiresAt: Date.now() + ttl
            };
            
            this._setItem(`cache_${key}`, JSON.stringify(cacheData));
        } catch (error) {
            console.error('❌ 设置缓存失败:', error.message);
        }
    }

    /**
     * 获取缓存数据
     * @param {string} key 缓存键
     * @returns {any|null} 缓存数据
     */
    getCache(key) {
        try {
            const cacheStr = this._getItem(`cache_${key}`);
            if (!cacheStr) return null;
            
            const cache = JSON.parse(cacheStr);
            
            // 检查是否过期
            if (Date.now() > cache.expiresAt) {
                this.removeCache(key);
                return null;
            }
            
            return cache.data;
        } catch (error) {
            console.error('❌ 获取缓存失败:', error.message);
            return null;
        }
    }

    /**
     * 移除缓存
     * @param {string} key 缓存键
     */
    removeCache(key) {
        try {
            this._removeItem(`cache_${key}`);
        } catch (error) {
            console.error('❌ 移除缓存失败:', error.message);
        }
    }

    /**
     * 清除所有过期缓存
     */
    clearExpiredCache() {
        try {
            if (!this.isLocalStorageAvailable) return;
            
            const storage = localStorage;
            const keys = Object.keys(storage);
            let clearedCount = 0;
            
            keys.forEach(key => {
                if (key.startsWith('cache_')) {
                    try {
                        const cacheStr = storage.getItem(key);
                        const cache = JSON.parse(cacheStr);
                        
                        if (Date.now() > cache.expiresAt) {
                            storage.removeItem(key);
                            clearedCount++;
                        }
                    } catch (error) {
                        // 损坏的缓存数据，直接删除
                        storage.removeItem(key);
                        clearedCount++;
                    }
                }
            });
            
            if (ENV_CONFIG.isDebug() && clearedCount > 0) {
                console.log('🧹 清除过期缓存:', clearedCount);
            }
        } catch (error) {
            console.error('❌ 清除过期缓存失败:', error.message);
        }
    }

    // ========================================
    // 🧹 清理和维护
    // ========================================

    /**
     * 清除所有数据
     */
    clearAll() {
        try {
            Object.values(STORAGE_KEYS).forEach(key => {
                this._removeItem(key);
            });
            
            // 清除所有缓存
            if (this.isLocalStorageAvailable) {
                const storage = localStorage;
                const keys = Object.keys(storage);
                keys.forEach(key => {
                    if (key.startsWith('cache_') || key.startsWith('dify_')) {
                        storage.removeItem(key);
                    }
                });
            }
            
            if (ENV_CONFIG.isDebug()) {
                console.log('🧹 清除所有存储数据');
            }
        } catch (error) {
            console.error('❌ 清除数据失败:', error.message);
        }
    }

    /**
     * 获取存储使用情况
     * @returns {Object} 存储使用情况
     */
    getStorageUsage() {
        try {
            let totalSize = 0;
            let itemCount = 0;
            const breakdown = {};
            
            if (this.isLocalStorageAvailable) {
                const storage = localStorage;
                Object.keys(storage).forEach(key => {
                    const value = storage.getItem(key);
                    const size = new Blob([value]).size;
                    totalSize += size;
                    itemCount++;
                    
                    if (key.startsWith('dify_')) {
                        breakdown[key] = size;
                    }
                });
            }
            
            return {
                totalSize: totalSize,
                itemCount: itemCount,
                breakdown: breakdown,
                available: this.isLocalStorageAvailable
            };
        } catch (error) {
            console.error('❌ 获取存储使用情况失败:', error.message);
            return { totalSize: 0, itemCount: 0, breakdown: {}, available: false };
        }
    }

    // ========================================
    // 🛠️ 内部工具方法
    // ========================================

    /**
     * 检查localStorage可用性
     * @private
     */
    _checkLocalStorageAvailability() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 检查sessionStorage可用性
     * @private
     */
    _checkSessionStorageAvailability() {
        try {
            const testKey = '__session_test__';
            sessionStorage.setItem(testKey, 'test');
            sessionStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 存储数据
     * @private
     */
    _setItem(key, value) {
        if (this.isLocalStorageAvailable) {
            localStorage.setItem(key, value);
        } else {
            console.warn('⚠️ LocalStorage不可用，数据无法持久化');
        }
    }

    /**
     * 获取数据
     * @private
     */
    _getItem(key) {
        if (this.isLocalStorageAvailable) {
            return localStorage.getItem(key);
        }
        return null;
    }

    /**
     * 删除数据
     * @private
     */
    _removeItem(key) {
        if (this.isLocalStorageAvailable) {
            localStorage.removeItem(key);
        }
    }
}

// 创建全局实例
const storageManager = new StorageManager();

// 定期清理过期缓存（每5分钟）
setInterval(() => {
    storageManager.clearExpiredCache();
}, 5 * 60 * 1000);

// 导出存储管理器类和实例
window.StorageManager = StorageManager;
window.storageManager = storageManager;

export { StorageManager, STORAGE_KEYS, DEFAULT_SETTINGS };
export default storageManager;
