# 文件上传API快速参考

## 🚀 快速开始

### 基础配置
```javascript
const API_BASE_URL = 'http://localhost:4005/api';
const authToken = 'your_jwt_token'; // 从登录获取

// axios配置
axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
```

## 📤 核心API

### 1. 上传文件
```javascript
// POST /api/files/upload
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('access_level', 'private'); // private/room/public

const response = await axios.post('/files/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// 响应数据
const fileData = response.data.data;
console.log('文件ID:', fileData.id);
console.log('是否加密:', fileData.is_encrypted);
```

### 2. 查看文件
```javascript
// GET /api/files/{fileId}/view
const imageUrl = `${API_BASE_URL}/files/${fileId}/view`;

// 在img标签中使用
<img src={imageUrl} alt="图片" />
```

### 3. 获取文件列表
```javascript
// GET /api/files/my-files?type=image&page=1&limit=10
const response = await axios.get('/files/my-files', {
  params: { type: 'image', page: 1, limit: 10 }
});

const { files, pagination } = response.data.data;
```

### 4. 删除文件
```javascript
// DELETE /api/files/{fileId}
await axios.delete(`/files/${fileId}`);
```

## 💬 聊天中使用

### 发送图片消息
```javascript
// 1. 上传图片
const uploadResult = await uploadFile(imageFile, 'room');

// 2. 发送消息
await axios.post(`/chat-rooms/${roomId}/messages`, {
  content: '发送了一张图片',
  message_type: 'image',
  attachments: [uploadResult.id]
});
```

## 🔐 安全特性

- **自动加密**: 所有文件自动使用AES-256-GCM加密存储
- **透明解密**: 访问时自动解密，用户无感知  
- **权限控制**: private文件只有所有者可访问
- **JWT认证**: 所有API需要Bearer Token

## ⚠️ 重要限制

- **文件大小**: 最大10MB
- **支持格式**: JPEG, PNG, GIF, WebP, SVG
- **多文件上传**: 最多5个文件
- **缩略图**: 自动生成150px和400px两种规格

## 🎯 快速示例

### React组件
```jsx
function ImageUpload({ onUploaded }) {
  const [uploading, setUploading] = useState(false);
  
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/files/upload', formData);
      onUploaded(response.data.data);
    } catch (error) {
      alert('上传失败: ' + error.response?.data?.message);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <input 
      type="file" 
      accept="image/*" 
      onChange={handleUpload}
      disabled={uploading}
    />
  );
}
```

### 错误处理
```javascript
function handleError(error) {
  switch (error.response?.data?.error) {
    case 'UNAUTHORIZED':
      // 重新登录
      window.location.href = '/login';
      break;
    case 'FILE_TOO_LARGE':
      alert('文件过大，请选择小于10MB的文件');
      break;
    case 'INVALID_FILE_TYPE':
      alert('不支持的文件格式');
      break;
    default:
      alert('操作失败: ' + error.message);
  }
}
```

## 📱 响应格式

### 成功响应
```json
{
  "success": true,
  "message": "操作成功",
  "data": {
    "id": "file-uuid",
    "filename": "stored-filename.png",
    "original_name": "user-filename.png", 
    "mime_type": "image/png",
    "file_size": 1024,
    "is_encrypted": true,
    "url": "/api/files/xxx/view",
    "thumbnailUrl": "/api/files/xxx/thumbnail",
    "downloadUrl": "/api/files/xxx/download"
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "错误描述"
}
```

---
📖 **详细文档**: 请参考 `api-fileupload.md` 获取完整API文档
