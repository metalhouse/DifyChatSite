// 聊天滚动调试工具
// 在浏览器控制台中运行这些函数来调试滚动问题

window.debugScroll = {
    // 检查当前滚动状态
    checkScrollStatus: function() {
        const chatroomMessages = document.getElementById('chatMessages');
        if (!chatroomMessages) {
            console.log('❌ 找不到chatMessages元素');
            return;
        }
        
        const computedStyle = window.getComputedStyle(chatroomMessages);
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const maxScrollTop = chatroomMessages.scrollHeight - chatroomMessages.clientHeight;
        const currentScrollTop = chatroomMessages.scrollTop;
        const isAtBottom = currentScrollTop >= maxScrollTop - 10;
        
        console.log('📏 滚动状态检查:', {
            scrollHeight: chatroomMessages.scrollHeight,
            clientHeight: chatroomMessages.clientHeight,
            scrollTop: currentScrollTop,
            maxScrollTop: maxScrollTop,
            paddingTop: paddingTop,
            paddingBottom: paddingBottom,
            isAtBottom: isAtBottom,
            distanceFromBottom: maxScrollTop - currentScrollTop,
            messageCount: chatroomMessages.children.length
        });
        
        return {
            element: chatroomMessages,
            isAtBottom,
            distanceFromBottom: maxScrollTop - currentScrollTop
        };
    },
    
    // 强制滚动到底部
    forceScrollToBottom: function() {
        const chatroomMessages = document.getElementById('chatMessages');
        if (!chatroomMessages) {
            console.log('❌ 找不到chatMessages元素');
            return;
        }
        
        const maxScrollTop = chatroomMessages.scrollHeight - chatroomMessages.clientHeight;
        chatroomMessages.scrollTop = maxScrollTop;
        
        // 使用最后一个消息元素
        const lastMessage = chatroomMessages.lastElementChild;
        if (lastMessage) {
            lastMessage.scrollIntoView({ 
                behavior: 'instant', 
                block: 'end',
                inline: 'nearest' 
            });
        }
        
        console.log('🔄 强制滚动完成');
        setTimeout(() => this.checkScrollStatus(), 100);
    },
    
    // 观察滚动变化
    watchScroll: function(duration = 10000) {
        const chatroomMessages = document.getElementById('chatMessages');
        if (!chatroomMessages) {
            console.log('❌ 找不到chatMessages元素');
            return;
        }
        
        console.log('👀 开始观察滚动变化，持续时间:', duration + 'ms');
        
        let lastScrollTop = chatroomMessages.scrollTop;
        let lastScrollHeight = chatroomMessages.scrollHeight;
        
        const observer = new MutationObserver(() => {
            const currentScrollTop = chatroomMessages.scrollTop;
            const currentScrollHeight = chatroomMessages.scrollHeight;
            
            if (currentScrollTop !== lastScrollTop || currentScrollHeight !== lastScrollHeight) {
                console.log('📈 滚动或内容变化:', {
                    scrollTop: `${lastScrollTop} → ${currentScrollTop}`,
                    scrollHeight: `${lastScrollHeight} → ${currentScrollHeight}`,
                    timestamp: new Date().toLocaleTimeString()
                });
                
                lastScrollTop = currentScrollTop;
                lastScrollHeight = currentScrollHeight;
            }
        });
        
        observer.observe(chatroomMessages, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style']
        });
        
        setTimeout(() => {
            observer.disconnect();
            console.log('⏰ 停止观察滚动变化');
        }, duration);
    }
};

console.log('🔧 聊天滚动调试工具已加载');
console.log('使用方法:');
console.log('- debugScroll.checkScrollStatus() // 检查当前滚动状态');
console.log('- debugScroll.forceScrollToBottom() // 强制滚动到底部');
console.log('- debugScroll.watchScroll() // 观察滚动变化');
