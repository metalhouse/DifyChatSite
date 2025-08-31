/**
 * 简洁图片上传API客户端
 * 基于DifyChatBack v2.0文件上传API
 */

class SimpleImageUploader {
    constructor() {
        this.baseURL = window.ENV_CONFIG ? window.ENV_CONFIG.getApiUrl() : 'http://localhost:4005/api';
        this.uploading = false; // 防重复上传标识
        this.uploadQueue = []; // 上传队列
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
     * 上传图片文件
     * @param {File} file - 图片文件
     * @param {string} accessLevel - 访问级别 (private/room/public)
     * @param {Function} onProgress - 进度回调
     * @returns {Promise<Object>} 上传结果
     */
    async uploadImage(file, accessLevel = 'room', onProgress = null) {
        // 防重复上传
        if (this.uploading) {
            throw new Error('已有图片正在上传中，请稍候...');
        }
        
        // 检查全局上传监控
        if (window.UPLOAD_MONITOR && window.UPLOAD_MONITOR.isUploading()) {
            throw new Error('系统正在处理其他上传任务，请稍候...');
        }
        
        if (!file) {
            throw new Error('请选择要上传的文件');
        }

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            throw new Error('请选择图片文件');
        }

        // 验证文件大小 (10MB)
        if (file.size > 10 * 1024 * 1024) {
            throw new Error('文件过大，请选择小于10MB的图片');
        }

        // 生产环境上传前处理
        if (window.UPLOAD_CONFIG && window.UPLOAD_CONFIG.beforeUpload) {
            window.UPLOAD_CONFIG.beforeUpload(file);
        }

        // 生成唯一的上传ID
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 设置上传状态
        this.uploading = true;
        if (window.UPLOAD_MONITOR) {
            window.UPLOAD_MONITOR.startUpload(uploadId);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('access_level', accessLevel);

        try {
            // 支持重试的上传逻辑
            const maxRetries = window.UPLOAD_CONFIG ? window.UPLOAD_CONFIG.maxRetries : 2;
            let lastError;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const result = await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();

                        // 设置进度监听
                        if (onProgress && typeof onProgress === 'function') {
                            xhr.upload.onprogress = (event) => {
                                if (event.lengthComputable) {
                                    const progress = Math.round((event.loaded / event.total) * 100);
                                    onProgress(progress);
                                }
                            };
                        }

                        // 设置响应处理
                        xhr.onload = () => {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                try {
                                    const result = JSON.parse(xhr.responseText);
                                    if (result.success) {
                                        resolve(result.data);
                                    } else {
                                        reject(new Error(result.message || '上传失败'));
                                    }
                                } catch (error) {
                                    reject(new Error('服务器响应格式错误'));
                                }
                            } else {
                                reject(new Error(`上传失败: HTTP ${xhr.status}`));
                            }
                        };

                        xhr.onerror = () => {
                            reject(new Error('网络连接失败'));
                        };

                        xhr.ontimeout = () => {
                            reject(new Error('上传超时'));
                        };

                        // 设置请求 - 使用路径工具标准化URL
                        const uploadUrl = window.PathUtils 
                            ? window.PathUtils.joinUrl(this.baseURL, '/files/upload')
                            : (this.baseURL.endsWith('/') 
                                ? `${this.baseURL}files/upload`
                                : `${this.baseURL}/files/upload`);
                        
                        xhr.open('POST', uploadUrl);
                        xhr.timeout = window.UPLOAD_CONFIG ? window.UPLOAD_CONFIG.timeout : 180000;
                        
                        // 设置认证头
                        try {
                            const headers = this.getAuthHeaders();
                            for (const [key, value] of Object.entries(headers)) {
                                xhr.setRequestHeader(key, value);
                            }
                        } catch (error) {
                            reject(error);
                            return;
                        }

                        // 发送请求
                        xhr.send(formData);
                    });

                    return result; // 上传成功，返回结果

                } catch (error) {
                    lastError = error;
                    
                    if (attempt < maxRetries) {
                        // 执行重试回调
                        if (window.UPLOAD_CONFIG && window.UPLOAD_CONFIG.onRetry) {
                            window.UPLOAD_CONFIG.onRetry(attempt, maxRetries, error);
                        }
                        
                        // 等待重试延迟
                        const retryDelay = window.UPLOAD_CONFIG ? window.UPLOAD_CONFIG.retryDelay : 1000;
                        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                    }
                }
            }

            // 所有重试都失败
            throw lastError;

        } finally {
            // 确保重置上传状态
            this.uploading = false;
            if (window.UPLOAD_MONITOR) {
                window.UPLOAD_MONITOR.finishUpload(uploadId);
            }
        }
    }

    /**
     * 获取图片URL
     * @param {string} fileId - 文件ID
     * @param {string} type - URL类型: view/download/thumbnail
     * @param {number} size - 缩略图大小
     */
    getImageUrl(fileId, type = 'view', size = null) {
        if (!fileId) return null;
        
        // 使用路径工具标准化URL拼接
        let url;
        if (window.PathUtils) {
            url = window.PathUtils.joinUrl(this.baseURL, `/files/${fileId}/${type}`);
        } else {
            // 回退到原始方法
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
}

// 全局实例
window.SimpleImageUploader = SimpleImageUploader;
