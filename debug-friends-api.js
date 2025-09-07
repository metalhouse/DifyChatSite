// 临时调试脚本：检查好友请求API状态
async function debugFriendRequestsAPI() {
    console.log('🔍 开始调试好友请求API...');
    
    // 1. 检查FriendsApi是否可用
    console.log('1. 检查FriendsApi状态:', typeof window.FriendsApi);
    
    if (!window.FriendsApi) {
        console.error('❌ FriendsApi 未加载');
        return;
    }
    
    // 2. 检查API配置
    console.log('2. API基础URL:', window.FriendsApi.baseURL);
    console.log('3. API端点配置:', window.FriendsApi.endpoints.REQUESTS);
    
    // 3. 检查Token
    const token = localStorage.getItem('access_token') || localStorage.getItem('dify_access_token');
    console.log('4. Token状态:', token ? 'Token存在' : '❌ 无Token');
    if (token) {
        console.log('   Token前20字符:', token.substring(0, 20) + '...');
    }
    
    // 4. 测试API连接
    try {
        console.log('5. 测试获取收到的请求...');
        const response = await window.FriendsApi.getReceivedRequests();
        console.log('✅ 收到请求API调用成功:', response);
        
        console.log('6. 测试获取发送的请求...');
        const sentResponse = await window.FriendsApi.getSentRequests();
        console.log('✅ 发送请求API调用成功:', sentResponse);
        
    } catch (error) {
        console.error('❌ API调用失败:', error);
        console.error('   错误详情:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        // 检查是否是网络错误
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            console.error('💡 这是网络连接错误，请检查:');
            console.error('   1. 后端服务是否启动 (通常在端口4005)');
            console.error('   2. CORS配置是否正确');
            console.error('   3. API地址配置是否正确');
        } else if (error.message.includes('401') || error.message.includes('认证失败')) {
            console.error('💡 这是认证错误，请检查:');
            console.error('   1. Token是否有效');
            console.error('   2. 是否需要重新登录');
        } else if (error.message.includes('404')) {
            console.error('💡 这是接口不存在错误，请检查:');
            console.error('   1. API端点路径是否正确');
            console.error('   2. 后端路由是否实现');
        }
    }
    
    console.log('🔍 API调试完成');
}

// 自动运行调试
if (typeof window !== 'undefined') {
    // 等待页面和脚本加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(debugFriendRequestsAPI, 1000);
        });
    } else {
        setTimeout(debugFriendRequestsAPI, 1000);
    }
}
