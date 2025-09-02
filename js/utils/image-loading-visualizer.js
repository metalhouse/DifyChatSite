/**
 * 图片加载状态可视化监控器
 * 提供实时的图片加载状态可视化界面
 */
class ImageLoadingVisualizer {
    constructor() {
        this.isVisible = false;
        this.updateInterval = null;
        this.chartContainer = null;
        
        console.log('📊 [可视化] 图片加载监控器已初始化');
    }

    /**
     * 创建可视化界面
     */
    create() {
        if (this.chartContainer) {
            return; // 已经创建过了
        }

        this.chartContainer = document.createElement('div');
        this.chartContainer.id = 'imageLoadingVisualizer';
        this.chartContainer.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 320px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            border-radius: 12px;
            padding: 20px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            z-index: 9998;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            display: none;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;

        this.chartContainer.innerHTML = `
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
                <h4 style="margin: 0; color: #4CAF50; font-size: 14px;">📊 图片加载监控</h4>
                <button onclick="window.imageLoadingVisualizer.hide()" style="
                    background: transparent; 
                    border: 1px solid rgba(255,255,255,0.3); 
                    color: white; 
                    padding: 2px 8px; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 11px;
                ">关闭</button>
            </div>
            
            <div id="queueStats" style="margin-bottom: 15px;"></div>
            <div id="loadingProgress" style="margin-bottom: 15px;"></div>
            <div id="performanceMetrics" style="margin-bottom: 15px;"></div>
            <div id="queueVisualization" style="margin-bottom: 15px;"></div>
            
            <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px; font-size: 10px; opacity: 0.7;">
                <button onclick="window.debugImageOptimizer.loadAllVisible()" style="
                    background: #2196F3; 
                    border: none; 
                    color: white; 
                    padding: 4px 8px; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 10px;
                    margin: 2px;
                ">加载可见</button>
                <button onclick="window.debugImageOptimizer.cleanup()" style="
                    background: #FF9800; 
                    border: none; 
                    color: white; 
                    padding: 4px 8px; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 10px;
                    margin: 2px;
                ">清理状态</button>
                <button onclick="window.imageOptimizationTestTools.stressTest(10)" style="
                    background: #9C27B0; 
                    border: none; 
                    color: white; 
                    padding: 4px 8px; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 10px;
                    margin: 2px;
                ">压力测试</button>
            </div>
        `;

        document.body.appendChild(this.chartContainer);
        console.log('📊 [可视化] 监控界面已创建');
    }

    /**
     * 显示监控器
     */
    show() {
        this.create();
        this.chartContainer.style.display = 'block';
        this.isVisible = true;
        
        // 开始更新数据
        this.startUpdating();
        console.log('📊 [可视化] 监控器已显示');
    }

    /**
     * 隐藏监控器
     */
    hide() {
        if (this.chartContainer) {
            this.chartContainer.style.display = 'none';
        }
        this.isVisible = false;
        
        // 停止更新
        this.stopUpdating();
        console.log('📊 [可视化] 监控器已隐藏');
    }

    /**
     * 切换显示/隐藏
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 开始更新数据
     */
    startUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.updateDisplay();
        }, 500); // 每500ms更新一次
    }

    /**
     * 停止更新数据
     */
    stopUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * 更新显示内容
     */
    updateDisplay() {
        if (!this.isVisible || !window.imageOptimizer) {
            return;
        }

        const stats = window.imageOptimizer.getLoadingStats();
        
        // 更新队列统计
        this.updateQueueStats(stats);
        
        // 更新加载进度
        this.updateLoadingProgress(stats);
        
        // 更新性能指标
        this.updatePerformanceMetrics(stats);
        
        // 更新队列可视化
        this.updateQueueVisualization(stats);
    }

    /**
     * 更新队列统计信息
     */
    updateQueueStats(stats) {
        const queueStatsDiv = document.getElementById('queueStats');
        if (!queueStatsDiv) return;

        const totalQueue = Object.values(stats.queues).reduce((sum, count) => sum + count, 0);
        
        queueStatsDiv.innerHTML = `
            <div style="color: #4CAF50; font-weight: bold; margin-bottom: 5px;">📋 队列状态</div>
            <div>🔥 用户请求: <span style="color: #F44336;">${stats.queues.userRequested}</span></div>
            <div>👁️ 可见缩略图: <span style="color: #FF9800;">${stats.queues.visibleThumbnails}</span></div>
            <div>👁️‍🗨️ 隐藏缩略图: <span style="color: #2196F3;">${stats.queues.hiddenThumbnails}</span></div>
            <div>🖼️ 原图队列: <span style="color: #9C27B0;">${stats.queues.fullImages}</span></div>
            <div style="border-top: 1px solid rgba(255,255,255,0.2); margin-top: 5px; padding-top: 5px;">
                📊 总队列: <span style="color: #FFC107;">${totalQueue}</span>
            </div>
        `;
    }

    /**
     * 更新加载进度
     */
    updateLoadingProgress(stats) {
        const progressDiv = document.getElementById('loadingProgress');
        if (!progressDiv) return;

        const thumbnailPercent = stats.totalImages > 0 ? 
            Math.round((stats.loadedThumbnails / stats.totalImages) * 100) : 0;
        const fullImagePercent = stats.totalImages > 0 ? 
            Math.round((stats.loadedFullImages / stats.totalImages) * 100) : 0;

        progressDiv.innerHTML = `
            <div style="color: #4CAF50; font-weight: bold; margin-bottom: 8px;">⚡ 加载进度</div>
            
            <div style="margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>缩略图</span>
                    <span>${stats.loadedThumbnails}/${stats.totalImages} (${thumbnailPercent}%)</span>
                </div>
                <div style="background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; margin-top: 2px;">
                    <div style="background: #4CAF50; height: 100%; width: ${thumbnailPercent}%; border-radius: 2px; transition: width 0.3s;"></div>
                </div>
            </div>
            
            <div style="margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>原图</span>
                    <span>${stats.loadedFullImages}/${stats.totalImages} (${fullImagePercent}%)</span>
                </div>
                <div style="background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; margin-top: 2px;">
                    <div style="background: #2196F3; height: 100%; width: ${fullImagePercent}%; border-radius: 2px; transition: width 0.3s;"></div>
                </div>
            </div>
            
            <div style="font-size: 11px; opacity: 0.8;">
                🔄 正在加载: ${stats.currentLoading}/${stats.maxConcurrent}
            </div>
        `;
    }

    /**
     * 更新性能指标
     */
    updatePerformanceMetrics(stats) {
        const metricsDiv = document.getElementById('performanceMetrics');
        if (!metricsDiv) return;

        const totalQueue = Object.values(stats.queues).reduce((sum, count) => sum + count, 0);
        const efficiency = stats.totalImages > 0 ? 
            Math.round(((stats.loadedThumbnails + stats.loadedFullImages) / (stats.totalImages * 2)) * 100) : 0;

        metricsDiv.innerHTML = `
            <div style="color: #4CAF50; font-weight: bold; margin-bottom: 5px;">📈 性能指标</div>
            <div>🎯 加载效率: <span style="color: ${efficiency > 70 ? '#4CAF50' : efficiency > 40 ? '#FF9800' : '#F44336'};">${efficiency}%</span></div>
            <div>🚦 队列压力: <span style="color: ${totalQueue < 5 ? '#4CAF50' : totalQueue < 15 ? '#FF9800' : '#F44336'};">${totalQueue > 0 ? '高' : '正常'}</span></div>
            <div>💾 内存使用: <span style="color: #2196F3;">${stats.totalImages} 项</span></div>
            <div>⚡ 并发状态: <span style="color: ${stats.currentLoading > 0 ? '#FF9800' : '#4CAF50'};">${stats.currentLoading > 0 ? '活跃' : '空闲'}</span></div>
        `;
    }

    /**
     * 更新队列可视化
     */
    updateQueueVisualization(stats) {
        const vizDiv = document.getElementById('queueVisualization');
        if (!vizDiv) return;

        const maxQueueSize = Math.max(...Object.values(stats.queues), 1);
        
        vizDiv.innerHTML = `
            <div style="color: #4CAF50; font-weight: bold; margin-bottom: 8px;">📊 队列可视化</div>
            ${Object.entries(stats.queues).map(([queueName, count]) => {
                const width = (count / maxQueueSize) * 100;
                const color = {
                    userRequested: '#F44336',
                    visibleThumbnails: '#FF9800', 
                    hiddenThumbnails: '#2196F3',
                    fullImages: '#9C27B0'
                }[queueName];
                
                const label = {
                    userRequested: '🔥 用户',
                    visibleThumbnails: '👁️ 可见',
                    hiddenThumbnails: '👁️‍🗨️ 隐藏',
                    fullImages: '🖼️ 原图'
                }[queueName];
                
                return `
                    <div style="margin-bottom: 4px;">
                        <div style="display: flex; justify-content: space-between; font-size: 10px;">
                            <span>${label}</span>
                            <span>${count}</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; margin-top: 1px;">
                            <div style="background: ${color}; height: 100%; width: ${width}%; border-radius: 4px; transition: width 0.3s;"></div>
                        </div>
                    </div>
                `;
            }).join('')}
        `;
    }

    /**
     * 销毁监控器
     */
    destroy() {
        this.stopUpdating();
        if (this.chartContainer) {
            this.chartContainer.remove();
            this.chartContainer = null;
        }
        console.log('📊 [可视化] 监控器已销毁');
    }
}

// 创建全局实例
window.imageLoadingVisualizer = new ImageLoadingVisualizer();

// 添加快捷键：Ctrl+Shift+V 显示/隐藏可视化监控器
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        window.imageLoadingVisualizer.toggle();
    }
});

// 添加到全局调试工具
if (window.debugImageOptimizer) {
    window.debugImageOptimizer.showVisualizer = () => window.imageLoadingVisualizer.show();
    window.debugImageOptimizer.hideVisualizer = () => window.imageLoadingVisualizer.hide();
    window.debugImageOptimizer.toggleVisualizer = () => window.imageLoadingVisualizer.toggle();
}

// 自动显示（开发环境）
window.addEventListener('load', function() {
    if (location.hostname === 'localhost' || location.hostname.includes('dev') || location.hostname === '127.0.0.1') {
        setTimeout(() => {
            if (window.imageOptimizer && window.imageOptimizer.getLoadingStats().totalImages > 0) {
                window.imageLoadingVisualizer.show();
                console.log('📊 [可视化] 开发环境自动显示监控器，按 Ctrl+Shift+V 切换显示');
            }
        }, 5000);
    }
});

console.log('📊 [可视化] 图片加载可视化监控器已加载，快捷键：Ctrl+Shift+V');
