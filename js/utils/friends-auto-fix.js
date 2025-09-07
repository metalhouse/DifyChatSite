/**
 * 好友申请功能自动修复脚本
 * 在chatroom.html页面加载时自动运行，检测并修复常见问题
 */
(function() {
    'use strict';
    
    console.log('🔧 好友申请功能自动修复脚本加载');
    
    // 配置
    const CONFIG = {
        MAX_INIT_RETRIES: 3,
        RETRY_INTERVAL: 2000,
        API_TIMEOUT: 10000,
        DEBUG_MODE: true
    };
    
    // 调试日志函数
    function debugLog(message, type = 'info') {
        if (!CONFIG.DEBUG_MODE) return;
        
        const prefix = {
            info: '🔵',
            warn: '🟡', 
            error: '🔴',
            success: '🟢'
        }[type] || '⚪';
        
        console.log(`${prefix} [FriendsAutoFix] ${message}`);
    }
    
    // 检查用户认证状态
    function checkAuthentication() {
        const tokenSources = [
            () => window.currentUser?.accessToken,
            () => window.auth?.accessToken, 
            () => window.TokenManager?.getAccessToken?.(),
            () => localStorage.getItem('access_token'),
            () => localStorage.getItem('dify_access_token'),
            () => localStorage.getItem('jwt_token'),
            () => localStorage.getItem('auth_token')
        ];
        
        for (const getToken of tokenSources) {
            try {
                const token = getToken();
                if (token && token !== 'null' && token !== 'undefined') {
                    debugLog(`找到有效Token: ${token.substring(0, 20)}...`, 'success');
                    return true;
                }
            } catch (e) {
                // 忽略获取Token的错误
            }
        }
        
        debugLog('未找到有效Token', 'warn');
        return false;
    }
    
    // 检查DOM元素
    function checkDOMElements() {
        const requiredElements = [
            'receivedRequestsList',
            'sentRequestsList', 
            'receivedCount',
            'sentCount'
        ];
        
        const missing = [];
        requiredElements.forEach(id => {
            if (!document.getElementById(id)) {
                missing.push(id);
            }
        });
        
        if (missing.length > 0) {
            debugLog(`缺少DOM元素: ${missing.join(', ')}`, 'warn');
            return false;
        }
        
        debugLog('所有必需DOM元素存在', 'success');
        return true;
    }
    
    // 修复FriendsApi实例
    function fixFriendsApi() {
        if (!window.FriendsApi && window.FriendsApiService) {
            debugLog('创建FriendsApi实例', 'info');
            window.FriendsApi = new window.FriendsApiService();
        }
        
        // 检查并修复基础URL
        if (window.FriendsApi && !window.FriendsApi.baseURL.includes('://')) {
            debugLog('修复API基础URL', 'info');
            window.FriendsApi.baseURL = window.ENV_CONFIG?.API_BASE_URL || 'http://localhost:4005';
        }
        
        return !!window.FriendsApi;
    }
    
    // 初始化好友控制器
    async function initializeFriendsController() {
        debugLog('开始初始化好友控制器', 'info');
        
        try {
            if (!window.FriendsController) {
                debugLog('FriendsController类不可用', 'error');
                return false;
            }
            
            if (window.friendsController) {
                debugLog('好友控制器已存在，尝试刷新', 'info');
                await window.friendsController.refresh();
                return true;
            }
            
            // 创建新实例
            window.friendsController = new window.FriendsController();
            
            // 尝试初始化
            try {
                await window.friendsController.initialize();
                debugLog('好友控制器初始化成功', 'success');
                return true;
            } catch (error) {
                debugLog(`初始化失败，尝试延迟初始化: ${error.message}`, 'warn');
                
                // 如果有延迟初始化方法，使用它
                if (typeof window.friendsController.delayedInitialize === 'function') {
                    const success = await window.friendsController.delayedInitialize(3, 1500);
                    if (success) {
                        debugLog('延迟初始化成功', 'success');
                        return true;
                    }
                }
                
                debugLog('延迟初始化也失败', 'error');
                return false;
            }
            
        } catch (error) {
            debugLog(`初始化好友控制器异常: ${error.message}`, 'error');
            return false;
        }
    }
    
    // 修复请求计数显示
    function fixRequestCounts() {
        const receivedCount = document.getElementById('receivedCount');
        const sentCount = document.getElementById('sentCount');
        
        if (receivedCount && !receivedCount.textContent) {
            receivedCount.textContent = '0';
            receivedCount.style.display = 'none';
        }
        
        if (sentCount && !sentCount.textContent) {
            sentCount.textContent = '0'; 
            sentCount.style.display = 'none';
        }
        
        debugLog('修复请求计数显示', 'info');
    }
    
    // 添加错误监听和自动修复
    function setupErrorHandling() {
        // 监听全局错误
        window.addEventListener('error', (event) => {
            if (event.error && event.error.message && event.error.message.includes('friends')) {
                debugLog(`捕获好友相关错误: ${event.error.message}`, 'warn');
                
                // 延迟重试初始化
                setTimeout(async () => {
                    debugLog('尝试自动修复', 'info');
                    await runAutoFix();
                }, 3000);
            }
        });
        
        // 监听Promise rejection
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && event.reason.message && event.reason.message.includes('friends')) {
                debugLog(`捕获好友相关Promise错误: ${event.reason.message}`, 'warn');
                event.preventDefault(); // 阻止错误在控制台显示
            }
        });
    }
    
    // 主要修复流程
    async function runAutoFix() {
        debugLog('开始自动修复流程', 'info');
        
        let attempts = 0;
        const maxAttempts = CONFIG.MAX_INIT_RETRIES;
        
        while (attempts < maxAttempts) {
            attempts++;
            debugLog(`修复尝试 ${attempts}/${maxAttempts}`, 'info');
            
            try {
                // 1. 检查认证
                if (!checkAuthentication()) {
                    debugLog('等待用户认证...', 'warn');
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_INTERVAL));
                        continue;
                    } else {
                        debugLog('用户未认证，跳过好友功能初始化', 'warn');
                        return false;
                    }
                }
                
                // 2. 检查DOM元素
                if (!checkDOMElements()) {
                    debugLog('等待DOM元素加载...', 'warn');
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_INTERVAL));
                        continue;
                    } else {
                        debugLog('必需的DOM元素缺失', 'error');
                        return false;
                    }
                }
                
                // 3. 修复FriendsApi
                if (!fixFriendsApi()) {
                    debugLog('FriendsApi修复失败', 'error');
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_INTERVAL));
                        continue;
                    } else {
                        return false;
                    }
                }
                
                // 4. 初始化好友控制器
                const success = await initializeFriendsController();
                if (!success) {
                    debugLog('好友控制器初始化失败', 'error');
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_INTERVAL));
                        continue;
                    } else {
                        return false;
                    }
                }
                
                // 5. 修复显示
                fixRequestCounts();
                
                debugLog('自动修复完成', 'success');
                return true;
                
            } catch (error) {
                debugLog(`修复过程异常: ${error.message}`, 'error');
                
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_INTERVAL));
                    continue;
                } else {
                    debugLog('所有修复尝试都失败了', 'error');
                    return false;
                }
            }
        }
        
        return false;
    }
    
    // 设置周期性健康检查
    function setupHealthCheck() {
        setInterval(() => {
            if (window.friendsController && typeof window.friendsController.checkUserAuthentication === 'function') {
                if (!window.friendsController.checkUserAuthentication()) {
                    debugLog('健康检查：认证状态异常', 'warn');
                }
            }
        }, 30000); // 每30秒检查一次
    }
    
    // 页面可见性变化时刷新数据
    function setupVisibilityHandler() {
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden && window.friendsController) {
                debugLog('页面可见，刷新好友数据', 'info');
                try {
                    await window.friendsController.refresh();
                } catch (error) {
                    debugLog(`刷新失败: ${error.message}`, 'error');
                }
            }
        });
    }
    
    // 导出调试工具到全局
    window.friendsAutoFix = {
        runFix: runAutoFix,
        checkAuth: checkAuthentication,
        checkDOM: checkDOMElements,
        initController: initializeFriendsController
    };
    
    // 主启动函数
    async function start() {
        debugLog('自动修复脚本启动', 'info');
        
        // 设置错误处理
        setupErrorHandling();
        
        // 等待DOM完全加载
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // 等待一会儿让其他脚本先加载
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 运行修复
        const success = await runAutoFix();
        
        if (success) {
            // 设置健康检查和事件监听
            setupHealthCheck();
            setupVisibilityHandler();
            
            debugLog('好友功能自动修复系统已启动', 'success');
        } else {
            debugLog('自动修复失败，好友功能可能无法正常使用', 'error');
        }
    }
    
    // 启动
    start().catch(error => {
        debugLog(`启动异常: ${error.message}`, 'error');
    });
    
})();
