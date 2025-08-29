#!/bin/bash

# DifyChatSite 快速修复脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 DifyChatSite 快速修复工具${NC}"
echo "=================================="

# 检查是否为root用户
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ 请使用sudo运行此脚本${NC}"
   exit 1
fi

# 修复选项菜单
show_menu() {
    echo -e "\n${YELLOW}请选择修复操作:${NC}"
    echo "1. 修复nginx配置语法错误"
    echo "2. 重启所有服务"
    echo "3. 修复文件权限"
    echo "4. 检查和修复SSL证书"
    echo "5. 重新部署前端文件"
    echo "6. 重新部署后端服务"
    echo "7. 完全重置部署"
    echo "8. 查看详细日志"
    echo "9. 退出"
    echo
}

# 1. 修复nginx配置
fix_nginx_config() {
    echo -e "${YELLOW}🔧 修复nginx配置...${NC}"
    
    # 备份当前配置
    cp /etc/nginx/conf.d/difychat.conf /etc/nginx/conf.d/difychat.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    # 检查配置文件语法
    if nginx -t; then
        echo -e "${GREEN}✅ nginx配置语法正确${NC}"
    else
        echo -e "${RED}❌ nginx配置有误，尝试修复...${NC}"
        
        # 常见问题修复
        sed -i 's/must-revalidate//g' /etc/nginx/conf.d/difychat.conf
        sed -i 's/gzip_proxied.*auth;/gzip_proxied expired no-cache no-store private auth;/g' /etc/nginx/conf.d/difychat.conf
        
        # 再次测试
        if nginx -t; then
            echo -e "${GREEN}✅ 配置修复成功${NC}"
            systemctl reload nginx
        else
            echo -e "${RED}❌ 自动修复失败，请手动检查配置${NC}"
            nginx -t
        fi
    fi
}

# 2. 重启所有服务
restart_services() {
    echo -e "${YELLOW}🔄 重启所有服务...${NC}"
    
    echo "重启nginx..."
    systemctl restart nginx
    sleep 2
    
    echo "重启difychat后端..."
    systemctl restart difychat
    sleep 3
    
    echo "检查服务状态..."
    if systemctl is-active --quiet nginx; then
        echo -e "Nginx: ${GREEN}✅ 运行中${NC}"
    else
        echo -e "Nginx: ${RED}❌ 停止${NC}"
    fi
    
    if systemctl is-active --quiet difychat; then
        echo -e "后端服务: ${GREEN}✅ 运行中${NC}"
    else
        echo -e "后端服务: ${RED}❌ 停止${NC}"
        echo "查看日志: journalctl -u difychat -f"
    fi
}

# 3. 修复文件权限
fix_permissions() {
    echo -e "${YELLOW}🔐 修复文件权限...${NC}"
    
    # 前端文件权限
    if [ -d "/var/www/DifyChatSite" ]; then
        chown -R www-data:www-data /var/www/DifyChatSite
        chmod -R 644 /var/www/DifyChatSite
        find /var/www/DifyChatSite -type d -exec chmod 755 {} \;
        echo -e "${GREEN}✅ 前端文件权限已修复${NC}"
    fi
    
    # 后端文件权限
    if [ -d "/opt/DifyChatSite-backend" ]; then
        chown -R www-data:www-data /opt/DifyChatSite-backend
        chmod 600 /opt/DifyChatSite-backend/.env 2>/dev/null
        echo -e "${GREEN}✅ 后端文件权限已修复${NC}"
    fi
    
    # SSL证书权限
    if [ -f "/etc/ssl/private/www.pznas.com.key" ]; then
        chmod 600 /etc/ssl/private/www.pznas.com.key
        chown root:ssl-cert /etc/ssl/private/www.pznas.com.key
        echo -e "${GREEN}✅ SSL证书权限已修复${NC}"
    fi
}

# 4. 检查SSL证书
check_ssl() {
    echo -e "${YELLOW}🔒 检查SSL证书...${NC}"
    
    CERT_FILE="/etc/ssl/certs/www.pznas.com_bundle.pem"
    KEY_FILE="/etc/ssl/private/www.pznas.com.key"
    
    if [ -f "$CERT_FILE" ]; then
        echo -e "证书文件: ${GREEN}✅ 存在${NC}"
        
        # 检查证书有效期
        if openssl x509 -in "$CERT_FILE" -checkend 86400 >/dev/null 2>&1; then
            EXPIRE_DATE=$(openssl x509 -in "$CERT_FILE" -enddate -noout | cut -d= -f2)
            echo -e "证书有效期: ${GREEN}✅ 有效 (到期: $EXPIRE_DATE)${NC}"
        else
            echo -e "证书有效期: ${RED}❌ 即将过期或已过期${NC}"
        fi
    else
        echo -e "证书文件: ${RED}❌ 不存在${NC}"
        echo "请将证书放在: $CERT_FILE"
    fi
    
    if [ -f "$KEY_FILE" ]; then
        echo -e "私钥文件: ${GREEN}✅ 存在${NC}"
    else
        echo -e "私钥文件: ${RED}❌ 不存在${NC}"
        echo "请将私钥放在: $KEY_FILE"
    fi
}

# 5. 重新部署前端
redeploy_frontend() {
    echo -e "${YELLOW}📱 重新部署前端...${NC}"
    
    read -p "请输入前端源码目录路径 [当前目录]: " SOURCE_DIR
    SOURCE_DIR=${SOURCE_DIR:-$(pwd)}
    
    if [ ! -d "$SOURCE_DIR" ]; then
        echo -e "${RED}❌ 源码目录不存在: $SOURCE_DIR${NC}"
        return 1
    fi
    
    # 备份现有文件
    if [ -d "/var/www/DifyChatSite" ]; then
        mv /var/www/DifyChatSite /var/www/DifyChatSite.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # 创建目录
    mkdir -p /var/www/DifyChatSite
    
    # 复制文件
    cp -r "$SOURCE_DIR"/*.html /var/www/DifyChatSite/ 2>/dev/null
    cp -r "$SOURCE_DIR"/assets /var/www/DifyChatSite/ 2>/dev/null
    cp -r "$SOURCE_DIR"/config /var/www/DifyChatSite/ 2>/dev/null
    cp -r "$SOURCE_DIR"/js /var/www/DifyChatSite/ 2>/dev/null
    cp -r "$SOURCE_DIR"/pages /var/www/DifyChatSite/ 2>/dev/null
    cp "$SOURCE_DIR"/favicon.ico /var/www/DifyChatSite/ 2>/dev/null
    
    # 设置权限
    chown -R www-data:www-data /var/www/DifyChatSite
    chmod -R 644 /var/www/DifyChatSite
    find /var/www/DifyChatSite -type d -exec chmod 755 {} \;
    
    echo -e "${GREEN}✅ 前端重新部署完成${NC}"
}

# 6. 重新部署后端
redeploy_backend() {
    echo -e "${YELLOW}⚙️  重新部署后端...${NC}"
    
    read -p "请输入后端源码目录路径: " BACKEND_SOURCE
    
    if [ ! -d "$BACKEND_SOURCE" ]; then
        echo -e "${RED}❌ 后端源码目录不存在: $BACKEND_SOURCE${NC}"
        return 1
    fi
    
    # 停止服务
    systemctl stop difychat
    
    # 备份现有文件
    if [ -d "/opt/DifyChatSite-backend" ]; then
        mv /opt/DifyChatSite-backend /opt/DifyChatSite-backend.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # 复制新文件
    mkdir -p /opt/DifyChatSite-backend
    cp -r "$BACKEND_SOURCE"/* /opt/DifyChatSite-backend/
    
    # 安装依赖
    cd /opt/DifyChatSite-backend
    npm install --production
    
    # 创建环境配置
    if [ ! -f ".env" ]; then
        cat > .env << 'EOF'
NODE_ENV=production
PORT=4005
HOST=127.0.0.1
CORS_ORIGIN=https://www.pznas.com:7990
WS_CORS_ORIGIN=https://www.pznas.com:7990
JWT_SECRET=your_jwt_secret_change_this
SESSION_SECRET=your_session_secret_change_this
EOF
    fi
    
    # 设置权限
    chown -R www-data:www-data /opt/DifyChatSite-backend
    chmod 600 .env
    
    # 启动服务
    systemctl start difychat
    
    echo -e "${GREEN}✅ 后端重新部署完成${NC}"
}

# 7. 完全重置
complete_reset() {
    echo -e "${YELLOW}🔄 完全重置部署...${NC}"
    
    read -p "⚠️  这将删除所有现有配置和数据，确定继续？(yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "操作已取消"
        return 0
    fi
    
    # 停止服务
    systemctl stop nginx difychat 2>/dev/null
    
    # 删除配置和数据
    rm -rf /var/www/DifyChatSite
    rm -rf /opt/DifyChatSite-backend
    rm -f /etc/nginx/conf.d/difychat.conf
    rm -f /etc/systemd/system/difychat.service
    
    # 重新加载systemd
    systemctl daemon-reload
    
    echo -e "${GREEN}✅ 重置完成，请重新运行部署脚本${NC}"
}

# 8. 查看日志
view_logs() {
    echo -e "${YELLOW}📋 选择要查看的日志:${NC}"
    echo "1. Nginx访问日志"
    echo "2. Nginx错误日志"
    echo "3. 后端服务日志"
    echo "4. 系统消息日志"
    
    read -p "请选择 (1-4): " LOG_CHOICE
    
    case $LOG_CHOICE in
        1)
            echo -e "${BLUE}Nginx访问日志 (最后50行):${NC}"
            tail -50 /var/log/nginx/difychat-access.log 2>/dev/null || echo "日志文件不存在"
            ;;
        2)
            echo -e "${BLUE}Nginx错误日志 (最后50行):${NC}"
            tail -50 /var/log/nginx/difychat-error.log 2>/dev/null || echo "日志文件不存在"
            ;;
        3)
            echo -e "${BLUE}后端服务日志 (最后50行):${NC}"
            journalctl -u difychat -n 50 --no-pager
            ;;
        4)
            echo -e "${BLUE}系统消息日志 (最后30行):${NC}"
            journalctl -n 30 --no-pager
            ;;
        *)
            echo "无效选择"
            ;;
    esac
    
    read -p "按回车键继续..."
}

# 主循环
while true; do
    show_menu
    read -p "请选择操作 (1-9): " choice
    
    case $choice in
        1)
            fix_nginx_config
            ;;
        2)
            restart_services
            ;;
        3)
            fix_permissions
            ;;
        4)
            check_ssl
            ;;
        5)
            redeploy_frontend
            ;;
        6)
            redeploy_backend
            ;;
        7)
            complete_reset
            ;;
        8)
            view_logs
            ;;
        9)
            echo -e "${BLUE}再见！${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}无效选择，请输入 1-9${NC}"
            ;;
    esac
    
    echo
    read -p "按回车键继续..."
    clear
done
