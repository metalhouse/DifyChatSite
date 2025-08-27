#!/bin/bash

# DifyChatSite 生产环境部署脚本
# 架构：前后端同服务器，Nginx统一入口
# 
# 部署步骤：
# 1. 准备环境和依赖
# 2. 部署前端静态文件
# 3. 配置Nginx
# 4. 部署后端服务
# 5. 启动服务并验证

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
DOMAIN="nas.pznas.com"
PORT="7990"
FRONTEND_DIR="/var/www/difychat"
BACKEND_DIR="/opt/difychat-backend"
NGINX_CONFIG_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
SERVICE_USER="difychat"
LOG_DIR="/var/log/difychat"

echo -e "${BLUE}🚀 DifyChatSite 生产环境部署开始${NC}"
echo -e "${BLUE}架构：前后端同服务器，Nginx统一入口，无CORS问题${NC}"
echo

# 1. 环境检查和准备
echo -e "${YELLOW}📋 Step 1: 环境检查和准备${NC}"

# 检查是否为root用户
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ 请使用sudo运行此脚本${NC}"
   exit 1
fi

# 检查必要命令
for cmd in nginx node npm git; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}❌ $cmd 未安装，请先安装${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ 环境检查通过${NC}"

# 创建服务用户
if ! id "$SERVICE_USER" &>/dev/null; then
    echo -e "${YELLOW}👤 创建服务用户: $SERVICE_USER${NC}"
    useradd --system --shell /bin/false --home-dir $BACKEND_DIR --create-home $SERVICE_USER
fi

# 创建必要目录
echo -e "${YELLOW}📁 创建部署目录${NC}"
mkdir -p $FRONTEND_DIR
mkdir -p $BACKEND_DIR
mkdir -p $LOG_DIR
chown -R $SERVICE_USER:$SERVICE_USER $BACKEND_DIR
chown -R $SERVICE_USER:$SERVICE_USER $LOG_DIR

# 2. 部署前端静态文件
echo -e "${YELLOW}📋 Step 2: 部署前端静态文件${NC}"

# 复制前端文件
cp -r *.html $FRONTEND_DIR/
cp -r assets/ $FRONTEND_DIR/
cp -r config/ $FRONTEND_DIR/
cp -r js/ $FRONTEND_DIR/
cp -r pages/ $FRONTEND_DIR/
cp favicon.ico $FRONTEND_DIR/

# 设置权限
chown -R www-data:www-data $FRONTEND_DIR
chmod -R 644 $FRONTEND_DIR
find $FRONTEND_DIR -type d -exec chmod 755 {} \;

echo -e "${GREEN}✅ 前端文件部署完成${NC}"

# 3. 配置Nginx
echo -e "${YELLOW}📋 Step 3: 配置Nginx${NC}"

# 复制Nginx配置
cp nginx/production-deploy.conf $NGINX_CONFIG_DIR/difychat

# 提示用户配置SSL证书
echo -e "${YELLOW}⚠️  请确保SSL证书已正确放置：${NC}"
echo "   - 证书文件: /path/to/your/certificate.crt"
echo "   - 私钥文件: /path/to/your/private.key"
echo "   - 请编辑 $NGINX_CONFIG_DIR/difychat 更新证书路径"
echo

read -p "是否已配置SSL证书？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ 请先配置SSL证书后再继续${NC}"
    exit 1
fi

# 启用站点
ln -sf $NGINX_CONFIG_DIR/difychat $NGINX_ENABLED_DIR/

# 测试Nginx配置
if nginx -t; then
    echo -e "${GREEN}✅ Nginx配置测试通过${NC}"
else
    echo -e "${RED}❌ Nginx配置测试失败${NC}"
    exit 1
fi

# 4. 部署后端服务
echo -e "${YELLOW}📋 Step 4: 部署后端服务${NC}"

# 检查后端代码目录
if [ ! -d "../backend" ]; then
    echo -e "${RED}❌ 后端代码目录不存在: ../backend${NC}"
    echo "请确保后端代码在正确位置"
    exit 1
fi

# 复制后端代码
cp -r ../backend/* $BACKEND_DIR/
chown -R $SERVICE_USER:$SERVICE_USER $BACKEND_DIR

# 切换到后端目录安装依赖
cd $BACKEND_DIR

# 以服务用户身份安装依赖
sudo -u $SERVICE_USER npm install --production

# 创建环境配置文件
cat > .env << EOF
NODE_ENV=production
PORT=4005
HOST=127.0.0.1

# 请根据实际情况修改以下配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=difychat_prod
DB_USER=difychat
DB_PASSWORD=your_secure_password

JWT_SECRET=your_very_secure_jwt_secret_here
JWT_EXPIRES_IN=24h

DIFY_API_BASE_URL=http://127.0.0.1:8000
DIFY_API_KEY=your_dify_api_key

CORS_ORIGIN=https://$DOMAIN:$PORT
CORS_CREDENTIALS=true
WS_CORS_ORIGIN=https://$DOMAIN:$PORT

LOG_LEVEL=info
LOG_FILE=$LOG_DIR/app.log

UPLOAD_MAX_SIZE=10485760
UPLOAD_DIR=/var/uploads/difychat

SESSION_SECRET=your_session_secret_here
SESSION_SECURE=false
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax
EOF

chown $SERVICE_USER:$SERVICE_USER .env
chmod 600 .env

echo -e "${GREEN}✅ 后端代码部署完成${NC}"

# 创建systemd服务
echo -e "${YELLOW}🔧 创建systemd服务${NC}"

cat > /etc/systemd/system/difychat.service << EOF
[Unit]
Description=DifyChatSite Backend Service
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# 安全配置
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=$LOG_DIR /var/uploads/difychat

# 日志配置
StandardOutput=append:$LOG_DIR/stdout.log
StandardError=append:$LOG_DIR/stderr.log

[Install]
WantedBy=multi-user.target
EOF

# 重新加载systemd
systemctl daemon-reload

echo -e "${GREEN}✅ systemd服务创建完成${NC}"

# 5. 启动服务并验证
echo -e "${YELLOW}📋 Step 5: 启动服务并验证${NC}"

# 启动后端服务
systemctl enable difychat
systemctl start difychat

# 等待服务启动
sleep 5

# 检查服务状态
if systemctl is-active --quiet difychat; then
    echo -e "${GREEN}✅ 后端服务启动成功${NC}"
else
    echo -e "${RED}❌ 后端服务启动失败${NC}"
    echo "查看日志: journalctl -u difychat -f"
    exit 1
fi

# 重启Nginx
systemctl restart nginx

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx重启成功${NC}"
else
    echo -e "${RED}❌ Nginx启动失败${NC}"
    exit 1
fi

# 验证部署
echo -e "${YELLOW}🔍 验证部署${NC}"

# 检查端口监听
if netstat -tlnp | grep ":4005" > /dev/null; then
    echo -e "${GREEN}✅ 后端服务正在监听端口4005${NC}"
else
    echo -e "${RED}❌ 后端服务未监听端口4005${NC}"
fi

if netstat -tlnp | grep ":$PORT" > /dev/null; then
    echo -e "${GREEN}✅ Nginx正在监听端口$PORT${NC}"
else
    echo -e "${RED}❌ Nginx未监听端口$PORT${NC}"
fi

# 健康检查
echo -e "${YELLOW}🏥 执行健康检查${NC}"
if curl -f -s http://127.0.0.1:4005/health > /dev/null; then
    echo -e "${GREEN}✅ 后端健康检查通过${NC}"
else
    echo -e "${YELLOW}⚠️  后端健康检查失败，可能还在启动中${NC}"
fi

echo
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${BLUE}访问地址: https://$DOMAIN:$PORT${NC}"
echo
echo -e "${YELLOW}📝 部署后检查清单：${NC}"
echo "1. ✅ 前端静态文件已部署到 $FRONTEND_DIR"
echo "2. ✅ Nginx配置已更新并重启"
echo "3. ✅ 后端服务已启动并设置为自启动"
echo "4. ✅ 系统服务和日志配置完成"
echo
echo -e "${YELLOW}🔧 常用管理命令：${NC}"
echo "查看后端服务状态: sudo systemctl status difychat"
echo "查看后端日志: sudo journalctl -u difychat -f"
echo "重启后端服务: sudo systemctl restart difychat"
echo "重启Nginx: sudo systemctl restart nginx"
echo "查看应用日志: sudo tail -f $LOG_DIR/app.log"
echo
echo -e "${YELLOW}⚠️  重要提醒：${NC}"
echo "1. 请根据实际情况修改 $BACKEND_DIR/.env 中的数据库和API配置"
echo "2. 确保防火墙已开放$PORT端口"
echo "3. 定期备份数据库和配置文件"
echo "4. 监控磁盘空间和日志大小"
