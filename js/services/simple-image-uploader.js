/**
 * 简洁图片上传API客户端
 * 基于DifyChatBack v2.0文件上传API
 */

class SimpleImageUploader {
    constructor() {
        this.baseURL = window.ENV_CONFIG ? window.ENV_CONFIG.getApiUrl() : 'http://localhost:4005/api';
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

        const formData = new FormData();
        formData.append('file', file);
        formData.append('access_level', accessLevel);

        return new Promise((resolve, reject) => {
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

            // 设置请求
            xhr.open('POST', `${this.baseURL}/files/upload`);
            xhr.timeout = 180000; // 3分钟超时
            
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
    }

    /**
     * 获取图片URL
     * @param {string} fileId - 文件ID
     * @param {string} type - URL类型: view/download/thumbnail
     * @param {number} size - 缩略图大小
     */
    getImageUrl(fileId, type = 'view', size = null) {
        if (!fileId) return null;
        
        let url = `${this.baseURL}/files/${fileId}/${type}`;
        if (type === 'thumbnail' && size) {
            url += `?size=${size}`;
        }
        return url;
    }
}

// 全局实例
window.SimpleImageUploader = SimpleImageUploader;
