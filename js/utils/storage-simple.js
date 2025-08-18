/**
 * 简化的存储管理器 - 兼容普通script标签使用
 */

const StorageManager = {
    /**
     * 安全的localStorage操作
     */
    setItem(key, value) {
        try {
            if (typeof value === 'object') {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                localStorage.setItem(key, value);
            }
            return true;
        } catch (error) {
            console.error('存储数据失败:', error);
            return false;
        }
    },

    getItem(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;
            
            // 尝试解析JSON
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        } catch (error) {
            console.error('读取数据失败:', error);
            return defaultValue;
        }
    },

    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('删除数据失败:', error);
            return false;
        }
    },

    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('清空存储失败:', error);
            return false;
        }
    },

    /**
     * 检查localStorage是否可用
     */
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch {
            return false;
        }
    }
};

// 兼容性导出
if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
}
