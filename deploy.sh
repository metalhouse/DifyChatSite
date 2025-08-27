#!/bin/bash

# DifyChatSite 一键部署脚本
# 适用于: 192.168.1.90 服务器
# 域名: nas.pznas.com:7990
# 后端: 192.168.1.90:4005

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置变量
DEPLOY_DIR="/var/www/difychat"
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
SSL_CERT_DIR="/etc/ssl/certs"
SSL_KEY_DIR="/etc/ssl/private"
BACKUP_DIR="/tmp/difychat_backup_$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}🚀 DifyChatSite 部署脚本启动${NC}"
echo -e "${CYAN}📋 部署配置:${NC}"
echo -e "  • 前端目录: ${DEPLOY_DIR}"
echo -e "  • 域名: nas.pznas.com:7990"
echo -e "  • 后端: 192.168.1.90:4005"
echo ""

# 检查运行权限
check_privileges() {
    echo -e "${YELLOW}🔐 检查运行权限...${NC}"
    if [[ $EUID -eq 0 ]]; then
        echo -e "${GREEN}✅ 以root用户运行${NC}"
    else
        echo -e "${RED}❌ 需要root权限运行此脚本${NC}"
        echo "请使用: sudo $0"
        exit 1
    fi
}

# 检查系统要求
check_requirements() {
    echo -e "${YELLOW}📋 检查系统要求...${NC}"
    
    # 检查nginx
    if command -v nginx &> /dev/null; then
        echo -e "${GREEN}✅ Nginx已安装$(NC}"
        nginx -v
    else
        echo -e "${RED}❌ 未安装Nginx${NC}"
        echo "安装命令: apt-get install nginx 或 yum install nginx"
        exit 1
    fi
    
    # 检查curl
    if command -v curl &> /dev/null; then
        echo -e "${GREEN}✅ curl已安装${NC}"
    else
        echo -e "${YELLOW}⚠️ 未安装curl，正在安装...${NC}"
        apt-get update && apt-get install -y curl || yum install -y curl
    fi
}

# 检查SSL证书
check_ssl_certificates() {
    echo -e "${YELLOW}🔒 检查SSL证书...${NC}"
    
    CERT_FILE="${SSL_CERT_DIR}/nas.pznas.com.crt"
    KEY_FILE="${SSL_KEY_DIR}/nas.pznas.com.key"
    
    if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
        echo -e "${GREEN}✅ SSL证书文件存在${NC}"
        
        # 检查证书有效期
        EXPIRE_DATE=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
        echo -e "  📅 证书过期时间: $EXPIRE_DATE"
        
        # 检查证书中的域名
        CERT_DOMAINS=$(openssl x509 -text -noout -in "$CERT_FILE" | grep -A1 "Subject Alternative Name" | tail -n1 | tr ',' '\n' | grep -i "nas.pznas.com" || true)
        if [[ -n "$CERT_DOMAINS" ]]; then
            echo -e "${GREEN}✅ 证书包含nas.pznas.com域名${NC}"
        else
            echo -e "${YELLOW}⚠️ 证书可能不包含nas.pznas.com域名${NC}"
        fi
    else
        echo -e "${RED}❌ SSL证书文件缺失${NC}"
        echo -e "需要的文件:"
        echo -e "  • $CERT_FILE"
        echo -e "  • $KEY_FILE"
        echo ""
        echo -e "${YELLOW}如果没有SSL证书，请先获取证书或使用自签名证书进行测试${NC}"
        
        read -p "是否生成自签名证书进行测试? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            generate_self_signed_cert
        else
            echo -e "${RED}部署终止，请先准备SSL证书${NC}"
            exit 1
        fi
    fi
}

# 生成自签名证书
generate_self_signed_cert() {
    echo -e "${YELLOW}🔐 生成自签名SSL证书...${NC}"
    
    mkdir -p "${SSL_CERT_DIR}" "${SSL_KEY_DIR}"
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${SSL_KEY_DIR}/nas.pznas.com.key" \
        -out "${SSL_CERT_DIR}/nas.pznas.com.crt" \
        -subj "/C=CN/ST=State/L=City/O=Organization/CN=nas.pznas.com"
    
    chmod 600 "${SSL_KEY_DIR}/nas.pznas.com.key"
    chmod 644 "${SSL_CERT_DIR}/nas.pznas.com.crt"
    
    echo -e "${GREEN}✅ 自签名证书生成完成${NC}"
    echo -e "${YELLOW}⚠️ 自签名证书仅用于测试，生产环境请使用正式证书${NC}"
}

# 检查后端服务
check_backend_service() {
    echo -e "${YELLOW}🔍 检查后端服务...${NC}"
    
    BACKEND_URL="http://192.168.1.90:4005"
    
    if curl -s -f "${BACKEND_URL}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 后端服务运行正常 (192.168.1.90:4005)${NC}"
    else
        echo -e "${RED}❌ 无法连接到后端服务${NC}"
        echo -e "请确保:"
        echo -e "  • 后端服务在192.168.1.90:4005运行"
        echo -e "  • 防火墙允许4005端口访问"
        echo -e "  • 健康检查接口/health可访问"
        echo ""
        read -p "是否继续部署? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}部署终止${NC}"
            exit 1
        fi
    fi
}

# 创建备份
create_backup() {
    echo -e "${YELLOW}💾 创建备份...${NC}"
    
    mkdir -p "$BACKUP_DIR"
    
    # 备份现有网站文件
    if [[ -d "$DEPLOY_DIR" ]]; then
        echo -e "  📂 备份网站文件..."
        cp -r "$DEPLOY_DIR" "$BACKUP_DIR/website/"
    fi
    
    # 备份nginx配置
    if [[ -f "${NGINX_SITES}/difychat.conf" ]]; then
        echo -e "  ⚙️ 备份Nginx配置..."
        mkdir -p "$BACKUP_DIR/nginx"
        cp "${NGINX_SITES}/difychat.conf" "$BACKUP_DIR/nginx/"
    fi
    
    echo -e "${GREEN}✅ 备份创建完成: $BACKUP_DIR${NC}"
}

# 部署前端文件
deploy_frontend() {
    echo -e "${YELLOW}📂 部署前端文件...${NC}"
    
    # 创建部署目录
    mkdir -p "$DEPLOY_DIR"
    
    # 复制文件
    echo -e "  📋 复制前端文件..."
    cp -r ./* "$DEPLOY_DIR/" 2>/dev/null || {
        echo -e "${RED}❌ 复制文件失败，请确保在项目根目录运行脚本${NC}"
        exit 1
    }
    
    # 排除不需要的文件
    rm -rf "$DEPLOY_DIR/.git" 2>/dev/null || true
    rm -rf "$DEPLOY_DIR/node_modules" 2>/dev/null || true
    rm -rf "$DEPLOY_DIR/nginx" 2>/dev/null || true
    rm -f "$DEPLOY_DIR/deploy.sh" 2>/dev/null || true
    rm -f "$DEPLOY_DIR/DEPLOYMENT_GUIDE.md" 2>/dev/null || true
    
    # 设置权限
    chown -R www-data:www-data "$DEPLOY_DIR" 2>/dev/null || chown -R nginx:nginx "$DEPLOY_DIR" 2>/dev/null || true
    find "$DEPLOY_DIR" -type f -exec chmod 644 {} \;
    find "$DEPLOY_DIR" -type d -exec chmod 755 {} \;
    
    echo -e "${GREEN}✅ 前端文件部署完成${NC}"
}

# 配置nginx
configure_nginx() {
    echo -e "${YELLOW}🔧 配置Nginx...${NC}"
    
    # 复制nginx配置文件
    if [[ -f "nginx/difychat.conf" ]]; then
        echo -e "  📋 复制Nginx配置文件..."
        cp "nginx/difychat.conf" "${NGINX_SITES}/difychat.conf"
    else
        echo -e "${RED}❌ 未找到nginx配置文件 nginx/difychat.conf${NC}"
        exit 1
    fi
    
    # 启用站点
    echo -e "  🔗 启用站点配置..."
    ln -sf "${NGINX_SITES}/difychat.conf" "${NGINX_ENABLED}/difychat.conf"
    
    # 移除默认站点（如果存在）
    if [[ -f "${NGINX_ENABLED}/default" ]]; then
        echo -e "  🗑️ 移除默认站点配置..."
        rm -f "${NGINX_ENABLED}/default"
    fi
    
    echo -e "${GREEN}✅ Nginx配置完成${NC}"
}

# 测试nginx配置
test_nginx_config() {
    echo -e "${YELLOW}✅ 测试Nginx配置...${NC}"
    
    if nginx -t 2>/dev/null; then
        echo -e "${GREEN}✅ Nginx配置测试通过${NC}"
    else
        echo -e "${RED}❌ Nginx配置测试失败${NC}"
        echo -e "${YELLOW}配置错误详情:${NC}"
        nginx -t
        exit 1
    fi
}

# 重启nginx
restart_nginx() {
    echo -e "${YELLOW}🔄 重启Nginx服务...${NC}"
    
    if systemctl restart nginx; then
        echo -e "${GREEN}✅ Nginx重启成功${NC}"
    else
        echo -e "${RED}❌ Nginx重启失败${NC}"
        echo -e "${YELLOW}尝试查看错误日志:${NC}"
        systemctl status nginx
        exit 1
    fi
    
    # 设置开机自启
    systemctl enable nginx 2>/dev/null || true
}

# 部署后检查
post_deployment_check() {
    echo -e "${YELLOW}🔍 部署后检查...${NC}"
    
    sleep 3  # 等待服务启动
    
    # 检查nginx状态
    if systemctl is-active nginx > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Nginx服务运行中${NC}"
    else
        echo -e "${RED}❌ Nginx服务未运行${NC}"
    fi
    
    # 检查端口监听
    if netstat -tuln 2>/dev/null | grep :7990 > /dev/null || ss -tuln 2>/dev/null | grep :7990 > /dev/null; then
        echo -e "${GREEN}✅ 端口7990正在监听${NC}"
    else
        echo -e "${RED}❌ 端口7990未监听${NC}"
    fi
    
    # 检查HTTPS访问
    echo -e "  🌐 测试HTTPS访问..."
    if curl -k -s -f "https://nas.pznas.com:7990" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ HTTPS访问正常${NC}"
    else
        echo -e "${YELLOW}⚠️ HTTPS访问测试失败（可能是DNS或证书问题）${NC}"
    fi
    
    # 检查API代理
    echo -e "  🔌 测试API代理..."
    if curl -k -s -f "https://nas.pznas.com:7990/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API代理工作正常${NC}"
    else
        echo -e "${YELLOW}⚠️ API代理测试失败${NC}"
    fi
}

# 显示部署结果
show_deployment_result() {
    echo ""
    echo -e "${GREEN}🎉 部署完成！${NC}"
    echo -e "${CYAN}📊 部署信息:${NC}"
    echo -e "  🌐 前端访问: ${GREEN}https://nas.pznas.com:7990${NC}"
    echo -e "  🔌 API接口: ${GREEN}https://nas.pznas.com:7990/api${NC}"
    echo -e "  🏥 健康检查: ${GREEN}https://nas.pznas.com:7990/health${NC}"
    echo -e "  📂 网站目录: ${DEPLOY_DIR}"
    echo -e "  ⚙️ Nginx配置: ${NGINX_SITES}/difychat.conf"
    echo -e "  💾 备份目录: ${BACKUP_DIR}"
    echo ""
    echo -e "${YELLOW}📝 重要提醒:${NC}"
    echo -e "  • 确保DNS将nas.pznas.com解析到本服务器"
    echo -e "  • 确保防火墙开放7990端口"
    echo -e "  • 如使用自签名证书，浏览器会显示安全警告"
    echo -e "  • 生产环境建议使用正式SSL证书"
    echo ""
    echo -e "${CYAN}🔧 常用命令:${NC}"
    echo -e "  • 查看Nginx状态: systemctl status nginx"
    echo -e "  • 重启Nginx: systemctl restart nginx"
    echo -e "  • 查看Nginx日志: tail -f /var/log/nginx/difychat.error.log"
    echo -e "  • 测试配置: nginx -t"
}

# 错误恢复
rollback_deployment() {
    echo -e "${RED}❌ 部署失败，正在恢复...${NC}"
    
    if [[ -d "$BACKUP_DIR/website" ]]; then
        echo -e "  📂 恢复网站文件..."
        rm -rf "$DEPLOY_DIR"
        cp -r "$BACKUP_DIR/website" "$DEPLOY_DIR"
    fi
    
    if [[ -f "$BACKUP_DIR/nginx/difychat.conf" ]]; then
        echo -e "  ⚙️ 恢复Nginx配置..."
        cp "$BACKUP_DIR/nginx/difychat.conf" "${NGINX_SITES}/difychat.conf"
        nginx -t && systemctl reload nginx
    fi
    
    echo -e "${YELLOW}⚠️ 已尝试恢复到部署前状态${NC}"
}

# 错误处理
trap rollback_deployment ERR

# 主执行流程
main() {
    check_privileges
    check_requirements
    check_ssl_certificates
    check_backend_service
    create_backup
    deploy_frontend
    configure_nginx
    test_nginx_config
    restart_nginx
    post_deployment_check
    show_deployment_result
}

# 脚本参数处理
case "${1:-}" in
    --check-only)
        echo -e "${BLUE}🔍 仅执行检查模式${NC}"
        check_privileges
        check_requirements
        check_ssl_certificates
        check_backend_service
        echo -e "${GREEN}✅ 检查完成，系统准备就绪${NC}"
        ;;
    --help|-h)
        echo "DifyChatSite 部署脚本"
        echo ""
        echo "用法:"
        echo "  $0              执行完整部署"
        echo "  $0 --check-only 仅执行环境检查"
        echo "  $0 --help       显示此帮助信息"
        ;;
    *)
        main
        ;;
esac
