# 后端用户管理API需求文档

## 问题描述

前端管理后台在用户管理功能中存在以下问题：

### 1. 编辑用户功能缺失
- **现象**：点击用户列表中的"编辑"按钮没有任何反应
- **原因**：前端调用了 `editUser(userId)` 函数，但该函数尚未实现
- **影响**：管理员无法修改用户的角色、状态、邮箱等信息

### 2. 删除用户功能不完整
- **现象**：点击删除用户后，前端显示删除成功，但数据库中用户记录依然存在
- **原因**：可能是后端API未正确处理删除请求，或删除逻辑不完整
- **影响**：无法真正删除用户，造成数据冗余

---

## 需要后端提供的API接口

### 1. 获取单个用户详情 (用于编辑功能)

**接口路径**: `GET /admin/users/{userId}`

**请求参数**:
- `userId` (路径参数): 用户ID

**请求头**:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**响应格式**:
```json
{
  "success": true,
  "message": "获取用户详情成功",
  "data": {
    "id": "user_123456",
    "username": "testuser",
    "email": "test@example.com",
    "role": "user",
    "status": "active",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-20T14:20:00Z",
    "lastLogin": "2025-02-01T09:15:00Z",
    "profile": {
      "nickname": "测试用户",
      "avatar": "https://example.com/avatar.jpg"
    }
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "用户不存在",
  "errorCode": "USER_NOT_FOUND"
}
```

---

### 2. 更新用户信息

**接口路径**: `PUT /admin/users/{userId}`

**请求参数**:
- `userId` (路径参数): 用户ID

**请求体**:
```json
{
  "username": "newusername",      // 可选：用户名
  "email": "newemail@example.com",// 可选：邮箱
  "role": "admin",                 // 可选：角色 (user|admin|moderator)
  "status": "active",              // 可选：状态 (active|inactive|banned)
  "password": "newpassword123"     // 可选：新密码（如果需要修改）
}
```

**请求头**:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**响应格式**:
```json
{
  "success": true,
  "message": "用户信息更新成功",
  "data": {
    "id": "user_123456",
    "username": "newusername",
    "email": "newemail@example.com",
    "role": "admin",
    "status": "active",
    "updatedAt": "2025-02-02T10:30:00Z"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "邮箱已被使用",
  "errorCode": "EMAIL_ALREADY_EXISTS"
}
```

**业务规则**:
1. 用户名和邮箱必须唯一
2. 只有管理员可以修改用户角色
3. 修改密码时应进行哈希加密
4. 修改后应记录操作日志

---

### 3. 删除用户（需要修复）

**接口路径**: `DELETE /admin/users/{userId}`

**请求参数**:
- `userId` (路径参数): 用户ID

**请求头**:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**响应格式**:
```json
{
  "success": true,
  "message": "用户删除成功",
  "data": {
    "deletedUserId": "user_123456",
    "deletedAt": "2025-02-02T10:30:00Z"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "无法删除管理员账户",
  "errorCode": "CANNOT_DELETE_ADMIN"
}
```

**需要后端实现的功能**:

1. **物理删除或逻辑删除**:
   - 推荐使用逻辑删除（软删除）
   - 在用户表中添加 `deletedAt` 字段
   - 删除时设置 `deletedAt = 当前时间`，而非直接 DELETE

2. **级联处理相关数据**:
   ```sql
   -- 需要处理的关联数据：
   - 用户的对话记录 (conversations)
   - 用户创建的智能体 (agents)
   - 用户的好友关系 (friendships)
   - 用户的权限记录 (permissions)
   - 用户的消息记录 (messages)
   ```

3. **删除策略建议**:
   ```
   选项A (软删除 - 推荐):
   - 用户记录：设置 deletedAt 字段
   - 对话/智能体：保留但标记为已删除用户所有
   - 好友关系：移除
   - 权限记录：撤销
   - 消息记录：保留（匿名化显示）
   
   选项B (硬删除):
   - 用户记录：物理删除
   - 对话记录：CASCADE DELETE 或转移给系统账户
   - 智能体：CASCADE DELETE 或转移给系统账户
   - 好友关系：CASCADE DELETE
   - 权限记录：CASCADE DELETE
   - 消息记录：保留但用户ID设为NULL
   ```

4. **安全检查**:
   - 禁止删除超级管理员账户
   - 禁止用户删除自己
   - 检查用户是否有重要的未完成任务

---

## 前端实现说明

### 当前前端代码状态

#### 删除用户（已实现，需要后端修复）
```javascript
// 文件: js/admin/admin-controller.js 第1452-1474行
async function deleteUser(userId) {
    if (!confirm('确定要删除此用户吗？此操作不可撤销。')) {
        return;
    }
    
    try {
        const response = await apiClient.delete(`/admin/users/${userId}`);
        if (response.success) {
            alert('用户删除成功');
            await loadUsersData();
        } else {
            throw new Error(response.message || '删除用户失败');
        }
    } catch (error) {
        console.error('❌ User deletion failed:', error);
        alert(`删除用户失败: ${error.message}`);
    }
}
```

#### 编辑用户（需要实现）
```javascript
// 文件: js/admin/admin-controller.js
// 目前只有按钮调用，函数未实现

// HTML中的调用 (admin.html 第644行):
<button class="admin-btn admin-btn-warning" onclick="editUser('${user.id}')">
    <i class="fas fa-edit"></i>
</button>

// 需要添加的函数实现示例:
async function editUser(userId) {
    try {
        // 1. 获取用户详情
        const response = await apiClient.get(`/admin/users/${userId}`);
        if (!response.success) {
            throw new Error(response.message || '获取用户信息失败');
        }
        
        const user = response.data;
        
        // 2. 填充编辑表单
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editEmail').value = user.email;
        document.getElementById('editRole').value = user.role;
        document.getElementById('editStatus').value = user.status;
        
        // 3. 显示编辑模态框
        const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
        modal.show();
    } catch (error) {
        console.error('❌ 加载用户信息失败:', error);
        alert(`加载用户信息失败: ${error.message}`);
    }
}

async function saveUserChanges() {
    try {
        const userId = document.getElementById('editUserId').value;
        const formData = {
            username: document.getElementById('editUsername').value,
            email: document.getElementById('editEmail').value,
            role: document.getElementById('editRole').value,
            status: document.getElementById('editStatus').value
        };
        
        const response = await apiClient.put(`/admin/users/${userId}`, formData);
        if (response.success) {
            alert('用户信息更新成功');
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
            modal.hide();
            
            // 重新加载用户列表
            await loadUsersData();
        } else {
            throw new Error(response.message || '更新用户失败');
        }
    } catch (error) {
        console.error('❌ 更新用户失败:', error);
        alert(`更新用户失败: ${error.message}`);
    }
}
```

---

## 数据库建议

### 用户表结构参考
```sql
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin', 'moderator') DEFAULT 'user',
    status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,  -- 软删除字段
    last_login TIMESTAMP NULL,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_deleted_at (deleted_at)
);
```

---

## 测试建议

### 1. 编辑用户测试用例
- [ ] 测试修改用户名
- [ ] 测试修改邮箱（包括重复邮箱验证）
- [ ] 测试修改角色（user → admin）
- [ ] 测试修改状态（active → banned）
- [ ] 测试修改不存在的用户
- [ ] 测试权限验证（非管理员不能编辑）

### 2. 删除用户测试用例
- [ ] 测试删除普通用户
- [ ] 测试删除不存在的用户
- [ ] 验证数据库中用户记录确实被删除/标记
- [ ] 验证关联数据的处理（对话、智能体等）
- [ ] 测试删除管理员账户（应被拒绝）
- [ ] 测试删除自己（应被拒绝）
- [ ] 验证删除后无法再次登录

---

## 时间节点

- **编辑用户API**: 建议优先实现，前端需要配套实现编辑表单
- **删除用户修复**: 建议尽快修复，确保级联删除逻辑正确

---

## 联系方式

如有疑问，请联系前端开发团队进行接口对接。

**文档创建时间**: 2025-02-02  
**版本**: v1.0
