/**
 * 图片优化服务 v2.0
 * 实现懒加载和渐进式图片加载，充分利用后端的缩略图功能
 */
class ImageOptimizationService {
    constructor() {
        // 缩略图尺寸配置（与后端一致）
        this.thumbnailSizes = {
            small: 150,   // 小缩略图，用于快速预览
            medium: 400,  // 中等缩略图，用于聊天消息
            full: null    // 原图
        };
        
        // 图片加载状态缓存
        this.loadingImages = new Map();
        
        // Intersection Observer for lazy loading
        this.observer = this.createIntersectionObserver();
    }

    /**
     * 创建并返回一个 IntersectionObserver 实例
     */
    createIntersectionObserver() {
        const options = {
            root: document.getElementById('chatMessages'), // 在聊天消息容器内滚动
            rootMargin: '0px 0px 200px 0px', // 提前200px开始加载
            threshold: 0.01
        };

        return new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    console.log('🖼️ [懒加载] 图片进入视口，开始加载:', img.alt);
                    this.loadImage(img);
                    observer.unobserve(img); // 加载后停止观察
                }
            });
        }, options);
    }

    /**
     * 实际加载图片的逻辑
     * @param {HTMLImageElement} img - 目标图片元素
     */
    loadImage(img) {
        const smallSrc = img.dataset.srcSmall;
        const mediumSrc = img.dataset.srcMedium;

        // 1. 加载小缩略图以快速显示
        const smallLoader = new Image();
        smallLoader.onload = () => {
            img.src = smallSrc;
            img.style.filter = 'blur(2px)'; // 轻微模糊效果
            console.log(`✅ [优化] small尺寸图片加载完成:`, smallSrc);

            // 2. 接着加载中等尺寸图片
            const mediumLoader = new Image();
            mediumLoader.onload = () => {
                img.src = mediumSrc;
                img.style.filter = 'none'; // 加载完成后移除模糊
                console.log(`✅ [优化] medium尺寸图片加载完成:`, mediumSrc);
            };
            mediumLoader.onerror = () => {
                console.error(`❌ [优化] medium尺寸图片加载失败:`, mediumSrc);
                // 如果中图加载失败，至少保留小图
            };
            mediumLoader.src = mediumSrc;
        };
        smallLoader.onerror = () => {
            console.error(`❌ [优化] small尺寸图片加载失败:`, smallSrc);
            img.alt = '图片加载失败';
            // 可以设置一个加载失败的占位图
        };
        smallLoader.src = smallSrc;
    }

    /**
     * 构建图片URL（支持缩略图）
     * @param {string|object} attachment - 附件信息
     * @param {string} size - 图片尺寸 ('small', 'medium', 'full')
     * @returns {string} 图片URL
     */
    buildImageUrl(attachment, size = 'medium') {
        const token = this.getAccessToken();
        if (!token) {
            console.warn('⚠️ 无法获取认证token');
            return '';
        }

        const apiUrl = window.ENV_CONFIG?.getApiUrl() || 'http://127.0.0.1:4005/api';
        let fileId = (typeof attachment === 'string') ? attachment : (attachment?.id || attachment?.fileId);
        
        if (!fileId) {
            console.error('❌ 无效的附件数据:', attachment);
            return '';
        }

        if (size === 'full') {
            return `${apiUrl}/files/${fileId}/view?token=${token}`;
        } else {
            const sizeParam = this.thumbnailSizes[size] || this.thumbnailSizes.medium;
            return `${apiUrl}/files/${fileId}/thumbnail?size=${sizeParam}&token=${token}`;
        }
    }

    /**
     * 获取访问令牌
     */
    getAccessToken() {
        if (window.TokenManager && typeof window.TokenManager.getAccessToken === 'function') {
            return window.TokenManager.getAccessToken();
        }
        return localStorage.getItem('dify_access_token');
    }

    /**
     * 创建并返回一个支持懒加载和渐进式加载的图片容器
     * @param {string} fileId - 文件ID
     * @param {string} altText - 图片的alt文本
     * @returns {HTMLElement} 包含懒加载逻辑的DOM元素
     */
    progressiveLoadImage(fileId, altText) {
        // 1. 创建容器和图片元素
        const container = document.createElement('div');
        container.className = 'progressive-image-container';
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
            transition: filter 0.3s ease;
        `;
        
        // 2. 构建URL
        const smallUrl = this.buildImageUrl(fileId, 'small');
        const mediumUrl = this.buildImageUrl(fileId, 'medium');
        const fullUrl = this.buildImageUrl(fileId, 'full');

        // 3. 设置占位符和data-*属性
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="100%25" height="100%25" fill="%23f0f0f0"/%3E%3C/svg%3E';
        img.dataset.srcSmall = smallUrl;
        img.dataset.srcMedium = mediumUrl;

        // 4. 设置点击放大事件
        container.onclick = () => {
            this.showImageModal(fullUrl, altText);
        };

        // 5. 将图片添加到观察器
        this.observer.observe(img);

        container.appendChild(img);
        return container;
    }

    /**
     * 显示图片查看模态框
     * @param {string} imageUrl - 要显示的原图URL
     * @param {string} altText - 图片的alt文本
     */
    showImageModal(imageUrl, altText) {
        const modal = this.createImageModal();
        const modalImg = modal.querySelector('.modal-image');
        const loadingIndicator = modal.querySelector('.modal-loading');
        const downloadBtn = modal.querySelector('.btn-download');

        loadingIndicator.style.display = 'block';
        modalImg.style.filter = 'blur(5px)';

        const imageLoader = new Image();
        imageLoader.onload = () => {
            loadingIndicator.style.display = 'none';
            modalImg.src = imageUrl;
            modalImg.style.filter = 'none';
        };
        imageLoader.onerror = () => {
            loadingIndicator.style.display = 'none';
            this.showToast('原图加载失败', 'error');
            modalImg.alt = '原图加载失败';
        };
        imageLoader.src = imageUrl;

        downloadBtn.onclick = () => {
            // 创建一个隐藏的a标签来触发下载
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = altText || 'image.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    }

    /**
     * 创建图片查看模态框
     */
    createImageModal() {
        const existingModal = document.getElementById('imageViewModal');
        if (existingModal) existingModal.remove();

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
                    <button class="btn-zoom-in" title="放大"><i class="fas fa-search-plus"></i></button>
                    <button class="btn-zoom-out" title="缩小"><i class="fas fa-search-minus"></i></button>
                    <button class="btn-download" title="下载原图"><i class="fas fa-download"></i></button>
                </div>
            </div>
        `;

        this.injectModalStyles();
        document.body.appendChild(modal);

        const close = () => {
            modal.classList.add('closing');
            setTimeout(() => modal.remove(), 300);
            document.removeEventListener('keydown', handleEsc);
        };

        const handleEsc = (e) => e.key === 'Escape' && close();
        
        modal.querySelector('.modal-close').onclick = close;
        modal.querySelector('.modal-backdrop').onclick = close;
        document.addEventListener('keydown', handleEsc);

        let zoom = 1;
        const modalImg = modal.querySelector('.modal-image');
        modal.querySelector('.btn-zoom-in').onclick = () => {
            zoom = Math.min(zoom * 1.2, 3);
            modalImg.style.transform = `scale(${zoom})`;
        };
        modal.querySelector('.btn-zoom-out').onclick = () => {
            zoom = Math.max(zoom / 1.2, 0.5);
            modalImg.style.transform = `scale(${zoom})`;
        };

        requestAnimationFrame(() => modal.classList.add('show'));
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
            .image-view-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; opacity: 0; transition: opacity 0.3s ease; }
            .image-view-modal.show { opacity: 1; }
            .image-view-modal.closing { opacity: 0; }
            .modal-backdrop { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); }
            .modal-content { position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
            .modal-body { position: relative; max-width: 90%; max-height: 90%; }
            .modal-image { max-width: 100%; max-height: 90vh; object-fit: contain; transition: transform 0.3s ease, filter 0.3s ease; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); }
            .modal-close { position: absolute; top: 20px; right: 30px; font-size: 40px; color: white; background: none; border: none; cursor: pointer; z-index: 10001; opacity: 0.8; transition: opacity 0.2s; }
            .modal-close:hover { opacity: 1; }
            .modal-controls { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); display: flex; gap: 15px; background: rgba(0, 0, 0, 0.7); padding: 10px 20px; border-radius: 25px; }
            .modal-controls button { background: rgba(255, 255, 255, 0.2); color: white; border: none; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; justify-content: center; }
            .modal-controls button:hover { background: rgba(255, 255, 255, 0.3); }
            .modal-loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: none; }
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
