// 超强力移动端图片上传修复 - 绕过所有限制

(function() {
    'use strict';

    console.log('💪 超强力移动端修复开始...');

    // 检测移动设备
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    // 创建强力上传按钮
    function createForceUploadButton() {
        // 移除现有按钮的所有限制
        const originalButton = document.getElementById('imageUploadButton')
            || document.getElementById('addButton')
            || document.querySelector('[data-action="image"], .image-button, .add-btn');
        if (!originalButton) {
            // 按钮可能由页面控制器稍后生成，这里静默跳过，稍后重试
            return null;
        }

        console.log('💪 创建强力上传按钮...');

        // 克隆按钮并完全重写
        const forceButton = originalButton.cloneNode(true);
        forceButton.id = 'imageUploadButton';
        forceButton.disabled = false;
        forceButton.style.cssText = `
            ${originalButton.style.cssText};
            opacity: 1 !important;
            pointer-events: auto !important;
            background-color: #007bff !important;
            cursor: pointer !important;
        `;
        forceButton.title = '图片上传 (强力修复版)';

        // 替换原按钮
        if (originalButton.parentNode) {
            originalButton.parentNode.replaceChild(forceButton, originalButton);
        }

        // 添加强力事件监听
        forceButton.addEventListener('click', handleForceUpload, true);
        forceButton.addEventListener('touchstart', handleForceUpload, true);
        forceButton.addEventListener('touchend', handleForceUpload, true);

        // 防止按钮被其他脚本禁用
        Object.defineProperty(forceButton, 'disabled', {
            get: () => false,
            set: () => {
                console.log('💪 阻止按钮被禁用');
                return false;
            }
        });

    return forceButton;
    }

    // 显示图片来源选择菜单 - 主流底部滑出样式
    function showImageSourceModal() {
        // 检查是否已有模态框
        let existingModal = document.getElementById('forceImageSourceModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'forceImageSourceModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.4);
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: flex-end;
            padding: 0;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        const actionSheet = document.createElement('div');
        actionSheet.className = 'action-sheet';
        actionSheet.style.cssText = `
            background: white;
            width: 100%;
            border-radius: 20px 20px 0 0;
            padding: 0;
            margin: 0;
            transform: translateY(100%);
            transition: transform 0.3s ease;
            box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.2);
            max-width: 500px;
        `;

        actionSheet.innerHTML = `
            <div class="action-sheet-header" style="
                padding: 20px 20px 10px 20px;
                border-bottom: 1px solid #f0f0f0;
                text-align: center;
            ">
                <div class="handle" style="
                    width: 40px;
                    height: 4px;
                    background: #ddd;
                    border-radius: 2px;
                    margin: 0 auto 15px auto;
                "></div>
                <h4 style="
                    margin: 0;
                    font-size: 18px;
                    color: #333;
                    font-weight: 600;
                ">选择图片</h4>
            </div>
            
            <div class="action-sheet-content" style="padding: 10px 0 30px 0;">
                <div class="action-item camera-btn" style="
                    display: flex;
                    align-items: center;
                    padding: 15px 25px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    border: none;
                    background: none;
                    width: 100%;
                    text-align: left;
                " data-action="camera">
                    <div style="
                        width: 50px;
                        height: 50px;
                        background: linear-gradient(135deg, #007bff, #0056b3);
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 15px;
                        font-size: 24px;
                    ">📷</div>
                    <div>
                        <div style="font-size: 16px; font-weight: 500; color: #333; margin-bottom: 2px;">
                            拍照
                        </div>
                        <div style="font-size: 13px; color: #666;">
                            使用相机拍摄照片
                        </div>
                    </div>
                </div>
                
                <div class="action-item gallery-btn" style="
                    display: flex;
                    align-items: center;
                    padding: 15px 25px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    border: none;
                    background: none;
                    width: 100%;
                    text-align: left;
                " data-action="gallery">
                    <div style="
                        width: 50px;
                        height: 50px;
                        background: linear-gradient(135deg, #28a745, #1e7e34);
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 15px;
                        font-size: 24px;
                    ">🖼️</div>
                    <div>
                        <div style="font-size: 16px; font-weight: 500; color: #333; margin-bottom: 2px;">
                            从相册选择
                        </div>
                        <div style="font-size: 13px; color: #666;">
                            选择已有的图片
                        </div>
                    </div>
                </div>
                
                <div class="action-item cancel-btn" style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 15px 25px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    border-top: 1px solid #f0f0f0;
                    margin-top: 10px;
                    border: none;
                    background: none;
                    width: 100%;
                " data-action="cancel">
                    <div style="font-size: 16px; color: #666; font-weight: 500;">
                        取消
                    </div>
                </div>
            </div>
        `;

        modal.appendChild(actionSheet);
        document.body.appendChild(modal);

        // 添加点击效果
        const actionItems = actionSheet.querySelectorAll('.action-item');
        actionItems.forEach(item => {
            item.addEventListener('touchstart', function() {
                this.style.backgroundColor = '#f8f9fa';
            });
            
            item.addEventListener('touchend', function() {
                setTimeout(() => {
                    this.style.backgroundColor = 'transparent';
                }, 150);
            });
            
            item.addEventListener('mouseenter', function() {
                if (!('ontouchstart' in window)) {
                    this.style.backgroundColor = '#f8f9fa';
                }
            });
            
            item.addEventListener('mouseleave', function() {
                if (!('ontouchstart' in window)) {
                    this.style.backgroundColor = 'transparent';
                }
            });
        });

        // 动画显示
        setTimeout(() => {
            modal.style.opacity = '1';
            actionSheet.style.transform = 'translateY(0)';
        }, 10);

        // 事件处理
        function closeModal() {
            modal.style.opacity = '0';
            actionSheet.style.transform = 'translateY(100%)';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }

        // 按钮点击事件
        actionSheet.addEventListener('click', function(e) {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            closeModal();

            setTimeout(() => {
                if (action === 'camera') {
                    console.log('💪 用户选择相机拍照');
                    const cameraInput = document.getElementById('cameraFileInput');
                    if (cameraInput) {
                        cameraInput.click();
                    }
                } else if (action === 'gallery') {
                    console.log('💪 用户选择从相册');
                    const fileInput = document.getElementById('imageFileInput');
                    if (fileInput) {
                        fileInput.click();
                    }
                }
            }, 100);
        });

        // 点击背景关闭
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });

        // 向下滑动关闭
        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        actionSheet.addEventListener('touchstart', function(e) {
            startY = e.touches[0].clientY;
            isDragging = true;
        });

        actionSheet.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            if (deltaY > 0) {
                actionSheet.style.transform = `translateY(${deltaY}px)`;
            }
        });

        actionSheet.addEventListener('touchend', function() {
            if (!isDragging) return;
            
            const deltaY = currentY - startY;
            isDragging = false;
            
            if (deltaY > 100) {
                closeModal();
            } else {
                actionSheet.style.transform = 'translateY(0)';
            }
        });

        // ESC 键关闭
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    }

    // 强力上传处理函数
    function handleForceUpload(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        console.log('💪 强力上传被触发:', e.type);

        // 只处理主要的点击事件
        if (e.type !== 'click' && e.type !== 'touchend') {
            return;
        }

        const fileInput = document.getElementById('imageFileInput');
        const cameraInput = document.getElementById('cameraFileInput');

        if (!fileInput) {
            console.error('未找到文件输入元素');
            alert('文件输入元素不存在');
            return;
        }

        try {
            if (isMobile() && cameraInput) {
                console.log('💪 移动设备：显示选择菜单');
                showImageSourceModal();
            } else {
                console.log('💪 桌面设备：触发文件输入');
                fileInput.click();
            }
        } catch (error) {
            console.error('强力上传出错:', error);
            // 备用方案：直接触发文件输入
            fileInput.click();
        }
    }

    // 强力文件输入处理
    function setupForceFileInputs() {
        const fileInput = document.getElementById('imageFileInput');
        const cameraInput = document.getElementById('cameraFileInput');

        function createForceFileHandler(input, source) {
            if (!input) return;

            const handler = function(e) {
                const files = e.target.files;
                console.log(`💪 ${source} 文件选择事件:`, files?.length || 0, '个文件');

                if (files && files.length > 0) {
                    const file = files[0];
                    console.log(`💪 选择了文件:`, {
                        name: file.name,
                        size: file.size,
                        type: file.type
                    });

                    // 尝试多种方式调用上传函数
                    let uploaded = false;

                    // 方式1：全局函数
                    if (typeof window.uploadAndSendImage === 'function') {
                        console.log('💪 使用全局上传函数');
                        window.uploadAndSendImage(file);
                        uploaded = true;
                    }
                    // 方式2：直接调用
                    else if (typeof uploadAndSendImage === 'function') {
                        console.log('💪 使用直接上传函数');
                        uploadAndSendImage(file);
                        uploaded = true;
                    }
                    // 方式3：手动上传
                    else {
                        console.log('💪 使用手动上传');
                        manualUpload(file);
                        uploaded = true;
                    }

                    if (!uploaded) {
                        console.error('💪 所有上传方式都失败');
                        alert('上传功能暂时不可用，请刷新页面重试');
                    }
                }

                // 清空文件输入
                e.target.value = '';
            };

            // 移除现有事件监听器
            const newInput = input.cloneNode(true);
            if (input.parentNode) {
                input.parentNode.replaceChild(newInput, input);
            }

            // 添加新的事件监听器
            newInput.addEventListener('change', handler);
            
            return newInput;
        }

        createForceFileHandler(fileInput, '文件');
        if (cameraInput) {
            createForceFileHandler(cameraInput, '相机');
        }
    }

    // 手动上传实现
    function manualUpload(file) {
        console.log('💪 执行手动上传:', file.name);

        // 创建FormData
        const formData = new FormData();
        formData.append('file', file);

        // 获取token
        const token = localStorage.getItem('dify_access_token') || localStorage.getItem('access_token');
        if (!token) {
            alert('未找到访问令牌，请重新登录');
            return;
        }

        // 构建上传URL
        const apiUrl = window.ENV_CONFIG?.getApiUrl?.() || 'http://localhost:4005/api';
        const uploadUrl = `${apiUrl}/files/upload`;

        console.log('💪 上传到:', uploadUrl);

        // 显示上传提示
        const uploadStatus = document.createElement('div');
        uploadStatus.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 9999;
        `;
        uploadStatus.textContent = '正在上传图片...';
        document.body.appendChild(uploadStatus);

        // 执行上传
        fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`上传失败: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            console.log('💪 上传成功:', result);
            uploadStatus.textContent = '上传成功！';
            setTimeout(() => {
                if (uploadStatus.parentNode) {
                    uploadStatus.parentNode.removeChild(uploadStatus);
                }
            }, 2000);

            // 尝试发送消息
            const messageData = {
                content: `发送了图片: ${file.name}`,
                type: 'image',
                attachments: [result.id]
            };

            // 如果有WebSocket连接，尝试发送
            if (window.chatroomController?.websocket) {
                const roomData = {
                    roomId: window.chatroomController.currentRoom?.id,
                    ...messageData,
                    timestamp: Date.now()
                };
                window.chatroomController.websocket.emit('send-message', roomData);
                console.log('💪 通过WebSocket发送图片消息');
            } else {
                console.log('💪 上传完成，但无法自动发送消息');
                alert('图片上传成功，但无法自动发送，请手动发送消息');
            }
        })
        .catch(error => {
            console.error('💪 上传失败:', error);
            uploadStatus.textContent = '上传失败！';
            setTimeout(() => {
                if (uploadStatus.parentNode) {
                    uploadStatus.parentNode.removeChild(uploadStatus);
                }
            }, 3000);
            alert(`上传失败: ${error.message}`);
        });
    }

    // 防止页面其他脚本干扰
    function preventInterference() {
        // 定期强制启用按钮
        setInterval(() => {
            const button = document.getElementById('imageUploadButton');
            if (button && button.disabled) {
                console.log('💪 检测到按钮被禁用，强制重新启用');
                button.disabled = false;
                button.style.opacity = '1';
                button.style.pointerEvents = 'auto';
            }
        }, 500);

        // 修复移动端图片显示问题
        fixMobileImageDisplay();

        // 监控DOM变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    mutation.target.id === 'imageUploadButton') {
                    
                    const button = mutation.target;
                    if (button.disabled) {
                        console.log('💪 DOM监控：强制启用按钮');
                        button.disabled = false;
                        button.style.opacity = '1';
                        button.style.pointerEvents = 'auto';
                    }
                }

                // 监控新增的图片元素
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const images = node.querySelectorAll ? 
                            node.querySelectorAll('img.message-image') : 
                            (node.classList && node.classList.contains('message-image') ? [node] : []);

                        images.forEach(img => {
                            console.log('💪 检测到新图片元素，应用移动端修复');
                            fixSingleMobileImage(img);
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'style', 'src']
        });
    }

    // 修复移动端图片显示
    function fixMobileImageDisplay() {
        console.log('💪 开始修复移动端图片显示...');

        // 修复现有图片
        const images = document.querySelectorAll('img.message-image');
        console.log(`💪 找到 ${images.length} 个图片元素`);

        images.forEach((img, index) => {
            console.log(`💪 修复图片 ${index + 1}:`, img.src);
            fixSingleMobileImage(img);
        });

        // 定期检查和修复图片
        setInterval(() => {
            const brokenImages = document.querySelectorAll('img.message-image[src=""], img.message-image:not([src])');
            if (brokenImages.length > 0) {
                console.log(`💪 发现 ${brokenImages.length} 个损坏图片，重新修复`);
                brokenImages.forEach(fixSingleMobileImage);
            }
        }, 3000);
    }

    // 修复单个移动端图片
    function fixSingleMobileImage(img) {
        if (!img || img.dataset.forcFixed) return;

        img.dataset.forcFixed = 'true';
        console.log('💪 修复单个图片:', img.src || '无src');

        // 移动端图片样式修复 - 使用更强的优先级
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            img.message-image {
                max-width: 250px !important;
                max-height: 200px !important;
                width: auto !important;
                height: auto !important;
                object-fit: cover !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                z-index: 10 !important;
                background: white !important;
                border: 1px solid #ddd !important;
            }
        `;
        if (!document.head.querySelector('style[data-force-image-fix]')) {
            styleSheet.setAttribute('data-force-image-fix', 'true');
            document.head.appendChild(styleSheet);
        }

        // 立即应用样式
        Object.assign(img.style, {
            maxWidth: '250px',
            maxHeight: '200px',
            width: 'auto',
            height: 'auto',
            objectFit: 'cover',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'block',
            visibility: 'visible',
            opacity: '1',
            position: 'relative',
            zIndex: '10',
            background: 'white',
            border: '1px solid #ddd'
        });

        // 如果图片没有src或src为空，尝试重新构建
        if (!img.src || img.src.includes('data:') || img.src === window.location.href || img.src.endsWith('/chatroom.html')) {
            console.log('💪 图片URL异常，尝试重新构建');
            
            // 尝试从父元素或相关属性获取信息
            const messageElement = img.closest('.message');
            if (messageElement && messageElement.localMessage && messageElement.localMessage.attachments) {
                const attachment = messageElement.localMessage.attachments[0];
                if (attachment) {
                    const newUrl = buildImageUrl(attachment);
                    if (newUrl) {
                        console.log('💪 重新构建图片URL:', newUrl);
                        img.src = newUrl;
                    }
                }
            } else {
                // 尝试从DOM属性中获取附件ID
                const attachmentId = img.getAttribute('data-attachment-id') || 
                                   img.getAttribute('data-file-id') ||
                                   img.closest('[data-attachment-id]')?.getAttribute('data-attachment-id');
                
                if (attachmentId) {
                    const newUrl = buildImageUrl(attachmentId);
                    if (newUrl) {
                        console.log('💪 从DOM属性重新构建图片URL:', newUrl);
                        img.src = newUrl;
                    }
                }
            }
        }

        // 强制重新加载图片
        const originalSrc = img.src;
        if (originalSrc && !originalSrc.includes('data:')) {
            // 添加时间戳防止缓存
            const separator = originalSrc.includes('?') ? '&' : '?';
            const timestamp = Date.now();
            img.src = `${originalSrc}${separator}_t=${timestamp}`;
            
            console.log('💪 强制重新加载图片:', img.src);
        }

        // 图片加载错误处理 - 增强版
        img.onerror = function(e) {
            console.log('💪 图片加载失败，尝试修复URL:', this.src);
            
            const originalSrc = this.src;
            const token = localStorage.getItem('dify_access_token') || localStorage.getItem('access_token');
            
            // 移除时间戳重试
            let cleanSrc = originalSrc.replace(/[?&]_t=\d+/, '');
            
            if (token && !cleanSrc.includes('token=')) {
                const separator = cleanSrc.includes('?') ? '&' : '?';
                const newSrc = `${cleanSrc}${separator}token=${token}`;
                console.log('💪 添加token重试:', newSrc);
                
                // 避免无限循环
                this.dataset.retryCount = (parseInt(this.dataset.retryCount) || 0) + 1;
                
                if (parseInt(this.dataset.retryCount) <= 3) {
                    // 延迟重试，避免快速失败
                    setTimeout(() => {
                        this.src = newSrc;
                    }, 1000 * parseInt(this.dataset.retryCount));
                } else {
                    console.log('💪 重试次数超限，显示错误提示');
                    showImageError(this);
                }
            } else {
                // 尝试其他可能的URL格式
                const baseUrl = window.ENV_CONFIG?.API_BASE_URL || 'http://localhost:4005';
                const apiUrl = window.ENV_CONFIG?.getApiUrl?.() || `${baseUrl}/api`;
                
                // 尝试提取文件ID
                const fileIdMatch = cleanSrc.match(/files\/([^\/\?]+)/);
                if (fileIdMatch && token) {
                    const fileId = fileIdMatch[1];
                    const alternateUrl = `${apiUrl}/files/${fileId}/view?token=${token}`;
                    
                    this.dataset.retryCount = (parseInt(this.dataset.retryCount) || 0) + 1;
                    if (parseInt(this.dataset.retryCount) <= 3) {
                        console.log('💪 尝试备用URL格式:', alternateUrl);
                        setTimeout(() => {
                            this.src = alternateUrl;
                        }, 1000 * parseInt(this.dataset.retryCount));
                        return;
                    }
                }
                
                showImageError(this);
            }
        };

        // 图片加载成功处理
        img.onload = function() {
            console.log('💪 图片加载成功:', this.src);
            // 确保显示样式正确
            this.style.display = 'block';
            this.style.visibility = 'visible';
            this.style.opacity = '1';
        };

        // 强制触发加载检查
        if (img.complete && img.naturalHeight === 0) {
            console.log('💪 图片加载不完整，触发重新加载');
            img.onerror();
        }
    }

    // 构建图片URL
    function buildImageUrl(attachment) {
        const token = localStorage.getItem('dify_access_token') || localStorage.getItem('access_token');
        let imageUrl = '';

        if (typeof attachment === 'object' && attachment !== null) {
            if (attachment.urlWithToken) {
                imageUrl = attachment.urlWithToken;
            } else if (attachment.url && token) {
                const backendUrl = window.ENV_CONFIG?.API_BASE_URL || 'http://localhost:4005';
                const cleanUrl = attachment.url.startsWith('/') ? attachment.url : `/${attachment.url}`;
                imageUrl = `${backendUrl}${cleanUrl}?token=${token}`;
            } else if (attachment.id && token) {
                const apiUrl = window.ENV_CONFIG?.getApiUrl?.() || 'http://localhost:4005/api';
                imageUrl = `${apiUrl}/files/${attachment.id}/view?token=${token}`;
            }
        } else if (typeof attachment === 'string' && token) {
            const apiUrl = window.ENV_CONFIG?.getApiUrl?.() || 'http://localhost:4005/api';
            imageUrl = `${apiUrl}/files/${attachment}/view?token=${token}`;
        }

        return imageUrl;
    }

    // 显示图片错误
    function showImageError(img) {
        if (!img.parentNode) return;

        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            padding: 10px 15px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            color: #6c757d;
            font-size: 14px;
            text-align: center;
            max-width: 250px;
            cursor: pointer;
        `;
        errorDiv.innerHTML = '📷 图片无法显示<br><small>点击重试</small>';
        
        errorDiv.onclick = function() {
            // 重新尝试加载
            img.dataset.forcFixed = '';
            img.dataset.retryCount = '';
            errorDiv.style.display = 'none';
            fixSingleMobileImage(img);
        };

        img.style.display = 'none';
        img.parentNode.insertBefore(errorDiv, img);
    }

    // 初始化强力修复
    function initForceMode() {
        console.log('💪 初始化强力修复模式...');

        // 等待页面完全加载
        if (document.readyState !== 'complete') {
            window.addEventListener('load', initForceMode);
            return;
        }

        try {
            const btn = createForceUploadButton();
            if (!btn) {
                // 若未找到按钮，稍后再试一次，最多重试3次
                let retries = 0;
                const retry = () => {
                    const n = createForceUploadButton();
                    retries++;
                    if (!n && retries < 3) setTimeout(retry, 1000);
                };
                setTimeout(retry, 800);
            }
            setupForceFileInputs();
            preventInterference();

            console.log('💪 强力修复初始化完成！');
        } catch (error) {
            console.error('💪 强力修复失败:', error);
        }
    }

    // 等待DOM加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initForceMode, 1000); // 延迟1秒确保其他脚本完成初始化
        });
    } else {
        setTimeout(initForceMode, 1000);
    }

    // 导出到全局供调试
    window.forceUploadFix = {
        init: initForceMode,
        upload: manualUpload,
        isMobile: isMobile
    };

})();
