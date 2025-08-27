#!/bin/bash

# DifyChatSite 完整部署脚本 - 包含内网SSL代理
# 解决混合内容问题：HTTPS前端 + HTTPS内网后端代理

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🚀 DifyChatSite 完整部署启动${NC}"
echo -e "${CYAN}🎯 部署架构:${NC}"
echo "  • 前端: https://nas.pznas.com:7990 (公网HTTPS)"
echo "  • 后端API: https://192.168.1.90:4006 (内网SSL代理)"
echo "  • 实际后端: http://127.0.0.1:4005 (本机HTTP)"
echo ""

# 检查权限
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ 需要root权限运行此脚本${NC}"
   exit 1
fi

# 1. 生成SSL证书
echo -e "${YELLOW}🔒 生成SSL证书...${NC}"

# 前端SSL证书
mkdir -p /etc/ssl/certs /etc/ssl/private
if [[ ! -f "/etc/ssl/certs/nas.pznas.com.crt" ]]; then
    echo "生成前端SSL证书..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/ssl/private/nas.pznas.com.key \
        -out /etc/ssl/certs/nas.pznas.com.crt \
        -subj "/C=CN/ST=State/L=City/O=DifyChatSite/CN=nas.pznas.com"
fi

# 内网后端SSL证书
if [[ ! -f "/etc/ssl/certs/backend-internal.crt" ]]; then
    echo "生成内网后端SSL证书..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/ssl/private/backend-internal.key \
        -out /etc/ssl/certs/backend-internal.crt \
        -subj "/C=CN/ST=State/L=City/O=DifyChatBackend/CN=192.168.1.90" \
        -addext "subjectAltName=IP:192.168.1.90,DNS:nas.pznas.com,DNS:localhost"
fi

chmod 600 /etc/ssl/private/*.key
chmod 644 /etc/ssl/certs/*.crt

echo -e "${GREEN}✅ SSL证书配置完成${NC}"

# 2. 部署前端文件
echo -e "${YELLOW}📂 部署前端文件...${NC}"
mkdir -p /var/www/difychat
cp -r ./* /var/www/difychat/ 2>/dev/null || {
    echo -e "${RED}❌ 复制失败，请在项目根目录运行${NC}"
    exit 1
}

# 清理不需要的文件
rm -rf /var/www/difychat/.git 2>/dev/null || true
rm -rf /var/www/difychat/nginx 2>/dev/null || true

chown -R www-data:www-data /var/www/difychat 2>/dev/null || chown -R nginx:nginx /var/www/difychat 2>/dev/null
find /var/www/difychat -type f -exec chmod 644 {} \;
find /var/www/difychat -type d -exec chmod 755 {} \;

# 3. 配置Nginx - 完整配置
echo -e "${YELLOW}🔧 配置Nginx...${NC}"

cat > /etc/nginx/sites-available/difychat.conf << 'EOF'
# DifyChatSite 完整配置
# 前端 + 内网SSL代理，解决混合内容问题

upstream backend_http {
    server 127.0.0.1:4005;  # 实际后端服务
    keepalive 16;
}

# 内网后端SSL代理 (端口4006)
server {
    listen 4006 ssl http2;
    server_name 192.168.1.90 nas.pznas.com localhost;
    
    # SSL配置
    ssl_certificate /etc/ssl/certs/backend-internal.crt;
    ssl_certificate_key /etc/ssl/private/backend-internal.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # CORS配置 - 允许前端域名
    add_header Access-Control-Allow-Origin "https://nas.pznas.com:7990" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token" always;
    add_header Access-Control-Allow-Credentials true always;
    
    # 预检请求处理
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin "https://nas.pznas.com:7990";
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token";
        add_header Access-Control-Allow-Credentials true;
        add_header Access-Control-Max-Age 1728000;
        add_header Content-Type "text/plain charset=UTF-8";
        add_header Content-Length 0;
        return 204;
    }
    
    # API代理
    location /api/ {
        proxy_pass http://backend_http/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 120s;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://backend_http/health;
        proxy_set_header Host $host;
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
    }
    
    # WebSocket支持
    location /socket.io/ {
        proxy_pass http://backend_http/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 前端HTTPS服务 (端口7990)
server {
    listen 7990 ssl http2;
    server_name nas.pznas.com;
    
    # SSL配置
    ssl_certificate /etc/ssl/certs/nas.pznas.com.crt;
    ssl_certificate_key /etc/ssl/private/nas.pznas.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # 安全头
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # 前端静态文件
    location / {
        root /var/www/difychat;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # HTML不缓存
        location ~* \.html$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate" always;
            add_header Pragma "no-cache" always;
            add_header Expires "0" always;
        }
        
        # 静态资源缓存
        location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
    }
    
    # 错误页面
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    
    access_log /var/log/nginx/difychat-frontend.access.log;
    error_log /var/log/nginx/difychat-frontend.error.log;
}

# HTTP重定向
server {
    listen 7990;
    server_name nas.pznas.com;
    return 301 https://$server_name:7990$request_uri;
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/difychat.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# 测试配置
if nginx -t; then
    echo -e "${GREEN}✅ Nginx配置测试通过${NC}"
else
    echo -e "${RED}❌ Nginx配置测试失败${NC}"
    exit 1
fi

# 4. 配置防火墙
echo -e "${YELLOW}🛡️ 配置防火墙...${NC}"
if command -v ufw > /dev/null 2>&1; then
    ufw --force enable
    ufw allow 22/tcp
    ufw allow 7990/tcp comment "Frontend HTTPS"
    ufw allow 4006/tcp comment "Backend SSL Proxy (Internal)"
    # 4005端口仅本机访问
    ufw deny 4005/tcp
    echo "防火墙配置完成"
fi

# 5. 重启服务
echo -e "${YELLOW}🔄 重启服务...${NC}"
systemctl restart nginx
systemctl enable nginx

sleep 3

# 6. 验证部署
echo -e "${YELLOW}🔍 验证部署...${NC}"

# 检查服务状态
if systemctl is-active nginx > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx服务运行中${NC}"
else
    echo -e "${RED}❌ Nginx服务未运行${NC}"
    exit 1
fi

# 检查端口监听
for port in 7990 4006; do
    if netstat -tuln 2>/dev/null | grep ":${port}" > /dev/null || ss -tuln 2>/dev/null | grep ":${port}" > /dev/null; then
        echo -e "${GREEN}✅ 端口${port}正在监听${NC}"
    else
        echo -e "${RED}❌ 端口${port}未监听${NC}"
    fi
done

# 检查后端服务（如果运行）
if curl -s -f http://127.0.0.1:4005/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端HTTP服务可访问${NC}"
else
    echo -e "${YELLOW}⚠️ 后端HTTP服务不可访问（可能未启动）${NC}"
fi

# 测试SSL代理
if curl -k -s -f https://192.168.1.90:4006/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 内网SSL代理工作正常${NC}"
else
    echo -e "${YELLOW}⚠️ 内网SSL代理测试失败（后端可能未启动）${NC}"
fi

# 部署完成
echo ""
echo -e "${GREEN}🎉 完整部署完成！${NC}"
echo "=================================="
echo -e "🌐 前端访问: ${GREEN}https://nas.pznas.com:7990${NC}"
echo -e "🔌 后端API: ${GREEN}https://192.168.1.90:4006${NC} ${CYAN}(内网SSL代理)${NC}"
echo -e "⚙️ 实际后端: ${GREEN}http://127.0.0.1:4005${NC} ${YELLOW}(仅本机)${NC}"
echo ""
echo -e "${BLUE}🛠️ 架构说明:${NC}"
echo "1. 浏览器访问 https://nas.pznas.com:7990 (前端)"
echo "2. 前端JS请求 https://192.168.1.90:4006/api/* (SSL代理)"
echo "3. SSL代理转发到 http://127.0.0.1:4005/api/* (实际后端)"
echo ""
echo -e "${YELLOW}📝 下一步:${NC}"
echo "• 确保后端服务在127.0.0.1:4005运行"
echo "• 配置后端CORS允许https://nas.pznas.com:7990"
echo "• 测试前端功能是否正常"
