/**
 * 开发环境配置工具
 * 用于快速配置后端地址和解决常见开发问题
 */

(function() {
    'use strict';
    
    // 开发环境检测
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' || 
                         window.location.hostname.startsWith('192.168.') ||
                         window.location.hostname.startsWith('10.') ||
                         window.location.hostname.startsWith('172.');

    // 开发工具配置
    const DEV_CONFIG = {
        // 常用的后端地址配置
        BACKEND_URLS: {
            localhost: 'http://localhost:4005',
            current_ip: `http://${window.location.hostname}:4005`,
            custom: null // 用户自定义
        },
        
        // 开发环境默认设置
        DEFAULTS: {
            enableCORS: true,
            enableDebugLogs: true,
            bypassSSLWarnings: true
        }
    };

    // 自动配置后端地址
    function autoConfigureBackend() {
        if (!isDevelopment) return;
        
        console.log('🔧 开发环境自动配置...');
        
        // 获取当前最适合的后端地址
        const currentBackend = window.getCurrentBackendUrl ? window.getCurrentBackendUrl() : null;
        const recommendedBackend = DEV_CONFIG.BACKEND_URLS.current_ip;
        
        console.log('当前后端地址:', currentBackend);
        console.log('推荐后端地址:', recommendedBackend);
        
        // 如果当前使用的是localhost，但访问IP不是localhost，自动切换
        if (currentBackend && currentBackend.includes('localhost') && 
            window.location.hostname !== 'localhost' && 
            window.location.hostname !== '127.0.0.1') {
            
            console.log('🔄 检测到IP访问，自动切换后端地址...');
            if (window.updateBackendUrl) {
                window.updateBackendUrl(recommendedBackend);
                
                // 显示切换提示
                showConfigMessage(`已自动切换后端地址到: ${recommendedBackend}`, 'info');
                
                // 3秒后刷新页面
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            }
        }
    }

    // 显示配置消息
    function showConfigMessage(message, type = 'info') {
        const alertClass = type === 'error' ? 'alert-danger' : 
                          type === 'warning' ? 'alert-warning' : 
                          type === 'success' ? 'alert-success' : 'alert-info';
        
        const alert = document.createElement('div');
        alert.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
        alert.style.cssText = 'top: 60px; left: 20px; right: 20px; z-index: 9998;';
        alert.innerHTML = `
            <i class="fas fa-tools me-2"></i>
            <strong>开发工具:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alert);
        
        // 5秒后自动移除
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    // 创建开发工具面板
    function createDevToolsPanel() {
        if (!isDevelopment) return;
        
        const panel = document.createElement('div');
        panel.id = 'dev-tools-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            border-radius: 10px;
            font-size: 12px;
            max-width: 300px;
            z-index: 9999;
            display: none;
        `;
        
        panel.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <strong>🔧 开发工具</strong>
                <button class="btn btn-sm btn-outline-light" onclick="this.parentNode.parentNode.style.display='none'">×</button>
            </div>
            <div class="mb-2">
                <small>当前后端: <span id="current-backend">检测中...</span></small>
            </div>
            <div class="btn-group-vertical w-100" role="group">
                <button class="btn btn-sm btn-outline-light mb-1" onclick="window.devTools.switchToLocalhost()">
                    切换到 Localhost
                </button>
                <button class="btn btn-sm btn-outline-light mb-1" onclick="window.devTools.switchToCurrentIP()">
                    切换到当前IP
                </button>
                <button class="btn btn-sm btn-outline-light mb-1" onclick="window.devTools.testConnection()">
                    测试连接
                </button>
                <button class="btn btn-sm btn-outline-light" onclick="window.devTools.showConfig()">
                    显示配置
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // 更新当前后端显示
        const updateCurrentBackend = () => {
            const backendSpan = document.getElementById('current-backend');
            if (backendSpan) {
                backendSpan.textContent = window.getCurrentBackendUrl ? window.getCurrentBackendUrl() : '未知';
            }
        };
        
        updateCurrentBackend();
        setInterval(updateCurrentBackend, 2000);
    }

    // 开发工具方法
    window.devTools = {
        switchToLocalhost() {
            if (window.updateBackendUrl) {
                window.updateBackendUrl(DEV_CONFIG.BACKEND_URLS.localhost);
                showConfigMessage('已切换到 localhost:4005，3秒后刷新页面', 'success');
                setTimeout(() => window.location.reload(), 3000);
            }
        },
        
        switchToCurrentIP() {
            if (window.updateBackendUrl) {
                window.updateBackendUrl(DEV_CONFIG.BACKEND_URLS.current_ip);
                showConfigMessage(`已切换到 ${DEV_CONFIG.BACKEND_URLS.current_ip}，3秒后刷新页面`, 'success');
                setTimeout(() => window.location.reload(), 3000);
            }
        },
        
        async testConnection() {
            showConfigMessage('正在测试后端连接...', 'info');
            
            try {
                const isConnected = window.checkBackendConnection ? 
                    await window.checkBackendConnection() : false;
                
                if (isConnected) {
                    showConfigMessage('✅ 后端连接正常', 'success');
                } else {
                    showConfigMessage('❌ 后端连接失败，请检查服务器状态', 'error');
                }
            } catch (error) {
                showConfigMessage(`连接测试失败: ${error.message}`, 'error');
            }
        },
        
        showConfig() {
            if (window.showConfig) {
                window.showConfig();
                showConfigMessage('配置信息已输出到控制台', 'info');
            }
        },
        
        togglePanel() {
            const panel = document.getElementById('dev-tools-panel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        }
    };

    // 添加快捷键支持 (Ctrl+Shift+D)
    function addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
                e.preventDefault();
                window.devTools.togglePanel();
            }
        });
    }

    // 初始化开发工具
    function initDevTools() {
        if (!isDevelopment) {
            console.log('🏭 生产环境，开发工具已禁用');
            return;
        }
        
        console.log('🔧 开发工具已启用');
        console.log('快捷键: Ctrl+Shift+D 显示/隐藏开发面板');
        
        // 延迟初始化，等待页面加载完成
        setTimeout(() => {
            autoConfigureBackend();
            createDevToolsPanel();
            addKeyboardShortcuts();
            
            // 只在环境变量明确启用时才显示开发工具提示
            if (window.ENV_CONFIG?.SHOW_DEV_TOOLS_NOTIFICATION) {
                showConfigMessage('开发工具已加载，按 Ctrl+Shift+D 显示工具面板', 'info');
            }
        }, 1000);
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDevTools);
    } else {
        initDevTools();
    }

})();
