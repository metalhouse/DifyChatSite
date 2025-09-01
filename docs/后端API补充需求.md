# 后端API补充需求

## 概述
经过前端页面测试，发现个人资料页面(profile.html)所需的部分API功能尚未完整实现。以下是需要补充或修改的API接口。

## 已存在的API（工作正常）
✅ `GET /api/users/profile` - 获取用户基本信息
✅ `PUT /api/users/profile` - 更新用户基本信息  
✅ `GET /api/conversations/user/stats` - 获取用户统计信息

## 需要新增的API

### 1. 修改密码API
**接口地址**: `POST /api/auth/change-password`

**请求参数**:
```json
{
    "currentPassword": "当前密码",
    "newPassword": "新密码",
    "confirmPassword": "确认新密码"
}
```

**响应格式**:
```json
{
    "success": true,
    "message": "密码修改成功",
    "data": null
}
```

**业务逻辑要求**:
- 验证当前密码是否正确
- 验证新密码强度（至少8位，包含大小写字母、数字、特殊字符）
- 验证新密码与确认密码一致
- 更新数据库中的密码（需要加密存储）
- 可选：密码修改后让用户重新登录

## 需要优化的API

### 1. 用户资料更新API优化
**当前接口**: `PUT /api/users/profile`

**建议优化**:
- 确保支持 `nickname` 字段（显示名称）
- 确保支持 `phone` 字段（手机号码）
- 增加字段验证：
  - `email` 格式验证
  - `phone` 格式验证（中国手机号）
  - `nickname` 长度限制（2-20字符）

**当前请求格式**:
```json
{
    "nickname": "显示名称",
    "email": "邮箱地址",
    "phone": "手机号码",
    "company": "公司名称（可选）",
    "bio": "个人简介（可选）"
}
```

### 2. 用户统计API优化
**当前接口**: `GET /api/conversations/user/stats`

**当前返回格式**（已正确）:
```json
{
    "success": true,
    "message": "获取统计信息成功",
    "data": {
        "conversation_stats": {
            "total": 13,
            "active": 2,
            "archived": 0,
            "today_new": 1
        },
        "message_stats": {
            "total": 101,
            "today": 2,
            "user_messages": 101,
            "assistant_messages": 0
        }
    }
}
```

**建议增加字段**:
```json
{
    "conversation_stats": {
        "total": "总对话数",
        "active": "活跃对话数",
        "archived": "已归档对话数",
        "today_new": "今日新建对话数"
    },
    "message_stats": {
        "total": "总消息数",
        "today": "今日消息数",
        "user_messages": "用户发送消息数",
        "assistant_messages": "助手回复消息数"
    },
    "usage_stats": {
        "login_count": "登录次数",
        "last_login_at": "最后登录时间",
        "online_duration": "在线时长（小时）"
    }
}
```

## API字段映射说明

### 用户信息字段对应关系
前端使用的字段名 -> 后端数据库字段名：
- `displayName` -> `nickname`
- `email` -> `email`
- `phone` -> `phone`
- `company` -> `company`（需新增）
- `bio` -> `bio`（需新增）

### 统计信息字段对应关系
前端期望字段 -> 后端当前字段：
- `chatCount` -> `conversation_stats.total`
- `messageCount` -> `message_stats.total`
- `onlineTime` -> 需计算（基于登录记录或消息活跃度）

## 数据库表结构建议

### users表需要的字段
```sql
-- 如果不存在，建议添加以下字段
ALTER TABLE users ADD COLUMN company VARCHAR(100) DEFAULT NULL COMMENT '公司/组织';
ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL COMMENT '个人简介';
```

## 安全性要求

### 密码修改安全
1. **验证当前密码**：必须验证用户输入的当前密码正确
2. **密码强度检查**：
   - 最小长度8位
   - 包含大写字母
   - 包含小写字母
   - 包含数字
   - 包含特殊字符
3. **密码加密存储**：使用bcrypt或类似算法
4. **操作日志**：记录密码修改操作

### 个人信息更新安全
1. **权限验证**：只能修改自己的信息
2. **输入验证**：
   - 邮箱格式验证
   - 手机号格式验证
   - 防止XSS攻击
3. **敏感信息保护**：确保不会泄露其他用户信息

## 错误处理要求

### 统一错误响应格式
```json
{
    "success": false,
    "message": "具体错误信息",
    "code": "错误代码",
    "data": null
}
```

### 常见错误情况
- `CURRENT_PASSWORD_INCORRECT` - 当前密码不正确
- `PASSWORD_TOO_WEAK` - 密码强度不够
- `EMAIL_FORMAT_INVALID` - 邮箱格式不正确
- `PHONE_FORMAT_INVALID` - 手机号格式不正确
- `NICKNAME_TOO_LONG` - 昵称过长

## 开发优先级

### 高优先级（必须）
1. ✅ 修改密码API (`POST /api/auth/change-password`)

### 中优先级（建议）
2. 用户资料API字段优化（支持company、bio字段）
3. 统计API增加用户活跃度数据

### 低优先级（可选）
4. 用户活动日志记录
5. 密码修改邮件通知

## 测试要求

### 功能测试
- [ ] 密码修改功能测试（正确密码、错误密码、弱密码）
- [ ] 个人信息更新测试（各字段验证）
- [ ] 统计信息获取测试

### 安全测试
- [ ] SQL注入测试
- [ ] XSS攻击测试
- [ ] 权限越权测试

## 前端对接说明

目前前端已经按照以上API规格进行了适配：
- 用户信息获取和更新功能已完成
- 统计信息展示功能已完成
- 密码修改功能暂时显示"功能开发中"提示

后端实现完成后，前端无需额外修改即可正常工作。

---
**整理时间**: 2025年9月1日  
**整理人**: GitHub Copilot  
**前端测试状态**: 除密码修改外其他功能正常
