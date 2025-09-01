// 移动端图片上传和显示修复脚本

(function() {
    'use strict';

    console.log('🔧 移动端图片修复脚本开始加载...');

    // 检测移动设备
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) ||
               window.innerWidth <= 768;
    }

    // 修复移动端文件输入点击问题
    function fixMobileFileInput() {
        const imageUploadButton = document.getElementById('imageUploadButton');
        const imageFileInput = document.getElementById('imageFileInput');
        const cameraFileInput = document.getElementById('cameraFileInput');

        if (!imageUploadButton) {
            console.warn('⚠️ 未找到图片上传按钮');
            return;
        }

        if (!imageFileInput) {
            console.warn('⚠️ 未找到图片文件输入框');
            return;
        }

        console.log('🔧 开始修复移动端文件输入...');

        // 立即绑定按钮事件
        bindButtonEvents(imageUploadButton);

        // 为文件输入框添加移动端优化的change事件
        function handleFileSelect(input, source) {
            // 移除现有事件监听器
            const newInput = input.cloneNode(true);
            if (input.parentNode) {
                input.parentNode.replaceChild(newInput, input);
            }

            newInput.addEventListener('change', function(e) {
                const files = e.target.files;
                if (files && files.length > 0) {
                    const file = files[0];
                    console.log(`📱 ${source} 文件选择:`, {
                        name: file.name,
                        size: file.size,
                        type: file.type
                    });

                    // 调用全局的上传函数
                    if (typeof uploadAndSendImage === 'function') {
                        uploadAndSendImage(file);
                    } else if (window.uploadAndSendImage) {
                        window.uploadAndSendImage(file);
                    } else {
                        console.error('❌ 未找到图片上传函数');
                        alert('上传功能暂时不可用，请刷新页面重试');
                    }
                }
                // 清空input值，允许重复选择相同文件
                e.target.value = '';
            });

            return newInput;
        }

        // 重新绑定文件输入事件
        const newImageFileInput = handleFileSelect(imageFileInput, '图库');
        if (cameraFileInput) {
            const newCameraFileInput = handleFileSelect(cameraFileInput, '相机');
        }

        console.log('✅ 移动端文件输入修复完成');
    }

    // 修复移动端图片URL显示问题
    function fixMobileImageUrls() {
        // 增强图片错误处理
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 查找新添加的图片元素
                        const images = node.querySelectorAll ? 
                            node.querySelectorAll('img.message-image') : 
                            (node.classList && node.classList.contains('message-image') ? [node] : []);

                        images.forEach(function(img) {
                            fixImageLoading(img);
                        });
                    }
                });
            });
        });

        // 监听聊天消息容器的变化
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            observer.observe(chatMessages, {
                childList: true,
                subtree: true
            });
        }

        // 修复已存在的图片
        document.querySelectorAll('img.message-image').forEach(fixImageLoading);
    }

    // 修复单个图片的加载问题
    function fixImageLoading(img) {
        if (!img || !img.src || img.dataset.fixed) {
            return;
        }

        // 标记为已修复，避免重复处理
        img.dataset.fixed = 'true';

        console.log('🖼️ 修复图片加载:', img.src);

        // 添加加载状态
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'image-loading';
        loadingDiv.textContent = '图片加载中...';
        loadingDiv.style.display = 'none';

        // 安全地插入loading元素
        if (img.parentNode) {
            img.parentNode.insertBefore(loadingDiv, img);
        }

        // 显示加载状态
        img.style.display = 'none';
        if (loadingDiv.parentNode) {
            loadingDiv.style.display = 'block';
        }

        // 创建新的图片对象来测试URL
        const testImg = new Image();
        
        testImg.onload = function() {
            console.log('✅ 图片加载成功:', img.src);
            if (img.parentNode) {
                img.style.display = 'block';
            }
            if (loadingDiv && loadingDiv.parentNode) {
                loadingDiv.style.display = 'none';
            }
        };

        testImg.onerror = function() {
            console.error('❌ 图片加载失败:', img.src);
            
            // 尝试重新构建URL
            const originalSrc = img.src;
            let newSrc = '';

            // 检查是否需要添加token
            const token = localStorage.getItem('dify_access_token') || localStorage.getItem('access_token');
            
            if (token && !originalSrc.includes('token=')) {
                const separator = originalSrc.includes('?') ? '&' : '?';
                newSrc = `${originalSrc}${separator}token=${token}`;
                
                console.log('🔄 尝试添加token重新加载:', newSrc);
                
                // 重新测试带token的URL
                const retryImg = new Image();
                retryImg.onload = function() {
                    console.log('✅ 带token的图片加载成功:', newSrc);
                    if (img.parentNode) {
                        img.src = newSrc;
                        img.style.display = 'block';
                    }
                    if (loadingDiv && loadingDiv.parentNode) {
                        loadingDiv.style.display = 'none';
                    }
                };
                retryImg.onerror = function() {
                    console.error('❌ 带token的图片也加载失败:', newSrc);
                    showImageError(img, loadingDiv);
                };
                retryImg.src = newSrc;
            } else {
                showImageError(img, loadingDiv);
            }
        };

        testImg.src = img.src;
    }

    // 显示图片错误信息
    function showImageError(img, loadingDiv) {
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.style.display = 'none';
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'image-error-message';
        errorDiv.innerHTML = '📷 图片暂时无法显示<br><small>点击重试</small>';
        
        errorDiv.onclick = function() {
            // 重新尝试加载
            errorDiv.style.display = 'none';
            img.dataset.fixed = '';  // 重置修复状态
            fixImageLoading(img);
        };

        // 安全地插入错误元素
        if (img && img.parentNode) {
            img.parentNode.insertBefore(errorDiv, img);
            img.style.display = 'none';
        } else {
            console.warn('⚠️ 无法显示图片错误信息：图片元素已被移除');
        }
    }

    // 修复移动端触摸事件
    function fixMobileTouchEvents() {
        // 防止移动端双击缩放影响图片点击
        document.addEventListener('touchstart', function(e) {
            if (e.target.classList.contains('message-image')) {
                e.preventDefault();
            }
        }, { passive: false });

        // 优化图片点击体验
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('message-image')) {
                e.stopPropagation();
                // 触发原有的图片点击事件（放大功能）
            }
        });
    }

    // 页面加载完成后执行修复
    function initMobileFix() {
        console.log('📱 检测到移动设备，应用修复...');
        
        try {
            fixMobileFileInput();
            fixMobileImageUrls();
            fixMobileTouchEvents();
            
            // 启动强力按钮监控
            startPersistentButtonMonitoring();
            
            console.log('✅ 移动端图片修复完成');
        } catch (error) {
            console.error('❌ 移动端图片修复出错:', error);
        }
    }

    // 持久性按钮监控
    function startPersistentButtonMonitoring() {
        console.log('🔧 启动持久性按钮监控...');
        
        // 每秒检查按钮状态
        const strongMonitor = setInterval(() => {
            const button = document.getElementById('imageUploadButton');
            if (button) {
                // 强制启用按钮
                if (button.disabled) {
                    console.log('🔧 强制启用被禁用的按钮');
                    button.disabled = false;
                }
                
                // 确保样式正确
                if (button.style.opacity !== '1') {
                    button.style.opacity = '1';
                }
                
                if (button.style.pointerEvents !== 'auto') {
                    button.style.pointerEvents = 'auto';
                }
                
                // 确保有点击事件监听器
                if (!button.dataset.mobileFixed) {
                    console.log('🔧 重新绑定按钮事件');
                    bindButtonEvents(button);
                    button.dataset.mobileFixed = 'true';
                }
            }
        }, 1000);

        // 使用MutationObserver监控DOM变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    mutation.target.id === 'imageUploadButton' && 
                    mutation.attributeName === 'disabled') {
                    
                    const button = mutation.target;
                    if (button.disabled) {
                        console.log('🔧 检测到按钮被禁用，立即重新启用');
                        setTimeout(() => {
                            button.disabled = false;
                            button.style.opacity = '1';
                            button.style.pointerEvents = 'auto';
                        }, 0);
                    }
                }
                
                // 检查新增的按钮元素
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const buttons = node.querySelectorAll ? 
                            node.querySelectorAll('#imageUploadButton') : 
                            (node.id === 'imageUploadButton' ? [node] : []);
                        
                        buttons.forEach(button => {
                            console.log('🔧 检测到新的上传按钮，应用修复');
                            setTimeout(() => {
                                button.disabled = false;
                                button.style.opacity = '1';
                                button.style.pointerEvents = 'auto';
                                bindButtonEvents(button);
                                button.dataset.mobileFixed = 'true';
                            }, 100);
                        });
                    }
                });
            });
        });

        // 监控整个文档的变化
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled']
        });

        // 10分钟后停止强力监控，改为轻量监控
        setTimeout(() => {
            clearInterval(strongMonitor);
            console.log('🔧 切换到轻量监控模式');
            
            // 轻量监控每5秒检查一次
            setInterval(() => {
                const button = document.getElementById('imageUploadButton');
                if (button && button.disabled) {
                    console.log('🔧 轻量监控：重新启用按钮');
                    button.disabled = false;
                    button.style.opacity = '1';
                    button.style.pointerEvents = 'auto';
                }
            }, 5000);
        }, 600000);
    }

    // 绑定按钮事件
    function bindButtonEvents(button) {
        // 移除现有的事件监听器
        const newButton = button.cloneNode(true);
        if (button.parentNode) {
            button.parentNode.replaceChild(newButton, button);
        }

        // 强制启用新按钮
        newButton.disabled = false;
        newButton.style.opacity = '1';
        newButton.style.pointerEvents = 'auto';
        newButton.dataset.mobileFixed = 'true';

        // 添加新的事件监听器
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('📱 移动端图片上传按钮被点击');

            const fileInput = document.getElementById('imageFileInput');
            const cameraInput = document.getElementById('cameraFileInput');

            if (isMobileDevice() && cameraInput) {
                console.log('📱 使用移动端相机输入');
                cameraInput.click();
            } else if (fileInput) {
                console.log('💻 使用文件输入');
                fileInput.click();
            } else {
                console.error('❌ 未找到文件输入元素');
                alert('上传功能暂时不可用');
            }
        }, { passive: false });

        return newButton;
    }

    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileFix);
    } else {
        initMobileFix();
    }

    // 导出修复函数供外部调用
    window.mobileImageFix = {
        fixFileInput: fixMobileFileInput,
        fixImageUrls: fixMobileImageUrls,
        isMobile: isMobileDevice
    };

})();
