/**
 * 文件上传API客户端
 * 基于DifyChatBack v2.0文件上传API
 */

class FileAPI {
    constructor() {
        this.baseURL = window.ENV_CONFIG ? window.ENV_CONFIG.getApiUrl() : 'http://localhost:4005/api';
        this.timeout = 180000; // 3分钟超时
        
        if (window.ENV_CONFIG && window.ENV_CONFIG.isDebug()) {
            console.log('📁 FileAPI初始化:', {
                baseURL: this.baseURL,
                timeout: this.timeout
            });
        }
    }

    /**
     * 获取认证头
     */
    getAuthHeaders() {
        const token = localStorage.getItem('dify_access_token');
        if (!token) {
            throw new Error('未找到访问令牌，请重新登录');
        }
        
        return {
            'Authorization': `Bearer ${token}`
        };
    }

    /**
     * 上传单个文件
     * @param {File} file - 要上传的文件
     * @param {string} accessLevel - 访问级别: private/room/public
     * @param {Function} onProgress - 上传进度回调
     * @returns {Promise<Object>} 上传结果
     */
    async uploadFile(file, accessLevel = 'private', onProgress = null) {
        if (!file) {
            throw new Error('请选择要上传的文件');
        }

        // 文件大小检查 (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('文件大小不能超过10MB');
        }

        // 文件类型检查
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('只支持 JPEG、PNG、GIF、WebP、SVG 格式的图片');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('access_level', accessLevel);

        try {
            console.log('📤 开始上传文件:', {
                name: file.name,
                size: file.size,
                type: file.type,
                accessLevel: accessLevel
            });

            // 标准化URL拼接 - 使用路径工具
            const uploadUrl = window.PathUtils 
                ? window.PathUtils.joinUrl(this.baseURL, '/files/upload')
                : this.standardizeUrl(`${this.baseURL}/files/upload`);
            const response = await this.uploadWithProgress(
                uploadUrl,
                formData,
                onProgress
            );

            // XMLHttpRequest 的响应需要用 responseText 而不是 json()
            const result = JSON.parse(response.responseText);
            
            if (result.success) {
                console.log('✅ 文件上传成功:', result.data);
                return result.data;
            } else {
                throw new Error(result.message || '文件上传失败');
            }
        } catch (error) {
            console.error('❌ 文件上传失败:', error);
            this.handleUploadError(error);
            throw error;
        }
    }

    /**
     * 支持进度回调的上传方法
     */
    async uploadWithProgress(url, formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // 设置进度监听
            if (onProgress && typeof onProgress === 'function') {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const progress = (event.loaded / event.total) * 100;
                        onProgress(progress);
                    }
                };
            }

            // 设置响应处理
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr);
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => {
                reject(new Error('网络连接失败'));
            };

            xhr.ontimeout = () => {
                reject(new Error('上传超时，请检查网络连接'));
            };

            // 配置请求 - 标准化URL拼接
            const standardizedUrl = this.standardizeUrl(url);
            xhr.timeout = this.timeout;
            xhr.open('POST', standardizedUrl, true);
            
            // 设置认证头
            try {
                const authHeaders = this.getAuthHeaders();
                Object.keys(authHeaders).forEach(key => {
                    xhr.setRequestHeader(key, authHeaders[key]);
                });
            } catch (error) {
                reject(error);
                return;
            }

            // 发送请求
            xhr.send(formData);
        });
    }

    /**
     * 上传多个文件
     * @param {FileList|File[]} files - 文件列表
     * @param {string} accessLevel - 访问级别
     * @param {Function} onProgress - 进度回调
     * @returns {Promise<Object[]>} 上传结果数组
     */
    async uploadMultipleFiles(files, accessLevel = 'private', onProgress = null) {
        if (!files || files.length === 0) {
            throw new Error('请选择要上传的文件');
        }

        if (files.length > 5) {
            throw new Error('一次最多只能上传5个文件');
        }

        const formData = new FormData();
        
        Array.from(files).forEach(file => {
            formData.append('files', file);
        });
        formData.append('access_level', accessLevel);

        try {
            const uploadUrl = window.PathUtils 
                ? window.PathUtils.joinUrl(this.baseURL, '/files/upload/multiple')
                : this.standardizeUrl(`${this.baseURL}/files/upload/multiple`);
                
            const response = await this.uploadWithProgress(
                uploadUrl,
                formData,
                onProgress
            );

            // XMLHttpRequest 的响应需要用 responseText 而不是 json()
            const result = JSON.parse(response.responseText);
            
            if (result.success) {
                console.log('✅ 多文件上传成功:', result.data);
                return result.data;
            } else {
                throw new Error(result.message || '文件上传失败');
            }
        } catch (error) {
            console.error('❌ 多文件上传失败:', error);
            this.handleUploadError(error);
            throw error;
        }
    }

    /**
     * 获取文件列表
     * @param {string} type - 文件类型过滤
     * @param {number} page - 页码
     * @param {number} limit - 每页数量
     * @returns {Promise<Object>} 文件列表和分页信息
     */
    async getUserFiles(type = '', page = 1, limit = 20) {
        try {
            const params = new URLSearchParams();
            if (type) params.append('type', type);
            params.append('page', page.toString());
            params.append('limit', limit.toString());

            const response = await fetch(this.standardizeUrl(`${this.baseURL}/files/my-files?${params}`), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...this.getAuthHeaders()
                },
                timeout: this.timeout
            });

            const result = await response.json();
            
            if (result.success) {
                return {
                    files: result.data.files,
                    pagination: result.data.pagination
                };
            } else {
                throw new Error(result.message || '获取文件列表失败');
            }
        } catch (error) {
            console.error('❌ 获取文件列表失败:', error);
            throw error;
        }
    }

    /**
     * 删除文件
     * @param {string} fileId - 文件ID
     * @returns {Promise<boolean>} 删除结果
     */
    async deleteFile(fileId) {
        if (!fileId) {
            throw new Error('文件ID不能为空');
        }

        try {
            const response = await fetch(this.standardizeUrl(`${this.baseURL}/files/${fileId}`), {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    ...this.getAuthHeaders()
                }
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ 文件删除成功:', fileId);
                return true;
            } else {
                throw new Error(result.message || '文件删除失败');
            }
        } catch (error) {
            console.error('❌ 文件删除失败:', error);
            throw error;
        }
    }

    /**
     * 获取文件访问URL
     * @param {string} fileId - 文件ID
     * @param {string} type - URL类型: view/download/thumbnail
     * @param {number} size - 缩略图大小
     * @returns {string} 文件URL
     */
    getFileUrl(fileId, type = 'view', size = null) {
        if (!fileId) {
            throw new Error('文件ID不能为空');
        }

        // 使用路径工具标准化URL拼接
        let url;
        if (window.PathUtils) {
            url = window.PathUtils.joinUrl(this.baseURL, `/files/${fileId}/${type}`);
        } else {
            // 回退方法
            const baseUrl = this.baseURL.endsWith('/') 
                ? this.baseURL.slice(0, -1) 
                : this.baseURL;
            url = `${baseUrl}/files/${fileId}/${type}`;
        }
        
        if (type === 'thumbnail' && size) {
            url += `?size=${size}`;
        }

        return url;
    }

    /**
     * 标准化URL - 处理多重斜杠和路径拼接
     * @param {string} url - 原始URL
     * @returns {string} 标准化后的URL
     */
    standardizeUrl(url) {
        // 优先使用全局路径工具
        if (window.PathUtils) {
            return window.PathUtils.standardizeUrl(url);
        }
        
        // 回退到内置方法
        if (!url) return '';
        
        // 保护协议部分
        const protocolMatch = url.match(/^(https?:\/\/)/);
        const protocol = protocolMatch ? protocolMatch[1] : '';
        const urlWithoutProtocol = protocolMatch ? url.slice(protocol.length) : url;
        
        // 移除多重斜杠，但保留单个斜杠
        const cleanUrl = urlWithoutProtocol.replace(/\/+/g, '/');
        
        return protocol + cleanUrl;
    }

    /**
     * 错误处理
     */
    handleUploadError(error) {
        if (error.message) {
            const errorMessage = error.message.toLowerCase();
            
            if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid_token')) {
                // 令牌错误，清除本地存储并跳转登录
                localStorage.removeItem('dify_access_token');
                localStorage.removeItem('dify_refresh_token');
                window.location.href = '/login.html';
                return;
            }
            
            if (errorMessage.includes('file_too_large')) {
                throw new Error('文件过大，请选择小于10MB的文件');
            }
            
            if (errorMessage.includes('invalid_file_type')) {
                throw new Error('不支持的文件格式，请上传图片文件');
            }
            
            if (errorMessage.includes('storage_error')) {
                throw new Error('服务器存储失败，请稍后重试');
            }
        }
    }

    /**
     * 验证文件
     * @param {File} file - 要验证的文件
     * @returns {Object} 验证结果
     */
    validateFile(file) {
        const errors = [];
        
        if (!file) {
            errors.push('请选择文件');
            return { valid: false, errors };
        }

        // 检查文件大小
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            errors.push('文件大小不能超过10MB');
        }

        // 检查文件类型
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            errors.push('只支持 JPEG、PNG、GIF、WebP、SVG 格式的图片');
        }

        // 检查文件名长度
        if (file.name.length > 255) {
            errors.push('文件名过长，请重命名后上传');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// 全局实例
window.FileAPI = new FileAPI();
