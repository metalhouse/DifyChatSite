# 登录超时功能测试指南

## 功能概述

为chat.html页面添加了登录超时检测功能，当用户点击发送按钮或执行需要认证的操作时，会检查登录状态。如果登录已过期，将显示登录超时模态框，引导用户重新登录。

## 新增功能

### 1. 登录超时模态框
- 位置：chat.html 中新增的 `#loginTimeoutModal`
- 样式：警告风格的模态框，带有时钟图标
- 行为：模态背景静态，不能通过ESC或点击背景关闭

### 2. 认证检查函数
- `checkAuthBeforeAction()`: 在执行操作前检查登录状态
- `showLoginTimeoutModal()`: 显示登录超时模态框
- `redirectToLogin()`: 重定向到登录页面并保存返回地址

### 3. 增强的发送消息功能
- `sendMessage()` 函数现在会先检查认证状态
- 如果认证失败，显示登录超时模态框而不是直接跳转

### 4. 其他功能的认证检查
已为以下功能添加认证检查：
- 查看聊天记录 (`showChatHistory`)
- 清空对话 (`clearChat`)
- 选择会话 (`showSelectConversationModal`)

### 5. API级别的401错误处理
- 修改了 `api-client.js` 中的401错误处理
- 优先触发登录超时模态框，而不是直接跳转
- 发送 `authFailed` 自定义事件

### 6. 登录重定向支持
- 登录页面现在支持 `redirect` 和 `return` 参数
- 登录成功后会自动返回到原页面

## 测试步骤

### 测试1：发送消息时的登录检查
1. 正常登录并进入聊天页面
2. 手动清除浏览器中的认证Token：
   ```javascript
   localStorage.removeItem('dify_access_token');
   ```
3. 尝试发送消息
4. **预期结果**：显示登录超时模态框

### 测试2：操作聊天记录时的认证检查
1. 在Token过期的状态下
2. 点击"查看聊天记录"按钮
3. **预期结果**：显示登录超时模态框

### 测试3：API调用401错误处理
1. 正常登录
2. 在开发者工具中修改API请求，让其返回401状态
3. **预期结果**：触发登录超时模态框

### 测试4：登录重定向功能
1. 从聊天页面触发登录超时
2. 点击"重新登录"按钮
3. 完成登录
4. **预期结果**：自动返回到原来的聊天页面

## 技术实现详情

### 文件修改列表
1. `chat.html`
   - 新增登录超时模态框HTML
   - 修改 `sendMessage` 函数添加认证检查
   - 新增认证相关工具函数
   - 添加 `authFailed` 事件监听器

2. `login.html`
   - 增强重定向参数支持
   - 修改登录成功后的跳转逻辑

3. `js/api/api-client.js`
   - 增强401错误处理
   - 优先使用模态框而不是直接跳转
   - 发送自定义事件

### 关键函数

```javascript
// 认证检查
window.checkAuthBeforeAction = async function() {
    // 检查登录状态，失败时显示模态框
}

// 显示登录超时模态框
window.showLoginTimeoutModal = function() {
    // 显示Bootstrap模态框
}

// 重定向到登录页面
window.redirectToLogin = function() {
    // 清理存储，跳转到登录页面并保存返回地址
}
```

## 注意事项

1. **向后兼容性**：如果页面没有 `showLoginTimeoutModal` 函数，会降级使用alert + 直接跳转

2. **认证服务依赖**：依赖 `js/services/auth-service.js` 的 `isAuthenticated()` 方法

3. **存储清理**：登录超时时会清理相关的localStorage项

4. **事件驱动**：使用自定义事件 `authFailed` 来实现解耦

## 故障排除

### 常见问题

1. **模态框不显示**
   - 检查Bootstrap是否正确加载
   - 检查模态框HTML是否正确添加

2. **认证检查失败**
   - 检查auth-service.js是否正确导入
   - 检查控制台错误信息

3. **重定向不工作**
   - 检查登录页面的URL参数处理
   - 确认页面间的URL编码正确

### 调试技巧

```javascript
// 手动触发登录超时测试
localStorage.removeItem('dify_access_token');
showLoginTimeoutModal();

// 查看认证状态
import('./js/services/auth-service.js').then(({ default: authService }) => {
    console.log('认证状态:', authService.isAuthenticated());
});
```

## 未来改进建议

1. 添加倒计时功能，显示剩余登录时间
2. 支持自动刷新Token功能
3. 添加"记住登录状态"选项
4. 优化移动端的模态框显示
5. 添加更详细的日志记录功能