# DifyChatSite 安全部署指南 - 内网API访问

## 🔒 安全架构
- **前端服务**: 192.168.1.90:7990 (nginx SSL) → 公网访问 https://nas.pznas.com:7990
- **后端API**: 192.168.1.90:4005 → **仅内网访问**，不暴露到公网
- **数据流向**: 浏览器 → HTTPS前端 → 内网HTTP后端

## 🛡️ 安全优势

1. **API不暴露到公网**: 后端API只能从内网访问，提高安全性
2. **减少攻击面**: 公网只暴露静态文件，没有动态API接口
3. **简化SSL**: 只需要为前端配置SSL，后端使用HTTP即可
4. **访问控制**: 只有能访问内网的用户才能使用API

## 📋 部署步骤

### 1. 网络安全配置

```bash
# 防火墙配置 - 只开放前端端口到公网
sudo ufw allow 7990/tcp comment "DifyChatSite Frontend HTTPS"

# 确保后端端口只能内网访问
sudo ufw deny from any to any port 4005
sudo ufw allow from 192.168.1.0/24 to any port 4005 comment "DifyChatSite Backend - LAN only"

# 或者使用iptables
sudo iptables -A INPUT -p tcp --dport 7990 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 4005 -s 192.168.1.0/24 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 4005 -j DROP
```

### 2. Nginx 配置
使用安全配置文件 `nginx/difychat-secure.conf`（已生成）

### 3. 后端CORS配置
更新后端允许的来源：

```javascript
// 后端 CORS 配置示例
const corsOptions = {
  origin: [
    'https://nas.pznas.com:7990',  // 允许来自前端域名的请求
    'http://192.168.1.90:7990',   // 允许直接IP访问（可选）
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
```

### 4. 前端环境变量
前端已自动配置为：
- 通过 `nas.pznas.com` 访问时 → 直连 `http://192.168.1.90:4005`
- API地址: `http://192.168.1.90:4005/api`
- WebSocket: `http://192.168.1.90:4005`

### 5. 部署脚本
```bash
#!/bin/bash
echo "🔒 安全部署 DifyChatSite..."

# 使用安全nginx配置
sudo cp nginx/difychat-secure.conf /etc/nginx/sites-available/difychat.conf

# 部署前端文件
sudo cp -r ./* /var/www/difychat/
sudo chown -R www-data:www-data /var/www/difychat

# 配置nginx
sudo ln -sf /etc/nginx/sites-available/difychat.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 配置防火墙
echo "🛡️ 配置防火墙..."
sudo ufw allow 7990/tcp comment "Frontend HTTPS"
sudo ufw deny from any to any port 4005
sudo ufw allow from 192.168.1.0/24 to any port 4005 comment "Backend LAN only"

echo "✅ 安全部署完成!"
echo "🌐 前端访问: https://nas.pznas.com:7990"
echo "🔒 后端API: 仅内网可访问 http://192.168.1.90:4005"
```

## 🔍 安全验证

### 1. 验证API不可公网访问
```bash
# 从外网测试 - 应该失败
curl -v http://your-public-ip:4005/api/health
curl -v https://nas.pznas.com:4005/api/health

# 从内网测试 - 应该成功
curl -v http://192.168.1.90:4005/api/health
```

### 2. 验证前端功能正常
```bash
# 前端应该正常访问
curl -v https://nas.pznas.com:7990

# 浏览器控制台检查API调用
# 应该看到对 http://192.168.1.90:4005/api/* 的请求
```

### 3. 端口扫描测试
```bash
# 从外网扫描 - 4005端口应该不可达
nmap -p 4005 your-public-ip

# 从内网扫描 - 4005端口应该开放
nmap -p 4005 192.168.1.90
```

## ⚠️ 重要注意事项

### 1. 浏览器混合内容警告
由于前端是HTTPS，后端是HTTP，可能出现混合内容警告：

**解决方案A: 允许不安全内容**
```javascript
// 在前端添加meta标签
<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
```

**解决方案B: 后端也配置SSL（推荐）**
```nginx
# 为内网后端也配置SSL
server {
    listen 4005 ssl;
    server_name 192.168.1.90;
    ssl_certificate /etc/ssl/certs/internal.crt;
    ssl_certificate_key /etc/ssl/private/internal.key;
    # ... 其他配置
}
```

**解决方案C: 使用nginx内网代理**
```nginx
# 在同一台服务器上为后端配置内网SSL代理
server {
    listen 4006 ssl;  # 新端口
    server_name 192.168.1.90;
    
    ssl_certificate /etc/ssl/certs/internal.crt;
    ssl_certificate_key /etc/ssl/private/internal.key;
    
    location / {
        proxy_pass http://127.0.0.1:4005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. 网络访问要求
- 用户必须能访问内网192.168.1.90（通过VPN或在同一网络）
- 如果用户在外网，需要VPN连接到内网才能使用API功能

### 3. 替代方案：仅内网部署
如果所有用户都在内网，可以考虑：
```bash
# 仅绑定内网IP
server {
    listen 192.168.1.90:7990 ssl;
    server_name nas.pznas.com;
    # ... 配置
}
```

## 🚀 快速部署命令

```bash
# 1. 下载安全配置
wget -O deploy-secure.sh https://your-repo/deploy-secure.sh

# 2. 执行安全部署
chmod +x deploy-secure.sh
sudo ./deploy-secure.sh

# 3. 验证部署
./check-security.sh
```

## 📊 访问模式对比

| 模式 | 前端访问 | API访问 | 安全性 | 适用场景 |
|------|----------|---------|---------|----------|
| 完全代理 | 公网HTTPS | 公网HTTPS | 中等 | 完全公网应用 |
| **安全模式** | **公网HTTPS** | **内网HTTP** | **高** | **企业内网应用** |
| 完全内网 | 内网HTTPS | 内网HTTP | 最高 | 纯内网应用 |

推荐使用**安全模式**，既保证了前端的公网访问，又确保了API的安全性。
