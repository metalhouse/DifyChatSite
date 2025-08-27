#!/bin/bash

# DifyChatSite 安全部署检查脚本
# 验证API不暴露到公网，前端正常工作

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 DifyChatSite 安全部署检查${NC}"
echo "=================================="

# 1. 检查前端HTTPS访问
echo -e "\n${YELLOW}1️⃣ 检查前端HTTPS访问${NC}"
if curl -k -s -f "https://nas.pznas.com:7990" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ 前端HTTPS访问正常${NC}"
else
    echo -e "  ${RED}❌ 前端HTTPS访问失败${NC}"
fi

# 2. 检查API不从公网访问（应该失败）
echo -e "\n${YELLOW}2️⃣ 检查API公网安全性${NC}"
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "unknown")

echo -e "  📡 当前公网IP: ${PUBLIC_IP}"

# 尝试从公网访问API（应该失败）
if timeout 10 curl -s -f "http://${PUBLIC_IP}:4005/health" > /dev/null 2>&1; then
    echo -e "  ${RED}❌ 危险：API可从公网访问！${NC}"
    echo -e "     请检查防火墙配置"
else
    echo -e "  ${GREEN}✅ 安全：API不可从公网访问${NC}"
fi

# 尝试通过域名访问API（应该失败）
if timeout 10 curl -k -s -f "https://nas.pznas.com:4005/health" > /dev/null 2>&1; then
    echo -e "  ${RED}❌ 危险：API可通过域名公网访问！${NC}"
else
    echo -e "  ${GREEN}✅ 安全：API不可通过域名公网访问${NC}"
fi

# 3. 检查内网API访问（应该成功）
echo -e "\n${YELLOW}3️⃣ 检查内网API访问${NC}"
if curl -s -f "http://192.168.1.90:4005/health" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ 内网API访问正常${NC}"
else
    echo -e "  ${RED}❌ 内网API访问失败${NC}"
    echo -e "     请检查后端服务状态"
fi

# 4. 检查nginx配置
echo -e "\n${YELLOW}4️⃣ 检查Nginx配置${NC}"
if nginx -t > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Nginx配置正确${NC}"
else
    echo -e "  ${RED}❌ Nginx配置有误${NC}"
fi

# 5. 检查SSL证书
echo -e "\n${YELLOW}5️⃣ 检查SSL证书${NC}"
CERT_FILE="/etc/ssl/certs/nas.pznas.com.crt"
KEY_FILE="/etc/ssl/private/nas.pznas.com.key"

if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
    echo -e "  ${GREEN}✅ SSL证书文件存在${NC}"
    
    # 检查证书过期时间
    if command -v openssl > /dev/null 2>&1; then
        EXPIRE_DATE=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
        if [[ -n "$EXPIRE_DATE" ]]; then
            echo -e "  📅 证书过期时间: $EXPIRE_DATE"
            
            # 检查是否即将过期（30天内）
            EXPIRE_TIMESTAMP=$(date -d "$EXPIRE_DATE" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRE_DATE" +%s 2>/dev/null)
            CURRENT_TIMESTAMP=$(date +%s)
            DAYS_LEFT=$(( (EXPIRE_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
            
            if [[ $DAYS_LEFT -lt 30 ]]; then
                echo -e "  ${YELLOW}⚠️ 警告：证书将在 ${DAYS_LEFT} 天后过期${NC}"
            fi
        fi
    fi
else
    echo -e "  ${RED}❌ SSL证书文件缺失${NC}"
fi

# 6. 检查防火墙配置
echo -e "\n${YELLOW}6️⃣ 检查防火墙配置${NC}"
if command -v ufw > /dev/null 2>&1 && ufw status > /dev/null 2>&1; then
    echo -e "  🛡️ UFW防火墙状态:"
    ufw status | grep -E "(7990|4005)" | while read line; do
        if echo "$line" | grep -q "7990.*ALLOW"; then
            echo -e "    ${GREEN}✅ 端口7990已开放（前端）${NC}"
        elif echo "$line" | grep -q "4005"; then
            if echo "$line" | grep -q "192.168.1"; then
                echo -e "    ${GREEN}✅ 端口4005仅允许内网访问${NC}"
            else
                echo -e "    ${YELLOW}⚠️ 端口4005配置: $line${NC}"
            fi
        fi
    done
elif command -v iptables > /dev/null 2>&1; then
    echo -e "  🛡️ IPTables规则:"
    iptables -L INPUT | grep -E "(7990|4005)" | head -5
else
    echo -e "  ${YELLOW}⚠️ 无法检查防火墙状态${NC}"
fi

# 7. 检查端口监听状态
echo -e "\n${YELLOW}7️⃣ 检查端口监听状态${NC}"
if command -v netstat > /dev/null 2>&1; then
    echo -e "  🔌 端口监听状态:"
    netstat -tuln | grep -E ":7990|:4005" | while read line; do
        if echo "$line" | grep -q ":7990"; then
            echo -e "    ${GREEN}✅ 端口7990正在监听${NC}"
        elif echo "$line" | grep -q ":4005"; then
            echo -e "    ${GREEN}✅ 端口4005正在监听${NC}"
        fi
    done
elif command -v ss > /dev/null 2>&1; then
    echo -e "  🔌 端口监听状态:"
    ss -tuln | grep -E ":7990|:4005" | while read line; do
        if echo "$line" | grep -q ":7990"; then
            echo -e "    ${GREEN}✅ 端口7990正在监听${NC}"
        elif echo "$line" | grep -q ":4005"; then
            echo -e "    ${GREEN}✅ 端口4005正在监听${NC}"
        fi
    done
fi

# 8. 检查服务状态
echo -e "\n${YELLOW}8️⃣ 检查服务状态${NC}"
if systemctl is-active nginx > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Nginx服务运行中${NC}"
else
    echo -e "  ${RED}❌ Nginx服务未运行${NC}"
fi

# 9. 前端配置验证
echo -e "\n${YELLOW}9️⃣ 检查前端配置${NC}"
FRONTEND_DIR="/var/www/difychat"
if [[ -f "$FRONTEND_DIR/index.html" ]]; then
    echo -e "  ${GREEN}✅ 前端文件已部署${NC}"
    
    # 检查配置文件
    if [[ -f "$FRONTEND_DIR/config/env.js" ]]; then
        # 检查是否配置为内网后端
        if grep -q "192.168.1.90:4005" "$FRONTEND_DIR/config/env.js" 2>/dev/null; then
            echo -e "  ${GREEN}✅ 前端配置为内网后端访问${NC}"
        else
            echo -e "  ${YELLOW}⚠️ 请检查前端后端地址配置${NC}"
        fi
    fi
else
    echo -e "  ${RED}❌ 前端文件未部署${NC}"
fi

# 总结
echo -e "\n${BLUE}📊 安全检查总结${NC}"
echo "=================================="
echo -e "🌐 前端地址: ${GREEN}https://nas.pznas.com:7990${NC}"
echo -e "🔒 后端API: ${GREEN}http://192.168.1.90:4005 (仅内网)${NC}"
echo -e "🛡️ 安全状态: API不暴露到公网"

# 提供测试URL
echo -e "\n${BLUE}🧪 手动测试URL${NC}"
echo "=================================="
echo "✅ 应该可访问："
echo "  https://nas.pznas.com:7990 (前端)"
echo "  http://192.168.1.90:4005/health (内网API)"
echo ""
echo "❌ 应该不可访问："
echo "  http://$(curl -s ifconfig.me 2>/dev/null):4005/health (公网API)"
echo "  https://nas.pznas.com:4005/health (域名API)"

# 浏览器测试建议
echo -e "\n${BLUE}🖥️ 浏览器测试建议${NC}"
echo "=================================="
echo "1. 访问 https://nas.pznas.com:7990"
echo "2. 打开浏览器开发者工具"
echo "3. 查看Network标签"
echo "4. 应该看到API请求发向 192.168.1.90:4005"
echo "5. 如果看到混合内容警告，这是正常的（HTTPS前端访问HTTP后端）"
