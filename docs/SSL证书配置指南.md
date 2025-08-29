# SSL证书配置指南

## 🔐 根据你的matrix.conf配置SSL

### 当前matrix.conf分析
```nginx
ssl_certificate /etc/ssl/certs/www.pznas.com_bundle.pem;
ssl_certificate_key /etc/ssl/private/www.pznas.com.key;
```

## 🎯 三种SSL配置方案

### 方案1: 使用相同证书（如果支持*.pznas.com）

如果你的www.pznas.com证书是通配符证书（*.pznas.com），可以直接使用：

```bash
# 创建软链接
sudo ln -s /etc/ssl/certs/www.pznas.com_bundle.pem /etc/ssl/certs/nas.pznas.com_bundle.pem
sudo ln -s /etc/ssl/private/www.pznas.com.key /etc/ssl/private/nas.pznas.com.key

# 修改nginx配置文件 /etc/nginx/conf.d/difychat.conf
ssl_certificate /etc/ssl/certs/nas.pznas.com_bundle.pem;
ssl_certificate_key /etc/ssl/private/nas.pznas.com.key;
```

### 方案2: 申请新的nas.pznas.com证书

```bash
# 使用certbot申请Let's Encrypt证书
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot certonly --nginx -d nas.pznas.com

# 证书会自动放置在
# /etc/letsencrypt/live/nas.pznas.com/fullchain.pem
# /etc/letsencrypt/live/nas.pznas.com/privkey.pem

# 修改nginx配置
ssl_certificate /etc/letsencrypt/live/nas.pznas.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/nas.pznas.com/privkey.pem;
```

### 方案3: 直接复用现有证书

```bash
# 直接在nginx配置中使用现有证书
# 修改 /etc/nginx/conf.d/difychat.conf
ssl_certificate /etc/ssl/certs/www.pznas.com_bundle.pem;
ssl_certificate_key /etc/ssl/private/www.pznas.com.key;
```

## 🛠️ 具体操作步骤

### 1. 检查现有证书的域名支持
```bash
# 查看证书支持的域名
sudo openssl x509 -in /etc/ssl/certs/www.pznas.com_bundle.pem -text -noout | grep -A 1 "Subject Alternative Name"
```

### 2. 根据检查结果选择方案

**如果看到包含nas.pznas.com或*.pznas.com**，使用方案1或方案3
**如果只有www.pznas.com**，使用方案2申请新证书

### 3. 修改nginx配置
```bash
# 编辑配置文件
sudo nano /etc/nginx/conf.d/difychat.conf

# 找到SSL配置部分，根据选择的方案修改：
ssl_certificate /path/to/your/certificate;
ssl_certificate_key /path/to/your/private_key;
```

### 4. 测试和重启
```bash
# 测试nginx配置
sudo nginx -t

# 重启nginx
sudo systemctl restart nginx
```

## 📝 推荐的nginx配置示例

```nginx
server {
    listen 7990 ssl http2;
    listen [::]:7990 ssl http2;
    server_name nas.pznas.com;

    # 选择其中一种SSL配置：
    
    # 方案1/3: 使用现有证书
    ssl_certificate /etc/ssl/certs/www.pznas.com_bundle.pem;
    ssl_certificate_key /etc/ssl/private/www.pznas.com.key;
    
    # 方案2: 使用Let's Encrypt新证书
    # ssl_certificate /etc/letsencrypt/live/nas.pznas.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/nas.pznas.com/privkey.pem;
    
    # 其他配置保持不变...
}
```

## 🔍 验证SSL配置

```bash
# 测试SSL连接
openssl s_client -connect nas.pznas.com:7990 -servername nas.pznas.com

# 或使用curl测试
curl -I https://nas.pznas.com:7990
```

## ⚠️ 注意事项

1. **证书权限**: 确保nginx用户能读取证书文件
2. **防火墙**: 确保7990端口已开放
3. **DNS解析**: 确保nas.pznas.com正确解析到你的服务器IP
4. **证书有效期**: 定期检查证书是否快过期
