@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM DifyChatSite Windows生产环境部署脚本
REM 架构：前后端同服务器，Nginx统一入口

echo.
echo 🚀 DifyChatSite 生产环境部署开始
echo 架构：前后端同服务器，Nginx统一入口，无CORS问题
echo.

REM 配置变量
set DOMAIN=nas.pznas.com
set PORT=7990
set FRONTEND_DIR=C:\inetpub\wwwroot\difychat
set BACKEND_DIR=C:\difychat-backend
set NGINX_DIR=C:\nginx

REM 1. 环境检查
echo 📋 Step 1: 环境检查
echo.

REM 检查Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装，请先安装Node.js
    pause
    exit /b 1
)

REM 检查npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm 未安装，请重新安装Node.js
    pause
    exit /b 1
)

echo ✅ Node.js和npm检查通过

REM 2. 创建部署目录
echo.
echo 📋 Step 2: 创建部署目录
echo.

if not exist "%FRONTEND_DIR%" mkdir "%FRONTEND_DIR%"
if not exist "%BACKEND_DIR%" mkdir "%BACKEND_DIR%"

echo ✅ 部署目录创建完成

REM 3. 部署前端文件
echo.
echo 📋 Step 3: 部署前端文件
echo.

REM 复制前端文件
xcopy /E /Y /Q *.html "%FRONTEND_DIR%\" >nul
xcopy /E /Y /Q assets "%FRONTEND_DIR%\assets\" >nul
xcopy /E /Y /Q config "%FRONTEND_DIR%\config\" >nul
xcopy /E /Y /Q js "%FRONTEND_DIR%\js\" >nul
xcopy /E /Y /Q pages "%FRONTEND_DIR%\pages\" >nul
copy /Y favicon.ico "%FRONTEND_DIR%\" >nul

echo ✅ 前端文件部署完成

REM 4. 生成Nginx配置
echo.
echo 📋 Step 4: 生成Nginx配置
echo.

REM 创建Windows适配的Nginx配置
(
echo # DifyChatSite Windows生产配置
echo server {
echo     listen %PORT% ssl http2;
echo     server_name %DOMAIN%;
echo.
echo     # SSL配置 - 请根据实际情况修改证书路径
echo     ssl_certificate C:/nginx/ssl/certificate.crt;
echo     ssl_private_key C:/nginx/ssl/private.key;
echo.
echo     ssl_protocols TLSv1.2 TLSv1.3;
echo     ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
echo     ssl_prefer_server_ciphers on;
echo.
echo     # 静态文件服务
echo     location / {
echo         root %FRONTEND_DIR:\=/%/;
echo         index index.html;
echo         try_files $uri $uri/ /index.html;
echo     }
echo.
echo     # API转发
echo     location /api/ {
echo         proxy_pass http://127.0.0.1:4005;
echo         proxy_http_version 1.1;
echo         proxy_set_header Host $host;
echo         proxy_set_header X-Real-IP $remote_addr;
echo         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
echo         proxy_set_header X-Forwarded-Proto $scheme;
echo     }
echo.
echo     # WebSocket支持
echo     location /socket.io/ {
echo         proxy_pass http://127.0.0.1:4005;
echo         proxy_http_version 1.1;
echo         proxy_set_header Upgrade $http_upgrade;
echo         proxy_set_header Connection "upgrade";
echo         proxy_set_header Host $host;
echo         proxy_set_header X-Real-IP $remote_addr;
echo         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
echo         proxy_set_header X-Forwarded-Proto $scheme;
echo         proxy_buffering off;
echo     }
echo }
echo.
echo # HTTP重定向到HTTPS
echo server {
echo     listen %PORT%;
echo     server_name %DOMAIN%;
echo     return 301 https://$server_name$request_uri;
echo }
) > "%NGINX_DIR%\conf\difychat.conf"

echo ✅ Nginx配置已生成: %NGINX_DIR%\conf\difychat.conf

REM 5. 部署后端（如果存在）
echo.
echo 📋 Step 5: 部署后端服务
echo.

if exist "..\backend" (
    echo 复制后端代码...
    xcopy /E /Y /Q "..\backend\*" "%BACKEND_DIR%\" >nul
    
    REM 切换到后端目录
    pushd "%BACKEND_DIR%"
    
    echo 安装后端依赖...
    npm install --production --silent
    
    REM 创建生产环境配置
    (
    echo NODE_ENV=production
    echo PORT=4005
    echo HOST=127.0.0.1
    echo.
    echo # 请根据实际情况修改以下配置
    echo DB_HOST=localhost
    echo DB_PORT=5432
    echo DB_NAME=difychat_prod
    echo DB_USER=difychat
    echo DB_PASSWORD=your_secure_password
    echo.
    echo JWT_SECRET=your_very_secure_jwt_secret_here
    echo JWT_EXPIRES_IN=24h
    echo.
    echo DIFY_API_BASE_URL=http://127.0.0.1:8000
    echo DIFY_API_KEY=your_dify_api_key
    echo.
    echo CORS_ORIGIN=https://%DOMAIN%:%PORT%
    echo CORS_CREDENTIALS=true
    echo WS_CORS_ORIGIN=https://%DOMAIN%:%PORT%
    echo.
    echo LOG_LEVEL=info
    echo LOG_FILE=C:/logs/difychat/app.log
    ) > .env
    
    popd
    echo ✅ 后端部署完成
) else (
    echo ⚠️ 后端目录不存在，跳过后端部署
)

REM 6. 生成启动脚本
echo.
echo 📋 Step 6: 生成启动脚本
echo.

REM 创建后端启动脚本
(
echo @echo off
echo cd /d "%BACKEND_DIR%"
echo echo 启动DifyChatSite后端服务...
echo node server.js
) > "%BACKEND_DIR%\start-backend.bat"

REM 创建服务管理脚本
(
echo @echo off
echo chcp 65001 ^>nul
echo.
echo echo DifyChatSite 服务管理
echo echo.
echo echo 1. 启动后端服务
echo echo 2. 重启Nginx
echo echo 3. 查看服务状态
echo echo 4. 退出
echo echo.
echo set /p choice=请选择操作（1-4）: 
echo.
echo if "%%choice%%"=="1" (
echo     echo 启动后端服务...
echo     start /min "DifyChatSite Backend" "%BACKEND_DIR%\start-backend.bat"
echo     echo ✅ 后端服务已启动
echo )
echo.
echo if "%%choice%%"=="2" (
echo     echo 重启Nginx...
echo     taskkill /f /im nginx.exe 2^>nul
echo     timeout /t 2 /nobreak ^>nul
echo     start /min "Nginx" "%NGINX_DIR%\nginx.exe"
echo     echo ✅ Nginx已重启
echo )
echo.
echo if "%%choice%%"=="3" (
echo     echo 检查服务状态...
echo     netstat -an ^| findstr ":4005"
echo     netstat -an ^| findstr ":%PORT%"
echo     echo.
echo     tasklist ^| findstr "node.exe"
echo     tasklist ^| findstr "nginx.exe"
echo )
echo.
echo if not "%%choice%%"=="4" pause
echo if not "%%choice%%"=="4" goto :start
) > "manage-services.bat"

echo ✅ 启动脚本已生成

REM 7. 完成部署
echo.
echo 🎉 部署完成！
echo.
echo 📝 部署信息：
echo    前端目录: %FRONTEND_DIR%
echo    后端目录: %BACKEND_DIR%
echo    访问地址: https://%DOMAIN%:%PORT%
echo.
echo 📋 接下来的步骤：
echo 1. 配置SSL证书到 %NGINX_DIR%\ssl\ 目录
echo 2. 将 %NGINX_DIR%\conf\difychat.conf 添加到Nginx主配置
echo 3. 修改 %BACKEND_DIR%\.env 中的数据库和API配置
echo 4. 运行 manage-services.bat 启动服务
echo.
echo ⚠️  重要提醒：
echo - 确保防火墙已开放%PORT%端口
echo - 请根据实际情况修改SSL证书路径
echo - 检查Windows防火墙设置
echo.

pause
