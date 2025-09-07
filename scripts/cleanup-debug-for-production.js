/**
 * 生产环境调试代码清理脚本
 * 清理不必要的调试代码，但保留关键错误处理
 */

const fs = require('fs');
const path = require('path');

// 需要清理的文件列表
const filesToClean = [
    'chatroom.html',
    'js/controllers/friends-controller.js',
    'js/controllers/chatroom-controller.js',
    'js/controllers/chat-controller.js'
];

// 保留的调试类型（生产环境需要的错误处理）
const keepPatterns = [
    /console\.error\([^)]*error/i,  // 保留错误处理日志
    /console\.warn\([^)]*认证失败/i, // 保留认证相关警告
    /console\.warn\([^)]*Token/i,   // 保留Token相关警告
    /console\.error\([^)]*初始化失败/i, // 保留初始化错误
    /console\.error\([^)]*加载.*失败/i, // 保留加载错误
];

// 需要清理的调试模式（开发调试用）
const cleanPatterns = [
    /console\.log\([^)]*🔍/g,      // 调试检查
    /console\.log\([^)]*🎨/g,      // 渲染调试
    /console\.log\([^)]*📊/g,      // 数据调试
    /console\.log\([^)]*🔧/g,      // 手动调试
    /console\.log\([^)]*✅/g,      // 成功标记
    /console\.log\([^)]*🔄/g,      // 刷新标记
    /console\.log\([^)]*📋/g,      // 列表调试
    /console\.log\([^)]*🤝/g,      // 好友功能调试
    /console\.log\([^)]*📤/g,      // 发送调试
    /console\.log\([^)]*🎯/g,      // 选择调试
    /console\.log\([^)]*🏠/g,      // 房间调试
    /console\.log\([^)]*📡/g,      // API调试
    /console\.log\(['"`][^'"`]*页面DOM加载完成[^'"`]*['"`][^)]*\);?/g,
    /console\.log\(['"`][^'"`]*初始化[^'"`]*['"`][^)]*\);?/g,
    /console\.log\(['"`][^'"`]*显示[^'"`]*模态框[^'"`]*['"`][^)]*\);?/g,
    /console\.log\(['"`][^'"`]*搜索用户[^'"`]*['"`][^)]*\);?/g,
    /console\.log\(['"`][^'"`]*发送好友请求给[^'"`]*['"`][^)]*\);?/g,
    // 清理alert调试（但保留确认对话框）
    /alert\(['"`][^'"`]*请输入[^'"`]*['"`]\);?/g,
    /alert\(['"`][^'"`]*好友请求发送成功[^'"`]*['"`]\);?/g,
    /alert\(['"`][^'"`]*功能暂不可用[^'"`]*['"`]\);?/g,
];

function shouldKeepLine(line) {
    // 检查是否包含需要保留的模式
    return keepPatterns.some(pattern => pattern.test(line));
}

function cleanDebugCode(content) {
    let cleanedContent = content;
    
    // 逐行处理，保留重要的错误处理
    const lines = content.split('\n');
    const cleanedLines = lines.map(line => {
        // 如果是重要的错误处理，保留
        if (shouldKeepLine(line)) {
            return line;
        }
        
        // 清理开发调试代码
        let cleanedLine = line;
        cleanPatterns.forEach(pattern => {
            cleanedLine = cleanedLine.replace(pattern, '');
        });
        
        // 清理空行
        if (cleanedLine.trim() === '') {
            return '';
        }
        
        return cleanedLine;
    });
    
    // 合并行，移除多余空行
    return cleanedLines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n'); // 最多保留两个换行符
}

function cleanFile(filePath) {
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
        console.warn(`文件不存在: ${fullPath}`);
        return false;
    }
    
    try {
        const originalContent = fs.readFileSync(fullPath, 'utf8');
        const cleanedContent = cleanDebugCode(originalContent);
        
        // 创建备份
        const backupPath = fullPath + '.debug-backup';
        fs.writeFileSync(backupPath, originalContent, 'utf8');
        
        // 写入清理后的内容
        fs.writeFileSync(fullPath, cleanedContent, 'utf8');
        
        console.log(`✅ 已清理: ${filePath}`);
        console.log(`   备份: ${backupPath}`);
        
        return true;
    } catch (error) {
        console.error(`❌ 清理失败 ${filePath}:`, error.message);
        return false;
    }
}

function main() {
    console.log('🧹 开始清理生产环境调试代码...');
    console.log('🔒 保留关键错误处理日志');
    console.log('🗑️ 清理开发调试代码\n');
    
    let successCount = 0;
    let totalCount = 0;
    
    filesToClean.forEach(file => {
        totalCount++;
        if (cleanFile(file)) {
            successCount++;
        }
    });
    
    console.log(`\n📊 清理完成: ${successCount}/${totalCount} 个文件`);
    
    if (successCount === totalCount) {
        console.log('✅ 所有文件清理成功，可以同步到生产环境');
    } else {
        console.log('⚠️ 部分文件清理失败，请检查后再同步');
    }
}

if (require.main === module) {
    main();
}

module.exports = { cleanDebugCode, cleanFile };
