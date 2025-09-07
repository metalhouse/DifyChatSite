#!/bin/bash

# 生产环境代码质量检查脚本

echo "🔍 检查生产环境代码质量..."

# 检查剩余的调试代码
echo "📊 剩余调试代码统计:"

# 检查console.log数量 (排除注释的)
CONSOLE_LOGS=$(grep -r "console\.log(" . --include="*.html" --include="*.js" | grep -v "^\s*//" | grep -v "console\.log.*//.*注释" | wc -l)
echo "- console.log: $CONSOLE_LOGS 处"

# 检查alert数量 (排除确认对话框)
ALERTS=$(grep -r "alert(" . --include="*.html" --include="*.js" | grep -v "confirm(" | wc -l)
echo "- alert(): $ALERTS 处"

# 检查confirm数量
CONFIRMS=$(grep -r "confirm(" . --include="*.html" --include="*.js" | wc -l)
echo "- confirm(): $CONFIRMS 处 (保留)"

# 检查console.error和console.warn (应该保留)
CONSOLE_ERRORS=$(grep -r "console\.error(" . --include="*.html" --include="*.js" | wc -l)
CONSOLE_WARNS=$(grep -r "console\.warn(" . --include="*.html" --include="*.js" | wc -l)
echo "- console.error: $CONSOLE_ERRORS 处 (保留)"
echo "- console.warn: $CONSOLE_WARNS 处 (保留)"

echo ""
echo "🎯 清理建议:"

if [ $CONSOLE_LOGS -lt 10 ]; then
    echo "✅ console.log 数量合理 ($CONSOLE_LOGS 处)"
else
    echo "⚠️ console.log 数量较多 ($CONSOLE_LOGS 处)，建议进一步清理"
fi

if [ $ALERTS -lt 5 ]; then
    echo "✅ alert 数量合理 ($ALERTS 处)"
else
    echo "⚠️ alert 数量较多 ($ALERTS 处)，建议检查是否为必要的用户提示"
fi

echo ""
echo "📋 关键文件检查:"

# 检查主要文件是否存在
FILES=("chatroom.html" "js/controllers/friends-controller.js" "assets/css/components.css")

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file 存在"
    else
        echo "❌ $file 不存在"
    fi
done

echo ""
echo "🚀 部署就绪状态:"

if [ $CONSOLE_LOGS -lt 10 ] && [ $ALERTS -lt 5 ]; then
    echo "✅ 代码已清理完毕，可以部署到生产环境"
    echo "📝 记得执行最终测试验证所有功能正常"
else
    echo "⚠️ 建议进一步清理调试代码后再部署"
fi

echo ""
echo "💡 提醒："
echo "- 错误处理日志 (console.error/warn) 已保留用于生产环境诊断"
echo "- 用户确认对话框 (confirm) 已保留作为交互功能"
echo "- 必要的用户提示 (部分alert) 已保留"
