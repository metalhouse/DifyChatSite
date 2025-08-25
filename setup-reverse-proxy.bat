@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo 🚀 开始配置DifyChatSite反代部署...

:: 检查必要文件是否存在
echo 📋 检查项目结构...
if not exist "index.html" (
    echo ❌ 错误: 未找到 index.html，请确保在项目根目录运行此脚本
    pause
    exit /b 1
)

:: 创建配置备份
echo 💾 创建配置备份...
set "backup_dir=backup\%date:~0,10%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "backup_dir=%backup_dir: =0%"
if not exist "%backup_dir%" mkdir "%backup_dir%"
if exist "config\*.js" copy "config\*.js" "%backup_dir%\" >nul 2>&1

:: 应用反代配置到其他HTML文件
echo 🔧 应用反代配置到HTML文件...

set "html_files=login.html chat.html chatroom.html profile.html settings.html"

for %%f in (%html_files%) do (
    if exist "%%f" (
        echo   配置 %%f...
        
        :: 检查是否已经有meta标签
        findstr /c:"backend-url" "%%f" >nul
        if !errorlevel! neq 0 (
            :: 创建临时文件进行替换
            set "temp_file=%%f.tmp"
            (
                for /f "delims=" %%l in ('type "%%f"') do (
                    set "line=%%l"
                    if "!line!"=="    <title>" (
                        echo     ^<^!-- 反代部署配置 --^>
                        echo     ^<meta name="backend-url" content=""^>
                        echo     ^<meta name="deployment-type" content="reverse-proxy"^>
                        echo.
                        echo     ^<^!-- 反代启动检查脚本 --^>
                        echo     ^<script src="js/utils/reverse-proxy-startup-check.js"^>^</script^>
                        echo.
                    )
                    echo !line!
                )
            ) > "!temp_file!"
            
            move "!temp_file!" "%%f" >nul
            echo     ✅ %%f 配置完成
        ) else (
            echo     ⏭️ %%f 已经配置过，跳过
        )
    ) else (
        echo     ⚠️ %%f 不存在，跳过
    )
)

:: 创建环境检测脚本
echo 📝 创建环境检测脚本...
(
echo ^<!DOCTYPE html^>
echo ^<html lang="zh-CN"^>
echo ^<head^>
echo     ^<meta charset="UTF-8"^>
echo     ^<meta name="viewport" content="width=device-width, initial-scale=1.0"^>
echo     ^<title^>反代部署检测工具^</title^>
echo     ^<style^>
echo         body { font-family: Arial, sans-serif; margin: 40px; }
echo         .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
echo         .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
echo         .warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
echo         .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
echo         button { padding: 10px 20px; margin: 10px 5px; cursor: pointer; }
echo     ^</style^>
echo ^</head^>
echo ^<body^>
echo     ^<h1^>🔍 反代部署检测工具^</h1^>
echo     ^<div id="results"^>^</div^>
echo     
echo     ^<button onclick="runFullCheck()"^>运行完整检测^</button^>
echo     ^<button onclick="runQuickCheck()"^>快速检测^</button^>
echo     ^<button onclick="viewConfig()"^>查看配置^</button^>
echo     ^<button onclick="exportReport()"^>导出报告^</button^>
echo     
echo     ^<script src="config/env.js" type="module"^>^</script^>
echo     ^<script src="config/global-config.js" type="module"^>^</script^>
echo     ^<script src="config/reverse-proxy-config.js" type="module"^>^</script^>
echo     ^<script src="js/utils/reverse-proxy-diagnostics.js" type="module"^>^</script^>
echo     
echo     ^<script^>
echo         function addResult(message, type = 'info'^) {
echo             const div = document.createElement('div'^);
echo             div.className = `status ${type}`;
echo             div.innerHTML = message;
echo             document.getElementById('results'^).appendChild(div^);
echo         }
echo         
echo         async function runFullCheck(^) {
echo             document.getElementById('results'^).innerHTML = '';
echo             addResult('开始完整检测...', 'info'^);
echo             
echo             try {
echo                 if (window.runReverseProxyDiagnostics^) {
echo                     const report = await window.runReverseProxyDiagnostics(^);
echo                     
echo                     addResult(`总体状态: ${report.summary.overall}`, 
echo                              report.summary.overall === 'excellent' ? 'success' : 
echo                              report.summary.overall === 'good' ? 'success' : 'warning'^);
echo                     
echo                     report.recommendations.forEach(rec =^> {
echo                         addResult(`${rec.category}: ${rec.message}`, 
echo                                  rec.type === 'error' ? 'error' : 'warning'^);
echo                     }^);
echo                     
echo                 } else {
echo                     addResult('诊断工具未加载，请检查文件路径', 'error'^);
echo                 }
echo             } catch (error^) {
echo                 addResult(`检测失败: ${error.message}`, 'error'^);
echo             }
echo         }
echo         
echo         async function runQuickCheck(^) {
echo             document.getElementById('results'^).innerHTML = '';
echo             addResult('开始快速检测...', 'info'^);
echo             
echo             const isReverseProxy = window.location.hostname === 'nas.pznas.com';
echo             addResult(`当前域名: ${window.location.hostname}`, 'info'^);
echo             addResult(`反代环境: ${isReverseProxy ? '是' : '否'}`, 
echo                      isReverseProxy ? 'success' : 'warning'^);
echo                      
echo             addResult(`ENV_CONFIG: ${window.ENV_CONFIG ? '已加载' : '未加载'}`, 
echo                      window.ENV_CONFIG ? 'success' : 'error'^);
echo         }
echo         
echo         window.addEventListener('load', (^) =^> {
echo             setTimeout(runQuickCheck, 1000^);
echo         }^);
echo     ^</script^>
echo ^</body^>
echo ^</html^>
) > check-reverse-proxy.html

echo ✅ 创建检测工具页面: check-reverse-proxy.html

:: 创建快速部署说明
echo 📄 创建部署说明...
(
echo # 反代部署快速指南
echo.
echo ## 🎯 部署目标
echo - 前端访问地址: https://nas.pznas.com:7990
echo - 后端API地址: https://nas.pznas.com:7990/api
echo - WebSocket地址: wss://nas.pznas.com:7990/ws
echo.
echo ## ✅ 前端配置已完成
echo - ✅ 环境配置文件已更新
echo - ✅ 反代专用配置已创建
echo - ✅ 启动检查脚本已添加
echo - ✅ 诊断工具已部署
echo.
echo ## 🔧 后端配置要求
echo ```javascript
echo // 后端需要添加的CORS配置
echo const corsOptions = {
echo   origin: ['https://nas.pznas.com:7990'],
echo   credentials: true
echo };
echo ```
echo.
echo ## 🧪 部署验证
echo 1. 访问 https://nas.pznas.com:7990/check-reverse-proxy.html
echo 2. 运行完整检测
echo 3. 检查所有项目是否通过
) > REVERSE_PROXY_SETUP.md

echo ✅ 创建部署说明: REVERSE_PROXY_SETUP.md

echo.
echo 🎉 反代部署配置完成！
echo.
echo 📋 接下来的步骤：
echo 1. 将整个项目部署到反代服务器
echo 2. 配置后端CORS支持 https://nas.pznas.com:7990
echo 3. 配置反代服务器转发规则
echo 4. 访问 https://nas.pznas.com:7990/check-reverse-proxy.html 进行检测
echo.
echo 📚 相关文档：
echo - 反代部署检查清单: docs\反代部署检查清单.md
echo - CORS配置指南: docs\反代部署CORS配置指南.md
echo - 快速部署说明: REVERSE_PROXY_SETUP.md
echo.
echo 🔧 检测工具：
echo - 浏览器访问: https://nas.pznas.com:7990/check-reverse-proxy.html
echo - 控制台检测: window.runReverseProxyDiagnostics()
echo.

pause
