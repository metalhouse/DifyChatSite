/**
 * 后端服务状态检测
 * 用于检测后端服务是否可用，并提供故障排除建议
 */

(function() {
    'use strict';

    class BackendHealthChecker {
        constructor() {
            this.checkInterval = 30000; // 30秒检测一次
            this.lastCheckTime = null;
            this.isHealthy = false;
            this.checkHistory = [];
            this.maxHistorySize = 10;
        }

        /**
         * 执行健康检查
         */
        async performHealthCheck(silent = false) {
            const startTime = Date.now();
            let result = {
                success: false,
                responseTime: 0,
                error: null,
                timestamp: startTime,
                url: null
            };

            try {
                if (!window.ENV_CONFIG) {
                    throw new Error('环境配置未加载');
                }

                const healthUrl = `${window.ENV_CONFIG.API_BASE_URL}/health`;
                result.url = healthUrl;

                !silent && console.log('🔍 检查后端健康状态:', healthUrl);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

                const response = await fetch(healthUrl, {
                    method: 'GET',
                    signal: controller.signal,
                    mode: 'cors',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                clearTimeout(timeoutId);
                result.responseTime = Date.now() - startTime;

                if (response.ok) {
                    result.success = true;
                    this.isHealthy = true;
                    !silent && console.log('✅ 后端服务正常');
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

            } catch (error) {
                result.error = error.message;
                result.responseTime = Date.now() - startTime;
                this.isHealthy = false;
                
                !silent && console.warn('❌ 后端健康检查失败:', error.message);
                
                // 提供故障排除建议
                this.provideTroubleshootingTips(error);
            }

            // 记录检查历史
            this.addToHistory(result);
            this.lastCheckTime = Date.now();

            return result;
        }

        /**
         * 提供故障排除建议
         */
        provideTroubleshootingTips(error) {
            const tips = [];
            const currentBackend = window.getCurrentBackendUrl ? window.getCurrentBackendUrl() : 'unknown';

            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                tips.push('🌐 网络连接问题:');
                tips.push('  • 检查后端服务是否启动');
                tips.push('  • 检查防火墙设置');
                tips.push('  • 验证后端地址配置');
                tips.push(`  • 当前后端地址: ${currentBackend}`);
                
                if (currentBackend.includes('localhost') && window.location.hostname !== 'localhost') {
                    tips.push('  • 🔧 建议: 使用开发工具切换到当前IP地址');
                }
            }

            if (error.message.includes('CORS')) {
                tips.push('🔒 CORS策略问题:');
                tips.push('  • 后端服务需要配置CORS允许前端域名');
                tips.push('  • 检查后端CORS设置');
            }

            if (error.message.includes('timeout') || error.message.includes('aborted')) {
                tips.push('⏱️ 请求超时:');
                tips.push('  • 后端响应时间过长');
                tips.push('  • 检查后端服务性能');
            }

            console.group('🔧 故障排除建议:');
            tips.forEach(tip => console.log(tip));
            console.groupEnd();
        }

        /**
         * 添加到历史记录
         */
        addToHistory(result) {
            this.checkHistory.unshift(result);
            if (this.checkHistory.length > this.maxHistorySize) {
                this.checkHistory.pop();
            }
        }

        /**
         * 获取健康状态报告
         */
        getHealthReport() {
            const recentChecks = this.checkHistory.slice(0, 5);
            const successRate = recentChecks.length > 0 ? 
                (recentChecks.filter(c => c.success).length / recentChecks.length) * 100 : 0;

            const avgResponseTime = recentChecks.length > 0 ?
                recentChecks.filter(c => c.success).reduce((sum, c) => sum + c.responseTime, 0) / 
                recentChecks.filter(c => c.success).length : 0;

            return {
                isHealthy: this.isHealthy,
                lastCheck: this.lastCheckTime,
                successRate: Math.round(successRate),
                avgResponseTime: Math.round(avgResponseTime),
                recentChecks: recentChecks,
                currentBackend: window.getCurrentBackendUrl ? window.getCurrentBackendUrl() : 'unknown'
            };
        }

        /**
         * 开始定期检查
         */
        startPeriodicCheck() {
            // 立即执行一次检查
            this.performHealthCheck();

            // 设置定期检查
            setInterval(() => {
                this.performHealthCheck(true); // 静默检查
            }, this.checkInterval);

            console.log('🔄 后端健康检查已启动，每30秒检查一次');
        }

        /**
         * 显示健康状态指示器
         */
        showHealthIndicator() {
            const indicator = document.createElement('div');
            indicator.id = 'backend-health-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #dc3545;
                box-shadow: 0 0 10px rgba(0,0,0,0.3);
                z-index: 9997;
                cursor: pointer;
                transition: all 0.3s ease;
            `;
            
            indicator.title = '后端服务状态 (点击查看详情)';
            indicator.onclick = () => this.showHealthDialog();

            document.body.appendChild(indicator);

            // 定期更新指示器
            setInterval(() => {
                const isHealthy = this.isHealthy;
                indicator.style.background = isHealthy ? '#28a745' : '#dc3545';
                indicator.title = isHealthy ? '后端服务正常' : '后端服务异常 (点击查看详情)';
            }, 1000);
        }

        /**
         * 显示健康状态对话框
         */
        showHealthDialog() {
            const report = this.getHealthReport();
            
            const dialog = document.createElement('div');
            dialog.className = 'modal fade';
            dialog.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-heartbeat me-2"></i>后端服务状态
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-6">
                                    <div class="card text-center">
                                        <div class="card-body">
                                            <i class="fas ${report.isHealthy ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'} fa-2x"></i>
                                            <h6 class="mt-2">${report.isHealthy ? '正常' : '异常'}</h6>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="card text-center">
                                        <div class="card-body">
                                            <h4 class="text-primary">${report.successRate}%</h4>
                                            <h6>成功率</h6>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <small class="text-muted">当前后端地址:</small>
                                <br><code>${report.currentBackend}</code>
                            </div>
                            
                            <div class="mb-3">
                                <small class="text-muted">平均响应时间: ${report.avgResponseTime}ms</small>
                            </div>
                            
                            <div class="mb-3">
                                <h6>最近检查记录:</h6>
                                <div class="list-group list-group-flush" style="max-height: 200px; overflow-y: auto;">
                                    ${report.recentChecks.map(check => `
                                        <div class="list-group-item d-flex justify-content-between align-items-center py-1">
                                            <small>${new Date(check.timestamp).toLocaleTimeString()}</small>
                                            <span>
                                                <i class="fas ${check.success ? 'fa-check text-success' : 'fa-times text-danger'}"></i>
                                                ${check.success ? check.responseTime + 'ms' : check.error}
                                            </span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                            <button type="button" class="btn btn-primary" onclick="window.backendHealthChecker.performHealthCheck()">重新检查</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);
            const modal = new bootstrap.Modal(dialog);
            modal.show();

            dialog.addEventListener('hidden.bs.modal', () => {
                dialog.remove();
            });
        }
    }

    // 初始化健康检查器
    function initHealthChecker() {
        window.backendHealthChecker = new BackendHealthChecker();
        
        // 等待配置加载完成
        function waitForConfig() {
            if (window.ENV_CONFIG) {
                window.backendHealthChecker.startPeriodicCheck();
                window.backendHealthChecker.showHealthIndicator();
            } else {
                setTimeout(waitForConfig, 500);
            }
        }
        
        waitForConfig();
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHealthChecker);
    } else {
        initHealthChecker();
    }

})();
