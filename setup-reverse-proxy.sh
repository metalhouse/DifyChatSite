#!/bin/bash

# 反代部署配置应用脚本
# 用于快速配置DifyChatSite支持反代部署到 https://nas.pznas.com:7990

set -e

echo "🚀 开始配置DifyChatSite反代部署..."

# 检查必要文件是否存在
echo "📋 检查项目结构..."
if [ ! -f "index.html" ]; then
    echo "❌ 错误: 未找到 index.html，请确保在项目根目录运行此脚本"
    exit 1
fi

# 创建配置备份
echo "💾 创建配置备份..."
mkdir -p backup/$(date +%Y%m%d_%H%M%S)
cp config/*.js backup/$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true

# 应用反代配置到其他HTML文件
echo "🔧 应用反代配置到HTML文件..."

# 需要配置的HTML文件列表
html_files=(
    "login.html"
    "chat.html"
    "chatroom.html"
    "profile.html"
    "settings.html"
)

for file in "${html_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  配置 $file..."
        
        # 检查是否已经有meta标签
        if ! grep -q 'name="backend-url"' "$file"; then
            # 在title标签前插入meta标签和脚本引用
            sed -i '/<title>/i\    <!-- 反代部署配置 -->\n    <meta name="backend-url" content="">\n    <meta name="deployment-type" content="reverse-proxy">\n    \n    <!-- 反代启动检查脚本 -->\n    <script src="js/utils/reverse-proxy-startup-check.js"></script>\n' "$file"
            echo "    ✅ $file 配置完成"
        else
            echo "    ⏭️ $file 已经配置过，跳过"
        fi
    else
        echo "    ⚠️ $file 不存在，跳过"
    fi
done

# 创建环境检测脚本
echo "📝 创建环境检测脚本..."
cat > check-reverse-proxy.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>反代部署检测工具</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        button { padding: 10px 20px; margin: 10px 5px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>🔍 反代部署检测工具</h1>
    <div id="results"></div>
    
    <button onclick="runFullCheck()">运行完整检测</button>
    <button onclick="runQuickCheck()">快速检测</button>
    <button onclick="viewConfig()">查看配置</button>
    <button onclick="exportReport()">导出报告</button>
    
    <script src="config/env.js" type="module"></script>
    <script src="config/global-config.js" type="module"></script>
    <script src="config/reverse-proxy-config.js" type="module"></script>
    <script src="js/utils/reverse-proxy-diagnostics.js" type="module"></script>
    
    <script>
        function addResult(message, type = 'info') {
            const div = document.createElement('div');
            div.className = `status ${type}`;
            div.innerHTML = message;
            document.getElementById('results').appendChild(div);
        }
        
        async function runFullCheck() {
            document.getElementById('results').innerHTML = '';
            addResult('开始完整检测...', 'info');
            
            try {
                if (window.runReverseProxyDiagnostics) {
                    const report = await window.runReverseProxyDiagnostics();
                    
                    addResult(`总体状态: ${report.summary.overall}`, 
                             report.summary.overall === 'excellent' ? 'success' : 
                             report.summary.overall === 'good' ? 'success' : 'warning');
                    
                    addResult(`成功项: ${report.summary.successes}, 问题: ${report.summary.issues}, 警告: ${report.summary.warnings}`, 'info');
                    
                    report.recommendations.forEach(rec => {
                        addResult(`${rec.category}: ${rec.message}`, 
                                 rec.type === 'error' ? 'error' : 'warning');
                    });
                    
                } else {
                    addResult('诊断工具未加载，请检查文件路径', 'error');
                }
            } catch (error) {
                addResult(`检测失败: ${error.message}`, 'error');
            }
        }
        
        async function runQuickCheck() {
            document.getElementById('results').innerHTML = '';
            addResult('开始快速检测...', 'info');
            
            // 检查环境
            const isReverseProxy = window.location.hostname === 'nas.pznas.com';
            addResult(`当前域名: ${window.location.hostname}`, 'info');
            addResult(`反代环境: ${isReverseProxy ? '是' : '否'}`, 
                     isReverseProxy ? 'success' : 'warning');
            
            // 检查配置加载
            addResult(`ENV_CONFIG: ${window.ENV_CONFIG ? '已加载' : '未加载'}`, 
                     window.ENV_CONFIG ? 'success' : 'error');
            addResult(`GLOBAL_CONFIG: ${window.GLOBAL_CONFIG ? '已加载' : '未加载'}`, 
                     window.GLOBAL_CONFIG ? 'success' : 'error');
            
            // 检查API配置
            if (window.ENV_CONFIG) {
                addResult(`API地址: ${window.ENV_CONFIG.API_BASE_URL}`, 'info');
                addResult(`WebSocket: ${window.ENV_CONFIG.WS_URL}`, 'info');
            }
        }
        
        function viewConfig() {
            document.getElementById('results').innerHTML = '';
            addResult('当前配置信息:', 'info');
            
            const configs = {
                'ENV_CONFIG': window.ENV_CONFIG,
                'GLOBAL_CONFIG': window.GLOBAL_CONFIG,
                'REVERSE_PROXY_CONFIG': window.REVERSE_PROXY_CONFIG
            };
            
            Object.entries(configs).forEach(([name, config]) => {
                if (config) {
                    addResult(`<strong>${name}:</strong><pre>${JSON.stringify(config, null, 2)}</pre>`, 'info');
                } else {
                    addResult(`${name}: 未加载`, 'warning');
                }
            });
        }
        
        function exportReport() {
            const report = window.REVERSE_PROXY_DIAGNOSTICS_REPORT || {
                message: '请先运行完整检测'
            };
            
            const blob = new Blob([JSON.stringify(report, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reverse-proxy-report-${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        // 页面加载完成后自动运行快速检测
        window.addEventListener('load', () => {
            setTimeout(runQuickCheck, 1000);
        });
    </script>
</body>
</html>
EOF

echo "✅ 创建检测工具页面: check-reverse-proxy.html"

# 创建快速部署说明
echo "📄 创建部署说明..."
cat > REVERSE_PROXY_SETUP.md << 'EOF'
# 反代部署快速指南

## 🎯 部署目标
- 前端访问地址: https://nas.pznas.com:7990
- 后端API地址: https://nas.pznas.com:7990/api
- WebSocket地址: wss://nas.pznas.com:7990/ws

## ✅ 前端配置已完成
- ✅ 环境配置文件已更新
- ✅ 反代专用配置已创建
- ✅ 启动检查脚本已添加
- ✅ 诊断工具已部署

## 🔧 后端配置要求
```javascript
// 后端需要添加的CORS配置
const corsOptions = {
  origin: ['https://nas.pznas.com:7990'],
  credentials: true
};
```

## 🌐 反代服务器配置要求
- 静态文件服务: 指向前端dist目录
- API反代: /api/* -> 后端服务:4005/api/*
- WebSocket反代: /ws/* -> 后端服务:4005/ws/*
- SSL证书配置

## 🧪 部署验证
1. 访问 https://nas.pznas.com:7990/check-reverse-proxy.html
2. 运行完整检测
3. 检查所有项目是否通过

## 📞 技术支持
如有问题，请检查:
1. 浏览器控制台输出
2. 网络面板请求状态
3. 后端服务日志
EOF

echo "✅ 创建部署说明: REVERSE_PROXY_SETUP.md"

# 设置文件权限
echo "🔑 设置文件权限..."
find . -name "*.js" -type f -exec chmod 644 {} \;
find . -name "*.html" -type f -exec chmod 644 {} \;
find . -name "*.md" -type f -exec chmod 644 {} \;

echo ""
echo "🎉 反代部署配置完成！"
echo ""
echo "📋 接下来的步骤："
echo "1. 将整个项目部署到反代服务器"
echo "2. 配置后端CORS支持 https://nas.pznas.com:7990"
echo "3. 配置反代服务器转发规则"
echo "4. 访问 https://nas.pznas.com:7990/check-reverse-proxy.html 进行检测"
echo ""
echo "📚 相关文档："
echo "- 反代部署检查清单: docs/反代部署检查清单.md"
echo "- CORS配置指南: docs/反代部署CORS配置指南.md"
echo "- 快速部署说明: REVERSE_PROXY_SETUP.md"
echo ""
echo "🔧 检测工具："
echo "- 浏览器访问: https://nas.pznas.com:7990/check-reverse-proxy.html"
echo "- 控制台检测: window.runReverseProxyDiagnostics()"
echo ""
