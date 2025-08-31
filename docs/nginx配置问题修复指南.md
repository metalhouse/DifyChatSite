# Nginx 配置问题修复指南

## 当前问题
访问域名 `www.pznas.com:7990` 显示nginx默认页面而不是 `index.html`

## 可能原因及解决方案

### 1. 文件部署问题

**检查项目文件是否正确部署到服务器**

```bash
# 1. 检查目录是否存在
ls -la /var/www/DifyChatSite/

# 2. 如果目录不存在，创建并部署
sudo mkdir -p /var/www/DifyChatSite
sudo chown -R www-data:www-data /var/www/DifyChatSite
```

**将本地文件上传到服务器**
```bash
# 从本地项目目录上传文件（在本地执行）
scp -r ./* user@server:/var/www/DifyChatSite/

# 或者在服务器上使用git
cd /var/www/DifyChatSite
git pull origin main
```

### 2. 文件权限问题

```bash
# 设置正确的文件权限
sudo chown -R www-data:www-data /var/www/DifyChatSite
sudo chmod -R 644 /var/www/DifyChatSite
sudo chmod -R 755 /var/www/DifyChatSite/assets
```

### 3. Nginx配置重载

```bash
# 测试nginx配置
sudo nginx -t

# 重载nginx配置
sudo systemctl reload nginx

# 如果需要，重启nginx
sudo systemctl restart nginx
```

### 4. 防火墙和端口

```bash
# 检查7990端口是否开放
sudo ufw status
sudo ufw allow 7990

# 或者使用iptables
sudo iptables -A INPUT -p tcp --dport 7990 -j ACCEPT
```

### 5. DNS和访问测试

```bash
# 测试本地访问
curl -I http://localhost:7990

# 测试域名解析
nslookup www.pznas.com

# 测试HTTPS访问
curl -I https://www.pznas.com:7990
```

## 推荐解决步骤

### 步骤1: 运行诊断脚本
```bash
chmod +x scripts/nginx-diagnosis.sh
sudo bash scripts/nginx-diagnosis.sh
```

### 步骤2: 确保文件正确部署
```bash
# 检查关键文件是否存在
ls -la /var/www/DifyChatSite/index.html
ls -la /var/www/DifyChatSite/assets/
ls -la /var/www/DifyChatSite/js/
```

### 步骤3: 检查nginx配置
```bash
# 确认配置文件位置和内容
cat /etc/nginx/conf.d/difychat.conf

# 测试配置语法
sudo nginx -t
```

### 步骤4: 重启服务
```bash
sudo systemctl restart nginx
sudo systemctl status nginx
```

### 步骤5: 测试访问
```bash
# 本地测试
curl -I http://localhost:7990

# 查看日志
tail -f /var/log/nginx/difychat-error.log
tail -f /var/log/nginx/difychat-access.log
```

## 常见问题排除

### 问题1: 显示nginx默认页面
**原因**: 其他nginx配置文件优先级更高
**解决**: 
```bash
# 检查是否有冲突的配置
ls /etc/nginx/sites-enabled/
ls /etc/nginx/conf.d/

# 禁用默认站点
sudo rm /etc/nginx/sites-enabled/default
```

### 问题2: 403 Forbidden
**原因**: 文件权限问题
**解决**:
```bash
sudo chown -R www-data:www-data /var/www/DifyChatSite
sudo chmod -R 755 /var/www/DifyChatSite
```

### 问题3: 502 Bad Gateway
**原因**: 后端服务未启动
**解决**:
```bash
# 检查后端服务（端口4005）
netstat -tlnp | grep 4005
```

## SSL证书问题

如果SSL证书有问题，nginx可能无法启动：

```bash
# 检查证书文件
sudo ls -la /etc/ssl/certs/www.pznas.com_bundle.pem
sudo ls -la /etc/ssl/private/www.pznas.com.key

# 测试证书
sudo openssl x509 -in /etc/ssl/certs/www.pznas.com_bundle.pem -text -noout
```
