#!/bin/bash

# DifyChatSite 系统完整测试脚本
# 测试前端、SSL代理、后端API的完整链路

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🧪 DifyChatSite 系统完整测试${NC}"
echo "=================================="
echo ""

# 测试计数
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "🔍 $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        if [[ "$expected_result" == "success" ]]; then
            echo -e "${GREEN}✅ 通过${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}❌ 失败 (应该失败但成功了)${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    else
        if [[ "$expected_result" == "fail" ]]; then
            echo -e "${GREEN}✅ 通过 (预期失败)${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}❌ 失败${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    fi
}

echo -e "${YELLOW}📋 第一部分: 基础服务检查${NC}"
echo "--------------------------------"

# 1. 检查Nginx服务
run_test "Nginx服务状态" "systemctl is-active nginx" "success"

# 2. 检查端口监听
run_test "前端端口7990监听" "netstat -tuln | grep ':7990 '" "success"
run_test "后端代理端口4006监听" "netstat -tuln | grep ':4006 '" "success"

# 3. 检查SSL证书
run_test "前端SSL证书存在" "test -f /etc/ssl/certs/nas.pznas.com.crt" "success"
run_test "后端SSL证书存在" "test -f /etc/ssl/certs/backend-internal.crt" "success"

echo ""
echo -e "${YELLOW}📋 第二部分: 前端服务测试${NC}"
echo "--------------------------------"

# 4. 前端HTTPS访问
run_test "前端HTTPS访问" "curl -k -s -f https://nas.pznas.com:7990" "success"
run_test "前端HTTP重定向" "curl -s -I http://nas.pznas.com:7990 | grep '301'" "success"

# 5. 静态文件测试
run_test "前端index.html存在" "test -f /var/www/difychat/index.html" "success"
run_test "前端配置文件存在" "test -f /var/www/difychat/config/env.js" "success"

echo ""
echo -e "${YELLOW}📋 第三部分: 后端服务测试${NC}"
echo "--------------------------------"

# 6. 后端HTTP服务测试
echo -n "🔍 后端HTTP服务(127.0.0.1:4005)... "
if curl -s -f http://127.0.0.1:4005/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 通过${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    BACKEND_RUNNING=true
else
    echo -e "${YELLOW}⚠️ 后端未运行${NC}"
    BACKEND_RUNNING=false
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 7. SSL代理测试
if [[ "$BACKEND_RUNNING" == "true" ]]; then
    run_test "SSL代理健康检查" "curl -k -s -f https://192.168.1.90:4006/health" "success"
    run_test "SSL代理API访问" "curl -k -s -f https://192.168.1.90:4006/api/health" "success"
else
    echo "⏭️ 跳过SSL代理测试 (后端未运行)"
fi

echo ""
echo -e "${YELLOW}📋 第四部分: 安全性测试${NC}"
echo "--------------------------------"

# 8. 安全性验证
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
if [[ "$PUBLIC_IP" != "unknown" ]]; then
    run_test "后端不可公网访问" "timeout 10 curl -s -f http://$PUBLIC_IP:4005/health" "fail"
    run_test "SSL代理不暴露4005" "timeout 10 curl -k -s -f https://nas.pznas.com:4005/health" "fail"
else
    echo "⏭️ 跳过公网安全测试 (无法获取公网IP)"
fi

# 9. 防火墙检查
if command -v ufw > /dev/null 2>&1; then
    run_test "防火墙7990端口开放" "ufw status | grep '7990.*ALLOW'" "success"
    run_test "防火墙4006端口开放" "ufw status | grep '4006.*ALLOW'" "success"
fi

echo ""
echo -e "${YELLOW}📋 第五部分: CORS和跨域测试${NC}"
echo "--------------------------------"

if [[ "$BACKEND_RUNNING" == "true" ]]; then
    # 10. CORS预检测试
    echo -n "🔍 CORS预检请求测试... "
    CORS_RESULT=$(curl -s -X OPTIONS http://127.0.0.1:4005/api/test \
        -H "Origin: https://nas.pznas.com:7990" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization" \
        -w "%{http_code}")
    
    if [[ "$CORS_RESULT" =~ 200$ ]]; then
        echo -e "${GREEN}✅ 通过${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ 失败 (HTTP: ${CORS_RESULT})${NC}"
        echo -e "     ${YELLOW}建议检查后端CORS配置${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # 11. 通过代理的CORS测试
    echo -n "🔍 通过SSL代理的CORS测试... "
    PROXY_CORS_RESULT=$(curl -k -s -X OPTIONS https://192.168.1.90:4006/api/test \
        -H "Origin: https://nas.pznas.com:7990" \
        -H "Access-Control-Request-Method: POST" \
        -w "%{http_code}")
    
    if [[ "$PROXY_CORS_RESULT" =~ 200$ ]]; then
        echo -e "${GREEN}✅ 通过${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${YELLOW}⚠️ 需要检查 (HTTP: ${PROXY_CORS_RESULT})${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo "⏭️ 跳过CORS测试 (后端未运行)"
fi

echo ""
echo -e "${YELLOW}📋 第六部分: 配置验证${NC}"
echo "--------------------------------"

# 12. 前端配置检查
echo -n "🔍 前端环境配置检查... "
if grep -q "192.168.1.90:4006" /var/www/difychat/config/env.js 2>/dev/null; then
    echo -e "${GREEN}✅ 通过${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ 失败${NC}"
    echo -e "     ${YELLOW}前端配置可能不正确${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 13. Nginx配置检查
run_test "Nginx配置语法检查" "nginx -t" "success"

echo ""
echo -e "${BLUE}📊 测试结果汇总${NC}"
echo "=================================="
echo -e "总测试数: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo ""
    echo -e "${GREEN}🎉 所有测试通过！系统部署成功${NC}"
    echo ""
    echo -e "${CYAN}🌐 访问信息:${NC}"
    echo "  前端地址: https://nas.pznas.com:7990"
    echo "  API地址: https://192.168.1.90:4006 (通过SSL代理)"
    echo "  实际后端: http://127.0.0.1:4005 (本机安全)"
    echo ""
    echo -e "${YELLOW}💡 使用建议:${NC}"
    echo "  1. 在浏览器中访问 https://nas.pznas.com:7990"
    echo "  2. 打开开发者工具查看API请求"
    echo "  3. 确认API请求指向 https://192.168.1.90:4006"
    echo "  4. 如有SSL证书警告，点击继续访问"
elif [[ $FAILED_TESTS -le 2 && "$BACKEND_RUNNING" == "false" ]]; then
    echo ""
    echo -e "${YELLOW}⚠️ 基础设施部署完成，但后端服务未运行${NC}"
    echo ""
    echo -e "${CYAN}🔧 下一步操作:${NC}"
    echo "  1. 启动后端服务在 127.0.0.1:4005"
    echo "  2. 根据 BACKEND_REQUIREMENTS.md 配置后端"
    echo "  3. 重新运行此测试脚本验证"
else
    echo ""
    echo -e "${RED}❌ 发现问题，请检查失败的测试项${NC}"
    echo ""
    echo -e "${CYAN}🛠️ 故障排除:${NC}"
    echo "  • 检查Nginx配置: nginx -t"
    echo "  • 查看Nginx日志: tail -f /var/log/nginx/error.log"
    echo "  • 检查防火墙状态: ufw status"
    echo "  • 验证SSL证书: openssl x509 -in /etc/ssl/certs/nas.pznas.com.crt -text"
    echo "  • 检查端口监听: netstat -tuln | grep -E '7990|4006|4005'"
fi

echo ""
echo -e "${BLUE}🔧 系统信息:${NC}"
echo "Nginx版本: $(nginx -v 2>&1 | cut -d' ' -f3)"
echo "系统时间: $(date)"
echo "运行时间: $(uptime -p 2>/dev/null || uptime)"

exit $FAILED_TESTS
