# 后端生产环境配置说明
# 
# 根据专家建议，后端只需要提供HTTP/WS服务，不需要配置SSL
# SSL由前端Nginx统一处理
#
# 后端配置要点：
# 1. 只监听127.0.0.1:4005（本地接口）
# 2. 不对外暴露，只接受Nginx转发的请求
# 3. 启用CORS但配置为信任Nginx转发
# 4. 配置正确的WebSocket支持

# 环境变量配置 (.env)
NODE_ENV=production
PORT=4005
HOST=127.0.0.1

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=difychat_prod
DB_USER=difychat
DB_PASSWORD=your_secure_password

# Redis配置（如果使用）
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT配置
JWT_SECRET=your_very_secure_jwt_secret_here
JWT_EXPIRES_IN=24h

# Dify API配置
DIFY_API_BASE_URL=http://127.0.0.1:8000
DIFY_API_KEY=your_dify_api_key

# CORS配置 - 信任来自Nginx的请求
CORS_ORIGIN=https://nas.pznas.com:7990
CORS_CREDENTIALS=true

# WebSocket配置
WS_CORS_ORIGIN=https://nas.pznas.com:7990

# 安全配置
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000

# 日志配置
LOG_LEVEL=info
LOG_FILE=/var/log/difychat/app.log

# 文件上传配置
UPLOAD_MAX_SIZE=10485760
UPLOAD_DIR=/var/uploads/difychat

# Session配置
SESSION_SECRET=your_session_secret_here
SESSION_SECURE=false
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax
