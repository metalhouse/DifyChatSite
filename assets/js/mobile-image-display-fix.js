// 图片显示修复脚本 - 支持桌面端和移动端

(function() {
    'use strict';

    console.log('🔧 图片显示修复启动 (桌面端+移动端)...');

    // 检测移动设备
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768 ||
               ('ontouchstart' in window);
    }

    // 强制修复所有图片显示
    function forceFixAllImages() {
        const mobile = isMobile();
        console.log(mobile ? '📱 开始强制修复所有图片(移动端)...' : '🖥️ 开始修复所有图片(桌面端)...');

        // 添加强制CSS样式
        const forceStyle = document.createElement('style');
        forceStyle.id = 'image-display-force-fix';
        forceStyle.textContent = `
            /* 桌面端图片显示修复 */
            @media (min-width: 769px) {
                .message-image,
                img.message-image {
                    max-width: 400px !important;
                    max-height: 300px !important;
                    width: auto !important;
                    height: auto !important;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    object-fit: cover !important;
                    border-radius: 8px !important;
                    border: 1px solid #e0e0e0 !important;
                    background: #f5f5f5 !important;
                    margin: 5px 0 !important;
                    position: relative !important;
                    z-index: 10 !important;
                    /* 防止被隐藏 */
                    clip: auto !important;
                    clip-path: none !important;
                    mask: none !important;
                }

                .message-attachments {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    overflow: visible !important;
                    height: auto !important;
                    max-height: none !important;
                    margin: 8px 0 !important;
                }
            }

            /* 移动端图片强制显示修复 */
            @media (max-width: 768px) {
                .message-image,
                img.message-image {
                    max-width: 280px !important;
                    max-height: 200px !important;
                    width: auto !important;
                    height: auto !important;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    object-fit: cover !important;
                    border-radius: 8px !important;
                    border: 1px solid #e0e0e0 !important;
                    background: #f5f5f5 !important;
                    margin: 5px 0 !important;
                    position: relative !important;
                    z-index: 10 !important;
                    /* 强制硬件加速 */
                    -webkit-transform: translateZ(0) !important;
                    transform: translateZ(0) !important;
                    /* 防止被隐藏 */
                    clip: auto !important;
                    clip-path: none !important;
                    mask: none !important;
                }

                .message-attachments {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    overflow: visible !important;
                    height: auto !important;
                    max-height: none !important;
                    margin: 8px 0 !important;
                }

                .message-bubble .message-attachments {
                    display: block !important;
                    margin-top: 8px !important;
                }
            }

            /* 通用图片显示修复 */
            .message,
            .message-bubble {
                overflow: visible !important;
            }
        `;

        // 移除旧的强制样式
        const oldStyle = document.getElementById('image-display-force-fix');
        if (oldStyle) {
            oldStyle.remove();
        }
        
        document.head.appendChild(forceStyle);

        // 查找并修复所有图片
        const images = document.querySelectorAll('img.message-image, .message-attachments img');
        const deviceType = mobile ? '移动端' : '桌面端';
        console.log(`🔧 找到 ${images.length} 个图片元素需要修复 (${deviceType})`);

        images.forEach((img, index) => {
            setTimeout(() => {
                forceFixSingleImage(img, index + 1);
            }, index * 200); // 延迟修复，避免阻塞
        });

        // 修复消息容器
        const attachmentContainers = document.querySelectorAll('.message-attachments');
        attachmentContainers.forEach(container => {
            container.style.cssText = `
                ${container.style.cssText}
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                margin: 8px 0 !important;
                overflow: visible !important;
            `;
        });
    }

    // 修复图片URL - 参考file-api.js的标准化方式
    function fixImageUrl(img, index) {
        if (!img) return null;

        const currentSrc = img.src;
        
        // 如果URL正常，不需要修复
        if (currentSrc && 
            !currentSrc.includes(window.location.origin) && 
            !currentSrc.includes('data:image/svg') && 
            !currentSrc.endsWith('.html') &&
            currentSrc.startsWith('http')) {
            return currentSrc;
        }

        // 尝试从data属性获取文件ID
        const fileId = img.dataset.fileId || 
                      img.getAttribute('data-file-id') ||
                      img.getAttribute('data-id');

        if (fileId) {
            // 使用标准的文件API URL构建方式
            return buildFileUrl(fileId);
        }

        // 尝试从备用属性获取URL
        const possibleSrcs = [
            img.getAttribute('data-src'),
            img.getAttribute('data-original'), 
            img.getAttribute('data-file-url'),
            img.dataset.src,
            img.dataset.original,
            img.dataset.fileUrl
        ].filter(Boolean);

        for (const src of possibleSrcs) {
            if (src && src.startsWith('http') && !src.includes(window.location.origin)) {
                return standardizeImageUrl(src);
            }
        }

        // 最后尝试从消息数据重建
        const messageEl = img.closest('.message');
        if (messageEl && messageEl.localMessage && messageEl.localMessage.attachments) {
            const attachment = messageEl.localMessage.attachments[0];
            if (attachment && attachment.id) {
                return buildFileUrl(attachment.id);
            }
        }

        return null;
    }

    // 构建标准文件URL - 参考file-api.js
    function buildFileUrl(fileId, type = 'view') {
        if (!fileId) return null;

        // 获取API基础URL
        const baseURL = window.ENV_CONFIG ? window.ENV_CONFIG.getApiUrl() : 'http://localhost:4005/api';
        
        // 使用路径工具或回退方法
        let url;
        if (window.PathUtils) {
            url = window.PathUtils.joinUrl(baseURL, `/files/${fileId}/${type}`);
        } else {
            const cleanBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
            url = `${cleanBase}/files/${fileId}/${type}`;
        }

        // 添加认证token
        const token = localStorage.getItem('dify_access_token');
        if (token) {
            url += `?token=${token}`;
        }

        return url;
    }

    // 标准化图片URL - 确保带有认证信息
    function standardizeImageUrl(url) {
        if (!url) return null;

        // 如果已经有token参数，直接返回
        if (url.includes('token=')) {
            return url;
        }

        // 添加token参数
        const token = localStorage.getItem('dify_access_token');
        if (token) {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}token=${token}`;
        }

        return url;
    }

    // 强制修复单个图片
    function forceFixSingleImage(img, index) {
        if (!img) return;

        const mobile = isMobile();
        const logPrefix = mobile ? '📱' : '🖥️';
        console.log(`${logPrefix} 修复图片 ${index}:`, img.src?.substring(0, 80) + '...' || '无src');

        // 根据设备类型设置不同的样式
        const maxWidth = mobile ? '280px' : '400px';
        const maxHeight = mobile ? '200px' : '300px';
        const transform = mobile ? '-webkit-transform: translateZ(0) !important; transform: translateZ(0) !important;' : '';

        // 强制设置样式
        img.style.cssText = `
            max-width: ${maxWidth} !important;
            max-height: ${maxHeight} !important;
            width: auto !important;
            height: auto !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            object-fit: cover !important;
            border-radius: 8px !important;
            border: 1px solid #e0e0e0 !important;
            background: #f5f5f5 !important;
            margin: 5px 0 !important;
            position: relative !important;
            z-index: 10 !important;
            cursor: pointer !important;
            ${transform}
        `;

        // 修复src属性 - 使用标准API方式
        const fixedUrl = fixImageUrl(img, index);
        if (fixedUrl && fixedUrl !== img.src) {
            console.log(`${logPrefix} 修复图片 ${index} URL: ${fixedUrl.substring(0, 60)}...`);
            img.src = fixedUrl;
        }

        // 如果图片已经加载完成但是隐藏，强制显示
        if (img.complete && img.naturalWidth > 0) {
            console.log(`📱 图片 ${index} 已加载，强制显示`);
            img.style.display = 'block';
            img.style.visibility = 'visible';
            img.style.opacity = '1';
        }

        // 重新绑定加载事件 - 简化版本
        img.onload = function() {
            const devicePrefix = mobile ? '📱' : '🖥️';
            console.log(`${devicePrefix} 图片 ${index} 加载成功:`, this.naturalWidth, 'x', this.naturalHeight);
            this.style.display = 'block';
            this.style.visibility = 'visible';
            this.style.opacity = '1';
        };

        img.onerror = function() {
            const devicePrefix = mobile ? '📱' : '🖥️';
            console.log(`${devicePrefix} 图片 ${index} 加载失败，尝试修复`);
            
            // 尝试使用标准化的URL重新加载
            const fixedUrl = standardizeImageUrl(this.src);
            if (fixedUrl && fixedUrl !== this.src) {
                console.log(`${devicePrefix} 图片 ${index} 重试标准化URL`);
                this.src = fixedUrl;
            } else {
                // 显示占位符
                this.style.cssText += `
                    background: #f0f0f0 !important;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Ctext x='50' y='50' font-family='Arial' font-size='12' text-anchor='middle' dy='.3em' fill='%23999'%3E图片加载失败%3C/text%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: center !important;
                    min-height: 80px !important;
                    border: 2px dashed #ccc !important;
                `;
            }
        };

        // 强制触发重新检查
        if (img.src && !img.complete) {
            // 强制重新加载
            const originalSrc = img.src;
            img.src = '';
            setTimeout(() => {
                img.src = originalSrc;
            }, 100);
        }
    }

    // 监控新增图片
    function startImageMonitoring() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 查找新增的图片
                        const newImages = node.querySelectorAll ? 
                            node.querySelectorAll('img.message-image, .message-attachments img') : 
                            (node.tagName === 'IMG' && (node.classList.contains('message-image') || node.closest('.message-attachments')) ? [node] : []);

                        newImages.forEach((img, index) => {
                            console.log('📱 检测到新图片，准备修复');
                            setTimeout(() => {
                                forceFixSingleImage(img, 'new-' + index);
                            }, 500);
                        });

                        // 查找新增的附件容器
                        const newContainers = node.querySelectorAll ? 
                            node.querySelectorAll('.message-attachments') :
                            (node.classList && node.classList.contains('message-attachments') ? [node] : []);

                        newContainers.forEach(container => {
                            container.style.cssText = `
                                ${container.style.cssText}
                                display: block !important;
                                visibility: visible !important;
                                opacity: 1 !important;
                            `;
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('📱 图片监控已启动');
    }

    // 定期强制修复
    function startPeriodicFix() {
        setInterval(() => {
            if (isMobile()) {
                const hiddenImages = document.querySelectorAll('img.message-image[style*="display: none"], img.message-image[style*="visibility: hidden"]');
                if (hiddenImages.length > 0) {
                    console.log(`📱 发现 ${hiddenImages.length} 个被隐藏的图片，重新修复`);
                    hiddenImages.forEach((img, index) => {
                        forceFixSingleImage(img, 'periodic-' + index);
                    });
                }
            }
        }, 5000);
    }

    // 初始化
    function init() {
        if (!isMobile()) {
            console.log('📱 非移动设备，跳过移动端图片修复');
            return;
        }

        console.log('📱 初始化移动端图片显示修复...');
        
        // 延迟执行，确保页面完全加载
        setTimeout(() => {
            forceFixAllImages();
            startImageMonitoring();
            startPeriodicFix();
            console.log('📱 移动端图片修复初始化完成');
        }, 2000);

        // 页面可见性变化时重新修复
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && isMobile()) {
                console.log('📱 页面变为可见，重新修复图片');
                setTimeout(forceFixAllImages, 1000);
            }
        });
    }

    // 导出到全局
    window.imageDisplayFix = {
        fixAll: forceFixAllImages,
        fixSingle: forceFixSingleImage,
        isMobile: isMobile
    };

    // 兼容旧的导出名称
    window.mobileImageForceFix = window.imageDisplayFix;
    
    // 直接导出修复函数供测试使用
    window.forceFixAllImages = forceFixAllImages;

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
