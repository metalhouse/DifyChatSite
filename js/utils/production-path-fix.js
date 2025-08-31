/**
 * 生产环境路径配置修复
 * 解决Linux生产环境与Windows开发环境之间的路径兼容性问题
 */

(function() {
    'use strict';

    // 检查当前环境
    const isProduction = () => {
        const hostname = window.location.hostname;
        return !(hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168.'));
    };

    // 生产环境路径修复
    if (isProduction()) {
        console.log('🔧 应用生产环境路径修复...');

        // 重写ENV_CONFIG的getApiUrl方法，确保路径标准化
        if (window.ENV_CONFIG && window.PathUtils) {
            const originalGetApiUrl = window.ENV_CONFIG.getApiUrl;
            
            window.ENV_CONFIG.getApiUrl = function(path = '') {
                const baseUrl = originalGetApiUrl.call(this, '');
                if (!path) return baseUrl;
                
                // 使用路径工具进行安全拼接
                return window.PathUtils.joinUrl(baseUrl, path);
            };
        }

        // 增强全局错误处理
        window.addEventListener('unhandledrejection', function(event) {
            if (event.reason && event.reason.message) {
                const message = event.reason.message.toLowerCase();
                
                // 检查是否为路径相关错误
                if (message.includes('network') || 
                    message.includes('fetch') || 
                    message.includes('cors') ||
                    message.includes('upload')) {
                    
                    console.error('🚨 可能的路径或网络错误:', event.reason);
                    
                    // 如果是图片上传相关错误，给出友好提示
                    if (message.includes('upload') && window.showToast) {
                        window.showToast('上传失败，请检查网络连接或稍后重试', 'error');
                    }
                }
            }
        });

        // 添加上传重试机制的配置
        window.UPLOAD_CONFIG = {
            maxRetries: 3,
            retryDelay: 1000, // 1秒
            timeout: 180000,  // 3分钟
            
            // 生产环境特殊处理
            beforeUpload: function(file) {
                console.log('📤 生产环境上传准备:', {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified
                });
                
                // 检查文件名是否包含特殊字符
                if (window.PathUtils && !window.PathUtils.sanitizeFilename(file.name) === file.name) {
                    console.warn('⚠️ 文件名包含特殊字符，可能在Linux系统上造成问题');
                }
            },
            
            onRetry: function(attempt, maxRetries, error) {
                console.warn(`🔄 上传重试 ${attempt}/${maxRetries}:`, error.message);
                if (window.showToast) {
                    window.showToast(`上传失败，正在重试 (${attempt}/${maxRetries})`, 'warning');
                }
            }
        };

        // 图片上传防抖处理 - 增强版：防止重复消息
        let uploadInProgress = false;
        const originalUploadAndSendImage = window.uploadAndSendImage;
        
        if (originalUploadAndSendImage) {
            window.uploadAndSendImage = async function(file) {
                // 生成文件指纹，用于去重
                const fileFingerprint = `${file.name}_${file.size}_${file.lastModified}`;
                
                if (uploadInProgress) {
                    console.warn('📤 检测到重复上传请求，忽略');
                    return;
                }
                
                // 检查是否重复上传相同文件
                if (window.lastUploadFingerprint === fileFingerprint) {
                    const timeDiff = Date.now() - (window.lastUploadTime || 0);
                    if (timeDiff < 3000) { // 3秒内防重复
                        console.warn('📤 检测到3秒内重复上传相同文件，忽略');
                        if (window.showToast) {
                            window.showToast('请不要重复上传相同图片', 'warning');
                        }
                        return;
                    }
                }
                
                // 记录上传信息
                window.lastUploadFingerprint = fileFingerprint;
                window.lastUploadTime = Date.now();
                
                uploadInProgress = true;
                try {
                    console.log('📤 [生产环境] 开始上传图片:', {
                        filename: file.name,
                        size: file.size,
                        fingerprint: fileFingerprint
                    });
                    return await originalUploadAndSendImage.call(this, file);
                } finally {
                    setTimeout(() => {
                        uploadInProgress = false;
                        console.log('📤 [生产环境] 上传防抖锁定解除');
                    }, 2000); // 2秒防抖
                }
            };
        }

        console.log('✅ 生产环境路径修复应用完成');
    }

    // 通用的图片上传状态监控
    window.UPLOAD_MONITOR = {
        activeUploads: new Set(),
        
        startUpload: function(fileId) {
            this.activeUploads.add(fileId);
            this.updateUI();
        },
        
        finishUpload: function(fileId) {
            this.activeUploads.delete(fileId);
            this.updateUI();
        },
        
        updateUI: function() {
            const hasActiveUploads = this.activeUploads.size > 0;
            
            // 更新上传按钮状态
            const uploadButtons = document.querySelectorAll('#imageUploadButton, .image-upload-btn');
            uploadButtons.forEach(btn => {
                if (hasActiveUploads) {
                    btn.classList.add('uploading');
                    btn.disabled = true;
                } else {
                    btn.classList.remove('uploading');
                    btn.disabled = false;
                }
            });
        },
        
        isUploading: function() {
            return this.activeUploads.size > 0;
        }
    };

})();
