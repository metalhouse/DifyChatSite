/**
 * 图片优化服务
 * 实现渐进式图片加载，充分利用后端的缩略图功能
 */
class ImageOptimizationService {
    constructor() {
        // 缩略图尺寸配置（与后端一致）
        this.thumbnailSizes = {
            small: 150,   // 小缩略图，用于列表
            medium: 400,  // 中等缩略图，用于聊天消息
            full: null    // 原图
        };
        
        // 图片加载状态缓存
        this.loadingImages = new Map();
        
        // 预加载队列
        this.preloadQueue = [];
        this.isPreloading = false;
    }

    /**
     * 构建图片URL（支持缩略图）
     * @param {string|object} attachment - 附件信息
     * @param {string} size - 图片尺寸 ('small', 'medium', 'full')
     * @returns {string} 图片URL
     */
    buildImageUrl(attachment, size = 'medium') {
        // 获取token
        const token = this.getAccessToken();
        if (!token) {
            console.warn('⚠️ 无法获取认证token');
            return '';
        }

        // 获取API基础URL
        const apiUrl = window.ENV_CONFIG?.getApiUrl() || 'http://127.0.0.1:4005/api';
        
        let fileId = '';
        
        // 处理不同格式的附件数据
        if (typeof attachment === 'string') {
            fileId = attachment;
        } else if (attachment && typeof attachment === 'object') {
            fileId = attachment.id || attachment.fileId;
            
            // 如果有预构建的带token URL，优先使用
            if (size === 'small' && attachment.thumbnailUrlWithToken) {
                return this.ensureFullUrl(attachment.thumbnailUrlWithToken);
            } else if (size === 'full' && attachment.urlWithToken) {
                return this.ensureFullUrl(attachment.urlWithToken);
            }
        }
        
        if (!fileId) {
            console.error('❌ 无效的附件数据:', attachment);
            return '';
        }

        // 根据尺寸构建不同的URL
        let url = '';
        if (size === 'full') {
            // 原图
            url = `${apiUrl}/files/${fileId}/view?token=${token}`;
        } else {
            // 缩略图
            const sizeParam = this.thumbnailSizes[size] || this.thumbnailSizes.medium;
            url = `${apiUrl}/files/${fileId}/thumbnail?size=${sizeParam}&token=${token}`;
        }
        
        console.log(`🖼️ [图片优化] 构建${size}尺寸URL:`, url);
        return url;
    }

    /**
     * 确保URL是完整的
     */
    ensureFullUrl(url) {
        if (!url) return '';
        
        if (url.startsWith('http')) {
            return url;
        }
        
        const backendUrl = window.ENV_CONFIG?.API_BASE_URL || 'http://127.0.0.1:4005';
        return `${backendUrl}${url}`;
    }

    /**
     * 获取访问令牌
     */
    getAccessToken() {
        // 尝试多种方式获取token
        if (window.TokenManager && typeof window.TokenManager.getAccessToken === 'function') {
            return window.TokenManager.getAccessToken();
        }
        
        return localStorage.getItem('dify_access_token') || 
               localStorage.getItem('access_token');
    }

    /**
     * 创建并返回一个支持渐进式加载的图片容器
     * @param {string} fileId - 文件ID
     * @param {string} altText - 图片的alt文本
     * @param {object} options - 加载选项
     * @returns {HTMLElement} 包含渐进式加载逻辑的DOM元素
     */
    progressiveLoadImage(fileId, altText, options = {}) {
        const {
            initialSize = 'medium', // 初始加载的尺寸，聊天窗口用中尺寸更合适
            targetSize = 'full',    // 目标尺寸（用于点击放大）
            containerClass = 'progressive-image-container'
        } = options;

        // 1. 创建容器和图片元素
        const container = document.createElement('div');
        container.className = containerClass;
        container.style.position = 'relative';
        container.style.minHeight = '100px'; // 占位高度

        const img = document.createElement('img');
        img.className = 'message-image img-fluid';
        img.alt = altText;
        img.title = '点击查看原图';
        img.style.cssText = `
            border-radius: 8px; 
            cursor: pointer; 
            max-width: 100%; 
            height: auto; 
            display: block;
            filter: blur(5px);
            transition: filter 0.5s ease;
        `;
        
        // 2. 构建URL
        const initialUrl = this.buildImageUrl(fileId, initialSize);
        const targetUrl = this.buildImageUrl(fileId, targetSize);

        // 3. 设置初始图片源（占位符）
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="100%25" height="100%25" fill="%23f0f0f0"/%3E%3C/svg%3E';

        // 4. 加载初始图片
        const initialLoader = new Image();
        initialLoader.onload = () => {
            img.src = initialUrl;
            img.style.filter = 'none'; // 加载完成后移除模糊
            console.log(`✅ [优化] ${initialSize}尺寸图片加载完成:`, initialUrl);
        };
        initialLoader.onerror = () => {
            console.error(`❌ [优化] ${initialSize}尺寸图片加载失败:`, initialUrl);
            container.innerHTML = `<div style="padding: 10px; background: #f5f5f5; border-radius: 4px; color: #666;">图片加载失败: ${altText}</div>`;
        };
        initialLoader.src = initialUrl;

        // 5. 设置点击放大事件
        container.onclick = () => {
            this.showImageModal(targetUrl, altText);
        };
        
        // 6. 预加载原图
        this.preloadImage(targetUrl);

        container.appendChild(img);
        return container;
    }

    /**
     * 预加载图片
     */
    preloadImage(url) {
        // 避免重复预加载
        if (this.loadingImages.has(url)) {
            return this.loadingImages.get(url);
        }

        console.log('🔄 [预加载] 开始预加载原图:', url);
        
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                console.log('✅ [预加载] 原图预加载完成:', url);
                this.loadingImages.delete(url);
                resolve(url);
            };
            
            img.onerror = (error) => {
                console.error('❌ [预加载] 原图预加载失败:', url);
                this.loadingImages.delete(url);
                reject(error);
            };
            
            // 延迟加载，避免阻塞主要内容
            setTimeout(() => {
                img.src = url;
            }, 1000);
        });

        this.loadingImages.set(url, promise);
        return promise;
    }


    /**
     * 创建图片查看模态框
     */
    createImageModal() {
        // 移除已存在的模态框
        const existingModal = document.getElementById('imageViewModal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        // 创建新模态框
        const modal = document.createElement('div');
        modal.id = 'imageViewModal';
        modal.className = 'image-view-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <button class="modal-close">&times;</button>
                <div class="modal-body">
                    <img class="modal-image" alt="查看大图">
                    <div class="modal-loading">
                        <div class="spinner-border text-light" role="status">
                            <span class="visually-hidden">加载中...</span>
                        </div>
                    </div>
                </div>
                <div class="modal-controls">
                    <button class="btn-zoom-in" title="放大">
                        <i class="fas fa-search-plus"></i>
                    </button>
                    <button class="btn-zoom-out" title="缩小">
                        <i class="fas fa-search-minus"></i>
                    </button>
                    <button class="btn-download" title="下载原图">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        `;

        // 添加样式
        this.injectModalStyles();

        // 添加到页面
        document.body.appendChild(modal);

        // 绑定事件
        const closeBtn = modal.querySelector('.modal-close');
        const backdrop = modal.querySelector('.modal-backdrop');
        const zoomInBtn = modal.querySelector('.btn-zoom-in');
        const zoomOutBtn = modal.querySelector('.btn-zoom-out');
        const modalImg = modal.querySelector('.modal-image');
        
        let currentZoom = 1;

        const closeModal = () => {
            modal.classList.add('closing');
            setTimeout(() => {
                if (modal.parentNode) {
                    document.body.removeChild(modal);
                }
            }, 300);
        };

        closeBtn.onclick = closeModal;
        backdrop.onclick = closeModal;
        
        // 缩放功能
        zoomInBtn.onclick = () => {
            currentZoom = Math.min(currentZoom * 1.2, 3);
            modalImg.style.transform = `scale(${currentZoom})`;
        };
        
        zoomOutBtn.onclick = () => {
            currentZoom = Math.max(currentZoom / 1.2, 0.5);
            modalImg.style.transform = `scale(${currentZoom})`;
        };

        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        // 显示动画
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });

        return modal;
    }

    /**
     * 注入模态框样式
     */
    injectModalStyles() {
        if (document.getElementById('image-modal-styles')) return;

        const style = document.createElement('style');
        style.id = 'image-modal-styles';
        style.textContent = `
            .image-view-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .image-view-modal.show {
                opacity: 1;
            }
            
            .image-view-modal.closing {
                opacity: 0;
            }
            
            .modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
            }
            
            .modal-content {
                position: relative;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .modal-body {
                position: relative;
                max-width: 90%;
                max-height: 90%;
            }
            
            .modal-image {
                max-width: 100%;
                max-height: 90vh;
                object-fit: contain;
                transition: transform 0.3s ease, filter 0.3s ease;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            }
            
            .modal-close {
                position: absolute;
                top: 20px;
                right: 30px;
                font-size: 40px;
                color: white;
                background: none;
                border: none;
                cursor: pointer;
                z-index: 10001;
                opacity: 0.8;
                transition: opacity 0.2s;
            }
            
            .modal-close:hover {
                opacity: 1;
            }
            
            .modal-controls {
                position: absolute;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 15px;
                background: rgba(0, 0, 0, 0.7);
                padding: 10px 20px;
                border-radius: 25px;
            }
            
            .modal-controls button {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 50%;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .modal-controls button:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .modal-loading {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                display: none;
            }
            
            .loading-image {
                transition: filter 0.3s ease;
            }
            
            .failed-image {
                opacity: 0.5;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
}

// 创建全局实例
window.imageOptimizer = new ImageOptimizationService();

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageOptimizationService;
}
