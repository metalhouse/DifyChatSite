# Chat页面Token过期处理修复说明

## 修复目标

实现您要求的功能：在 `chat.html` 页面，当用户点击"发送消息"或"选择会话"时，如果token过期，通过后端返回的401响应来判断，然后弹出模态框让用户重新登录，而不是直接跳转到登录页面。

## 修改内容

### 1. 修改发送消息逻辑 (`chat.html`)

**之前的逻辑**：
```javascript
window.sendMessage = async function() {
    // 首先检查登录状态
    if (!(await checkAuthBeforeAction())) {
        return; // 如果认证失败，不继续执行
    }
    // ... 发送消息
};
```

**修改后的逻辑**：
```javascript
window.sendMessage = async function() {
    // 移除前置认证检查，让后端通过401响应来判断token是否有效
    if (window.chatController && typeof window.chatController.sendMessage === 'function') {
        return window.chatController.sendMessage();
    }
    // ...
};
```

### 2. 修改消息发送错误处理 (`chat-controller-v2.js`)

**之前的逻辑**：
- 检测到"令牌已过期"直接跳转到登录页面

**修改后的逻辑**：
```javascript
// 检测token过期，弹出登录模态框
if (error && error.message && (
    error.message.includes('令牌已过期') || 
    error.message.includes('登录已过期') ||
    error.message.includes('未授权') ||
    (error.response && error.response.status === 401)
)) {
    console.log('🔐 检测到令牌已过期，显示登录超时模态框');
    
    // 显示登录超时模态框
    if (typeof window.showLoginTimeoutModal === 'function') {
        window.showLoginTimeoutModal();
    } else {
        // 兜底方案：直接跳转
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `./login.html?return=${returnUrl}`;
    }
    
    return;
}
```

### 3. 修改选择会话逻辑 (`chat.html`)

**之前的逻辑**：
```javascript
window.showSelectConversationModal = async function() {
    // 检查登录状态
    if (!(await checkAuthBeforeAction())) {
        return;
    }
    // ... 显示模态框和加载数据
};
```

**修改后的逻辑**：
```javascript
window.showSelectConversationModal = async function() {
    console.log('📋 显示选择会话模态框');
    const modal = new bootstrap.Modal(document.getElementById('selectConversationModal'));
    modal.show();
    
    // 加载会话列表，如果token过期会由API调用自动处理401响应
    await loadSelectConversationList();
};
```

### 4. 增强API错误处理

在 `loadSelectConversationList` 函数中添加了401错误的特殊处理：

```javascript
catch (error) {
    // 检查是否是401认证错误，如果是则由API客户端自动处理
    if (error.response && error.response.status === 401) {
        console.log('🔐 选择会话列表加载遇到401错误，由API客户端自动处理');
        // 关闭选择会话模态框
        const modal = bootstrap.Modal.getInstance(document.getElementById('selectConversationModal'));
        if (modal) {
            modal.hide();
        }
        return;
    }
    // ... 其他错误处理
}
```

## 认证流程

### 新的认证流程：

1. **用户操作** → 点击"发送消息"或"选择会话"
2. **直接调用API** → 不做前置认证检查
3. **后端验证** → 如果token有效返回数据，如果无效返回401
4. **401错误处理** → API客户端捕获401，触发 `showLoginTimeoutModal()`
5. **用户重新登录** → 在模态框中重新登录，无需页面跳转
6. **操作重试** → 登录成功后用户可以重新执行操作

### API客户端401处理逻辑：

```javascript
// 特殊处理401错误
if (response.status === 401) {
    // 发送自定义事件
    window.dispatchEvent(new CustomEvent('authFailed', { 
        detail: { status: 401, message: 'Authentication failed', url: fullUrl } 
    }));
    
    // 如果页面有showLoginTimeoutModal函数，优先使用模态框
    if (typeof window.showLoginTimeoutModal === 'function') {
        setTimeout(() => {
            window.showLoginTimeoutModal();
        }, 100);
        return errorResponse; // 不执行默认跳转
    }
    
    // 兜底方案：清理存储并跳转到登录页面
    // ...
}
```

## 优势

1. **用户体验更好**：
   - 无需页面跳转，在模态框中重新登录
   - 登录成功后可以继续当前的操作
   - 保持聊天页面的上下文

2. **后端验证权威**：
   - 完全依赖后端的token验证
   - 避免前端时间同步问题
   - 减少前端复杂的过期判断逻辑

3. **错误处理统一**：
   - 所有401错误都由API客户端统一处理
   - 支持模态框和页面跳转两种模式
   - 提供了兜底方案

## 测试步骤

1. **正常使用**：
   - 登录后在chat页面发送消息 ✅
   - 登录后点击"选择会话" ✅

2. **Token过期测试**：
   - 手动清除localStorage中的token
   - 点击"发送消息"或"选择会话"
   - 应该弹出登录超时模态框而不是跳转页面

3. **重新登录测试**：
   - 在模态框中重新登录
   - 登录成功后关闭模态框
   - 重新执行之前的操作

## 注意事项

- 修改完成后，其他页面的认证逻辑保持不变
- 只有chat.html页面采用后端验证优先的策略
- API客户端的401处理是全局的，会影响所有API调用
- 如果页面没有 `showLoginTimeoutModal` 函数，会自动降级为页面跳转模式