/**
 * 图片优化服务测试和演示脚本
 * 用于验证智能分级加载功能
 */

// 等待页面加载完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('🧪 [测试] 图片优化服务测试脚本加载完成');
    
    // 延迟2秒后开始测试，确保其他组件已初始化
    setTimeout(runImageOptimizationTests, 2000);
});

function runImageOptimizationTests() {
    if (!window.imageOptimizer) {
        console.error('❌ [测试] 图片优化服务未找到');
        return;
    }
    
    console.log('🧪 [测试] 开始图片优化服务功能测试');
    
    // 1. 检查服务状态
    testServiceStatus();
    
    // 2. 定期输出统计信息
    startStatsMonitoring();
    
    // 3. 添加测试控制按钮
    addTestControls();
}

function testServiceStatus() {
    const stats = window.imageOptimizer.getLoadingStats();
    console.log('📊 [测试] 当前服务状态:', stats);
    
    if (stats.totalImages > 0) {
        console.log(`✅ [测试] 发现 ${stats.totalImages} 张图片`);
    } else {
        console.log('⚠️ [测试] 当前没有图片，请发送一些包含图片的消息进行测试');
    }
}

function startStatsMonitoring() {
    // 每5秒输出一次统计信息
    setInterval(() => {
        const stats = window.imageOptimizer.getLoadingStats();
        const totalQueue = Object.values(stats.queues).reduce((sum, count) => sum + count, 0);
        
        if (totalQueue > 0 || stats.currentLoading > 0) {
            console.log(`📊 [监控] 队列总数: ${totalQueue}, 正在加载: ${stats.currentLoading}, 缩略图: ${stats.loadedThumbnails}/${stats.totalImages}, 原图: ${stats.loadedFullImages}/${stats.totalImages}`);
        }
    }, 5000);
}

function addTestControls() {
    // 创建测试控制面板
    const controlPanel = document.createElement('div');
    controlPanel.id = 'imageOptimizationTestPanel';
    controlPanel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 12px;
        z-index: 9999;
        max-width: 300px;
        display: none;
    `;
    
    controlPanel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">图片优化测试面板</div>
        <button onclick="window.debugImageOptimizer.logStats()" style="margin: 2px; padding: 5px 10px; font-size: 11px;">显示统计</button>
        <button onclick="window.debugImageOptimizer.loadAllVisible()" style="margin: 2px; padding: 5px 10px; font-size: 11px;">加载可见缩略图</button>
        <button onclick="window.debugImageOptimizer.cleanup()" style="margin: 2px; padding: 5px 10px; font-size: 11px;">清理状态</button>
        <button onclick="toggleTestPanel()" style="margin: 2px; padding: 5px 10px; font-size: 11px;">隐藏面板</button>
        <div id="realTimeStats" style="margin-top: 10px; font-size: 10px; opacity: 0.8;"></div>
    `;
    
    document.body.appendChild(controlPanel);
    
    // 添加快捷键：Ctrl+Shift+I 显示/隐藏测试面板
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            toggleTestPanel();
        }
    });
    
    // 实时更新统计信息
    setInterval(() => {
        const statsDiv = document.getElementById('realTimeStats');
        const panel = document.getElementById('imageOptimizationTestPanel');
        
        if (statsDiv && panel.style.display !== 'none') {
            const stats = window.imageOptimizer.getLoadingStats();
            const totalQueue = Object.values(stats.queues).reduce((sum, count) => sum + count, 0);
            
            statsDiv.innerHTML = `
                队列: ${totalQueue} | 加载中: ${stats.currentLoading}/${stats.maxConcurrent}<br>
                缩略图: ${stats.loadedThumbnails}/${stats.totalImages}<br>
                原图: ${stats.loadedFullImages}/${stats.totalImages}
            `;
        }
    }, 1000);
    
    console.log('🎮 [测试] 测试控制面板已添加，按 Ctrl+Shift+I 显示/隐藏');
}

// 全局函数：切换测试面板显示
window.toggleTestPanel = function() {
    const panel = document.getElementById('imageOptimizationTestPanel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
};

// 页面加载时自动显示测试面板（如果是开发环境）
window.addEventListener('load', function() {
    // 检查是否在开发环境（localhost或包含dev的域名）
    if (location.hostname === 'localhost' || location.hostname.includes('dev') || location.hostname === '127.0.0.1') {
        setTimeout(() => {
            const panel = document.getElementById('imageOptimizationTestPanel');
            if (panel) {
                panel.style.display = 'block';
                console.log('🧪 [测试] 开发环境检测到，自动显示测试面板');
            }
        }, 3000);
    }
});

// 导出测试工具
window.imageOptimizationTestTools = {
    showPanel: () => document.getElementById('imageOptimizationTestPanel').style.display = 'block',
    hidePanel: () => document.getElementById('imageOptimizationTestPanel').style.display = 'none',
    runTests: runImageOptimizationTests,
    
    // 模拟加载压力测试
    stressTest: (imageCount = 20) => {
        console.log(`🔥 [压力测试] 模拟 ${imageCount} 张图片同时加载`);
        
        for (let i = 0; i < imageCount; i++) {
            const mockFileId = `test_image_${i}_${Date.now()}`;
            const container = window.imageOptimizer.progressiveLoadImage(mockFileId, `测试图片 ${i}`);
            
            // 将测试图片添加到聊天消息区域
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message message-other mb-3';
                messageDiv.innerHTML = `
                    <div class="message-bubble">
                        <div class="message-header">
                            <span class="message-sender">测试用户</span>
                            <span class="message-time">${new Date().toLocaleTimeString()}</span>
                        </div>
                        <div class="message-content">测试图片 ${i}</div>
                    </div>
                `;
                messageDiv.querySelector('.message-content').appendChild(container);
                chatMessages.appendChild(messageDiv);
            }
            
            // 模拟一些图片进入视口，一些不进入
            if (i % 3 === 0) {
                setTimeout(() => {
                    window.imageOptimizer.manualLoadImage(`img_${mockFileId}_*`, 'thumbnail');
                }, 1000 + i * 100);
            }
        }
        
        console.log(`🔥 [压力测试] ${imageCount} 张测试图片已创建`);
    }
};
