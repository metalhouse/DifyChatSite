# Ubuntu 24 生产部署指南

## 🎯 针对你的环境优化

### 📂 Nginx配置目录结构
```
/etc/nginx/
├── conf.d/
│   ├── matrix.conf (你现有的配置) ✅
│   └── difychat.conf (新增的DifyChatSite配置) ✅
├── sites-available/ (可选，未使用)
└── sites-enabled/ (可选，未使用)
```

**优势**: 使用 `/etc/nginx/conf.d/` 目录与你现有的matrix.conf保持一致，避免混乱。

### 🔐 SSL证书目录推荐

根据Ubuntu 24最佳实践，SSL证书通常放在：

1. **系统标准目录**（推荐）：
   ```
   /etc/ssl/certs/nas.pznas.com.crt    # 证书文件
   /etc/ssl/private/nas.pznas.com.key  # 私钥文件
   ```

2. **Nginx专用目录**（备选）：
   ```
   /etc/nginx/ssl/nas.pznas.com.crt    # 证书文件
   /etc/nginx/ssl/nas.pznas.com.key    # 私钥文件
   ```

3. **与matrix.conf相同目录**（推荐，保持一致）：
   检查你的matrix.conf中的证书路径，使用相同目录

## 🚀 部署步骤

### 1. 检查现有配置
```bash
# 查看现有matrix配置的证书路径
sudo cat /etc/nginx/conf.d/matrix.conf | grep ssl_certificate

# 查看Nginx主配置是否包含conf.d
sudo cat /etc/nginx/nginx.conf | grep conf.d
```

### 2. 准备SSL证书
```bash
# 如果使用系统标准目录
sudo mkdir -p /etc/ssl/private
sudo chmod 710 /etc/ssl/private

# 复制或生成证书文件
sudo cp your-certificate.crt /etc/ssl/certs/nas.pznas.com.crt
sudo cp your-private.key /etc/ssl/private/nas.pznas.com.key

# 设置正确权限
sudo chmod 644 /etc/ssl/certs/nas.pznas.com.crt
sudo chmod 600 /etc/ssl/private/nas.pznas.com.key
sudo chown root:ssl-cert /etc/ssl/private/nas.pznas.com.key
```

### 3. 执行部署脚本
```bash
cd /path/to/DifyChatSite
sudo chmod +x deploy-production.sh
sudo ./deploy-production.sh
```

脚本会：
- ✅ 自动检测你的matrix.conf配置
- ✅ 提取现有SSL证书路径
- ✅ 自动配置DifyChatSite使用相同证书
- ✅ 在 `/etc/nginx/conf.d/` 创建 `difychat.conf`
- ✅ 不会影响现有matrix配置

## 🔧 手动配置（如果自动检测失败）

### 1. 编辑Nginx配置
```bash
sudo nano /etc/nginx/conf.d/difychat.conf
```

### 2. 更新SSL证书路径
```nginx
server {
    listen 7990 ssl http2;
    server_name nas.pznas.com;

    # 使用你的实际证书路径
    ssl_certificate /etc/ssl/certs/nas.pznas.com.crt;
    ssl_private_key /etc/ssl/private/nas.pznas.com.key;
    
    # ... 其他配置保持不变
}
```

### 3. 测试并重启
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## ⚖️ 端口冲突检查

确认端口不冲突：
```bash
# 检查matrix使用的端口
sudo grep -r "listen" /etc/nginx/conf.d/matrix.conf

# 检查7990端口是否空闲
sudo netstat -tlnp | grep 7990

# 如果7990已被占用，修改deploy-production.sh中的PORT变量
```

## 🛡️ 防火墙配置

```bash
# 开放DifyChatSite端口
sudo ufw allow 7990/tcp

# 检查防火墙状态
sudo ufw status
```

## 🔍 部署验证

### 1. 检查Nginx配置
```bash
# 查看所有配置文件
sudo ls -la /etc/nginx/conf.d/

# 应该看到:
# matrix.conf (你现有的)
# difychat.conf (新增的)
```

### 2. 检查服务状态
```bash
# 检查Nginx
sudo systemctl status nginx

# 检查DifyChatSite后端
sudo systemctl status difychat

# 检查端口监听
sudo netstat -tlnp | grep -E ":(7990|4005)"
```

### 3. 访问测试
```bash
# 测试HTTPS访问
curl -k https://nas.pznas.com:7990

# 测试API
curl -k https://nas.pznas.com:7990/api/health
```

## 📋 最佳实践建议

### 1. SSL证书管理
```bash
# 创建证书管理脚本
sudo tee /usr/local/bin/update-ssl-certs.sh << 'EOF'
#!/bin/bash
# 统一更新所有SSL证书
cp /path/to/new/cert.crt /etc/ssl/certs/nas.pznas.com.crt
cp /path/to/new/cert.key /etc/ssl/private/nas.pznas.com.key
chmod 644 /etc/ssl/certs/nas.pznas.com.crt
chmod 600 /etc/ssl/private/nas.pznas.com.key
nginx -t && systemctl reload nginx
EOF
sudo chmod +x /usr/local/bin/update-ssl-certs.sh
```

### 2. 配置备份
```bash
# 备份重要配置
sudo tar -czf ~/nginx-config-backup-$(date +%Y%m%d).tar.gz /etc/nginx/conf.d/
```

### 3. 日志监控
```bash
# 查看DifyChatSite访问日志
sudo tail -f /var/log/nginx/difychat-access.log

# 查看错误日志
sudo tail -f /var/log/nginx/difychat-error.log
```

## ❓ 常见问题

### Q1: 与matrix.conf冲突吗？
**A**: 不会冲突。使用不同端口（matrix用其端口，DifyChatSite用7990），配置独立。

### Q2: 可以使用相同SSL证书吗？
**A**: 可以，如果是通配符证书或包含多个域名的证书。

### Q3: 如何临时禁用DifyChatSite？
**A**: `sudo mv /etc/nginx/conf.d/difychat.conf /etc/nginx/conf.d/difychat.conf.disabled && sudo systemctl reload nginx`

### Q4: 如何查看部署状态？
**A**: 使用脚本生成的管理命令查看各服务状态。

---

## 🎉 总结

修改后的部署脚本将：
- ✅ 与你现有matrix.conf和谐共存
- ✅ 自动检测并复用SSL证书配置
- ✅ 使用标准的 `/etc/nginx/conf.d/` 目录
- ✅ 提供完整的Ubuntu 24适配

**不会有任何冲突，可以安全部署！** 🚀
