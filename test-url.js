// 测试文件URL生成
console.log('🔍 测试当前环境配置:');
console.log('getApiUrl():', window.ENV_CONFIG.getApiUrl());
console.log('缩略图URL测试:', `${window.ENV_CONFIG.getApiUrl()}/files/d050d9f3-3b16-4fcb-ae41-49f3b07bf7f8/thumbnail?size=150`);

// 测试FileAPI
const fileApi = new FileAPI();
console.log('FileAPI baseURL:', fileApi.baseURL);
console.log('FileAPI getFileUrl:', fileApi.getFileUrl('d050d9f3-3b16-4fcb-ae41-49f3b07bf7f8', 'thumbnail', 150));
