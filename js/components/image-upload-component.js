/**
 * 图片上传组件
 * 支持拖拽上传、粘贴上传、点击上传
 */

class ImageUploadComponent {
    constructor(options = {}) {
        this.container = options.container;
        this.onUploaded = options.onUploaded || (() => {});
        this.onError = options.onError || ((error) => console.error(error));
        this.accessLevel = options.accessLevel || 'private';
        this.multiple = options.multiple || false;
        this.showPreview = options.showPreview !== false;
        
        this.fileAPI = window.FileAPI;
        this.uploading = false;
        this.uploadProgress = 0;
        
        this.init();
    }

    init() {
        this.createUploadUI();
        this.bindEvents();
        
        console.log('🖼️ ImageUploadComponent初始化完成');
    }

    createUploadUI() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="image-upload-wrapper">
                <!-- 隐藏的文件输入 -->
                <input type="file" 
                       accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                       ${this.multiple ? 'multiple' : ''}
                       style="display: none"
                       class="file-input">
                
                <!-- 上传按钮 -->
                <button type="button" class="btn btn-outline-primary image-upload-btn" title="点击选择图片文件">
                    <i class="fas fa-folder-open me-1"></i>选择图片
                </button>
                
                <!-- 上传进度 -->
                <div class="upload-progress" style="display: none;">
                    <div class="progress mb-2">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" 
                             role="progressbar" 
                             style="width: 0%">
                            <span class="progress-text">0%</span>
                        </div>
                    </div>
                    <small class="text-muted upload-status">准备上传...</small>
                </div>
                
                <!-- 图片预览区域 -->
                <div class="image-preview-area" style="display: none;">
                    <div class="preview-images"></div>
                    <div class="preview-actions mt-2">
                        <button type="button" class="btn btn-sm btn-success send-images-btn">
                            <i class="fas fa-paper-plane me-1"></i>发送图片
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary cancel-upload-btn">
                            <i class="fas fa-times me-1"></i>取消
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 获取元素引用
        this.fileInput = this.container.querySelector('.file-input');
        this.uploadBtn = this.container.querySelector('.image-upload-btn');
        this.progressContainer = this.container.querySelector('.upload-progress');
        this.progressBar = this.container.querySelector('.progress-bar');
        this.progressText = this.container.querySelector('.progress-text');
        this.uploadStatus = this.container.querySelector('.upload-status');
        this.previewArea = this.container.querySelector('.image-preview-area');
        this.previewImages = this.container.querySelector('.preview-images');
        this.sendBtn = this.container.querySelector('.send-images-btn');
        this.cancelBtn = this.container.querySelector('.cancel-upload-btn');
        
        // 调试元素引用
        console.log('🔍 ImageUploadComponent 元素引用:', {
            fileInput: this.fileInput,
            uploadBtn: this.uploadBtn,
            container: this.container
        });
    }

    bindEvents() {
        if (!this.container) return;

        // 点击上传按钮
        this.uploadBtn?.addEventListener('click', () => {
            console.log('🖱️ 上传按钮被点击');
            console.log('🔍 文件输入元素:', this.fileInput);
            if (this.fileInput) {
                console.log('📁 触发文件选择对话框');
                this.fileInput.click();
            } else {
                console.error('❌ 文件输入元素未找到');
            }
        });

        // 文件选择
        this.fileInput?.addEventListener('change', (e) => {
            console.log('📁 文件选择事件触发:', e.target.files);
            this.handleFileSelect(e.target.files);
        });

        // 发送按钮
        this.sendBtn?.addEventListener('click', () => {
            this.sendImages();
        });

        // 取消按钮
        this.cancelBtn?.addEventListener('click', () => {
            this.cancelUpload();
        });

        // 拖拽上传
        this.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.container.classList.add('drag-over');
        });

        this.container.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.container.classList.remove('drag-over');
        });

        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.container.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files).filter(file => 
                file.type.startsWith('image/')
            );
            
            if (files.length > 0) {
                this.handleFileSelect(files);
            }
        });

        // 粘贴上传
        document.addEventListener('paste', (e) => {
            if (!this.container.offsetParent) return; // 组件不可见时不处理

            const items = Array.from(e.clipboardData.items);
            const imageFiles = [];

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        imageFiles.push(file);
                    }
                }
            }

            if (imageFiles.length > 0) {
                e.preventDefault();
                this.handleFileSelect(imageFiles);
            }
        });
    }

    async handleFileSelect(files) {
        if (!files || files.length === 0) return;
        
        if (this.uploading) {
            this.onError('已有文件正在上传中，请稍候...');
            return;
        }

        // 验证文件
        const validFiles = [];
        for (const file of Array.from(files)) {
            const validation = this.fileAPI.validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
            } else {
                this.onError(`文件 "${file.name}" 验证失败: ${validation.errors.join(', ')}`);
            }
        }

        if (validFiles.length === 0) return;

        // 限制单次上传文件数量
        if (!this.multiple && validFiles.length > 1) {
            this.onError('当前模式只能上传一个文件');
            return;
        }

        if (validFiles.length > 5) {
            this.onError('一次最多只能上传5个文件');
            return;
        }

        // 显示预览
        if (this.showPreview) {
            this.showImagePreviews(validFiles);
        } else {
            // 直接上传
            await this.uploadFiles(validFiles);
        }
    }

    showImagePreviews(files) {
        this.previewImages.innerHTML = '';
        this.previewFiles = files;

        files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item d-inline-block me-2 mb-2 position-relative';
                previewItem.innerHTML = `
                    <img src="${e.target.result}" 
                         alt="${file.name}" 
                         class="preview-image"
                         style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid #dee2e6;">
                    <button type="button" 
                            class="btn btn-sm btn-danger position-absolute top-0 start-100 translate-middle rounded-circle p-1"
                            style="width: 24px; height: 24px; font-size: 12px;"
                            onclick="this.parentElement.remove()"
                            title="移除">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="preview-info mt-1">
                        <small class="text-muted d-block text-truncate" style="max-width: 100px;" title="${file.name}">
                            ${file.name}
                        </small>
                        <small class="text-muted">
                            ${this.formatFileSize(file.size)}
                        </small>
                    </div>
                `;
                this.previewImages.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        });

        // 显示预览区域
        this.previewArea.style.display = 'block';
        this.uploadBtn.disabled = true;
    }

    async sendImages() {
        const previewItems = this.previewImages.children;
        const remainingFiles = Array.from(previewItems).map((item, index) => 
            this.previewFiles[index]
        ).filter(Boolean);

        if (remainingFiles.length === 0) {
            this.onError('没有要发送的图片');
            return;
        }

        await this.uploadFiles(remainingFiles);
    }

    async uploadFiles(files) {
        this.uploading = true;
        this.showProgress(true);
        this.updateProgress(0, '准备上传...');

        try {
            const results = [];

            if (files.length === 1) {
                // 单文件上传
                const result = await this.fileAPI.uploadFile(
                    files[0],
                    this.accessLevel,
                    (progress) => this.updateProgress(progress, '上传中...')
                );
                results.push(result);
            } else {
                // 多文件上传
                const result = await this.fileAPI.uploadMultipleFiles(
                    files,
                    this.accessLevel,
                    (progress) => this.updateProgress(progress, '上传中...')
                );
                results.push(...result);
            }

            this.updateProgress(100, '上传完成!');
            
            // 调用回调
            this.onUploaded(results, files);
            
            // 延迟隐藏进度条
            setTimeout(() => {
                this.resetComponent();
            }, 1000);

        } catch (error) {
            console.error('图片上传失败:', error);
            this.onError(error.message || '图片上传失败');
            this.resetComponent();
        } finally {
            this.uploading = false;
        }
    }

    updateProgress(progress, status) {
        if (!this.progressBar || !this.progressText) return;

        this.progressBar.style.width = `${progress}%`;
        this.progressText.textContent = `${Math.round(progress)}%`;
        this.uploadStatus.textContent = status;

        // 进度条动画
        if (progress >= 100) {
            this.progressBar.classList.remove('progress-bar-animated');
            this.progressBar.classList.add('bg-success');
        }
    }

    showProgress(show) {
        if (!this.progressContainer) return;

        this.progressContainer.style.display = show ? 'block' : 'none';
        this.uploadBtn.disabled = show;

        if (show) {
            this.previewArea.style.display = 'none';
        }
    }

    cancelUpload() {
        this.resetComponent();
    }

    resetComponent() {
        this.uploading = false;
        this.uploadProgress = 0;
        this.previewFiles = null;

        // 重置UI
        this.showProgress(false);
        this.previewArea.style.display = 'none';
        this.previewImages.innerHTML = '';
        this.uploadBtn.disabled = false;
        this.fileInput.value = '';

        // 重置进度条样式
        if (this.progressBar) {
            this.progressBar.style.width = '0%';
            this.progressBar.classList.add('progress-bar-animated');
            this.progressBar.classList.remove('bg-success');
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 销毁组件
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.previewFiles = null;
        this.uploading = false;
    }
}

// CSS 样式
const style = document.createElement('style');
style.textContent = `
    .image-upload-wrapper {
        position: relative;
    }

    .image-upload-wrapper.drag-over {
        background-color: #f8f9fa;
        border: 2px dashed #28a745;
        border-radius: 8px;
        padding: 10px;
    }

    .image-upload-btn {
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }

    .image-upload-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
    }

    .image-upload-btn:disabled {
        opacity: 0.6;
        transform: none;
        cursor: not-allowed;
    }

    .upload-progress {
        min-width: 200px;
    }

    .progress {
        height: 8px;
        border-radius: 4px;
        overflow: hidden;
    }

    .progress-bar {
        transition: width 0.3s ease;
    }

    .progress-text {
        font-size: 10px;
        line-height: 1;
        color: white;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }

    .image-preview-area {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 15px;
        border: 1px solid #dee2e6;
        margin-top: 10px;
    }

    .preview-item {
        transition: transform 0.2s ease;
    }

    .preview-item:hover {
        transform: translateY(-2px);
    }

    .preview-image {
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .preview-image:hover {
        opacity: 0.8;
        border-color: #28a745 !important;
    }

    @media (max-width: 768px) {
        .image-upload-wrapper {
            width: 100%;
        }
        
        .preview-item {
            margin-bottom: 10px;
        }
        
        .preview-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        
        .preview-actions .btn {
            flex: 1;
            max-width: 120px;
        }
    }
`;

document.head.appendChild(style);

// 全局引用
window.ImageUploadComponent = ImageUploadComponent;
