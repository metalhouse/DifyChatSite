# 反代部署后端CORS配置指南

## 概述

为了支持通过 `https://nas.pznas.com:7990` 反向代理访问，后端需要配置相应的CORS设置来允许前端跨域请求。

## 必要的后端配置

### 1. CORS Origins 配置

后端需要在CORS配置中添加反代域名：

```bash
# 环境变量配置 (.env 文件)
CORS_ORIGINS=https://nas.pznas.com:7990,http://localhost:6005,http://127.0.0.1:6005

# 或者
FRONTEND_URL=https://nas.pznas.com:7990
```

### 2. Node.js/Express 示例配置

```javascript
const cors = require('cors');

// CORS 配置
const corsOptions = {
  origin: [
    'https://nas.pznas.com:7990',  // 反代地址
    'http://localhost:6005',       // 开发环境
    'http://127.0.0.1:6005'        // 开发环境
  ],
  credentials: true,  // 允许携带认证信息
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'Authorization'
  ]
};

app.use(cors(corsOptions));

// 预检请求处理
app.options('*', cors(corsOptions));
```

### 3. 基于现有代码的配置

根据项目中的API指南，后端应该已有类似配置：

```typescript
// src/app.ts
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(url => url.trim())
  : [process.env.FRONTEND_URL || 'http://localhost:6005'];

// 添加反代地址
corsOrigins.push('https://nas.pznas.com:7990');

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
```

### 4. WebSocket CORS 配置

如果使用 Socket.IO：

```javascript
const io = require('socket.io')(server, {
  cors: {
    origin: [
      'https://nas.pznas.com:7990',
      'http://localhost:6005',
      'http://127.0.0.1:6005'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

### 5. Nginx 反代服务器配置

如果使用 Nginx 作为反向代理：

```nginx
server {
    listen 443 ssl;
    server_name nas.pznas.com;
    
    # SSL 配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 反代到后端
    location /api/ {
        proxy_pass http://backend-server:4005/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS 头部（如果后端未设置）
        add_header Access-Control-Allow-Origin https://nas.pznas.com:7990 always;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header Access-Control-Allow-Headers 'Origin, X-Requested-With, Content-Type, Accept, Authorization' always;
        add_header Access-Control-Allow-Credentials true always;
        
        # 处理预检请求
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # WebSocket 支持
    location /ws/ {
        proxy_pass http://backend-server:4005/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 静态文件服务
    location / {
        proxy_pass http://frontend-server:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 验证配置

### 1. 浏览器开发者工具检查

部署后，在浏览器开发者工具中检查：
- Network 面板查看API请求是否成功
- Console 面板查看是否有CORS错误
- Application 面板查看认证Token是否正常存储

### 2. 健康检查

访问以下地址验证配置：
- `https://nas.pznas.com:7990/health` - 后端健康检查
- `https://nas.pznas.com:7990/api/health` - API健康检查

### 3. 前端配置验证

在浏览器控制台运行：

```javascript
// 检查反代配置
console.log(window.isReverseProxyEnvironment());
console.log(window.getReverseProxyConfig());

// 健康检查
window.reverseProxyHealthCheck().then(result => {
    console.log('健康检查结果:', result);
});

// 查看当前环境配置
console.log('当前环境配置:', window.ENV_CONFIG);
```

## 常见问题解决

### 1. CORS错误
- 确保后端CORS配置包含完整的反代地址（包括端口）
- 检查是否启用了 `credentials: true`
- 验证预检请求（OPTIONS）是否正确处理

### 2. WebSocket连接失败
- 确保使用 `wss://` 协议（而不是 `ws://`）
- 检查反代服务器是否正确转发WebSocket升级请求
- 验证后端WebSocket CORS配置

### 3. 认证问题
- 检查JWT Token是否能正确传递
- 验证Cookie设置（如果使用Cookie认证）
- 确保HTTPS环境下的安全策略正确

### 4. 请求超时
- 考虑增加超时时间（反代可能增加延迟）
- 检查反代服务器的超时配置
- 验证网络连接稳定性

## 部署检查清单

- [ ] 后端CORS配置添加反代域名
- [ ] 前端环境配置支持反代地址
- [ ] WebSocket配置支持WSS协议
- [ ] SSL证书配置正确
- [ ] 反代服务器配置正确
- [ ] 健康检查通过
- [ ] 认证功能正常
- [ ] WebSocket连接正常
- [ ] 所有API接口正常响应
