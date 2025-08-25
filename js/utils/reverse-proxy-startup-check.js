/**
 * 反代部署启动检查脚本
 * 在页面加载时自动检查反代环境配置
 */

(function() {
    'use strict';
    
    // 反代配置检查
    function checkReverseProxySetup() {
        const hostname = window.location.hostname;
        const isReverseProxy = hostname === 'nas.pznas.com';
        
        if (isReverseProxy) {
            console.log('🌐 检测到反代环境: nas.pznas.com');
            
            // 设置环境标识
            window.ENVIRONMENT = 'production';
            window.DEPLOYMENT_TYPE = 'reverse-proxy';
            
            // 显示反代环境信息
            if (sessionStorage.getItem('reverse-proxy-welcome-shown') !== 'true') {
                console.log('🔧 反代部署环境信息:');
                console.log('  域名: https://nas.pznas.com:7990');
                console.log('  后端: https://nas.pznas.com:7990/api');
                console.log('  WebSocket: wss://nas.pznas.com:7990/ws');
                console.log('  配置: 生产环境，启用HTTPS');
                
                sessionStorage.setItem('reverse-proxy-welcome-shown', 'true');
            }
            
            // 动态加载反代配置
            const script = document.createElement('script');
            script.type = 'module';
            script.src = './config/reverse-proxy-config.js';
            script.onload = function() {
                console.log('✅ 反代配置已加载');
                
                // 5秒后运行诊断
                setTimeout(() => {
                    if (window.runReverseProxyDiagnostics && !window.DIAGNOSTICS_RAN) {
                        console.log('🔍 开始反代环境诊断...');
                        window.runReverseProxyDiagnostics().then(report => {
                            window.DIAGNOSTICS_RAN = true;
                            if (report.summary.overall === 'poor') {
                                console.warn('⚠️ 反代环境存在问题，请检查配置');
                            } else {
                                console.log('✅ 反代环境运行正常');
                            }
                        }).catch(error => {
                            console.error('❌ 反代诊断失败:', error);
                        });
                    }
                }, 5000);
            };
            script.onerror = function() {
                console.warn('⚠️ 反代配置加载失败，使用默认配置');
            };
            document.head.appendChild(script);
            
            // 设置后端URL到meta标签
            const backendUrl = 'https://nas.pznas.com:7990';
            const metaBackend = document.querySelector('meta[name="backend-url"]');
            if (metaBackend) {
                metaBackend.setAttribute('content', backendUrl);
            }
            
            // 设置全局配置
            window.PRODUCTION_API_URL = backendUrl;
            window.PRODUCTION_WS_URL = 'wss://nas.pznas.com:7990';
            
            return true;
        }
        
        return false;
    }
    
    // 安全检查
    function checkSecurityRequirements() {
        const isHTTPS = window.location.protocol === 'https:';
        const isDevelopment = window.location.hostname === 'localhost' || 
                             window.location.hostname === '127.0.0.1';
        
        if (!isHTTPS && !isDevelopment) {
            console.warn('🔒 安全警告: 生产环境应使用HTTPS协议');
            
            // 显示安全提示
            const securityBanner = document.createElement('div');
            securityBanner.innerHTML = `
                <div class="alert alert-warning alert-dismissible fade show position-fixed w-100" 
                     style="top: 0; z-index: 9999; background: #fff3cd; border-color: #ffeaa7; color: #856404;" 
                     role="alert">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>安全提醒:</strong> 当前连接未加密。生产环境建议使用HTTPS协议保护数据安全。
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
            
            // 3秒后添加到页面
            setTimeout(() => {
                if (document.body) {
                    document.body.appendChild(securityBanner);
                    
                    // 10秒后自动关闭
                    setTimeout(() => {
                        if (securityBanner.parentNode) {
                            securityBanner.parentNode.removeChild(securityBanner);
                        }
                    }, 10000);
                }
            }, 3000);
        }
    }
    
    // 网络连接检查
    function checkNetworkConnectivity() {
        // 检查是否在线
        if (!navigator.onLine) {
            console.warn('⚠️ 网络连接异常');
            return false;
        }
        
        // 监听网络状态变化
        window.addEventListener('online', () => {
            console.log('✅ 网络连接已恢复');
            // 重新检查后端连接
            if (window.checkBackendConnection) {
                window.checkBackendConnection().then(isOnline => {
                    if (isOnline) {
                        console.log('✅ 后端连接正常');
                    } else {
                        console.warn('⚠️ 后端连接异常');
                    }
                });
            }
        });
        
        window.addEventListener('offline', () => {
            console.warn('⚠️ 网络连接断开');
        });
        
        return true;
    }
    
    // 配置加载检查
    function checkConfigurationLoading() {
        let retryCount = 0;
        const maxRetries = 10;
        
        function waitForConfig() {
            if (window.ENV_CONFIG && window.GLOBAL_CONFIG) {
                console.log('✅ 配置文件加载完成');
                return true;
            }
            
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(waitForConfig, 500);
            } else {
                console.error('❌ 配置文件加载超时');
                // 显示错误提示
                const errorDiv = document.createElement('div');
                errorDiv.innerHTML = `
                    <div class="alert alert-danger position-fixed" 
                         style="top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000;">
                        <h5>配置加载失败</h5>
                        <p>应用配置文件加载失败，请刷新页面重试。</p>
                        <button class="btn btn-danger" onclick="window.location.reload()">刷新页面</button>
                    </div>
                `;
                document.body.appendChild(errorDiv);
                return false;
            }
        }
        
        setTimeout(waitForConfig, 100);
    }
    
    // DOM加载完成后执行检查
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runStartupChecks);
    } else {
        runStartupChecks();
    }
    
    function runStartupChecks() {
        console.log('🚀 开始启动检查...');
        
        // 按顺序执行检查
        const isReverseProxy = checkReverseProxySetup();
        checkSecurityRequirements();
        checkNetworkConnectivity();
        checkConfigurationLoading();
        
        // 记录启动信息
        console.log('🔧 启动检查完成:', {
            deploymentType: isReverseProxy ? 'reverse-proxy' : 'direct',
            hostname: window.location.hostname,
            protocol: window.location.protocol,
            port: window.location.port,
            timestamp: new Date().toISOString()
        });
    }
    
    // 导出工具函数
    window.reverseProxyStartupCheck = {
        checkReverseProxySetup,
        checkSecurityRequirements,
        checkNetworkConnectivity,
        checkConfigurationLoading
    };
    
})();
