# DifyChatSite Nginx 反向代理部署指南

## 🎯 部署架构
- **后端服务**: 192.168.1.90:4005
- **前端服务**: 192.168.1.90 (nginx)
- **SSL域名**: nas.pznas.com:7990
- **访问方式**: https://nas.pznas.com:7990

## 📋 部署步骤

### 1. 准备SSL证书
```bash
# 确保您有以下SSL证书文件:
# - /etc/ssl/certs/nas.pznas.com.crt
# - /etc/ssl/private/nas.pznas.com.key
```

### 2. Nginx 配置文件
创建 `/etc/nginx/sites-available/difychat.conf`:

```nginx
# DifyChatSite 反向代理配置
# 域名: nas.pznas.com:7990
# 后端: 192.168.1.90:4005

upstream backend_api {
    server 192.168.1.90:4005;
    keepalive 32;
}

server {
    listen 7990 ssl http2;
    server_name nas.pznas.com;
    
    # SSL 配置
    ssl_certificate /etc/ssl/certs/nas.pznas.com.crt;
    ssl_certificate_key /etc/ssl/private/nas.pznas.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    # 文件上传大小限制
    client_max_body_size 100M;
    
    # 前端静态文件
    location / {
        root /var/www/difychat;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1M;
            add_header Cache-Control "public, immutable";
        }
        
        # HTML文件不缓存
        location ~* \.html$ {
            expires -1;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }
    
    # API 反向代理
    location /api/ {
        proxy_pass http://backend_api/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # 超时设置
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 120s;
        
        # 缓冲设置
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        
        # CORS 支持
        add_header Access-Control-Allow-Origin $http_origin;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
        add_header Access-Control-Allow-Headers 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
        add_header Access-Control-Allow-Credentials true;
        
        # 处理预检请求
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin $http_origin;
            add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
            add_header Access-Control-Allow-Headers 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header Access-Control-Allow-Credentials true;
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain; charset=utf-8';
            add_header Content-Length 0;
            return 204;
        }
    }
    
    # WebSocket 反向代理
    location /socket.io/ {
        proxy_pass http://backend_api/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 超时设置
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
    
    # 健康检查端点
    location /health {
        proxy_pass http://backend_api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 短超时，快速失败
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }
    
    # 错误页面
    error_page 502 503 504 /50x.html;
    location = /50x.html {
        root /var/www/difychat;
        internal;
    }
    
    # 日志
    access_log /var/log/nginx/difychat.access.log;
    error_log /var/log/nginx/difychat.error.log warn;
}

# HTTP 重定向到 HTTPS
server {
    listen 7990;
    server_name nas.pznas.com;
    return 301 https://$server_name:7990$request_uri;
}
```

### 3. 部署脚本
创建 `deploy.sh`:

```bash
#!/bin/bash

echo "🚀 开始部署 DifyChatSite..."

# 检查必要的目录和文件
if [ ! -d "/var/www/difychat" ]; then
    echo "创建网站目录..."
    sudo mkdir -p /var/www/difychat
fi

# 复制前端文件
echo "📂 复制前端文件..."
sudo cp -r ./* /var/www/difychat/
sudo chown -R www-data:www-data /var/www/difychat

# 设置适当的权限
sudo find /var/www/difychat -type f -exec chmod 644 {} \;
sudo find /var/www/difychat -type d -exec chmod 755 {} \;

# 启用nginx配置
echo "🔧 配置 Nginx..."
sudo ln -sf /etc/nginx/sites-available/difychat.conf /etc/nginx/sites-enabled/

# 测试nginx配置
echo "✅ 测试 Nginx 配置..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "🔄 重载 Nginx..."
    sudo systemctl reload nginx
    echo "✅ 部署完成!"
    echo ""
    echo "📝 访问信息:"
    echo "  前端地址: https://nas.pznas.com:7990"
    echo "  API地址: https://nas.pznas.com:7990/api"
    echo "  健康检查: https://nas.pznas.com:7990/health"
else
    echo "❌ Nginx 配置测试失败，请检查配置文件"
fi
```

### 4. 环境检查脚本
创建 `check-deployment.sh`:

```bash
#!/bin/bash

echo "🔍 DifyChatSite 部署检查..."

# 检查后端服务
echo "1️⃣ 检查后端服务 (192.168.1.90:4005)"
if curl -s -f http://192.168.1.90:4005/health > /dev/null; then
    echo "  ✅ 后端服务运行正常"
else
    echo "  ❌ 后端服务无法访问"
fi

# 检查nginx配置
echo "2️⃣ 检查 Nginx 配置"
if sudo nginx -t > /dev/null 2>&1; then
    echo "  ✅ Nginx 配置正确"
else
    echo "  ❌ Nginx 配置有误"
fi

# 检查SSL证书
echo "3️⃣ 检查 SSL 证书"
if [ -f "/etc/ssl/certs/nas.pznas.com.crt" ] && [ -f "/etc/ssl/private/nas.pznas.com.key" ]; then
    echo "  ✅ SSL 证书文件存在"
else
    echo "  ❌ SSL 证书文件缺失"
fi

# 检查前端文件
echo "4️⃣ 检查前端文件"
if [ -f "/var/www/difychat/index.html" ]; then
    echo "  ✅ 前端文件部署完成"
else
    echo "  ❌ 前端文件未部署"
fi

# 检查服务状态
echo "5️⃣ 检查服务状态"
if systemctl is-active nginx > /dev/null 2>&1; then
    echo "  ✅ Nginx 服务运行中"
else
    echo "  ❌ Nginx 服务未运行"
fi

echo ""
echo "🌐 测试URL:"
echo "  https://nas.pznas.com:7990"
echo "  https://nas.pznas.com:7990/api/health"
```

### 5. 完整部署命令

```bash
# 1. 上传配置文件
sudo cp difychat.conf /etc/nginx/sites-available/

# 2. 运行部署脚本
chmod +x deploy.sh
./deploy.sh

# 3. 运行检查脚本
chmod +x check-deployment.sh
./check-deployment.sh
```

## 🔧 配置要点

### 前端环境变量
前端会自动检测 `nas.pznas.com` 域名并使用生产环境配置:
- API地址: `https://nas.pznas.com:7990/api`
- WebSocket: `wss://nas.pznas.com:7990`

### 后端配置确认
确保后端服务配置了正确的CORS:
```javascript
// 后端需要允许的origin
const corsOptions = {
  origin: ['https://nas.pznas.com:7990'],
  credentials: true
};
```

## ⚠️ 注意事项

1. **SSL证书**: 确保SSL证书覆盖 `nas.pznas.com` 域名
2. **防火墙**: 开放7990端口
3. **DNS**: 确保 `nas.pznas.com` 解析到 `192.168.1.90`
4. **后端CORS**: 后端需要允许来自 `https://nas.pznas.com:7990` 的请求

## 🚀 快速启动

```bash
# 一键部署
curl -sSL https://raw.githubusercontent.com/your-repo/deploy-script.sh | bash
```
