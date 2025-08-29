#!/bin/bash

# DifyChatSite 故障排查和状态检查脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 DifyChatSite 系统状态检查${NC}"
echo "=================================="

# 1. 检查系统服务状态
echo -e "${YELLOW}📋 1. 系统服务状态${NC}"

echo -n "Nginx服务状态: "
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ 运行中${NC}"
else
    echo -e "${RED}❌ 停止${NC}"
    echo "   启动命令: sudo systemctl start nginx"
fi

echo -n "DifyChatSite后端服务: "
if systemctl is-active --quiet difychat; then
    echo -e "${GREEN}✅ 运行中${NC}"
else
    echo -e "${RED}❌ 停止${NC}"
    echo "   启动命令: sudo systemctl start difychat"
fi

# 2. 检查端口监听
echo -e "\n${YELLOW}📋 2. 端口监听状态${NC}"

echo -n "端口7990 (前端HTTPS): "
if netstat -tlnp 2>/dev/null | grep -q ":7990 "; then
    echo -e "${GREEN}✅ 监听中${NC}"
else
    echo -e "${RED}❌ 未监听${NC}"
fi

echo -n "端口4005 (后端HTTP): "
if netstat -tlnp 2>/dev/null | grep -q "127.0.0.1:4005"; then
    echo -e "${GREEN}✅ 监听中${NC}"
else
    echo -e "${RED}❌ 未监听${NC}"
fi

# 3. 检查配置文件
echo -e "\n${YELLOW}📋 3. 配置文件检查${NC}"

echo -n "Nginx配置文件: "
if [ -f "/etc/nginx/conf.d/difychat.conf" ]; then
    echo -e "${GREEN}✅ 存在${NC}"
    # 测试nginx配置
    if nginx -t >/dev/null 2>&1; then
        echo "   配置语法: ${GREEN}✅ 正确${NC}"
    else
        echo "   配置语法: ${RED}❌ 错误${NC}"
        echo "   检查命令: sudo nginx -t"
    fi
else
    echo -e "${RED}❌ 不存在${NC}"
fi

echo -n "后端环境配置: "
if [ -f "/opt/DifyChatSite-backend/.env" ]; then
    echo -e "${GREEN}✅ 存在${NC}"
else
    echo -e "${RED}❌ 不存在${NC}"
fi

# 4. 检查SSL证书
echo -e "\n${YELLOW}📋 4. SSL证书检查${NC}"

echo -n "SSL证书文件: "
if [ -f "/etc/ssl/certs/www.pznas.com_bundle.pem" ]; then
    echo -e "${GREEN}✅ 存在${NC}"
    # 检查证书有效期
    if openssl x509 -in /etc/ssl/certs/www.pznas.com_bundle.pem -checkend 86400 >/dev/null 2>&1; then
        echo "   证书有效期: ${GREEN}✅ 有效${NC}"
    else
        echo "   证书有效期: ${YELLOW}⚠️  即将过期或已过期${NC}"
    fi
else
    echo -e "${RED}❌ 不存在${NC}"
fi

echo -n "SSL私钥文件: "
if [ -f "/etc/ssl/private/www.pznas.com.key" ]; then
    echo -e "${GREEN}✅ 存在${NC}"
else
    echo -e "${RED}❌ 不存在${NC}"
fi

# 5. 检查文件权限
echo -e "\n${YELLOW}📋 5. 文件权限检查${NC}"

echo -n "前端文件目录权限: "
if [ -d "/var/www/DifyChatSite" ]; then
    OWNER=$(stat -c '%U:%G' /var/www/DifyChatSite)
    if [ "$OWNER" = "www-data:www-data" ]; then
        echo -e "${GREEN}✅ 正确 ($OWNER)${NC}"
    else
        echo -e "${YELLOW}⚠️  非标准 ($OWNER)${NC}"
        echo "   修复命令: sudo chown -R www-data:www-data /var/www/DifyChatSite"
    fi
else
    echo -e "${RED}❌ 目录不存在${NC}"
fi

echo -n "后端文件目录权限: "
if [ -d "/opt/DifyChatSite-backend" ]; then
    OWNER=$(stat -c '%U:%G' /opt/DifyChatSite-backend)
    echo -e "${GREEN}✅ 存在 ($OWNER)${NC}"
else
    echo -e "${RED}❌ 目录不存在${NC}"
fi

# 6. 连通性测试
echo -e "\n${YELLOW}📋 6. 连通性测试${NC}"

echo -n "后端健康检查: "
if curl -s http://127.0.0.1:4005/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 正常${NC}"
else
    echo -e "${RED}❌ 失败${NC}"
    echo "   检查后端服务是否启动"
fi

echo -n "前端HTTPS访问: "
if curl -s -k https://www.pznas.com:7990 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 正常${NC}"
else
    echo -e "${RED}❌ 失败${NC}"
    echo "   检查nginx和SSL证书配置"
fi

echo -n "API代理测试: "
if curl -s -k https://www.pznas.com:7990/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 正常${NC}"
else
    echo -e "${RED}❌ 失败${NC}"
    echo "   检查nginx代理配置"
fi

# 7. 防火墙检查
echo -e "\n${YELLOW}📋 7. 防火墙状态${NC}"

echo -n "UFW状态: "
if command -v ufw >/dev/null 2>&1; then
    UFW_STATUS=$(ufw status | head -1)
    if [[ $UFW_STATUS == *"active"* ]]; then
        echo -e "${GREEN}✅ 活动${NC}"
        # 检查端口7990是否允许
        if ufw status | grep -q "7990"; then
            echo "   端口7990: ${GREEN}✅ 已开放${NC}"
        else
            echo "   端口7990: ${YELLOW}⚠️  未明确开放${NC}"
            echo "   开放命令: sudo ufw allow 7990/tcp"
        fi
    else
        echo -e "${YELLOW}⚠️  非活动${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  UFW未安装${NC}"
fi

# 8. 最近日志
echo -e "\n${YELLOW}📋 8. 最近日志 (最后5条)${NC}"

echo "Nginx错误日志:"
if [ -f "/var/log/nginx/difychat-error.log" ]; then
    tail -5 /var/log/nginx/difychat-error.log 2>/dev/null | sed 's/^/   /' || echo "   (无错误日志)"
else
    echo "   日志文件不存在"
fi

echo "后端服务日志:"
journalctl -u difychat -n 3 --no-pager 2>/dev/null | sed 's/^/   /' || echo "   无法获取服务日志"

# 9. 系统资源
echo -e "\n${YELLOW}📋 9. 系统资源使用${NC}"

echo -n "磁盘空间: "
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 85 ]; then
    echo -e "${GREEN}✅ 正常 (${DISK_USAGE}%使用)${NC}"
else
    echo -e "${YELLOW}⚠️  较高 (${DISK_USAGE}%使用)${NC}"
fi

echo -n "内存使用: "
MEM_USAGE=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
echo -e "${GREEN}✅ ${MEM_USAGE}%${NC}"

# 10. 建议操作
echo -e "\n${BLUE}📋 10. 建议操作${NC}"

HAS_ISSUES=false

# 检查是否有停止的服务
if ! systemctl is-active --quiet nginx; then
    echo -e "${YELLOW}• 启动nginx: ${NC}sudo systemctl start nginx"
    HAS_ISSUES=true
fi

if ! systemctl is-active --quiet difychat; then
    echo -e "${YELLOW}• 启动后端服务: ${NC}sudo systemctl start difychat"
    HAS_ISSUES=true
fi

# 检查nginx配置
if ! nginx -t >/dev/null 2>&1; then
    echo -e "${YELLOW}• 修复nginx配置: ${NC}sudo nginx -t"
    HAS_ISSUES=true
fi

if [ "$HAS_ISSUES" = false ]; then
    echo -e "${GREEN}🎉 系统运行正常！${NC}"
    echo -e "   访问地址: ${BLUE}https://www.pznas.com:7990${NC}"
else
    echo -e "${YELLOW}⚠️  发现问题，请按上述建议处理${NC}"
fi

echo -e "\n${BLUE}=================================="
echo -e "检查完成时间: $(date)"
echo -e "====================================${NC}"
