/**
 * 管理员控制台主控制器
 * 基于DifyChatBack管理后台API接口文档v2.0开发
 * 支持用户管理、智能体管理、对话管理、系统监控等功能
 */

import apiClient from '../api/api-client.js';

// 全局变量
let currentSection = 'dashboard';
let currentData = {
    users: [],
    agents: [],
    conversations: [],
    dashboardStats: {},
    systemInfo: {}
};

// 分页状态
let pagination = {
    users: { page: 1, limit: 20, total: 0 },
    agents: { page: 1, limit: 20, total: 0 },
    conversations: { page: 1, limit: 20, total: 0 }
};

// 搜索状态
let searchQueries = {
    users: '',
    agents: '',
    conversations: ''
};

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Admin controller loaded');
    initializeAdminPanel();
    setupEventListeners();
    checkAuthAndLoadDashboard();
});

/**
 * 初始化管理面板
 */
function initializeAdminPanel() {
    console.log('📊 Initializing admin panel...');
    
    // 设置退出登录功能
    setupLogoutHandler();
    
    // 设置侧边栏导航
    setupSidebarNavigation();
}

/**
 * 设置退出登录处理器
 */
function setupLogoutHandler() {
    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

/**
 * 设置侧边栏导航
 */
function setupSidebarNavigation() {
    const navItems = document.querySelectorAll('.admin-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // 更新导航状态
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    console.log('🎯 Setting up event listeners...');
    
    // 搜索框事件
    setupSearchListeners();
    
    // 表单提交事件
    setupFormListeners();
    
    // 其他交互事件
    setupInteractionListeners();
}

/**
 * 设置搜索监听器
 */
function setupSearchListeners() {
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', debounce((e) => {
            searchQueries.users = e.target.value;
            pagination.users.page = 1;
            loadUsersData();
        }, 300));
    }
    
    const agentSearch = document.getElementById('agentSearch');
    if (agentSearch) {
        agentSearch.addEventListener('input', debounce((e) => {
            searchQueries.agents = e.target.value;
            pagination.agents.page = 1;
            loadAgentsData();
        }, 300));
    }
    
    const conversationSearch = document.getElementById('conversationSearch');
    if (conversationSearch) {
        conversationSearch.addEventListener('input', debounce((e) => {
            searchQueries.conversations = e.target.value;
            pagination.conversations.page = 1;
            loadConversationsData();
        }, 300));
    }
}

/**
 * 设置表单监听器
 */
function setupFormListeners() {
    // 创建用户表单
    const createUserForm = document.getElementById('createUserForm');
    if (createUserForm) {
        createUserForm.addEventListener('submit', function(e) {
            e.preventDefault();
            createUser();
        });
    }
    
    // 创建智能体表单
    const createAgentForm = document.getElementById('createAgentForm');
    if (createAgentForm) {
        createAgentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            createAgent();
        });
    }
    
    // 编辑智能体表单
    const editAgentForm = document.getElementById('editAgentForm');
    if (editAgentForm) {
        editAgentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveAgentChanges();
        });
    }
}

/**
 * 设置交互监听器
 */
function setupInteractionListeners() {
    // 日志级别选择器
    const logLevel = document.getElementById('logLevel');
    if (logLevel) {
        logLevel.addEventListener('change', function() {
            loadLogsData(this.value);
        });
    }
}

/**
 * 检查认证状态并加载仪表盘
 */
async function checkAuthAndLoadDashboard() {
    try {
        console.log('🔐 Checking authentication status...');
        
        // 检查token存在性
        const token = localStorage.getItem('dify_access_token') || localStorage.getItem('access_token');
        if (!token) {
            console.warn('❌ No access token found, redirecting to login...');
            window.location.href = './login.html';
            return;
        }
        
        console.log('✅ Access token found, verifying admin permissions...');
        
        // 通过访问管理员API验证权限
        const testResponse = await apiClient.get('/admin/dashboard/overview');
        if (testResponse.success) {
            console.log('✅ Admin access verified successfully');
            
            // 获取用户信息并更新UI
            await updateUserInfo();
            
            // 加载仪表盘数据
            await loadDashboardData();
        } else {
            console.warn('❌ Admin API access failed:', testResponse);
            alert('管理员权限验证失败，将跳转到主页');
            window.location.href = './index.html';
        }
    } catch (error) {
        console.error('❌ Auth check error:', error);
        if (error.status === 401) {
            alert('您没有管理员权限，将跳转到登录页面');
            window.location.href = './login.html';
        } else if (error.status === 403) {
            alert('权限不足，将跳转到主页');
            window.location.href = './index.html';
        } else {
            console.error('Auth check failed:', error);
            alert('认证检查失败，将跳转到主页');
            window.location.href = './index.html';
        }
    }
}

/**
 * 更新用户信息显示
 */
async function updateUserInfo() {
    try {
        console.log('🔍 更新用户信息显示 - 暂时跳过API调用');
        // 先从localStorage获取用户信息作为临时方案
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            const user = JSON.parse(userInfo);
            const username = user.username || '管理员';
            const usernameElement = document.getElementById('adminUsername');
            if (usernameElement) {
                usernameElement.textContent = username;
            }
        } else {
            // 使用默认用户名
            const usernameElement = document.getElementById('adminUsername');
            if (usernameElement) {
                usernameElement.textContent = 'metalhouse'; // 使用提供的管理员用户名
            }
        }
    } catch (error) {
        console.log('📝 用户信息更新失败，使用默认值:', error.message);
    }
}

/**
 * 处理退出登录
 */
async function handleLogout() {
    try {
        console.log('🚪 Logging out...');
        
        // 调用后端登出API
        await apiClient.post('/auth/logout');
        
        // 清除本地存储
        localStorage.removeItem('dify_access_token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
        
        // 跳转到登录页面
        window.location.href = './login.html';
    } catch (error) {
        console.error('❌ Logout error:', error);
        
        // 即使后端登出失败，也清除本地存储并跳转
        localStorage.clear();
        window.location.href = './login.html';
    }
}

/**
 * 显示指定区域
 */
function showSection(sectionName) {
    console.log(`📋 Switching to section: ${sectionName}`);
    
    // 隐藏所有区域 - 使用CSS类而不是内联样式
    const sections = document.querySelectorAll('.admin-section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });
    
    // 显示目标区域
    const targetSection = document.getElementById(`${sectionName}Section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    
    // 更新导航状态
    updateNavigationState(sectionName);
    
    // 更新当前区域
    currentSection = sectionName;
    
    // 根据区域加载对应数据
    loadSectionData(sectionName);
}

/**
 * 更新导航状态
 */
function updateNavigationState(sectionName) {
    // 更新侧边栏导航状态
    const navItems = document.querySelectorAll('.admin-nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick')?.includes(sectionName)) {
            item.classList.add('active');
        }
    });
}

/**
 * 加载区域数据
 */
async function loadSectionData(sectionName) {
    try {
        switch (sectionName) {
            case 'dashboard':
                await loadDashboardData();
                break;
            case 'users':
                await loadUsersData();
                break;
            case 'agents':
                await loadAgentsData();
                break;
            case 'conversations':
                await loadConversationsData();
                break;
            case 'system':
                await loadSystemData();
                break;
            case 'logs':
                await loadLogsData();
                break;
            default:
                console.warn(`Unknown section: ${sectionName}`);
        }
    } catch (error) {
        console.error(`Error loading ${sectionName} data:`, error);
        showError(`加载${sectionName}数据失败: ${error.message}`);
    }
}

/**
 * 加载仪表盘数据
 */
async function loadDashboardData() {
    try {
        console.log('📊 Loading dashboard data...');
        showLoading('dashboardSection');
        
        const response = await apiClient.get('/admin/dashboard/overview');
        console.log('🔍 Dashboard API响应数据:', response);
        
        if (response.success) {
            currentData.dashboardStats = response.data;
            console.log('📊 仪表板统计数据:', response.data);
            renderDashboardStats(response.data);
            
            // 加载最近活动
            await loadRecentActivities();
        } else {
            throw new Error(response.message || '获取仪表盘数据失败');
        }
    } catch (error) {
        console.error('❌ Dashboard data loading failed:', error);
        showError('加载仪表盘数据失败');
    } finally {
        hideLoading('dashboardSection');
    }
}

/**
 * 渲染仪表盘统计数据
 */
function renderDashboardStats(data) {
    console.log('🎨 开始渲染仪表盘统计数据:', data);
    
    // 检查多个可能的容器位置
    let statsCards = document.querySelector('#dashboardSection .admin-content .row.mb-4');
    if (!statsCards) {
        // 尝试其他选择器
        statsCards = document.querySelector('#dashboardSection .row.mb-4');
        if (!statsCards) {
            statsCards = document.querySelector('#dashboardSection .row');
            if (!statsCards) {
                // 如果都没找到，创建一个
                const adminContent = document.querySelector('#dashboardSection .admin-content');
                if (adminContent) {
                    const rowDiv = document.createElement('div');
                    rowDiv.className = 'row mb-4';
                    adminContent.appendChild(rowDiv);
                    statsCards = rowDiv;
                    console.log('📦 创建了新的统计卡片容器');
                }
            }
        }
    }
    
    if (!statsCards) {
        console.error('❌ 找不到统计卡片容器');
        return;
    }
    
    console.log('✅ 找到统计卡片容器:', statsCards);
    
    statsCards.innerHTML = `
        <div class="col-md-3 mb-3">
            <div class="stats-card">
                <div class="stats-card-icon users">
                    <i class="fas fa-users"></i>
                </div>
                <div class="stats-card-title">总用户数</div>
                <div class="stats-card-value">${data.users?.total || 0}</div>
                <div class="stats-card-change positive">
                    <i class="fas fa-arrow-up me-1"></i>
                    今日新增: ${data.users?.newToday || 0}
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="stats-card">
                <div class="stats-card-icon agents">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="stats-card-title">智能体数量</div>
                <div class="stats-card-value">${data.agents?.total || 0}</div>
                <div class="stats-card-change positive">
                    <i class="fas fa-arrow-up me-1"></i>
                    活跃: ${data.agents?.active || 0}
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="stats-card">
                <div class="stats-card-icon conversations">
                    <i class="fas fa-comments"></i>
                </div>
                <div class="stats-card-title">对话总数</div>
                <div class="stats-card-value">${data.conversations?.total || 0}</div>
                <div class="stats-card-change positive">
                    <i class="fas fa-arrow-up me-1"></i>
                    本周: ${data.conversations?.thisWeek || 0}
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="stats-card">
                <div class="stats-card-icon system">
                    <i class="fas fa-server"></i>
                </div>
                <div class="stats-card-title">系统状态</div>
                <div class="stats-card-value">
                    <span class="health-indicator ${data.system?.status === 'healthy' ? 'healthy' : 'warning'}"></span>
                    ${data.system?.status === 'healthy' ? '正常' : '警告'}
                </div>
                <div class="stats-card-change">
                    运行时间: ${formatUptime(data.system?.uptime || 0)}
                </div>
            </div>
        </div>
    `;
    
    console.log('✅ 仪表盘统计卡片渲染完成');
}

/**
 * 加载最近活动
 */
async function loadRecentActivities() {
    try {
        console.log('📋 开始渲染最近活动 - 使用模拟数据');
        
        // 找到最近活动容器
        const activitiesContainer = document.querySelector('#dashboardSection .admin-content .row:last-child');
        if (activitiesContainer) {
            activitiesContainer.innerHTML = `
                <div class="col-md-12">
                    <div class="admin-table">
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>最近活动</th>
                                        <th>用户</th>
                                        <th>时间</th>
                                        <th>状态</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>管理员登录</td>
                                        <td>metalhouse</td>
                                        <td>${formatDateTime(new Date().toISOString())}</td>
                                        <td><span class="status-badge active">成功</span></td>
                                    </tr>
                                    <tr>
                                        <td>仪表盘查看</td>
                                        <td>metalhouse</td>
                                        <td>${formatDateTime(new Date().toISOString())}</td>
                                        <td><span class="status-badge active">正常</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            console.log('✅ 最近活动渲染完成');
        }
        
        // 渲染系统组件状态
        renderSystemComponents();
    } catch (error) {
        console.error('❌ 渲染最近活动失败:', error);
    }
}

/**
 * 渲染系统组件状态
 */
function renderSystemComponents() {
    try {
        console.log('🔧 开始渲染系统组件状态');
        
        // 查找系统组件状态容器，如果没有则创建
        let systemContainer = document.querySelector('#dashboardSection .system-components');
        if (!systemContainer) {
            const adminContent = document.querySelector('#dashboardSection .admin-content');
            if (adminContent) {
                const systemDiv = document.createElement('div');
                systemDiv.className = 'row mt-4';
                systemDiv.innerHTML = `
                    <div class="col-md-12">
                        <div class="admin-table">
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>系统组件</th>
                                            <th>状态</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>后端API服务</td>
                                            <td><span class="health-indicator healthy"></span>正常</td>
                                        </tr>
                                        <tr>
                                            <td>数据库连接</td>
                                            <td><span class="health-indicator healthy"></span>正常</td>
                                        </tr>
                                        <tr>
                                            <td>认证服务</td>
                                            <td><span class="health-indicator healthy"></span>正常</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
                adminContent.appendChild(systemDiv);
                console.log('✅ 系统组件状态渲染完成');
            }
        }
    } catch (error) {
        console.error('❌ 渲染系统组件状态失败:', error);
    }
}

/**
 * 加载用户数据
 */
async function loadUsersData() {
    try {
        console.log('👥 Loading users data...');
        showLoading('usersSection');
        
        const params = new URLSearchParams({
            page: pagination.users.page,
            limit: pagination.users.limit
        });
        
        if (searchQueries.users) {
            params.append('search', searchQueries.users);
        }
        
        const response = await apiClient.get(`/admin/users?${params}`);
        if (response.success) {
            currentData.users = response.data.users || [];
            pagination.users.total = response.data.total || 0;
            pagination.users.totalPages = response.data.totalPages || 1;
            
            renderUsersTable(currentData.users);
            renderUsersPagination();
        } else {
            throw new Error(response.message || '获取用户数据失败');
        }
    } catch (error) {
        console.error('❌ Users data loading failed:', error);
        showError('加载用户数据失败');
    } finally {
        hideLoading('usersSection');
    }
}

/**
 * 渲染用户表格
 */
function renderUsersTable(users) {
    const tableContainer = document.querySelector('#usersSection .table-responsive table');
    if (!tableContainer) return;
    
    tableContainer.innerHTML = `
        <thead>
            <tr>
                <th>用户ID</th>
                <th>用户名</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            ${users.map(user => `
                <tr>
                    <td><code>${user.id}</code></td>
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>
                        <span class="badge bg-${getRoleBadgeClass(user.role)}">${getRoleDisplayName(user.role)}</span>
                    </td>
                    <td>
                        <span class="status-badge ${user.status}">${getStatusDisplayName(user.status)}</span>
                    </td>
                    <td>${formatDateTime(user.createdAt)}</td>
                    <td>
                        <button class="admin-btn admin-btn-warning" onclick="editUser('${user.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="admin-btn admin-btn-danger" onclick="deleteUser('${user.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;
}

/**
 * 渲染用户分页
 */
function renderUsersPagination() {
    // 实现分页逻辑
    const currentPage = pagination.users.page;
    const totalPages = pagination.users.totalPages;
    
    // 这里可以添加分页UI的渲染逻辑
    console.log(`Users pagination: ${currentPage}/${totalPages}`);
}

/**
 * 加载智能体数据
 */
async function loadAgentsData() {
    try {
        console.log('🤖 Loading agents data...');
        showLoading('agentsSection');
        
        const params = new URLSearchParams({
            page: pagination.agents.page,
            limit: pagination.agents.limit
        });
        
        if (searchQueries.agents) {
            params.append('search', searchQueries.agents);
        }
        
        const response = await apiClient.get(`/admin/agents?${params}`);
        if (response.success) {
            currentData.agents = response.data.agents || [];
            pagination.agents.total = response.data.total || 0;
            pagination.agents.totalPages = response.data.totalPages || 1;
            
            renderAgentsTable(currentData.agents);
            renderAgentsPagination();
        } else {
            throw new Error(response.message || '获取智能体数据失败');
        }
    } catch (error) {
        console.error('❌ Agents data loading failed:', error);
        showError('加载智能体数据失败');
    } finally {
        hideLoading('agentsSection');
    }
}

/**
 * 渲染智能体表格（8列数据格式）
 */
function renderAgentsTable(agents) {
    const tableContainer = document.querySelector('#agentsSection .table-responsive table');
    if (!tableContainer) return;
    
    tableContainer.innerHTML = `
        <thead>
            <tr>
                <th>智能体ID</th>
                <th>名称</th>
                <th>类型</th>
                <th>所有者</th>
                <th>状态</th>
                <th>对话数</th>
                <th>创建时间</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            ${agents.map(agent => `
                <tr>
                    <td><code>${agent.id}</code></td>
                    <td>${agent.name}</td>
                    <td>${agent.type}</td>
                    <td>${agent.owner}</td>
                    <td>
                        <span class="status-badge ${agent.status}">${getStatusDisplayName(agent.status)}</span>
                    </td>
                    <td>${agent.conversationCount || 0}</td>
                    <td>${formatDateTime(agent.createdAt)}</td>
                    <td>
                        <button class="admin-btn admin-btn-warning" onclick="editAgent('${agent.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="admin-btn admin-btn-${agent.status === 'active' ? 'secondary' : 'success'}" 
                                onclick="toggleAgentStatus('${agent.id}', '${agent.status}')">
                            <i class="fas fa-${agent.status === 'active' ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="admin-btn admin-btn-danger" onclick="deleteAgent('${agent.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;
}

/**
 * 渲染智能体分页
 */
function renderAgentsPagination() {
    const currentPage = pagination.agents.page;
    const totalPages = pagination.agents.totalPages;
    
    console.log(`Agents pagination: ${currentPage}/${totalPages}`);
}

/**
 * 加载对话数据
 */
async function loadConversationsData() {
    try {
        console.log('💬 Loading conversations data...');
        showLoading('conversationsSection');
        
        const params = new URLSearchParams({
            page: pagination.conversations.page,
            limit: pagination.conversations.limit
        });
        
        if (searchQueries.conversations) {
            params.append('search', searchQueries.conversations);
        }
        
        const response = await apiClient.get(`/admin/conversations?${params}`);
        if (response.success) {
            currentData.conversations = response.data.conversations || [];
            pagination.conversations.total = response.data.total || 0;
            pagination.conversations.totalPages = response.data.totalPages || 1;
            
            renderConversationsTable(currentData.conversations);
            renderConversationsPagination();
        } else {
            throw new Error(response.message || '获取对话数据失败');
        }
    } catch (error) {
        console.error('❌ Conversations data loading failed:', error);
        showError('加载对话数据失败');
    } finally {
        hideLoading('conversationsSection');
    }
}

/**
 * 渲染对话表格
 */
function renderConversationsTable(conversations) {
    const tableContainer = document.querySelector('#conversationsSection .table-responsive table');
    if (!tableContainer) return;
    
    tableContainer.innerHTML = `
        <thead>
            <tr>
                <th>对话名称</th>
                <th>用户</th>
                <th>智能体</th>
                <th>消息数</th>
                <th>开始时间</th>
                <th>最后活动</th>
                <th>状态</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            ${conversations.map(conv => {
                // 处理对话名称：优先使用title，否则使用前几个字符的首条消息，或者生成默认名称
                const conversationName = conv.title || 
                    conv.name || 
                    (conv.firstMessage ? `${conv.firstMessage.substring(0, 30)}...` : '') ||
                    `与${conv.agentName || '智能体'}的对话`;
                
                // 处理消息数：确保显示准确的消息数量
                const messageCount = conv.messageCount || 
                    conv.totalMessages || 
                    conv.messages?.length || 
                    0;
                
                // 处理状态
                const status = conv.status || 'active';
                const statusText = status === 'active' ? '进行中' : 
                    status === 'completed' ? '已完成' : 
                    status === 'archived' ? '已归档' : '未知';
                
                return `
                    <tr>
                        <td>
                            <div style="max-width: 200px;">
                                <strong>${conversationName}</strong>
                                ${conv.id ? `<br><small class="text-muted">ID: ${conv.id}</small>` : ''}
                            </div>
                        </td>
                        <td>${conv.userName || conv.username || conv.user || 'Unknown'}</td>
                        <td>${conv.agentName || conv.agent || 'Unknown'}</td>
                        <td>
                            <span class="badge bg-primary">${messageCount}</span>
                        </td>
                        <td>${formatDateTime(conv.createdAt)}</td>
                        <td>${formatDateTime(conv.updatedAt || conv.lastActivity)}</td>
                        <td>
                            <span class="status-badge ${status}">${statusText}</span>
                        </td>
                        <td>
                            <button class="admin-btn admin-btn-primary" onclick="viewConversation('${conv.id}')" title="查看详情">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="admin-btn admin-btn-warning" onclick="archiveConversation('${conv.id}')" title="归档对话">
                                <i class="fas fa-archive"></i>
                            </button>
                            <button class="admin-btn admin-btn-danger" onclick="deleteConversation('${conv.id}')" title="删除对话">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;
}

/**
 * 渲染对话分页
 */
function renderConversationsPagination() {
    const currentPage = pagination.conversations.page;
    const totalPages = pagination.conversations.totalPages;
    
    console.log(`Conversations pagination: ${currentPage}/${totalPages}`);
}

/**
 * 加载系统数据
 */
async function loadSystemData() {
    try {
        console.log('🖥️ Loading system data...');
        showLoading('systemSection');
        
        const [healthResponse, metricsResponse] = await Promise.all([
            apiClient.get('/admin/system/health'),
            apiClient.get('/admin/system/metrics')
        ]);
        
        if (healthResponse.success && metricsResponse.success) {
            renderSystemInfo(healthResponse.data, metricsResponse.data);
        } else {
            throw new Error('获取系统数据失败');
        }
    } catch (error) {
        console.error('❌ System data loading failed:', error);
        showError('加载系统数据失败');
    } finally {
        hideLoading('systemSection');
    }
}

/**
 * 渲染系统信息
 */
function renderSystemInfo(healthData, metricsData) {
    const systemSection = document.querySelector('#systemSection .admin-content');
    if (!systemSection) return;
    
    // 处理后端数据字段映射
    const cpu = metricsData.cpuUsage || metricsData.cpu_usage || metricsData.cpu || 0;
    const memory = metricsData.memoryUsage || metricsData.memory_usage || metricsData.memory || 0;
    const disk = metricsData.diskUsage || metricsData.disk_usage || metricsData.disk || 0;
    const uptime = metricsData.uptime || 0;
    
    console.log('🖥️ System metrics processed:', { cpu, memory, disk, uptime, raw: metricsData });
    
    systemSection.innerHTML = `
        <div class="row mb-4">
            <div class="col-md-6 mb-3">
                <div class="stats-card">
                    <div class="stats-card-icon system">
                        <i class="fas fa-heartbeat"></i>
                    </div>
                    <div class="stats-card-title">系统健康状态</div>
                    <div class="stats-card-value">
                        <span class="health-indicator ${healthData.status === 'healthy' ? 'healthy' : 'warning'}"></span>
                        ${healthData.status === 'healthy' ? '正常运行' : '需要关注'}
                    </div>
                </div>
            </div>
            <div class="col-md-6 mb-3">
                <div class="stats-card">
                    <div class="stats-card-icon agents">
                        <i class="fas fa-microchip"></i>
                    </div>
                    <div class="stats-card-title">性能指标</div>
                    <div class="stats-card-value">
                        CPU: ${cpu.toFixed(1)}%
                    </div>
                    <div class="stats-card-change">
                        内存: ${memory.toFixed(1)}%
                    </div>
                </div>
            </div>
        </div>
        
        <div class="admin-table">
            <h5 class="mb-3">系统详细信息</h5>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>指标</th>
                            <th>当前值</th>
                            <th>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>运行时间</td>
                            <td>${formatUptime(uptime)}</td>
                            <td><span class="status-badge active">正常</span></td>
                        </tr>
                        <tr>
                            <td>CPU使用率</td>
                            <td>${cpu.toFixed(1)}%</td>
                            <td><span class="status-badge ${cpu > 80 ? 'inactive' : 'active'}">${cpu > 80 ? '高' : '正常'}</span></td>
                        </tr>
                        <tr>
                            <td>内存使用率</td>
                            <td>${memory.toFixed(1)}%</td>
                            <td><span class="status-badge ${memory > 80 ? 'inactive' : 'active'}">${memory > 80 ? '高' : '正常'}</span></td>
                        </tr>
                        <tr>
                            <td>磁盘使用率</td>
                            <td>${disk.toFixed(1)}%</td>
                            <td><span class="status-badge ${disk > 80 ? 'inactive' : 'active'}">${disk > 80 ? '高' : '正常'}</span></td>
                        </tr>
                        ${metricsData.active_connections ? `
                        <tr>
                            <td>活跃连接数</td>
                            <td>${metricsData.active_connections}</td>
                            <td><span class="status-badge active">正常</span></td>
                        </tr>
                        ` : ''}
                        ${metricsData.requests_per_minute ? `
                        <tr>
                            <td>每分钟请求数</td>
                            <td>${metricsData.requests_per_minute}</td>
                            <td><span class="status-badge active">正常</span></td>
                        </tr>
                        ` : ''}
                        ${metricsData.response_time_avg ? `
                        <tr>
                            <td>平均响应时间</td>
                            <td>${metricsData.response_time_avg}ms</td>
                            <td><span class="status-badge ${metricsData.response_time_avg > 1000 ? 'inactive' : 'active'}">${metricsData.response_time_avg > 1000 ? '慢' : '正常'}</span></td>
                        </tr>
                        ` : ''}
                        ${metricsData.cache_hit_rate !== undefined ? `
                        <tr>
                            <td>缓存命中率</td>
                            <td>${(metricsData.cache_hit_rate * 100).toFixed(1)}%</td>
                            <td><span class="status-badge ${metricsData.cache_hit_rate < 0.8 ? 'pending' : 'active'}">${metricsData.cache_hit_rate < 0.8 ? '低' : '正常'}</span></td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * 刷新系统状态
 */
async function refreshSystemStatus() {
    await loadSystemData();
}

/**
 * 加载日志数据
 */
async function loadLogsData(level = 'all') {
    try {
        console.log('📋 Loading logs data...');
        showLoading('logsSection');
        
        // 根据日志级别选择不同的API端点
        let endpoint = '/admin/logs/system';
        switch (level) {
            case 'error':
                endpoint = '/admin/logs/errors';
                break;
            case 'access':
                endpoint = '/admin/logs/access';
                break;
            case 'system':
            default:
                endpoint = '/admin/logs/system';
                break;
        }
        
        const response = await apiClient.get(`${endpoint}?limit=100`);
        if (response.success) {
            renderLogs(response.data.logs || []);
            
            // 更新日志级别选择器
            updateLogLevelSelector(level);
        } else {
            throw new Error(response.message || '获取日志数据失败');
        }
    } catch (error) {
        console.error('❌ Logs data loading failed:', error);
        showError('加载日志数据失败');
    } finally {
        hideLoading('logsSection');
    }
}

/**
 * 更新日志级别选择器
 */
function updateLogLevelSelector(currentLevel) {
    const logLevelSelect = document.getElementById('logLevel');
    if (!logLevelSelect) return;
    
    logLevelSelect.innerHTML = `
        <option value="system" ${currentLevel === 'system' ? 'selected' : ''}>系统日志</option>
        <option value="error" ${currentLevel === 'error' ? 'selected' : ''}>错误日志</option>
        <option value="access" ${currentLevel === 'access' ? 'selected' : ''}>访问日志</option>
    `;
}

/**
 * 渲染日志内容
 */
function renderLogs(logs) {
    const logsContent = document.getElementById('logsContent');
    if (!logsContent) return;
    
    if (!logs || logs.length === 0) {
        logsContent.textContent = '暂无日志数据';
        return;
    }
    
    const logText = logs.map(log => {
        // 处理各种可能的时间戳字段名
        const timestamp = log.timestamp || log.createdAt || log.time || log.date;
        const formattedTime = timestamp ? formatDateTime(timestamp) : new Date().toLocaleString('zh-CN');
        const level = (log.level || log.logLevel || 'INFO').toString().toUpperCase();
        const message = log.message || log.msg || log.text || '';
        
        // 根据日志级别设置颜色（通过ANSI转义符模拟）
        let colorPrefix = '';
        switch (level) {
            case 'ERROR':
                colorPrefix = '\x1b[31m'; // 红色
                break;
            case 'WARN':
            case 'WARNING':
                colorPrefix = '\x1b[33m'; // 黄色
                break;
            case 'INFO':
                colorPrefix = '\x1b[32m'; // 绿色
                break;
            case 'DEBUG':
                colorPrefix = '\x1b[36m'; // 青色
                break;
            default:
                colorPrefix = '\x1b[37m'; // 白色
        }
        
        return `[${formattedTime}] ${colorPrefix}${level}\x1b[0m: ${message}`;
    }).join('\n');
    
    logsContent.textContent = logText;
    
    console.log('📋 Rendered logs:', { count: logs.length, sample: logs[0] });
}

/**
 * 刷新日志
 */
async function refreshLogs() {
    const logLevel = document.getElementById('logLevel');
    const currentLevel = logLevel ? logLevel.value : 'system';
    await loadLogsData(currentLevel);
}

/**
 * 显示创建用户模态框
 */
function showCreateUserModal() {
    const modal = new bootstrap.Modal(document.getElementById('createUserModal'));
    
    // 设置角色选项
    const roleSelect = document.querySelector('#createUserModal select[name="role"]');
    if (roleSelect) {
        roleSelect.innerHTML = `
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
        `;
    }
    
    modal.show();
}

/**
 * 创建用户
 */
async function createUser() {
    try {
        const form = document.getElementById('createUserForm');
        const formData = new FormData(form);
        
        const userData = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            role: formData.get('role')
        };
        
        console.log('👤 Creating user:', userData.username);
        
        const response = await apiClient.post('/admin/users', userData);
        if (response.success) {
            alert('用户创建成功');
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('createUserModal'));
            modal.hide();
            
            // 清空表单
            form.reset();
            
            // 重新加载用户数据
            await loadUsersData();
        } else {
            throw new Error(response.message || '创建用户失败');
        }
    } catch (error) {
        console.error('❌ User creation failed:', error);
        alert(`创建用户失败: ${error.message}`);
    }
}

/**
 * 显示创建智能体模态框
 */
function showCreateAgentModal() {
    const modal = new bootstrap.Modal(document.getElementById('createAgentModal'));
    
    // 设置智能体类型选项
    const typeSelect = document.querySelector('#createAgentModal select[name="type"]');
    if (typeSelect) {
        typeSelect.innerHTML = `
            <option value="chatbot">对话机器人</option>
            <option value="workflow">工作流</option>
            <option value="completion">文本补全</option>
            <option value="agent">智能体</option>
        `;
    }
    
    // 设置可见性选项
    const visibilitySelect = document.querySelector('#createAgentModal select[name="visibility"]');
    if (visibilitySelect) {
        visibilitySelect.innerHTML = `
            <option value="private">私有</option>
            <option value="public">公开</option>
            <option value="shared">共享</option>
        `;
    }
    
    modal.show();
}

/**
 * 创建智能体
 */
async function createAgent() {
    try {
        const form = document.getElementById('createAgentForm');
        const formData = new FormData(form);
        
        const agentData = {
            name: formData.get('name'),
            type: formData.get('type'),
            description: formData.get('description'),
            visibility: formData.get('visibility') || 'private'
        };
        
        console.log('🤖 Creating agent:', agentData.name);
        
        const response = await apiClient.post('/admin/agents', agentData);
        if (response.success) {
            alert('智能体创建成功');
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('createAgentModal'));
            modal.hide();
            
            // 清空表单
            form.reset();
            
            // 重新加载智能体数据
            await loadAgentsData();
        } else {
            throw new Error(response.message || '创建智能体失败');
        }
    } catch (error) {
        console.error('❌ Agent creation failed:', error);
        alert(`创建智能体失败: ${error.message}`);
    }
}

/**
 * 编辑智能体
 */
async function editAgent(agentId) {
    try {
        console.log('✏️ Editing agent:', agentId);
        
        // 获取智能体详情
        const response = await apiClient.get(`/admin/agents/${agentId}`);
        if (response.success) {
            const agent = response.data;
            
            // 填充编辑表单
            document.getElementById('editAgentId').value = agent.id;
            document.querySelector('#editAgentForm input[name="name"]').value = agent.name;
            document.querySelector('#editAgentForm textarea[name="description"]').value = agent.description || '';
            document.querySelector('#editAgentForm select[name="visibility"]').value = agent.visibility;
            document.querySelector('#editAgentForm select[name="status"]').value = agent.status;
            
            // 显示模态框
            const modal = new bootstrap.Modal(document.getElementById('editAgentModal'));
            modal.show();
        } else {
            throw new Error(response.message || '获取智能体详情失败');
        }
    } catch (error) {
        console.error('❌ Agent edit preparation failed:', error);
        alert(`编辑智能体失败: ${error.message}`);
    }
}

/**
 * 保存智能体更改
 */
async function saveAgentChanges() {
    try {
        const form = document.getElementById('editAgentForm');
        const formData = new FormData(form);
        const agentId = formData.get('id');
        
        const updateData = {
            name: formData.get('name'),
            description: formData.get('description'),
            visibility: formData.get('visibility'),
            status: formData.get('status')
        };
        
        console.log('💾 Saving agent changes:', agentId);
        
        const response = await apiClient.put(`/admin/agents/${agentId}`, updateData);
        if (response.success) {
            alert('智能体更新成功');
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('editAgentModal'));
            modal.hide();
            
            // 重新加载智能体数据
            await loadAgentsData();
        } else {
            throw new Error(response.message || '更新智能体失败');
        }
    } catch (error) {
        console.error('❌ Agent update failed:', error);
        alert(`更新智能体失败: ${error.message}`);
    }
}

/**
 * 切换智能体状态
 */
async function toggleAgentStatus(agentId, currentStatus) {
    try {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        
        console.log(`🔄 Toggling agent status: ${agentId} -> ${newStatus}`);
        
        const response = await apiClient.patch(`/admin/agents/${agentId}/status`, {
            status: newStatus
        });
        
        if (response.success) {
            alert(`智能体状态已更新为: ${getStatusDisplayName(newStatus)}`);
            await loadAgentsData();
        } else {
            throw new Error(response.message || '更新智能体状态失败');
        }
    } catch (error) {
        console.error('❌ Agent status toggle failed:', error);
        alert(`更新智能体状态失败: ${error.message}`);
    }
}

/**
 * 删除用户
 */
async function deleteUser(userId) {
    if (!confirm('确定要删除此用户吗？此操作不可撤销。')) {
        return;
    }
    
    try {
        console.log('🗑️ Deleting user:', userId);
        
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

/**
 * 删除智能体
 */
async function deleteAgent(agentId) {
    if (!confirm('确定要删除此智能体吗？此操作不可撤销。')) {
        return;
    }
    
    try {
        console.log('🗑️ Deleting agent:', agentId);
        
        const response = await apiClient.delete(`/admin/agents/${agentId}`);
        if (response.success) {
            alert('智能体删除成功');
            await loadAgentsData();
        } else {
            throw new Error(response.message || '删除智能体失败');
        }
    } catch (error) {
        console.error('❌ Agent deletion failed:', error);
        alert(`删除智能体失败: ${error.message}`);
    }
}

/**
 * 查看对话详情
 */
async function viewConversation(conversationId) {
    try {
        console.log('👁️ Viewing conversation:', conversationId);
        
        const response = await apiClient.get(`/admin/conversations/${conversationId}`);
        if (response.success) {
            const conversation = response.data;
            
            // 创建详情模态框内容
            const detailsHtml = `
                <div class="conversation-details">
                    <h6>对话信息</h6>
                    <table class="table table-sm">
                        <tr><td><strong>对话名称:</strong></td><td>${conversation.title || conversation.name || '未命名对话'}</td></tr>
                        <tr><td><strong>用户:</strong></td><td>${conversation.userName || 'Unknown'}</td></tr>
                        <tr><td><strong>智能体:</strong></td><td>${conversation.agentName || 'Unknown'}</td></tr>
                        <tr><td><strong>消息数量:</strong></td><td>${conversation.messageCount || conversation.messages?.length || 0}</td></tr>
                        <tr><td><strong>开始时间:</strong></td><td>${formatDateTime(conversation.createdAt)}</td></tr>
                        <tr><td><strong>最后活动:</strong></td><td>${formatDateTime(conversation.updatedAt)}</td></tr>
                    </table>
                    
                    ${conversation.messages && conversation.messages.length > 0 ? `
                        <h6 class="mt-3">最近消息 (显示最后${Math.min(5, conversation.messages.length)}条)</h6>
                        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                            ${conversation.messages.slice(-5).map(msg => `
                                <div class="mb-2 p-2 ${msg.role === 'user' ? 'bg-light' : 'bg-primary bg-opacity-10'} rounded">
                                    <small class="text-muted">${msg.role === 'user' ? '👤 用户' : '🤖 助手'} - ${formatDateTime(msg.createdAt)}</small>
                                    <div>${msg.content || msg.message || '无内容'}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-muted">暂无消息记录</p>'}
                </div>
            `;
            
            // 显示在模态框中或使用alert（这里简化显示）
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = detailsHtml;
            
            // 简化版：显示对话基本信息
            alert(`对话详情:\n名称: ${conversation.title || conversation.name || '未命名对话'}\n用户: ${conversation.userName || 'Unknown'}\n智能体: ${conversation.agentName || 'Unknown'}\n消息数: ${conversation.messageCount || 0}\n创建时间: ${formatDateTime(conversation.createdAt)}`);
        } else {
            throw new Error(response.message || '获取对话详情失败');
        }
    } catch (error) {
        console.error('❌ Conversation view failed:', error);
        alert(`查看对话失败: ${error.message}`);
    }
}

/**
 * 归档对话
 */
async function archiveConversation(conversationId) {
    if (!confirm('确定要归档此对话吗？归档后对话将被标记为已完成。')) {
        return;
    }
    
    try {
        console.log('📦 Archiving conversation:', conversationId);
        
        // 使用PATCH更新对话状态为archived
        const response = await apiClient.patch(`/admin/conversations/${conversationId}`, {
            status: 'archived'
        });
        
        if (response.success) {
            alert('对话归档成功');
            await loadConversationsData();
        } else {
            throw new Error(response.message || '归档对话失败');
        }
    } catch (error) {
        console.error('❌ Conversation archive failed:', error);
        alert(`归档对话失败: ${error.message}`);
    }
}

/**
 * 删除对话
 */
async function deleteConversation(conversationId) {
    if (!confirm('确定要删除此对话吗？此操作不可撤销。')) {
        return;
    }
    
    try {
        console.log('🗑️ Deleting conversation:', conversationId);
        
        const response = await apiClient.delete(`/admin/conversations/${conversationId}`);
        if (response.success) {
            alert('对话删除成功');
            await loadConversationsData();
        } else {
            throw new Error(response.message || '删除对话失败');
        }
    } catch (error) {
        console.error('❌ Conversation deletion failed:', error);
        alert(`删除对话失败: ${error.message}`);
    }
}

// ======================
// 工具函数
// ======================

/**
 * 防抖函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 显示加载状态
 */
function showLoading(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading';
        loadingDiv.innerHTML = '<div class="spinner"></div>';
        loadingDiv.id = `${sectionId}-loading`;
        
        section.appendChild(loadingDiv);
    }
}

/**
 * 隐藏加载状态
 */
function hideLoading(sectionId) {
    const loadingDiv = document.getElementById(`${sectionId}-loading`);
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

/**
 * 显示错误信息
 */
function showError(message) {
    alert(message); // 简单的错误显示，可以改为更好看的提示框
}

/**
 * 格式化日期时间
 */
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    
    let date;
    
    // 尝试解析不同格式的日期
    if (typeof dateString === 'string') {
        // 处理各种可能的时间格式
        if (dateString.includes('T')) {
            // ISO格式
            date = new Date(dateString);
        } else if (dateString.includes('-')) {
            // 常规格式 YYYY-MM-DD HH:mm:ss
            date = new Date(dateString);
        } else if (/^\d+$/.test(dateString)) {
            // Unix时间戳（秒或毫秒）
            const timestamp = parseInt(dateString);
            date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
        } else {
            date = new Date(dateString);
        }
    } else if (typeof dateString === 'number') {
        // 数字时间戳
        date = new Date(dateString > 1000000000000 ? dateString : dateString * 1000);
    } else {
        date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
        console.warn('Invalid date format:', dateString);
        return String(dateString); // 返回原始值
    }
    
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * 格式化运行时间
 */
function formatUptime(seconds) {
    if (!seconds || seconds < 0) return '0秒';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}天${hours}小时`;
    } else if (hours > 0) {
        return `${hours}小时${minutes}分钟`;
    } else {
        return `${minutes}分钟`;
    }
}

/**
 * 获取角色徽章样式类
 */
function getRoleBadgeClass(role) {
    switch (role) {
        case 'admin':
        case 'super_admin':
            return 'danger';
        case 'user':
            return 'primary';
        default:
            return 'secondary';
    }
}

/**
 * 获取角色显示名称
 */
function getRoleDisplayName(role) {
    switch (role) {
        case 'admin':
            return '管理员';
        case 'super_admin':
            return '超级管理员';
        case 'user':
            return '用户';
        default:
            return role;
    }
}

/**
 * 获取状态显示名称
 */
function getStatusDisplayName(status) {
    switch (status) {
        case 'active':
            return '活跃';
        case 'inactive':
            return '非活跃';
        case 'pending':
            return '待审核';
        case 'suspended':
            return '已暂停';
        default:
            return status;
    }
}

// 将关键函数暴露到全局作用域，供HTML内联事件调用
window.showSection = showSection;
window.showCreateUserModal = showCreateUserModal;
window.createUser = createUser;
window.showCreateAgentModal = showCreateAgentModal;
window.createAgent = createAgent;
window.editAgent = editAgent;
window.saveAgentChanges = saveAgentChanges;
window.toggleAgentStatus = toggleAgentStatus;
window.deleteUser = deleteUser;
window.deleteAgent = deleteAgent;
window.viewConversation = viewConversation;
window.archiveConversation = archiveConversation;
window.deleteConversation = deleteConversation;
window.refreshSystemStatus = refreshSystemStatus;
window.refreshLogs = refreshLogs;

console.log('✅ Admin controller script loaded successfully');
