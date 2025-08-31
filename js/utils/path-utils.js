/**
 * 路径处理工具
 * 解决Windows和Linux系统之间的路径兼容性问题
 */

class PathUtils {
    /**
     * 标准化URL - 移除多重斜杠，保持协议部分
     * @param {string} url - 原始URL
     * @returns {string} 标准化后的URL
     */
    static standardizeUrl(url) {
        if (!url || typeof url !== 'string') return '';
        
        // 保护协议部分 (http://, https://, ws://, wss://)
        const protocolMatch = url.match(/^(https?:\/\/|wss?:\/\/)/);
        const protocol = protocolMatch ? protocolMatch[1] : '';
        const urlWithoutProtocol = protocolMatch ? url.slice(protocol.length) : url;
        
        // 移除多重斜杠，但保留单个斜杠
        const cleanUrl = urlWithoutProtocol.replace(/\/+/g, '/');
        
        // 移除末尾的斜杠（除非是根路径）
        const finalUrl = cleanUrl.length > 1 && cleanUrl.endsWith('/') 
            ? cleanUrl.slice(0, -1) 
            : cleanUrl;
        
        return protocol + finalUrl;
    }

    /**
     * 安全的URL拼接
     * @param {string} base - 基础URL
     * @param {string} path - 路径部分
     * @returns {string} 拼接后的URL
     */
    static joinUrl(base, path) {
        if (!base || !path) return base || path || '';
        
        // 移除base末尾的斜杠
        const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
        
        // 确保path以斜杠开头
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        
        const joinedUrl = cleanBase + cleanPath;
        
        // 标准化最终URL
        return this.standardizeUrl(joinedUrl);
    }

    /**
     * 检查URL是否为绝对路径
     * @param {string} url 
     * @returns {boolean}
     */
    static isAbsoluteUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return /^https?:\/\//.test(url) || /^wss?:\/\//.test(url);
    }

    /**
     * 检查是否为相对路径
     * @param {string} path 
     * @returns {boolean}
     */
    static isRelativePath(path) {
        if (!path || typeof path !== 'string') return false;
        return !this.isAbsoluteUrl(path) && !path.startsWith('/');
    }

    /**
     * 获取文件扩展名
     * @param {string} filename 
     * @returns {string}
     */
    static getFileExtension(filename) {
        if (!filename || typeof filename !== 'string') return '';
        const lastDotIndex = filename.lastIndexOf('.');
        return lastDotIndex === -1 ? '' : filename.slice(lastDotIndex + 1).toLowerCase();
    }

    /**
     * 检查文件是否为图片类型
     * @param {string} filename 
     * @returns {boolean}
     */
    static isImageFile(filename) {
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
        const ext = this.getFileExtension(filename);
        return imageExtensions.includes(ext);
    }

    /**
     * 安全的文件名处理 - 移除非法字符
     * @param {string} filename 
     * @returns {string}
     */
    static sanitizeFilename(filename) {
        if (!filename || typeof filename !== 'string') return '';
        
        // 移除Windows和Linux都不允许的字符
        return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    }

    /**
     * 生成安全的文件路径
     * @param {string} basePath - 基础路径
     * @param {string} filename - 文件名
     * @returns {string} 安全的文件路径
     */
    static safePath(basePath, filename) {
        const safeFilename = this.sanitizeFilename(filename);
        return this.joinUrl(basePath, safeFilename);
    }
}

// 全局导出
window.PathUtils = PathUtils;

// 兼容CommonJS导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PathUtils;
}

// 兼容AMD导出
if (typeof define === 'function' && define.amd) {
    define(function() {
        return PathUtils;
    });
}
