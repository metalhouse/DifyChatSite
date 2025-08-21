/**
 * 环境变量配置管理
 * 基于前端对接API指南 - 第3章基础配置
 */

// 检测当前环境
const getEnvironment = () => {
  // 优先检查显式设置的环境变量
  if (window.ENVIRONMENT) {
    return window.ENVIRONMENT;
  }
  
  // 基于域名判断环境
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168.')) {
    return 'development';
  }
  
  return 'production';
};

const ENV = getEnvironment();

// 开发环境配置
const developmentConfig = {
  // API配置 - 基于指南第3.1节
  // 根据当前访问地址动态配置后端URL
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:4005' 
    : `http://${window.location.hostname}:4005`,
  API_PREFIX: '/api',
  WS_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4005'
    : `http://${window.location.hostname}:4005`,
  
  // 功能开关
  ENABLE_WEBSOCKET: true,
  ENABLE_ENCRYPTION: true,
  DEBUG_MODE: true,
  SHOW_DEV_TOOLS_NOTIFICATION: false, // 是否显示开发工具通知
  
  // WebSocket优化开关 - 后端WebSocket实时通知修复后的优化配置
  ENABLE_PERIODIC_REFRESH: false,     // 禁用定期刷新（WebSocket实时通知已正常工作）
  ENABLE_FOCUS_REFRESH: false,        // 禁用焦点刷新（WebSocket实时通知已正常工作）
  WEBSOCKET_REALTIME_READY: true,     // WebSocket实时通知已修复标识
  SHOW_READ_NOTIFICATIONS: false,     // 禁用已读消息弹窗通知（避免过多干扰）
  
  // 超时配置 - 基于指南第3.6节按场景区分
  API_TIMEOUT: 30000,        // 通用API超时 30秒
  DIFY_TIMEOUT: 120000,      // Dify AI专用超时 120秒（2分钟）
  UPLOAD_TIMEOUT: 180000,    // 文件上传超时 180秒（3分钟）
  WS_TIMEOUT: 60000,         // WebSocket超时 60秒
  
  // CORS配置
  WITH_CREDENTIALS: true,
  
  // 安全配置
  SECURE_MODE: false,
  SSL_VERIFY: false
};

// 生产环境配置
const productionConfig = {
  // API配置
  API_BASE_URL: window.PRODUCTION_API_URL || 'https://your-api-domain.com',
  API_PREFIX: '/api',
  WS_URL: window.PRODUCTION_WS_URL || 'https://your-api-domain.com',
  
  // 功能开关
  ENABLE_WEBSOCKET: true,
  ENABLE_ENCRYPTION: true,
  DEBUG_MODE: false,
  SHOW_DEV_TOOLS_NOTIFICATION: false, // 是否显示开发工具通知
  
  // WebSocket优化开关 - 生产环境配置
  ENABLE_PERIODIC_REFRESH: false,     // 禁用定期刷新（WebSocket实时通知正常工作）
  ENABLE_FOCUS_REFRESH: false,        // 禁用焦点刷新（WebSocket实时通知正常工作）
  WEBSOCKET_REALTIME_READY: true,     // WebSocket实时通知已修复标识
  
  // 超时配置 - 生产环境可能需要更长超时
  API_TIMEOUT: 30000,        // 通用API超时 30秒
  DIFY_TIMEOUT: 120000,      // Dify AI专用超时 120秒
  UPLOAD_TIMEOUT: 180000,    // 文件上传超时 180秒
  WS_TIMEOUT: 60000,         // WebSocket超时 60秒
  
  // CORS配置
  WITH_CREDENTIALS: true,
  
  // 安全配置
  SECURE_MODE: true,
  SSL_VERIFY: true
};

// 根据环境选择配置
const config = ENV === 'production' ? productionConfig : developmentConfig;

// 导出环境配置
export const ENV_CONFIG = {
  ...config,
  ENVIRONMENT: ENV,
  
  // 便捷的完整URL生成器
  getApiUrl: (path = '') => {
    const baseUrl = `${config.API_BASE_URL}${config.API_PREFIX}`;
    return path ? `${baseUrl}${path.startsWith('/') ? path : '/' + path}` : baseUrl;
  },
  
  // WebSocket URL生成器
  getWsUrl: () => config.WS_URL,
  
  // 调试信息
  isDebug: () => config.DEBUG_MODE,
  isDevelopment: () => ENV === 'development',
  isProduction: () => ENV === 'production'
};

// 同时挂载到全局对象，保持与其他配置文件的一致性
window.ENV_CONFIG = ENV_CONFIG;

// 控制台输出当前配置（仅开发环境）
if (config.DEBUG_MODE) {
  console.log('🔧 环境配置已加载:', {
    environment: ENV,
    apiBaseUrl: config.API_BASE_URL,
    wsUrl: config.WS_URL,
    timeouts: {
      api: config.API_TIMEOUT,
      dify: config.DIFY_TIMEOUT,
      upload: config.UPLOAD_TIMEOUT,
      websocket: config.WS_TIMEOUT
    }
  });
}

export default ENV_CONFIG;
