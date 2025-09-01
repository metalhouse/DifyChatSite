// 移动端图片功能调试工具

(function() {
    'use strict';

    console.log('🔍 移动端图片调试工具开始运行...');

    // 创建调试面板
    function createDebugPanel() {
        // 检查是否已存在调试面板
        if (document.getElementById('mobileDebugPanel')) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'mobileDebugPanel';
        panel.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            width: 300px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 9999;
            font-size: 12px;
            max-height: 400px;
            overflow-y: auto;
            display: none;
        `;

        const toggle = document.createElement('button');
        toggle.textContent = '🔍';
        toggle.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 18px;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;

        toggle.onclick = function() {
            const isVisible = panel.style.display === 'block';
            panel.style.display = isVisible ? 'none' : 'block';
            updateDebugInfo();
        };

        document.body.appendChild(toggle);
        document.body.appendChild(panel);
    }

    // 更新调试信息
    function updateDebugInfo() {
        const panel = document.getElementById('mobileDebugPanel');
        if (!panel || panel.style.display === 'none') return;

        const info = gatherDebugInfo();
        panel.innerHTML = `
            <h6>📱 移动端图片调试信息</h6>
            <hr>
            
            <div><strong>设备检测:</strong></div>
            <div>• 用户代理: ${info.userAgent}</div>
            <div>• 是移动设备: ${info.isMobile}</div>
            <div>• 屏幕宽度: ${info.screenWidth}px</div>
            <div>• 触摸支持: ${info.touchSupport}</div>
            <br>
            
            <div><strong>页面元素:</strong></div>
            <div>• 上传按钮: ${info.uploadButton}</div>
            <div>• 文件输入框: ${info.fileInput}</div>
            <div>• 相机输入框: ${info.cameraInput}</div>
            <div>• 聊天消息容器: ${info.chatMessages}</div>
            <br>
            
            <div><strong>Token状态:</strong></div>
            <div>• 访问token: ${info.tokenStatus}</div>
            <div>• 存储keys: ${info.storageKeys}</div>
            <br>
            
            <div><strong>图片统计:</strong></div>
            <div>• 消息图片数量: ${info.imageCount}</div>
            <div>• 加载失败图片: ${info.failedImages}</div>
            <br>
            
            <div><strong>网络状态:</strong></div>
            <div>• 连接状态: ${info.networkStatus}</div>
            <div>• API基础URL: ${info.apiBaseUrl}</div>
            <br>
            
            <button onclick="window.mobileDebugTool.testImageUpload()" 
                    style="width:100%; margin:5px 0; padding:8px; background:#28a745; color:white; border:none; border-radius:4px;">
                测试图片上传
            </button>
            <button onclick="window.mobileDebugTool.testImageUrls()" 
                    style="width:100%; margin:5px 0; padding:8px; background:#007bff; color:white; border:none; border-radius:4px;">
                测试图片URL
            </button>
            <button onclick="window.mobileDebugTool.clearCache()" 
                    style="width:100%; margin:5px 0; padding:8px; background:#ffc107; color:black; border:none; border-radius:4px;">
                清除缓存
            </button>
        `;
    }

    // 收集调试信息
    function gatherDebugInfo() {
        const uploadButton = document.getElementById('imageUploadButton');
        const fileInput = document.getElementById('imageFileInput');
        const cameraInput = document.getElementById('cameraFileInput');
        const chatMessages = document.getElementById('chatMessages');
        
        const token = localStorage.getItem('dify_access_token') || localStorage.getItem('access_token');
        const images = document.querySelectorAll('img.message-image');
        const failedImages = Array.from(images).filter(img => 
            img.complete && img.naturalHeight === 0
        );

        return {
            userAgent: navigator.userAgent.substring(0, 100) + '...',
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            screenWidth: window.innerWidth,
            touchSupport: 'ontouchstart' in window,
            
            uploadButton: uploadButton ? '✅ 存在' : '❌ 缺失',
            fileInput: fileInput ? '✅ 存在' : '❌ 缺失',
            cameraInput: cameraInput ? '✅ 存在' : '❌ 缺失',
            chatMessages: chatMessages ? '✅ 存在' : '❌ 缺失',
            
            tokenStatus: token ? `✅ 有效 (${token.substring(0, 10)}...)` : '❌ 缺失',
            storageKeys: Object.keys(localStorage).filter(k => k.includes('token')).join(', '),
            
            imageCount: images.length,
            failedImages: failedImages.length,
            
            networkStatus: navigator.onLine ? '✅ 在线' : '❌ 离线',
            apiBaseUrl: window.ENV_CONFIG?.API_BASE_URL || window.globalConfig?.getBackendUrl() || '未配置'
        };
    }

    // 测试图片上传功能
    function testImageUpload() {
        console.log('🧪 测试图片上传功能...');
        
        const uploadButton = document.getElementById('imageUploadButton');
        if (!uploadButton) {
            console.error('❌ 上传按钮不存在');
            alert('上传按钮不存在');
            return;
        }

        // 模拟点击上传按钮
        console.log('📱 模拟点击上传按钮...');
        uploadButton.click();
        
        // 检查是否显示了选择模态框或文件输入框
        setTimeout(() => {
            const modal = document.getElementById('imageSourceModal');
            const fileInput = document.getElementById('imageFileInput');
            
            if (modal) {
                console.log('✅ 移动端选择模态框已显示');
                alert('✅ 移动端模态框正常显示');
            } else if (fileInput && fileInput.style.display !== 'none') {
                console.log('✅ 桌面端文件输入框已触发');
                alert('✅ 桌面端文件输入正常');
            } else {
                console.error('❌ 上传功能未正常响应');
                alert('❌ 上传功能未正常响应');
            }
        }, 500);
    }

    // 测试图片URL
    function testImageUrls() {
        console.log('🧪 测试图片URL...');
        
        const images = document.querySelectorAll('img.message-image');
        if (images.length === 0) {
            console.log('ℹ️ 暂无图片消息');
            alert('暂无图片消息可测试');
            return;
        }

        let successCount = 0;
        let failCount = 0;
        
        images.forEach((img, index) => {
            const testImg = new Image();
            testImg.onload = () => {
                console.log(`✅ 图片 ${index + 1} 加载成功:`, img.src);
                successCount++;
            };
            testImg.onerror = () => {
                console.error(`❌ 图片 ${index + 1} 加载失败:`, img.src);
                failCount++;
            };
            testImg.src = img.src;
        });

        setTimeout(() => {
            const message = `图片测试完成:\n成功: ${successCount}\n失败: ${failCount}`;
            console.log(message);
            alert(message);
        }, 2000);
    }

    // 清除缓存
    function clearCache() {
        console.log('🧹 清除缓存...');
        
        // 清除本地存储中的临时数据
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('temp_') || key.includes('cache_') || key.includes('last_'))) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // 清除全局变量
        if (window.sentImageMessages) {
            window.sentImageMessages.clear();
        }
        if (window.lastUploadedFile) {
            delete window.lastUploadedFile;
        }
        
        console.log(`✅ 已清除 ${keysToRemove.length} 个缓存项`);
        alert(`已清除 ${keysToRemove.length} 个缓存项`);
        
        // 刷新调试信息
        updateDebugInfo();
    }

    // 监听图片加载事件
    function monitorImageLoading() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const images = node.querySelectorAll ? 
                            node.querySelectorAll('img.message-image') : 
                            (node.classList && node.classList.contains('message-image') ? [node] : []);

                        images.forEach(function(img) {
                            console.log('🖼️ 新图片元素添加:', img.src);
                            
                            img.onload = () => {
                                console.log('✅ 图片加载成功:', img.src);
                            };
                            
                            img.onerror = () => {
                                console.error('❌ 图片加载失败:', img.src);
                                updateDebugInfo(); // 更新调试信息
                            };
                        });
                    }
                });
            });
        });

        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            observer.observe(chatMessages, {
                childList: true,
                subtree: true
            });
        }
    }

    // 初始化调试工具
    function init() {
        createDebugPanel();
        monitorImageLoading();
        
        // 导出到全局
        window.mobileDebugTool = {
            updateInfo: updateDebugInfo,
            testImageUpload: testImageUpload,
            testImageUrls: testImageUrls,
            clearCache: clearCache,
            gatherInfo: gatherDebugInfo
        };
        
        console.log('✅ 移动端图片调试工具已就绪');
    }

    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
