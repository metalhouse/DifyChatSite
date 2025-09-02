/**
 * 图片优化服务 v3.0
 * 实现智能分级加载：先加载视口内缩略图，再加载视口外缩略图，最后加载原图
 */
class ImageOptimizationService {
    constructor() {
        // 缩略图尺寸配置（与后端一致）
        this.thumbnailSizes = {
            small: 150,   // 小缩略图，用于快速预览
            medium: 400,  // 中等缩略图，用于聊天消息
            full: null    // 原图
        };
        
        // 图片加载队列管理
        this.loadingQueues = {
            visibleThumbnails: [],    // 视口内缩略图队列（最高优先级）
            hiddenThumbnails: [],     // 视口外缩略图队列（中等优先级）
            fullImages: [],           // 原图队列（最低优先级）
            userRequested: []         // 用户主动点击的原图（特殊优先级）
        };
        
        // 图片加载状态缓存
        this.imageStates = new Map();
        
        // 当前正在加载的图片数量（控制并发）
        this.currentLoading = 0;
        this.maxConcurrent = 2;
        
        // Intersection Observer for lazy loading
        this.observer = this.createIntersectionObserver();
        
        // 定时处理加载队列
        this.queueProcessor = setInterval(() => {
            this.processLoadingQueue();
        }, 100);
        
        console.log('🚀 [图片优化] ImageOptimizationService v3.0 初始化完成');
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
                const img = entry.target;
                const imageId = img.dataset.imageId;
                
                if (entry.isIntersecting) {
                    // 图片进入视口 - 添加到可见缩略图队列
                    console.log('👁️ [视口] 图片进入视口:', imageId);
                    this.addToQueue('visibleThumbnails', {
                        img,
                        imageId,
                        priority: Date.now() // 越早进入视口优先级越高
                    });
                } else {
                    // 图片离开视口 - 从可见队列移除，添加到隐藏队列
                    console.log('👁️‍🗨️ [视口] 图片离开视口:', imageId);
                    this.removeFromQueue('visibleThumbnails', imageId);
                    this.addToQueue('hiddenThumbnails', {
                        img,
                        imageId,
                        priority: Date.now()
                    });
                }
            });
        }, options);
    }

    /**
     * 添加到指定队列
     * @param {string} queueName - 队列名称
     * @param {object} item - 队列项目
     */
    addToQueue(queueName, item) {
        // 避免重复添加
        const existingIndex = this.loadingQueues[queueName].findIndex(
            queueItem => queueItem.imageId === item.imageId
        );
        
        if (existingIndex === -1) {
            this.loadingQueues[queueName].push(item);
            // 按优先级排序（时间越早优先级越高）
            this.loadingQueues[queueName].sort((a, b) => a.priority - b.priority);
            console.log(`📋 [队列] 添加到${queueName}队列:`, item.imageId, `队列长度: ${this.loadingQueues[queueName].length}`);
        }
    }

    /**
     * 从指定队列移除
     * @param {string} queueName - 队列名称
     * @param {string} imageId - 图片ID
     */
    removeFromQueue(queueName, imageId) {
        const originalLength = this.loadingQueues[queueName].length;
        this.loadingQueues[queueName] = this.loadingQueues[queueName].filter(
            item => item.imageId !== imageId
        );
        if (this.loadingQueues[queueName].length !== originalLength) {
            console.log(`📋 [队列] 从${queueName}队列移除:`, imageId, `队列长度: ${this.loadingQueues[queueName].length}`);
        }
    }

    /**
     * 处理加载队列
     */
    processLoadingQueue() {
        // 如果已达到最大并发数，跳过
        if (this.currentLoading >= this.maxConcurrent) {
            return;
        }

        // 按优先级处理队列：用户点击 > 视口内缩略图 > 视口外缩略图 > 原图
        const queuePriority = ['userRequested', 'visibleThumbnails', 'hiddenThumbnails', 'fullImages'];
        
        for (const queueName of queuePriority) {
            const queue = this.loadingQueues[queueName];
            if (queue.length > 0 && this.currentLoading < this.maxConcurrent) {
                const item = queue.shift(); // 取出第一个（优先级最高的）
                this.processImageLoad(item, queueName);
                
                if (this.currentLoading >= this.maxConcurrent) {
                    break;
                }
            }
        }
    }

    /**
     * 处理单个图片加载
     * @param {object} item - 队列项目
     * @param {string} queueType - 队列类型
     */
    async processImageLoad(item, queueType) {
        const { img, imageId } = item;
        
        // 检查图片是否已经加载
        const currentState = this.imageStates.get(imageId) || { thumbnailLoaded: false, fullLoaded: false };
        
        if (queueType === 'userRequested') {
            // 用户点击要求加载原图
            if (!currentState.fullLoaded) {
                await this.loadFullImage(img, imageId);
            }
        } else if (queueType.includes('Thumbnails')) {
            // 加载缩略图
            if (!currentState.thumbnailLoaded) {
                await this.loadThumbnailImage(img, imageId);
            }
        } else if (queueType === 'fullImages') {
            // 自动加载原图（所有缩略图都加载完后）
            if (currentState.thumbnailLoaded && !currentState.fullLoaded) {
                await this.loadFullImage(img, imageId);
            }
        }
    }

    /**
     * 加载缩略图图片
     * @param {HTMLImageElement} img - 目标图片元素
     * @param {string} imageId - 图片ID
     */
    async loadThumbnailImage(img, imageId) {
        this.currentLoading++;
        console.log(`🔄 [加载] 开始加载缩略图: ${imageId} (并发: ${this.currentLoading}/${this.maxConcurrent})`);
        
        try {
            const smallSrc = img.dataset.srcSmall;
            const mediumSrc = img.dataset.srcMedium;

            // 1. 先加载小缩略图
            await new Promise((resolve, reject) => {
                const smallLoader = new Image();
                smallLoader.onload = () => {
                    img.src = smallSrc;
                    img.style.filter = 'blur(1px)'; // 轻微模糊效果
                    console.log(`✅ [缩略图] small尺寸加载完成: ${imageId}`);
                    resolve();
                };
                smallLoader.onerror = () => {
                    console.error(`❌ [缩略图] small尺寸加载失败: ${imageId}`);
                    reject(new Error(`Small thumbnail load failed: ${imageId}`));
                };
                smallLoader.src = smallSrc;
            });

            // 2. 接着加载中等尺寸缩略图
            await new Promise((resolve, reject) => {
                const mediumLoader = new Image();
                mediumLoader.onload = () => {
                    img.src = mediumSrc;
                    img.style.filter = 'none'; // 移除模糊效果
                    console.log(`✅ [缩略图] medium尺寸加载完成: ${imageId}`);
                    resolve();
                };
                mediumLoader.onerror = () => {
                    console.error(`❌ [缩略图] medium尺寸加载失败: ${imageId}`);
                    // 如果中图加载失败，至少保留小图
                    resolve();
                };
                mediumLoader.src = mediumSrc;
            });

            // 更新状态
            const currentState = this.imageStates.get(imageId) || {};
            this.imageStates.set(imageId, { ...currentState, thumbnailLoaded: true });
            
            // 缩略图加载完成后，将原图添加到加载队列（低优先级）
            this.scheduleFullImageLoad(img, imageId);
            
        } catch (error) {
            console.error(`❌ [缩略图] 加载失败: ${imageId}`, error);
            img.alt = '缩略图加载失败';
        } finally {
            this.currentLoading--;
            console.log(`🔄 [加载] 缩略图加载完成: ${imageId} (并发: ${this.currentLoading}/${this.maxConcurrent})`);
        }
    }

    /**
     * 加载原图
     * @param {HTMLImageElement} img - 目标图片元素
     * @param {string} imageId - 图片ID
     */
    async loadFullImage(img, imageId) {
        this.currentLoading++;
        console.log(`🔄 [原图] 开始加载原图: ${imageId} (并发: ${this.currentLoading}/${this.maxConcurrent})`);
        
        try {
            const fullSrc = img.dataset.srcFull;
            
            await new Promise((resolve, reject) => {
                const fullLoader = new Image();
                fullLoader.onload = () => {
                    // 不替换src，保留缩略图。原图用于点击查看
                    console.log(`✅ [原图] 原图预加载完成: ${imageId}`);
                    resolve();
                };
                fullLoader.onerror = () => {
                    console.error(`❌ [原图] 原图加载失败: ${imageId}`);
                    reject(new Error(`Full image load failed: ${imageId}`));
                };
                fullLoader.src = fullSrc;
            });

            // 更新状态
            const currentState = this.imageStates.get(imageId) || {};
            this.imageStates.set(imageId, { ...currentState, fullLoaded: true });
            
        } catch (error) {
            console.error(`❌ [原图] 加载失败: ${imageId}`, error);
        } finally {
            this.currentLoading--;
            console.log(`🔄 [原图] 原图加载完成: ${imageId} (并发: ${this.currentLoading}/${this.maxConcurrent})`);
        }
    }

    /**
     * 安排原图加载（延迟执行）
     * @param {HTMLImageElement} img - 目标图片元素
     * @param {string} imageId - 图片ID
     */
    scheduleFullImageLoad(img, imageId) {
        // 延迟5秒后添加到原图加载队列，确保所有缩略图优先加载
        setTimeout(() => {
            const currentState = this.imageStates.get(imageId) || {};
            if (currentState.thumbnailLoaded && !currentState.fullLoaded) {
                this.addToQueue('fullImages', {
                    img,
                    imageId,
                    priority: Date.now()
                });
                console.log(`⏰ [调度] 原图已安排加载: ${imageId}`);
            }
        }, 5000);
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
     * 创建并返回一个支持智能分级加载的图片容器
     * @param {string} fileId - 文件ID
     * @param {string} altText - 图片的alt文本
     * @returns {HTMLElement} 包含智能加载逻辑的DOM元素
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

        // 3. 生成唯一图片ID和设置数据属性
        const imageId = `img_${fileId}_${Date.now()}`;
        img.dataset.imageId = imageId;
        img.dataset.srcSmall = smallUrl;
        img.dataset.srcMedium = mediumUrl;
        img.dataset.srcFull = fullUrl;

        // 4. 设置占位符
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="100%25" height="100%25" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="14"%3E准备加载...%3C/text%3E%3C/svg%3E';

        // 5. 设置点击放大事件（优先加载原图）
        container.onclick = () => {
            console.log('🖱️ [用户] 点击查看原图:', imageId);
            // 用户点击时，优先加载原图
            this.addToQueue('userRequested', {
                img,
                imageId,
                priority: Date.now()
            });
            
            // 显示模态框
            setTimeout(() => {
                this.showImageModal(fullUrl, altText);
            }, 100);
        };

        // 6. 初始化图片状态
        this.imageStates.set(imageId, {
            thumbnailLoaded: false,
            fullLoaded: false,
            element: img
        });

        // 7. 将图片添加到观察器
        this.observer.observe(img);

        container.appendChild(img);
        
        console.log('📷 [图片] 创建智能加载图片容器:', imageId);
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

    /**
     * 获取加载统计信息
     */
    getLoadingStats() {
        const stats = {
            queues: {
                userRequested: this.loadingQueues.userRequested.length,
                visibleThumbnails: this.loadingQueues.visibleThumbnails.length,
                hiddenThumbnails: this.loadingQueues.hiddenThumbnails.length,
                fullImages: this.loadingQueues.fullImages.length
            },
            currentLoading: this.currentLoading,
            maxConcurrent: this.maxConcurrent,
            totalImages: this.imageStates.size,
            loadedThumbnails: Array.from(this.imageStates.values()).filter(state => state.thumbnailLoaded).length,
            loadedFullImages: Array.from(this.imageStates.values()).filter(state => state.fullLoaded).length
        };
        
        return stats;
    }

    /**
     * 手动触发特定图片的加载
     * @param {string} imageId - 图片ID
     * @param {string} loadType - 加载类型 ('thumbnail' | 'full')
     */
    manualLoadImage(imageId, loadType = 'thumbnail') {
        const imageState = this.imageStates.get(imageId);
        if (!imageState) {
            console.warn(`⚠️ [手动] 图片状态未找到: ${imageId}`);
            return;
        }

        const queueName = loadType === 'full' ? 'userRequested' : 'visibleThumbnails';
        this.addToQueue(queueName, {
            img: imageState.element,
            imageId,
            priority: Date.now()
        });

        console.log(`🖱️ [手动] 手动触发加载: ${imageId} (${loadType})`);
    }

    /**
     * 清理已经不在DOM中的图片状态
     */
    cleanup() {
        const imagesToRemove = [];
        
        for (const [imageId, state] of this.imageStates.entries()) {
            if (!document.contains(state.element)) {
                imagesToRemove.push(imageId);
            }
        }
        
        imagesToRemove.forEach(imageId => {
            this.imageStates.delete(imageId);
            // 从所有队列中移除
            Object.keys(this.loadingQueues).forEach(queueName => {
                this.removeFromQueue(queueName, imageId);
            });
        });
        
        if (imagesToRemove.length > 0) {
            console.log(`🧹 [清理] 清理了 ${imagesToRemove.length} 个已移除的图片状态`);
        }
    }

    /**
     * 销毁服务，清理资源
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        
        if (this.queueProcessor) {
            clearInterval(this.queueProcessor);
        }
        
        this.imageStates.clear();
        Object.keys(this.loadingQueues).forEach(queueName => {
            this.loadingQueues[queueName] = [];
        });
        
        console.log('🗑️ [图片优化] ImageOptimizationService 已销毁');
    }
}

// 创建全局实例
window.imageOptimizer = new ImageOptimizationService();

// 添加全局调试功能
window.debugImageOptimizer = {
    getStats: () => window.imageOptimizer.getLoadingStats(),
    getQueues: () => window.imageOptimizer.loadingQueues,
    getStates: () => Object.fromEntries(window.imageOptimizer.imageStates),
    manualLoad: (imageId, type) => window.imageOptimizer.manualLoadImage(imageId, type),
    cleanup: () => window.imageOptimizer.cleanup(),
    
    // 调试用的详细日志
    logStats: () => {
        const stats = window.imageOptimizer.getLoadingStats();
        console.table(stats.queues);
        console.log('📊 [统计]', {
            当前加载: `${stats.currentLoading}/${stats.maxConcurrent}`,
            总图片数: stats.totalImages,
            已加载缩略图: stats.loadedThumbnails,
            已加载原图: stats.loadedFullImages
        });
    },
    
    // 强制加载所有可见图片的缩略图
    loadAllVisible: () => {
        const visibleImages = document.querySelectorAll('img[data-image-id]');
        const chatMessages = document.getElementById('chatMessages');
        
        visibleImages.forEach(img => {
            const rect = img.getBoundingClientRect();
            const chatRect = chatMessages.getBoundingClientRect();
            
            // 检查是否在聊天消息容器的可视区域内
            if (rect.bottom > chatRect.top && rect.top < chatRect.bottom) {
                const imageId = img.dataset.imageId;
                window.imageOptimizer.manualLoadImage(imageId, 'thumbnail');
                console.log('🔧 [调试] 强制加载可见缩略图:', imageId);
            }
        });
    }
};

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageOptimizationService;
}
