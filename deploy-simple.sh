#!/bin/bash

# DifyChatSite 简化手动部署脚本
# 基于现有matrix.conf配置的Ubuntu 24环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 DifyChatSite 简化部署开始${NC}"
echo -e "${BLUE}目标: 与现有matrix.conf兼容部署${NC}"
echo

# 检查是否为root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ 请使用sudo运行此脚本${NC}"
   exit 1
fi

# 配置变量
DOMAIN="nas.pznas.com"
PORT="7990"
FRONTEND_DIR="/var/www/difychat"
BACKEND_DIR="/opt/difychat"
LOG_DIR="/var/log/difychat"

echo -e "${YELLOW}📋 Step 1: 创建目录和用户${NC}"

# 创建用户和目录
useradd --system --shell /bin/false --home-dir $BACKEND_DIR --create-home difychat 2>/dev/null || true
mkdir -p $FRONTEND_DIR $BACKEND_DIR $LOG_DIR /var/uploads/difychat

# 设置权限
chown -R www-data:www-data $FRONTEND_DIR
chown -R difychat:difychat $BACKEND_DIR $LOG_DIR /var/uploads/difychat

echo -e "${GREEN}✅ 目录和用户创建完成${NC}"

echo -e "${YELLOW}📋 Step 2: 部署前端文件${NC}"

# 复制前端文件
cp *.html $FRONTEND_DIR/ 2>/dev/null || echo "HTML文件复制"
cp -r assets config js pages $FRONTEND_DIR/ 2>/dev/null || echo "目录复制"
cp favicon.ico $FRONTEND_DIR/ 2>/dev/null || echo "图标复制"

# 设置前端权限
chown -R www-data:www-data $FRONTEND_DIR
find $FRONTEND_DIR -type f -exec chmod 644 {} \;
find $FRONTEND_DIR -type d -exec chmod 755 {} \;

echo -e "${GREEN}✅ 前端文件部署完成${NC}"

echo -e "${YELLOW}📋 Step 3: 配置Nginx${NC}"

# 复制nginx配置
cp nginx/difychat-manual.conf /etc/nginx/conf.d/difychat.conf

echo -e "${YELLOW}⚠️  请检查SSL证书配置:${NC}"
echo "配置文件: /etc/nginx/conf.d/difychat.conf"
echo "需要确认证书路径是否正确:"
echo "- ssl_certificate /etc/ssl/certs/nas.pznas.com_bundle.pem;"
echo "- ssl_certificate_key /etc/ssl/private/nas.pznas.com.key;"
echo

read -p "是否需要编辑Nginx配置？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    nano /etc/nginx/conf.d/difychat.conf
fi

# 测试nginx配置
if nginx -t; then
    echo -e "${GREEN}✅ Nginx配置测试通过${NC}"
    systemctl restart nginx
    echo -e "${GREEN}✅ Nginx已重启${NC}"
else
    echo -e "${RED}❌ Nginx配置测试失败，请检查配置${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Step 4: 后端服务配置${NC}"

# 检查后端代码
if [ ! -f "server.js" ] && [ ! -d "../backend" ]; then
    echo -e "${RED}❌ 找不到后端代码${NC}"
    echo "请确保:"
    echo "1. 当前目录有server.js文件，或"
    echo "2. ../backend目录存在后端代码"
    exit 1
fi

# 复制后端代码
if [ -f "server.js" ]; then
    cp -r * $BACKEND_DIR/ 2>/dev/null || true
elif [ -d "../backend" ]; then
    cp -r ../backend/* $BACKEND_DIR/
fi

# 设置后端权限
chown -R difychat:difychat $BACKEND_DIR

# 切换到后端目录
cd $BACKEND_DIR

# 安装依赖（如果有package.json）
if [ -f "package.json" ]; then
    echo -e "${YELLOW}📦 安装Node.js依赖...${NC}"
    sudo -u difychat npm install --production --silent
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
fi

# 创建环境配置
echo -e "${YELLOW}📝 创建环境配置...${NC}"
cat > .env << EOF
NODE_ENV=production
PORT=4005
HOST=127.0.0.1

# CORS配置 - 重要！
CORS_ORIGIN=https://$DOMAIN:$PORT
CORS_CREDENTIALS=true
WS_CORS_ORIGIN=https://$DOMAIN:$PORT

# JWT配置
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h

# 日志配置
LOG_LEVEL=info
LOG_FILE=$LOG_DIR/app.log

# 文件上传配置
UPLOAD_MAX_SIZE=52428800
UPLOAD_DIR=/var/uploads/difychat

# Session配置
SESSION_SECRET=$(openssl rand -base64 32)
SESSION_SECURE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax

# 数据库配置（请根据实际情况修改）
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=difychat_prod
# DB_USER=difychat
# DB_PASSWORD=your_database_password
EOF

chown difychat:difychat .env
chmod 600 .env

echo -e "${GREEN}✅ 环境配置创建完成${NC}"

# 创建systemd服务
echo -e "${YELLOW}🔧 创建系统服务...${NC}"
cat > /etc/systemd/system/difychat.service << EOF
[Unit]
Description=DifyChatSite Backend Service
After=network.target

[Service]
Type=simple
User=difychat
Group=difychat
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

# 启动服务
systemctl daemon-reload
systemctl enable difychat
systemctl start difychat

sleep 3

# 检查服务状态
if systemctl is-active --quiet difychat; then
    echo -e "${GREEN}✅ 后端服务启动成功${NC}"
else
    echo -e "${RED}❌ 后端服务启动失败${NC}"
    echo "查看日志: journalctl -u difychat -n 20"
    exit 1
fi

echo -e "${YELLOW}📋 Step 5: 验证部署${NC}"

# 检查端口监听
if netstat -tlnp | grep ":$PORT" > /dev/null; then
    echo -e "${GREEN}✅ Nginx监听端口$PORT${NC}"
else
    echo -e "${RED}❌ Nginx未监听端口$PORT${NC}"
fi

if netstat -tlnp | grep ":4005" > /dev/null; then
    echo -e "${GREEN}✅ 后端监听端口4005${NC}"
else
    echo -e "${RED}❌ 后端未监听端口4005${NC}"
fi

# 简单健康检查
if curl -f -s http://127.0.0.1:4005/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端健康检查通过${NC}"
else
    echo -e "${YELLOW}⚠️  后端健康检查失败（可能后端还在启动或没有/health端点）${NC}"
fi

echo
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${BLUE}访问地址: https://$DOMAIN:$PORT${NC}"
echo
echo -e "${YELLOW}📝 接下来的步骤:${NC}"
echo "1. 确保SSL证书配置正确"
echo "2. 配置防火墙: sudo ufw allow $PORT/tcp"
echo "3. 根据需要修改 $BACKEND_DIR/.env 中的数据库配置"
echo "4. 测试访问: https://$DOMAIN:$PORT"
echo
echo -e "${YELLOW}🔧 管理命令:${NC}"
echo "查看服务状态: sudo systemctl status difychat"
echo "查看日志: sudo journalctl -u difychat -f"
echo "重启服务: sudo systemctl restart difychat"
echo "编辑配置: sudo nano $BACKEND_DIR/.env"
