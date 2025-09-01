/**
 * 图片显示修复脚本 v2.0
 * 基于file-api.js标准，支持桌面端和移动端
 */

(function() {
    'use strict';

    console.log('🔧 图片显示修复 v2.0 启动...');

    // 检测设备类型
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    // 获取API基础URL - 与file-api.js保持一致
    function getApiBaseUrl() {
        return window.ENV_CONFIG ? window.ENV_CONFIG.getApiUrl() : 'http://localhost:4005/api';
    }

    // 获取访问令牌 - 与file-api.js保持一致
    function getAuthToken() {
        return localStorage.getItem('dify_access_token');
    }

    // 构建文件访问URL - 完全参考file-api.js的getFileUrl方法
    function buildFileUrl(fileId, type = 'view') {
        if (!fileId) return null;

        const baseURL = getApiBaseUrl();
        
        // 使用与file-api.js相同的URL构建逻辑
        let url;
        if (window.PathUtils) {
            url = window.PathUtils.joinUrl(baseURL, `/files/${fileId}/${type}`);
        } else {
            // 回退方法 - 与file-api.js保持一致
            const baseUrl = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
            url = `${baseUrl}/files/${fileId}/${type}`;
        }

        // 添加认证 - 但不在URL中，使用Header方式
        return url;
    }

    // 标准化URL - 使用file-api.js的方法
    function standardizeUrl(url) {
        if (window.PathUtils) {
            return window.PathUtils.standardizeUrl(url);
        }
        
        if (!url) return '';
        
        // 保护协议部分
        const protocolMatch = url.match(/^(https?:\/\/)/);
        const protocol = protocolMatch ? protocolMatch[1] : '';
        const urlWithoutProtocol = protocolMatch ? url.slice(protocol.length) : url;
        
        // 移除多重斜杠，但保留单个斜杠
        const cleanUrl = urlWithoutProtocol.replace(/\/+/g, '/');
        
        return protocol + cleanUrl;
    }

    // 添加CSS样式
    function addImageStyles() {
        const mobile = isMobile();
        const styleId = 'image-display-fix-styles';
        
        // 移除旧样式
        const oldStyle = document.getElementById(styleId);
        if (oldStyle) {
            oldStyle.remove();
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* 通用图片样式 */
            .message-image {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                object-fit: cover !important;
                border-radius: 8px !important;
                border: 1px solid #e0e0e0 !important;
                background: #f5f5f5 !important;
                margin: 5px 0 !important;
                cursor: pointer !important;
            }

            .message-attachments {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                margin: 8px 0 !important;
            }

            /* 桌面端样式 */
            @media (min-width: 769px) {
                .message-image {
                    max-width: 400px !important;
                    max-height: 300px !important;
                }
            }

            /* 移动端样式 */
            @media (max-width: 768px) {
                .message-image {
                    max-width: 280px !important;
                    max-height: 200px !important;
                    -webkit-transform: translateZ(0) !important;
                    transform: translateZ(0) !important;
                }
            }

            /* 加载失败占位符 */
            .message-image.load-error {
                background: #f0f0f0 !important;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Ctext x='50' y='50' font-family='Arial' font-size='12' text-anchor='middle' dy='.3em' fill='%23999'%3E图片加载失败%3C/text%3E%3C/svg%3E") !important;
                background-repeat: no-repeat !important;
                background-position: center !important;
                min-height: 80px !important;
                border: 2px dashed #ccc !important;
            }
        `;
        
        document.head.appendChild(style);
    }

    // 修复单个图片
    function fixImage(img, index = 0) {
        if (!img) return false;

        const mobile = isMobile();
        const prefix = mobile ? '📱' : '🖥️';
        
        console.log(`${prefix} 修复图片 ${index + 1}`);

        // 移除错误标记
        img.classList.remove('load-error');

        // 尝试获取文件ID
        let fileId = img.dataset.fileId || 
                    img.getAttribute('data-file-id') ||
                    img.getAttribute('data-id');

        // 如果没有直接的文件ID，尝试从现有URL中提取
        if (!fileId && img.src) {
            const urlMatch = img.src.match(/\/files\/([^\/\?]+)\/(view|download|thumbnail)/);
            if (urlMatch) {
                fileId = urlMatch[1];
                console.log(`${prefix} 从URL中提取文件ID: ${fileId}`);
            }
        }

        if (fileId) {
            // 使用标准文件API URL
            const newUrl = buildFileUrl(fileId);
            const token = getAuthToken();
            const finalUrl = token ? `${newUrl}?token=${token}` : newUrl;
            
            // 比较基础URL（去掉查询参数），避免因为token不同而重复设置
            const currentBaseUrl = img.src.split('?')[0];
            const newBaseUrl = newUrl;
            
            if (newBaseUrl !== currentBaseUrl) {
                console.log(`${prefix} 使用文件ID重建URL:`, fileId);
                img.setAttribute('data-file-id', fileId);
                img.src = finalUrl;
            } else if (!img.src.includes('token=') && token) {
                // 如果URL正确但缺少token，添加token
                console.log(`${prefix} 为现有URL添加token`);
                img.src = finalUrl;
            }
        } else if (img.src && !img.src.includes('token=')) {
            // 为现有URL添加token
            const token = getAuthToken();
            if (token) {
                const separator = img.src.includes('?') ? '&' : '?';
                img.src = `${img.src}${separator}token=${token}`;
                console.log(`${prefix} 为图片添加token`);
            }
        }

        // 设置加载事件
        img.onload = function() {
            console.log(`${prefix} 图片加载成功:`, this.naturalWidth, 'x', this.naturalHeight);
            this.classList.remove('load-error');
        };

        img.onerror = function() {
            console.log(`${prefix} 图片加载失败`);
            this.classList.add('load-error');
        };

        // 如果图片已经加载完成，触发成功事件
        if (img.complete && img.naturalWidth > 0) {
            img.onload();
        }

        return true;
    }

    // 修复所有图片
    function fixAllImages() {
        const images = document.querySelectorAll('img.message-image, .message-attachments img');
        const mobile = isMobile();
        const deviceType = mobile ? '移动端' : '桌面端';
        
        console.log(`🔧 开始修复 ${images.length} 个图片 (${deviceType})`);

        let fixedCount = 0;
        images.forEach((img, index) => {
            if (fixImage(img, index)) {
                fixedCount++;
            }
        });

        console.log(`✅ 完成图片修复: ${fixedCount}/${images.length}`);
        return fixedCount;
    }

    // 监控新增图片
    function startImageMonitoring() {
        const observer = new MutationObserver((mutations) => {
            let hasNewImages = false;
            const newImages = [];

            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 查找新增的图片
                        const images = node.querySelectorAll ? 
                            node.querySelectorAll('img.message-image, .message-attachments img') : 
                            (node.tagName === 'IMG' && 
                             (node.classList.contains('message-image') || node.closest('.message-attachments')) ? 
                             [node] : []);

                        if (images.length > 0) {
                            hasNewImages = true;
                            images.forEach(img => newImages.push(img));
                        }
                    }
                });
            });

            if (hasNewImages) {
                console.log(`🔧 检测到 ${newImages.length} 个新图片，立即修复`);
                // 立即修复新图片，不需要延迟
                newImages.forEach((img, index) => {
                    fixImage(img, index);
                });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('👁️ 图片监控已启动');
    }

    // 定期检查和修复
    function startPeriodicFix() {
        setInterval(() => {
            const brokenImages = document.querySelectorAll('img.message-image:not([src]), img.message-image[src=""], .message-attachments img:not([src]), .message-attachments img[src=""]');
            if (brokenImages.length > 0) {
                console.log(`🔧 发现 ${brokenImages.length} 个损坏图片，开始修复`);
                brokenImages.forEach(fixImage);
            }
        }, 30000); // 每30秒检查一次
    }

    // 初始化
    function init() {
        const mobile = isMobile();
        console.log(`🔧 初始化图片修复系统 (${mobile ? '移动端' : '桌面端'})`);
        
        // 添加样式
        addImageStyles();

        // 延迟初始修复，确保页面加载完成
        setTimeout(() => {
            fixAllImages();
            startImageMonitoring();
            startPeriodicFix();
            console.log('✅ 图片修复系统已就绪');
        }, 1000);

        // 页面可见性变化时重新检查
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(fixAllImages, 500);
            }
        });
    }

    // 导出到全局
    window.ImageDisplayFix = {
        fixAll: fixAllImages,
        fixImage: fixImage,
        isMobile: isMobile,
        buildFileUrl: buildFileUrl
    };

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
