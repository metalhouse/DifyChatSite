/**
 * 反代部署诊断工具
 * 用于检查反代部署环境的配置和连接状态
 */

class ReverseProxyDiagnostics {
    constructor() {
        this.results = {
            environment: {},
            connectivity: {},
            configuration: {},
            cors: {},
            websocket: {},
            auth: {},
            performance: {}
        };
        
        this.proxyDomain = 'nas.pznas.com';
        this.proxyPort = 7990;
        this.protocol = 'https';
    }

    /**
     * 运行完整诊断
     */
    async runFullDiagnostics() {
        console.log('🔍 开始反代部署诊断...');
        
        await this.checkEnvironment();
        await this.checkConnectivity();
        await this.checkConfiguration();
        await this.checkCORS();
        await this.checkWebSocket();
        await this.checkAuth();
        await this.checkPerformance();
        
        this.generateReport();
        return this.results;
    }

    /**
     * 检查环境配置
     */
    async checkEnvironment() {
        console.log('🌐 检查环境配置...');
        
        const env = {
            hostname: window.location.hostname,
            protocol: window.location.protocol,
            port: window.location.port || (window.location.protocol === 'https:' ? '443' : '80'),
            userAgent: navigator.userAgent,
            isReverseProxy: window.location.hostname === this.proxyDomain,
            hasEnvConfig: !!window.ENV_CONFIG,
            hasGlobalConfig: !!window.GLOBAL_CONFIG,
            hasReverseProxyConfig: !!window.REVERSE_PROXY_CONFIG
        };
        
        // 检查配置加载状态
        if (window.ENV_CONFIG) {
            env.envConfig = {
                apiBaseUrl: window.ENV_CONFIG.API_BASE_URL,
                wsUrl: window.ENV_CONFIG.WS_URL,
                environment: window.ENV_CONFIG.ENVIRONMENT,
                debugMode: window.ENV_CONFIG.DEBUG_MODE
            };
        }
        
        this.results.environment = env;
        console.log('✅ 环境检查完成:', env);
    }

    /**
     * 检查连接性
     */
    async checkConnectivity() {
        console.log('🔗 检查连接性...');
        
        const connectivity = {
            healthCheck: null,
            apiEndpoint: null,
            staticFiles: null
        };
        
        // 健康检查
        try {
            const healthUrl = `${this.protocol}://${this.proxyDomain}:${this.proxyPort}/health`;
            const startTime = Date.now();
            
            const response = await fetch(healthUrl, {
                method: 'GET',
                mode: 'cors',
                credentials: 'include',
                signal: AbortSignal.timeout(10000)
            });
            
            connectivity.healthCheck = {
                success: response.ok,
                status: response.status,
                statusText: response.statusText,
                responseTime: Date.now() - startTime,
                url: healthUrl
            };
            
            if (response.ok) {
                const data = await response.json();
                connectivity.healthCheck.data = data;
            }
            
        } catch (error) {
            connectivity.healthCheck = {
                success: false,
                error: error.message,
                url: `${this.protocol}://${this.proxyDomain}:${this.proxyPort}/health`
            };
        }
        
        // API端点检查
        try {
            const apiUrl = `${this.protocol}://${this.proxyDomain}:${this.proxyPort}/api/health`;
            const startTime = Date.now();
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                mode: 'cors',
                credentials: 'include',
                signal: AbortSignal.timeout(10000)
            });
            
            connectivity.apiEndpoint = {
                success: response.ok,
                status: response.status,
                statusText: response.statusText,
                responseTime: Date.now() - startTime,
                url: apiUrl
            };
            
        } catch (error) {
            connectivity.apiEndpoint = {
                success: false,
                error: error.message,
                url: `${this.protocol}://${this.proxyDomain}:${this.proxyPort}/api/health`
            };
        }
        
        this.results.connectivity = connectivity;
        console.log('✅ 连接性检查完成:', connectivity);
    }

    /**
     * 检查配置正确性
     */
    async checkConfiguration() {
        console.log('⚙️ 检查配置...');
        
        const config = {
            apiBaseUrl: null,
            wsUrl: null,
            timeouts: null,
            security: null,
            configMismatch: []
        };
        
        // 检查API配置
        if (window.ENV_CONFIG) {
            config.apiBaseUrl = window.ENV_CONFIG.API_BASE_URL;
            config.wsUrl = window.ENV_CONFIG.WS_URL;
            config.timeouts = {
                api: window.ENV_CONFIG.API_TIMEOUT,
                dify: window.ENV_CONFIG.DIFY_TIMEOUT,
                upload: window.ENV_CONFIG.UPLOAD_TIMEOUT,
                websocket: window.ENV_CONFIG.WS_TIMEOUT
            };
            config.security = {
                secureMode: window.ENV_CONFIG.SECURE_MODE,
                sslVerify: window.ENV_CONFIG.SSL_VERIFY,
                withCredentials: window.ENV_CONFIG.WITH_CREDENTIALS
            };
            
            // 检查配置匹配性
            const expectedApiUrl = `${this.protocol}://${this.proxyDomain}:${this.proxyPort}`;
            const expectedWsUrl = `wss://${this.proxyDomain}:${this.proxyPort}`;
            
            if (!config.apiBaseUrl.startsWith(expectedApiUrl)) {
                config.configMismatch.push(`API Base URL 不匹配: 期望 ${expectedApiUrl}, 实际 ${config.apiBaseUrl}`);
            }
            
            if (!config.wsUrl.startsWith(expectedWsUrl)) {
                config.configMismatch.push(`WebSocket URL 不匹配: 期望 ${expectedWsUrl}, 实际 ${config.wsUrl}`);
            }
        }
        
        this.results.configuration = config;
        console.log('✅ 配置检查完成:', config);
    }

    /**
     * 检查CORS配置
     */
    async checkCORS() {
        console.log('🔒 检查CORS配置...');
        
        const cors = {
            preflightCheck: null,
            credentialsSupport: null,
            headersSupport: null
        };
        
        // 预检请求检查
        try {
            const response = await fetch(`${this.protocol}://${this.proxyDomain}:${this.proxyPort}/api/health`, {
                method: 'OPTIONS',
                headers: {
                    'Origin': window.location.origin,
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type, Authorization'
                }
            });
            
            cors.preflightCheck = {
                success: response.ok,
                status: response.status,
                allowOrigin: response.headers.get('Access-Control-Allow-Origin'),
                allowMethods: response.headers.get('Access-Control-Allow-Methods'),
                allowHeaders: response.headers.get('Access-Control-Allow-Headers'),
                allowCredentials: response.headers.get('Access-Control-Allow-Credentials')
            };
            
        } catch (error) {
            cors.preflightCheck = {
                success: false,
                error: error.message
            };
        }
        
        // 带认证信息的请求检查
        try {
            const response = await fetch(`${this.protocol}://${this.proxyDomain}:${this.proxyPort}/api/health`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Authorization': 'Bearer test-token'
                }
            });
            
            cors.credentialsSupport = {
                success: true,
                status: response.status,
                cookiesAccepted: response.headers.get('Set-Cookie') !== null
            };
            
        } catch (error) {
            cors.credentialsSupport = {
                success: false,
                error: error.message
            };
        }
        
        this.results.cors = cors;
        console.log('✅ CORS检查完成:', cors);
    }

    /**
     * 检查WebSocket连接
     */
    async checkWebSocket() {
        console.log('🔌 检查WebSocket连接...');
        
        const ws = {
            connectionTest: null,
            protocolSupport: null
        };
        
        return new Promise((resolve) => {
            const wsUrl = `wss://${this.proxyDomain}:${this.proxyPort}/ws`;
            
            try {
                const websocket = new WebSocket(wsUrl);
                const timeout = setTimeout(() => {
                    websocket.close();
                    ws.connectionTest = {
                        success: false,
                        error: '连接超时',
                        url: wsUrl
                    };
                    this.results.websocket = ws;
                    resolve();
                }, 5000);
                
                websocket.onopen = () => {
                    clearTimeout(timeout);
                    ws.connectionTest = {
                        success: true,
                        url: wsUrl,
                        readyState: websocket.readyState
                    };
                    ws.protocolSupport = websocket.protocol || 'default';
                    websocket.close();
                    this.results.websocket = ws;
                    resolve();
                };
                
                websocket.onerror = (error) => {
                    clearTimeout(timeout);
                    ws.connectionTest = {
                        success: false,
                        error: error.message || 'WebSocket连接错误',
                        url: wsUrl
                    };
                    this.results.websocket = ws;
                    resolve();
                };
                
            } catch (error) {
                ws.connectionTest = {
                    success: false,
                    error: error.message,
                    url: wsUrl
                };
                this.results.websocket = ws;
                resolve();
            }
        });
    }

    /**
     * 检查认证功能
     */
    async checkAuth() {
        console.log('🔐 检查认证功能...');
        
        const auth = {
            tokenStorage: null,
            authHeaderSupport: null,
            loginEndpoint: null
        };
        
        // 检查Token存储
        const storedToken = localStorage.getItem('dify_access_token') || 
                           localStorage.getItem('access_token');
        
        auth.tokenStorage = {
            hasToken: !!storedToken,
            tokenLength: storedToken ? storedToken.length : 0,
            storageKeys: Object.keys(localStorage).filter(key => key.includes('token'))
        };
        
        // 检查认证头支持
        if (storedToken) {
            try {
                const response = await fetch(`${this.protocol}://${this.proxyDomain}:${this.proxyPort}/api/auth/verify`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${storedToken}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });
                
                auth.authHeaderSupport = {
                    success: response.ok,
                    status: response.status,
                    statusText: response.statusText
                };
                
            } catch (error) {
                auth.authHeaderSupport = {
                    success: false,
                    error: error.message
                };
            }
        }
        
        // 检查登录端点
        try {
            const response = await fetch(`${this.protocol}://${this.proxyDomain}:${this.proxyPort}/api/auth/login`, {
                method: 'OPTIONS'
            });
            
            auth.loginEndpoint = {
                available: response.ok || response.status === 405, // 405表示方法不允许但端点存在
                status: response.status
            };
            
        } catch (error) {
            auth.loginEndpoint = {
                available: false,
                error: error.message
            };
        }
        
        this.results.auth = auth;
        console.log('✅ 认证检查完成:', auth);
    }

    /**
     * 检查性能
     */
    async checkPerformance() {
        console.log('⚡ 检查性能...');
        
        const performance = {
            responseTime: null,
            throughput: null,
            errorRate: null
        };
        
        // 响应时间测试
        const responseTimes = [];
        const errors = [];
        
        for (let i = 0; i < 5; i++) {
            try {
                const startTime = Date.now();
                const response = await fetch(`${this.protocol}://${this.proxyDomain}:${this.proxyPort}/health`, {
                    method: 'GET',
                    cache: 'no-cache'
                });
                const responseTime = Date.now() - startTime;
                
                if (response.ok) {
                    responseTimes.push(responseTime);
                } else {
                    errors.push(`HTTP ${response.status}`);
                }
                
            } catch (error) {
                errors.push(error.message);
            }
        }
        
        if (responseTimes.length > 0) {
            performance.responseTime = {
                average: Math.round(responseTimes.reduce((a, b) => a + b) / responseTimes.length),
                min: Math.min(...responseTimes),
                max: Math.max(...responseTimes),
                samples: responseTimes.length
            };
        }
        
        performance.errorRate = {
            total: errors.length,
            rate: (errors.length / 5) * 100,
            errors: errors
        };
        
        this.results.performance = performance;
        console.log('✅ 性能检查完成:', performance);
    }

    /**
     * 生成诊断报告
     */
    generateReport() {
        console.log('📋 生成诊断报告...');
        
        const report = {
            summary: this.generateSummary(),
            recommendations: this.generateRecommendations(),
            fullResults: this.results
        };
        
        console.group('🔍 反代部署诊断报告');
        console.log('📊 摘要:', report.summary);
        console.log('💡 建议:', report.recommendations);
        console.log('📋 详细结果:', report.fullResults);
        console.groupEnd();
        
        // 将报告存储到全局变量
        window.REVERSE_PROXY_DIAGNOSTICS_REPORT = report;
        
        return report;
    }

    /**
     * 生成摘要
     */
    generateSummary() {
        const summary = {
            overall: 'unknown',
            issues: 0,
            warnings: 0,
            successes: 0
        };
        
        // 检查各项结果
        const checks = [
            { name: '环境配置', result: this.results.environment.isReverseProxy && this.results.environment.hasEnvConfig },
            { name: '连接性', result: this.results.connectivity.healthCheck?.success || false },
            { name: 'CORS配置', result: this.results.cors.preflightCheck?.success || false },
            { name: 'WebSocket', result: this.results.websocket.connectionTest?.success || false },
            { name: '认证功能', result: this.results.auth.loginEndpoint?.available || false }
        ];
        
        checks.forEach(check => {
            if (check.result) {
                summary.successes++;
            } else {
                summary.issues++;
            }
        });
        
        // 性能警告
        if (this.results.performance.responseTime?.average > 3000) {
            summary.warnings++;
        }
        
        if (this.results.performance.errorRate?.rate > 20) {
            summary.warnings++;
        }
        
        // 总体状态
        if (summary.issues === 0) {
            summary.overall = summary.warnings === 0 ? 'excellent' : 'good';
        } else if (summary.issues <= 2) {
            summary.overall = 'fair';
        } else {
            summary.overall = 'poor';
        }
        
        return summary;
    }

    /**
     * 生成建议
     */
    generateRecommendations() {
        const recommendations = [];
        
        // 环境配置建议
        if (!this.results.environment.isReverseProxy) {
            recommendations.push({
                type: 'error',
                category: '环境配置',
                message: '当前不在反代环境中，请确认域名配置'
            });
        }
        
        // 连接性建议
        if (!this.results.connectivity.healthCheck?.success) {
            recommendations.push({
                type: 'error',
                category: '连接性',
                message: '健康检查失败，请检查后端服务状态和反代配置'
            });
        }
        
        // CORS建议
        if (!this.results.cors.preflightCheck?.success) {
            recommendations.push({
                type: 'error',
                category: 'CORS',
                message: '预检请求失败，请检查后端CORS配置是否包含反代域名'
            });
        }
        
        // WebSocket建议
        if (!this.results.websocket.connectionTest?.success) {
            recommendations.push({
                type: 'warning',
                category: 'WebSocket',
                message: 'WebSocket连接失败，实时功能可能不可用'
            });
        }
        
        // 性能建议
        if (this.results.performance.responseTime?.average > 5000) {
            recommendations.push({
                type: 'warning',
                category: '性能',
                message: '响应时间较长，建议优化反代配置或网络连接'
            });
        }
        
        if (this.results.performance.errorRate?.rate > 50) {
            recommendations.push({
                type: 'error',
                category: '稳定性',
                message: '错误率过高，请检查网络和服务稳定性'
            });
        }
        
        return recommendations;
    }
}

// 创建全局诊断工具实例
window.ReverseProxyDiagnostics = ReverseProxyDiagnostics;

// 便捷函数
window.runReverseProxyDiagnostics = async function() {
    const diagnostics = new ReverseProxyDiagnostics();
    return await diagnostics.runFullDiagnostics();
};

// 导出
export default ReverseProxyDiagnostics;
