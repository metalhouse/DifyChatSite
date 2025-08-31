#!/bin/bash

echo "=== DifyChat Nginx 配置诊断 ==="
echo "诊断时间: $(date)"
echo

echo "1. 检查nginx服务状态"
systemctl status nginx | head -10
echo

echo "2. 检查nginx配置文件语法"
nginx -t
echo

echo "3. 检查网站根目录"
echo "目录: /var/www/DifyChatSite"
if [ -d "/var/www/DifyChatSite" ]; then
    echo "✅ 目录存在"
    echo "目录内容:"
    ls -la /var/www/DifyChatSite/
    echo
    
    if [ -f "/var/www/DifyChatSite/index.html" ]; then
        echo "✅ index.html 存在"
        echo "文件大小: $(du -h /var/www/DifyChatSite/index.html)"
        echo "文件权限: $(ls -l /var/www/DifyChatSite/index.html)"
    else
        echo "❌ index.html 不存在"
    fi
else
    echo "❌ 目录不存在"
fi
echo

echo "4. 检查端口监听"
echo "nginx监听的端口:"
netstat -tlnp | grep nginx || ss -tlnp | grep nginx
echo

echo "5. 检查配置文件"
echo "difychat.conf 位置:"
find /etc/nginx -name "difychat.conf" -type f 2>/dev/null
echo

echo "6. 检查nginx错误日志"
echo "最近的错误日志:"
tail -20 /var/log/nginx/error.log 2>/dev/null || echo "无法读取错误日志"
echo

echo "7. 检查网站访问日志"
echo "最近的访问日志:"
tail -10 /var/log/nginx/difychat-access.log 2>/dev/null || echo "无法读取访问日志"
echo

echo "8. 测试本地访问"
echo "测试本地7990端口:"
curl -I http://localhost:7990 2>/dev/null || echo "无法连接到localhost:7990"
echo

echo "=== 诊断完成 ==="
