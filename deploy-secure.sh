#!/bin/bash

# DifyChatSite 安全一键部署脚本
# 特点：前端HTTPS公网访问，后端仅内网访问

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔒 DifyChatSite 安全部署启动${NC}"
echo -e "${CYAN}🎯 部署模式: 前端公网HTTPS + 后端内网HTTP${NC}"
echo ""

# 检查权限
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ 需要root权限运行此脚本${NC}"
   echo "请使用: sudo $0"
   exit 1
fi

echo -e "${YELLOW}📋 部署配置确认${NC}"
echo "前端访问: https://nas.pznas.com:7990"
echo "后端API:  http://192.168.1.90:4005 (仅内网)"
echo ""

read -p "确认继续部署? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "部署取消"
    exit 0
fi

# 1. 部署前端文件
echo -e "${YELLOW}📂 部署前端文件...${NC}"
mkdir -p /var/www/difychat
cp -r ./* /var/www/difychat/ 2>/dev/null || {
    echo -e "${RED}❌ 复制失败，请在项目根目录运行${NC}"
    exit 1
}

# 清理不需要的文件
rm -rf /var/www/difychat/.git 2>/dev/null || true
rm -rf /var/www/difychat/nginx 2>/dev/null || true
rm -f /var/www/difychat/deploy-secure.sh 2>/dev/null || true

chown -R www-data:www-data /var/www/difychat 2>/dev/null || chown -R nginx:nginx /var/www/difychat 2>/dev/null
find /var/www/difychat -type f -exec chmod 644 {} \;
find /var/www/difychat -type d -exec chmod 755 {} \;

echo -e "${GREEN}✅ 前端文件部署完成${NC}"

# 2. 配置Nginx（使用安全配置）
echo -e "${YELLOW}🔧 配置Nginx...${NC}"
if [[ -f "nginx/difychat-secure.conf" ]]; then
    cp "nginx/difychat-secure.conf" /etc/nginx/sites-available/difychat.conf
else
    echo -e "${RED}❌ 未找到安全nginx配置文件${NC}"
    exit 1
fi

ln -sf /etc/nginx/sites-available/difychat.conf /etc/nginx/sites-enabled/difychat.conf
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

if nginx -t; then
    echo -e "${GREEN}✅ Nginx配置测试通过${NC}"
else
    echo -e "${RED}❌ Nginx配置测试失败${NC}"
    exit 1
fi

# 3. 配置防火墙安全规则
echo -e "${YELLOW}🛡️ 配置防火墙...${NC}"

# 使用UFW
if command -v ufw > /dev/null 2>&1; then
    echo "使用UFW配置防火墙..."
    ufw --force enable
    ufw allow 22/tcp comment "SSH"
    ufw allow 7990/tcp comment "DifyChatSite Frontend HTTPS"
    
    # 拒绝4005端口的公网访问
    ufw deny 4005/tcp
    # 允许内网访问4005端口
    ufw allow from 192.168.1.0/24 to any port 4005 comment "Backend LAN only"
    ufw allow from 127.0.0.0/8 to any port 4005 comment "Backend localhost"
    
    echo "UFW规则已配置"
    ufw status
    
# 使用iptables
elif command -v iptables > /dev/null 2>&1; then
    echo "使用iptables配置防火墙..."
    
    # 允许已建立的连接
    iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
    
    # 允许回环
    iptables -A INPUT -i lo -j ACCEPT
    
    # 允许SSH
    iptables -A INPUT -p tcp --dport 22 -j ACCEPT
    
    # 允许7990端口（前端HTTPS）
    iptables -A INPUT -p tcp --dport 7990 -j ACCEPT
    
    # 允许内网访问4005端口（后端API）
    iptables -A INPUT -p tcp --dport 4005 -s 192.168.1.0/24 -j ACCEPT
    iptables -A INPUT -p tcp --dport 4005 -s 127.0.0.0/8 -j ACCEPT
    
    # 拒绝其他对4005端口的访问
    iptables -A INPUT -p tcp --dport 4005 -j DROP
    
    # 保存iptables规则（不同系统方法不同）
    if command -v iptables-save > /dev/null 2>&1; then
        iptables-save > /etc/iptables/rules.v4 2>/dev/null || iptables-save > /etc/iptables.rules 2>/dev/null || true
    fi
    
    echo "iptables规则已配置"
    iptables -L INPUT | grep -E "(7990|4005)"
else
    echo -e "${YELLOW}⚠️ 未检测到防火墙工具，请手动配置：${NC}"
    echo "- 开放7990端口到公网（前端HTTPS）"
    echo "- 4005端口仅允许内网192.168.1.0/24访问"
fi

# 4. 检查SSL证书
echo -e "${YELLOW}🔒 检查SSL证书...${NC}"
CERT_FILE="/etc/ssl/certs/nas.pznas.com.crt"
KEY_FILE="/etc/ssl/private/nas.pznas.com.key"

if [[ ! -f "$CERT_FILE" || ! -f "$KEY_FILE" ]]; then
    echo -e "${YELLOW}⚠️ SSL证书文件不存在，生成自签名证书...${NC}"
    
    mkdir -p /etc/ssl/certs /etc/ssl/private
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/C=CN/ST=State/L=City/O=DifyChatSite/CN=nas.pznas.com"
    
    chmod 600 "$KEY_FILE"
    chmod 644 "$CERT_FILE"
    
    echo -e "${GREEN}✅ 自签名证书生成完成${NC}"
    echo -e "${YELLOW}⚠️ 生产环境请使用正式SSL证书${NC}"
else
    echo -e "${GREEN}✅ SSL证书文件存在${NC}"
fi

# 5. 重启服务
echo -e "${YELLOW}🔄 重启服务...${NC}"
systemctl restart nginx
systemctl enable nginx

sleep 3

# 6. 验证部署
echo -e "${YELLOW}🔍 验证部署...${NC}"

# 检查nginx状态
if systemctl is-active nginx > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx服务运行中${NC}"
else
    echo -e "${RED}❌ Nginx服务未运行${NC}"
    systemctl status nginx
    exit 1
fi

# 检查端口监听
if netstat -tuln 2>/dev/null | grep :7990 > /dev/null || ss -tuln 2>/dev/null | grep :7990 > /dev/null; then
    echo -e "${GREEN}✅ 端口7990正在监听${NC}"
else
    echo -e "${RED}❌ 端口7990未监听${NC}"
fi

# 检查内网后端
if curl -s -f http://192.168.1.90:4005/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 内网后端API可访问${NC}"
else
    echo -e "${YELLOW}⚠️ 内网后端API不可访问（可能后端服务未启动）${NC}"
fi

# 7. 部署完成
echo ""
echo -e "${GREEN}🎉 安全部署完成！${NC}"
echo "=================================="
echo -e "🌐 前端访问: ${GREEN}https://nas.pznas.com:7990${NC}"
echo -e "🔒 后端API: ${GREEN}http://192.168.1.90:4005${NC} ${YELLOW}(仅内网)${NC}"
echo ""
echo -e "${BLUE}🛡️ 安全特性:${NC}"
echo "✅ 前端通过HTTPS提供服务"
echo "✅ 后端API仅内网可访问"
echo "✅ 防火墙规则已配置"
echo "✅ SSL证书已配置"
echo ""
echo -e "${YELLOW}📝 重要提醒:${NC}"
echo "• 确保DNS将nas.pznas.com解析到本服务器"
echo "• 确保后端服务在192.168.1.90:4005运行"
echo "• 用户需在内网环境或通过VPN访问才能使用API功能"
echo "• 浏览器可能显示混合内容警告（HTTPS前端访问HTTP后端）"
echo ""
echo -e "${CYAN}🔧 管理命令:${NC}"
echo "• 查看服务状态: systemctl status nginx"
echo "• 查看防火墙状态: ufw status 或 iptables -L"
echo "• 安全检查: ./check-security.sh"
echo "• 查看访问日志: tail -f /var/log/nginx/difychat.access.log"

# 提示运行安全检查
echo ""
echo -e "${BLUE}💡 建议运行安全检查脚本验证部署:${NC}"
echo "chmod +x check-security.sh && ./check-security.sh"
