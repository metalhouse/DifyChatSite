#!/bin/bash

echo "=== DifyChat 生产环境诊断脚本 ==="
echo "时间: $(date)"
echo

# 检查Nginx配置
echo "1. 检查 Nginx 配置..."
nginx -t
echo

# 检查端口监听
echo "2. 检查端口监听..."
netstat -tulpn | grep -E ':(4005|7990)'
echo

# 检查后端健康状态
echo "3. 检查后端健康状态..."
curl -s -o /dev/null -w "HTTP Status: %{http_code} | Response Time: %{time_total}s\n" \
    http://127.0.0.1:4005/health

curl -s -o /dev/null -w "HTTP Status: %{http_code} | Response Time: %{time_total}s\n" \
    https://www.pznas.com:7990/health
echo

# 检查文件API直接访问
echo "4. 测试后端文件API直接访问..."
echo "测试直接访问后端文件API (这应该返回401或403，表示需要token):"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
    http://127.0.0.1:4005/api/files/test

echo "测试通过Nginx代理访问文件API:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
    https://www.pznas.com:7990/api/files/test
echo

# 检查后端进程
echo "5. 检查后端进程..."
ps aux | grep -E '(node|npm|yarn|pm2).*4005' | head -5
echo

# 检查日志文件
echo "6. 检查最近的错误日志..."
echo "--- Nginx 错误日志 (最近5行) ---"
if [ -f /var/log/nginx/difychat-error.log ]; then
    tail -5 /var/log/nginx/difychat-error.log
else
    echo "日志文件不存在"
fi
echo

echo "--- 后端日志 (如果有) ---"
# 根据你的后端部署方式调整日志路径
if [ -f /var/log/difychat/backend.log ]; then
    tail -5 /var/log/difychat/backend.log
elif [ -f ~/.pm2/logs/difychat-error.log ]; then
    tail -5 ~/.pm2/logs/difychat-error.log
else
    echo "未找到后端日志文件"
fi
echo

# 检查文件存储目录
echo "7. 检查文件存储目录..."
echo "检查常见的文件存储路径："
for path in "/var/www/difychat-uploads" "/opt/difychat/uploads" "/tmp/difychat-uploads" "/home/*/difychat/uploads"; do
    if [ -d "$path" ]; then
        echo "✅ 找到: $path"
        ls -la "$path" | head -3
    else
        echo "❌ 不存在: $path"
    fi
done
echo

# 测试具体的文件访问
echo "8. 测试文件访问..."
echo "请手动替换下面的文件ID为实际的文件ID进行测试："
echo "curl -H 'Authorization: Bearer YOUR_TOKEN' https://www.pznas.com:7990/api/files/YOUR_FILE_ID/view"
echo

echo "=== 诊断完成 ==="
echo
echo "常见问题排查："
echo "1. 如果后端健康检查失败 -> 检查后端是否在4005端口运行"
echo "2. 如果文件API返回404 -> 检查后端文件服务配置和存储路径"
echo "3. 如果通过Nginx访问失败 -> 检查Nginx配置并重新加载"
echo "4. 如果权限问题 -> 检查文件存储目录的读写权限"
echo
echo "修复建议："
echo "1. 重启后端服务: systemctl restart difychat-backend"
echo "2. 重新加载Nginx: nginx -s reload"
echo "3. 检查防火墙: ufw status"
echo "4. 查看详细错误: journalctl -u difychat-backend -f"
