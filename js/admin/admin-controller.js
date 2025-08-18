// 管理员控制台主控制器
import apiClient from '../api/api-client.js';

// 全局变量
let currentSection = 'dashboard';
let currentData = {};

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin controller loaded');
    initializeAdminPanel();
    setupEventListeners();
    loadDashboardData();
});

// 初始化管理面板
function initializeAdminPanel() {
    console.log('Initializing admin panel...');
    
    // 检查认证状态
    checkAuthStatus();
    
    // 设置退出登录功能
    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// 设置事件监听器
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // 搜索框事件
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', debounce(handleUserSearch, 300));
    }
    
    const agentSearch = document.getElementById('agentSearch');
    if (agentSearch) {
        agentSearch.addEventListener('input', debounce(handleAgentSearch, 300));
    }
    
    const conversationSearch = document.getElementById('conversationSearch');
    if (conversationSearch) {
        conversationSearch.addEventListener('input', debounce(handleConversationSearch, 300));
    }
    
    // 日志级别选择器事件
    const logLevel = document.getElementById('logLevel');
    if (logLevel) {
        logLevel.addEventListener('change', function() {
            console.log('Log level changed to:', this.value);
            loadLogsData(this.value);
        });
    }
}

// 检查认证状态
async function checkAuthStatus() {
    try {
        console.log('Checking authentication status...');
        
        // 先检查本地存储中是否有token - 使用与api-client.js一致的key
        const token = localStorage.getItem('dify_access_token') || localStorage.getItem('access_token');
        if (!token) {
            console.warn('No access token found, redirecting to login...');
            // 跳转到登录页面
            window.location.href = './login.html';
            return;
        }
        
        console.log('Access token found, length:', token.length);
        
        // 直接尝试访问管理员API来验证权限，而不是使用可能不存在的 /auth/me
        // 根据admin-api-documentation.md，所有管理API都会自动验证管理员权限
        try {
            const testResponse = await apiClient.get('/admin/dashboard/overview');
            if (testResponse.success) {
                console.log('Admin access verified successfully');
                // 管理员权限验证成功，继续执行
            } else {
                console.warn('Admin API access failed:', testResponse);
                alert('管理员权限验证失败，将跳转到主页');
                window.location.href = './index.html';
                return;
            }
        } catch (adminError) {
            console.error('Admin API access error:', adminError);
            if (adminError.status === 401) {
                alert('您没有管理员权限，将跳转到登录页面');
                window.location.href = './login.html';
            } else {
                alert('管理员权限检查失败，将跳转到主页');
                window.location.href = './index.html';
            }
            return;
        }
    } catch (error) {
        console.error('Auth check error:', error);
        // 只在网络完全无法连接时才跳转
        if (error.message && error.message.includes('Failed to fetch')) {
            alert('无法连接到服务器，请检查网络连接');
        } else {
            console.warn('Auth check failed, but continuing...');
        }
    }
}

// 处理退出登录
async function handleLogout(e) {
    e.preventDefault();
    
    try {
        console.log('Logging out...');
        await apiClient.post('/auth/logout');
        
        // 清除本地存储
        localStorage.clear();
        sessionStorage.clear();
        
        // 跳转到登录页面
        window.location.href = './login.html';
    } catch (error) {
        console.error('Logout error:', error);
        // 即使退出失败，也清除本地数据并跳转
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = './login.html';
    }
}

// 显示指定部分
function showSection(sectionName) {
    console.log(`Switching to section: ${sectionName}`);
    
    // 隐藏所有部分
    const sections = document.querySelectorAll('.admin-section');
    sections.forEach(section => {
        section.style.display = 'none';
    });
    
    // 更新导航状态
    const navItems = document.querySelectorAll('.admin-nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // 显示目标部分
    const targetSection = document.getElementById(`${sectionName}Section`);
    if (targetSection) {
        targetSection.style.display = 'block';
        currentSection = sectionName;
    }
    
    // 激活对应导航
    const activeNav = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
    
    // 加载对应数据
    switch (sectionName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsersData();
            break;
        case 'agents':
            loadAgentsData();
            break;
        case 'conversations':
            loadConversationsData();
            break;
        case 'system':
            loadSystemData();
            break;
        case 'logs':
            loadLogsData();
            break;
    }
}

// 导出全局函数供HTML使用
window.showSection = showSection;

// 仪表盘数据加载
async function loadDashboardData() {
    try {
        console.log('Loading dashboard data...');
        const response = await apiClient.get('/admin/dashboard/overview');
        
        // 添加详细的调试信息
        console.log('Dashboard raw API response:', response);
        console.log('Dashboard response data structure:', {
            success: response.success,
            hasData: !!response.data,
            dataType: typeof response.data,
            dataKeys: response.data ? Object.keys(response.data) : null,
            fullData: response.data
        });
        
        // 详细显示每个数据项
        if (response.data) {
            console.log('详细数据分析:');
            console.log('- users数据:', response.data.users);
            console.log('- agents数据:', response.data.agents);  
            console.log('- conversations数据:', response.data.conversations);
            console.log('- system数据:', response.data.system);
        }
        
        if (response.success && response.data) {
            updateDashboardStats(response.data);
            // 同时加载最近活动
            loadRecentActivities();
        } else {
            console.error('Failed to load dashboard data:', response);
            // 使用默认数据
            updateDashboardStats({
                users: { total: 0 },
                agents: { total: 0 },
                conversations: { total: 0 },
                system: { status: '未知' }
            });
        }
    } catch (error) {
        console.error('Dashboard data error:', error);
        // 即使API调用失败，也显示默认数据而不是错误消息
        updateDashboardStats({
            users: { total: '-' },
            agents: { total: '-' },
            conversations: { total: '-' },
            system: { status: '离线' }
        });
        console.warn('Dashboard loaded with default data due to API error');
    }
}

// 加载最近活动
async function loadRecentActivities() {
    try {
        console.log('Loading recent activities...');
        const response = await apiClient.get('/admin/dashboard/recent-activities?limit=5');
        
        if (response.success && response.data && response.data.activities) {
            updateRecentActivities(response.data.activities);
        } else {
            console.warn('Failed to load recent activities:', response);
            // 使用默认数据
            updateRecentActivities([
                { action: '系统启动', user: 'system', time: '刚刚', status: 'success' }
            ]);
        }
    } catch (error) {
        console.error('Recent activities error:', error);
        updateRecentActivities([
            { action: '数据加载失败', user: 'system', time: '刚刚', status: 'error' }
        ]);
    }
}

// 更新最近活动显示
function updateRecentActivities(activities) {
    console.log('Updating recent activities:', activities);
    const tbody = document.getElementById('recentActivities');
    
    if (!tbody) {
        console.warn('Recent activities table not found');
        return;
    }
    
    if (!activities || activities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">暂无活动记录</td></tr>';
        return;
    }
    
    tbody.innerHTML = activities.map(activity => `
        <tr>
            <td>${activity.action}</td>
            <td>${activity.user}</td>
            <td>${activity.time}</td>
            <td>
                <span class="status-badge ${activity.status === 'success' ? 'active' : 'inactive'}">
                    ${activity.status === 'success' ? '成功' : '失败'}
                </span>
            </td>
        </tr>
    `).join('');
}

function updateDashboardStats(data) {
    console.log('Updating dashboard stats:', data);
    
    // 更新总用户数
    const totalUsersElement = document.getElementById('totalUsers');
    if (totalUsersElement && data.users) {
        const userCount = data.users.total || '0';
        console.log('Updating totalUsers element with:', userCount);
        totalUsersElement.textContent = userCount;
    } else {
        console.warn('totalUsers element not found or data.users missing:', { 
            element: !!totalUsersElement, 
            data: data.users 
        });
    }
    
    // 更新智能体数量
    const totalAgentsElement = document.getElementById('totalAgents');
    if (totalAgentsElement && data.agents) {
        const agentCount = data.agents.total || '0';
        console.log('Updating totalAgents element with:', agentCount);
        totalAgentsElement.textContent = agentCount;
    } else {
        console.warn('totalAgents element not found or data.agents missing:', { 
            element: !!totalAgentsElement, 
            data: data.agents 
        });
    }
    
    // 更新总对话数
    const totalConversationsElement = document.getElementById('totalConversations');
    if (totalConversationsElement && data.conversations) {
        const conversationCount = data.conversations.total || '0';
        console.log('Updating totalConversations element with:', conversationCount);
        totalConversationsElement.textContent = conversationCount;
    } else {
        console.warn('totalConversations element not found or data.conversations missing:', { 
            element: !!totalConversationsElement, 
            data: data.conversations 
        });
    }
    
    console.log('Dashboard stats updated successfully');
}

// 用户数据加载
async function loadUsersData(page = 1, search = '') {
    try {
        console.log(`Loading users data - page: ${page}, search: ${search}`);
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '20'
        });
        
        if (search) {
            params.append('search', search);
        }
        
        const response = await apiClient.get(`/admin/users?${params}`);
        
        // 添加详细的调试信息
        console.log('Raw API response:', response);
        console.log('Response data structure:', {
            success: response.success,
            hasData: !!response.data,
            dataType: typeof response.data,
            dataKeys: response.data ? Object.keys(response.data) : null,
            fullData: response.data
        });
        
        if (response.success && response.data) {
            // 检查数据结构
            const users = response.data.users || response.data;
            console.log('Extracted users:', users);
            console.log('Users is array:', Array.isArray(users));
            console.log('Users length:', users ? users.length : 'null');
            
            updateUsersTable(users);
        } else {
            console.error('Failed to load users data:', response);
        }
    } catch (error) {
        console.error('Users data error:', error);
        showErrorMessage('用户数据加载失败');
    }
}

function updateUsersTable(users) {
    console.log('Updating users table:', users);
    
    const tableBody = document.getElementById('usersTable');
    if (!tableBody) {
        console.error('Users table body not found');
        return;
    }
    
    if (!Array.isArray(users) || users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    <i class="fas fa-users fa-2x mb-2"></i>
                    <div>暂无用户数据</div>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id || '-'}</td>
            <td>${user.username || '未知'}</td>
            <td>${user.email || '未设置'}</td>
            <td>
                <span class="badge bg-primary">
                    ${getRoleName(user.role)}
                </span>
            </td>
            <td>
                <span class="status-badge ${user.status || 'active'}">
                    ${getStatusName(user.status)}
                </span>
            </td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <button class="admin-btn admin-btn-warning btn-sm" onclick="editUser(${user.id})" title="编辑">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="admin-btn admin-btn-danger btn-sm" onclick="deleteUser(${user.id})" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    console.log(`Updated users table with ${users.length} users`);
}

// 代理数据加载
async function loadAgentsData(page = 1, search = '') {
    try {
        console.log(`Loading agents data - page: ${page}, search: ${search}`);
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '20'
        });
        
        if (search) {
            params.append('search', search);
        }
        
        const response = await apiClient.get(`/admin/agents?${params}`);
        
        // 添加详细的调试信息 - 智能体API
        console.log('Agents raw API response:', response);
        console.log('Agents response data structure:', {
            success: response.success,
            hasData: !!response.data,
            dataType: typeof response.data,
            dataKeys: response.data ? Object.keys(response.data) : null,
            fullData: response.data
        });
        
        if (response.success && response.data) {
            // 检查数据结构
            const agents = response.data.agents || response.data;
            console.log('Extracted agents:', agents);
            console.log('Agents is array:', Array.isArray(agents));
            console.log('Agents length:', agents ? agents.length : 'null');
            
            // 缓存智能体数据到全局变量
            currentData.agents = agents;
            
            updateAgentsTable(agents);
        } else {
            console.error('Failed to load agents data:', response);
            showErrorMessage('智能体数据加载失败');
        }
    } catch (error) {
        console.error('Agents data error:', error);
        showErrorMessage('智能体数据加载失败');
    }
}

function updateAgentsTable(agents = []) {
    console.log('Updating agents table:', agents);
    const tableBody = document.getElementById('agentsTable');
    if (!tableBody) {
        console.warn('Agents table body not found');
        return;
    }
    
    if (!Array.isArray(agents) || agents.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
                    <i class="fas fa-robot fa-2x mb-2"></i>
                    <div>暂无智能体数据</div>
                </td>
            </tr>
        `;
        return;
    }
    
    const html = agents.map(agent => `
        <tr>
            <td>${agent.id || '-'}</td>
            <td>
                <div class="fw-medium">${agent.name || '未命名智能体'}</div>
                <small class="text-muted">${agent.description || ''}</small>
            </td>
            <td>
                <span class="badge bg-info">${agent.type || '未知类型'}</span>
            </td>
            <td>${agent.owner || '未知用户'}</td>
            <td>
                <span class="status-badge ${agent.status || 'active'}">
                    ${getStatusName(agent.status)}
                </span>
            </td>
            <td>
                <span class="badge rounded-pill bg-primary">${agent.conversationCount || 0}</span>
            </td>
            <td>${formatDate(agent.createdAt)}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" onclick="editAgent('${agent.id}')" title="编辑">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteAgent('${agent.id}')" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    tableBody.innerHTML = html;
}

// 对话数据加载
async function loadConversationsData(page = 1, search = '') {
    try {
        console.log(`Loading conversations data - page: ${page}, search: ${search}`);
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '20'
        });
        
        if (search) {
            params.append('search', search);
        }
        
        const response = await apiClient.get(`/admin/conversations?${params}`);
        
        if (response.success && response.data) {
            updateConversationsTable(response.data.conversations || response.data);
        } else {
            console.error('Failed to load conversations data:', response);
        }
    } catch (error) {
        console.error('Conversations data error:', error);
        showErrorMessage('对话数据加载失败');
    }
}

function updateConversationsTable(conversations = []) {
    console.log('Updating conversations table:', conversations);
    const tableBody = document.getElementById('conversationsTable');
    if (!tableBody) {
        console.warn('Conversations table body not found');
        return;
    }
    
    if (!Array.isArray(conversations) || conversations.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">暂无对话数据</td></tr>';
        return;
    }
    
    const html = conversations.map(conv => {
        // 调试输出单个对话数据结构
        console.log('Processing conversation:', conv);
        
        // 处理字段映射，适应后端返回的数据格式
        const conversationId = conv.id || '-';
        const userName = conv.userName || conv.user_name || conv.user?.name || '匿名用户';
        const userAvatar = conv.userAvatar || conv.user_avatar || conv.user?.avatar || '/assets/images/default-avatar.png';
        const agentName = conv.agentName || conv.agent_name || conv.agent?.name || '未知智能体';
        const messageCount = conv.messageCount || conv.message_count || conv.messages_count || 0;
        const status = conv.status || 'active';
        const createdAt = conv.createdAt || conv.created_at || conv.start_time;
        const updatedAt = conv.updatedAt || conv.updated_at || conv.last_activity || conv.last_message_at;
        
        // 状态显示
        const statusBadge = status === 'active' ? 
            '<span class="badge bg-success">活跃</span>' : 
            status === 'archived' ? 
            '<span class="badge bg-secondary">已归档</span>' :
            '<span class="badge bg-warning">未知</span>';
            
        return `
            <tr>
                <td>
                    <small class="text-muted">${conversationId}</small>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${userAvatar}" 
                             alt="Avatar" class="rounded-circle me-2" width="24" height="24"
                             onerror="handleAvatarError(this)">
                        ${userName}
                    </div>
                </td>
                <td>
                    <div class="text-truncate" style="max-width: 150px;" title="${agentName}">
                        <i class="fas fa-robot me-1 text-primary"></i>
                        ${agentName}
                    </div>
                </td>
                <td>
                    <span class="badge rounded-pill bg-info">${messageCount}</span>
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td>
                    <small class="text-muted">${formatDate(createdAt)}</small>
                </td>
                <td>
                    <small class="text-muted">${formatDate(updatedAt)}</small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-info" onclick="viewConversation('${conversationId}')" title="查看">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteConversation('${conversationId}')" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = html;
}

// 系统数据加载
async function loadSystemData() {
    try {
        console.log('Loading system data...');
        const [healthResponse, metricsResponse] = await Promise.all([
            apiClient.get('/admin/system/health'),
            apiClient.get('/admin/system/metrics')
        ]);
        
        if (healthResponse.success) {
            updateSystemStatus(healthResponse.data);
        }
        
        if (metricsResponse.success) {
            updateSystemMetrics(metricsResponse.data);
            // 合并健康数据和指标数据来更新表格
            const combinedData = {
                ...healthResponse.data,
                ...metricsResponse.data
            };
            updateSystemStatusTable(combinedData);
        }
    } catch (error) {
        console.error('System data error:', error);
        showErrorMessage('系统数据加载失败');
    }
}

function updateSystemStatus(data = {}) {
    console.log('Updating system status:', data);
    console.log('Services data structure:', data.services);
    console.log('Checks data structure:', data.checks);
    
    // 更新服务器状态指示器
    const statusElement = document.getElementById('serverStatus');
    if (statusElement) {
        const isHealthy = data.status === 'healthy' || data.healthy === true;
        statusElement.innerHTML = `
            <span class="badge bg-${isHealthy ? 'success' : 'danger'}">
                <i class="fas fa-${isHealthy ? 'check-circle' : 'exclamation-triangle'}"></i>
                ${isHealthy ? '正常' : '异常'}
            </span>
        `;
    }
    
    // 更新数据库状态 - 支持checks数组格式
    const dbStatus = document.getElementById('dbStatus');
    const dbHealthIndicator = document.getElementById('dbHealthIndicator');
    const dbDetails = document.getElementById('dbDetails');
    
    if (dbStatus) {
        let dbData = null;
        let isDbHealthy = false;
        
        // 优先从checks数组获取（因为后端使用这种格式）
        if (data.checks && Array.isArray(data.checks)) {
            const dbCheck = data.checks.find(check => 
                check.name && (
                    check.name.toLowerCase().includes('database') || 
                    check.name.toLowerCase().includes('数据库') ||
                    check.name.toLowerCase().includes('db') ||
                    check.name.toLowerCase().includes('mysql') ||
                    check.name.toLowerCase().includes('mariadb')
                )
            );
            if (dbCheck) {
                console.log('Found database in checks:', dbCheck);
                isDbHealthy = dbCheck.status === 'pass';
                dbData = { 
                    status: dbCheck.status === 'pass' ? 'connected' : 'error',
                    responseTime: dbCheck.responseTime || dbCheck.message || 'N/A'
                };
            }
        }
        
        // 备用：从services获取
        if (!dbData && data.services && data.services.database) {
            dbData = data.services.database;
            isDbHealthy = dbData.status === 'connected';
            console.log('Found database in services:', dbData);
        }
        
        // 更新显示
        if (dbData) {
            console.log('Updating database status:', { dbData, isDbHealthy });
            dbStatus.textContent = isDbHealthy ? '正常连接' : '连接异常';
            if (dbHealthIndicator) {
                dbHealthIndicator.className = `health-indicator ${isDbHealthy ? 'healthy' : 'error'}`;
            }
            if (dbDetails) {
                dbDetails.textContent = `响应时间: ${dbData.responseTime}`;
            }
        } else {
            console.warn('Database status not found in checks or services');
            dbStatus.textContent = '数据未找到';
            if (dbHealthIndicator) {
                dbHealthIndicator.className = 'health-indicator warning';
            }
        }
    }
    
    // 更新Redis状态 - 支持checks数组格式
    const redisStatus = document.getElementById('redisStatus');
    const redisHealthIndicator = document.getElementById('redisHealthIndicator');
    const redisDetails = document.getElementById('redisDetails');
    
    if (redisStatus) {
        let redisData = null;
        let isRedisHealthy = false;
        
        // 优先从checks数组获取
        if (data.checks && Array.isArray(data.checks)) {
            const redisCheck = data.checks.find(check => 
                check.name && check.name.toLowerCase().includes('redis')
            );
            if (redisCheck) {
                console.log('Found redis in checks:', redisCheck);
                isRedisHealthy = redisCheck.status === 'pass';
                redisData = { 
                    status: redisCheck.status === 'pass' ? 'connected' : 'error',
                    responseTime: redisCheck.responseTime || redisCheck.message || 'N/A'
                };
            }
        }
        
        // 备用：从services获取
        if (!redisData && data.services && data.services.redis) {
            redisData = data.services.redis;
            isRedisHealthy = redisData.status === 'connected';
            console.log('Found redis in services:', redisData);
        }
        
        // 更新显示
        if (redisData) {
            console.log('Updating redis status:', { redisData, isRedisHealthy });
            redisStatus.textContent = isRedisHealthy ? '正常连接' : '连接异常';
            if (redisHealthIndicator) {
                redisHealthIndicator.className = `health-indicator ${isRedisHealthy ? 'healthy' : 'error'}`;
            }
            if (redisDetails) {
                redisDetails.textContent = `响应时间: ${redisData.responseTime}`;
            }
        } else {
            console.warn('Redis status not found in checks or services');
            redisStatus.textContent = '数据未找到';
            if (redisHealthIndicator) {
                redisHealthIndicator.className = 'health-indicator warning';
            }
        }
    }
    
    // 注意：不在这里调用updateSystemStatusTable，因为需要合并指标数据
}

function updateSystemMetrics(data) {
    console.log('System metrics:', data);
    // 这里可以添加更多系统指标的显示逻辑
}

// 更新系统状态表格
function updateSystemStatusTable(data = {}) {
    console.log('updateSystemStatusTable called with data:', data);
    const tableBody = document.getElementById('systemStatusTable');
    if (!tableBody) {
        console.warn('System status table not found');
        return;
    }
    
    const components = [
        {
            name: 'CPU使用率',
            status: (typeof data.cpu_usage === 'number') ? `${data.cpu_usage.toFixed(1)}%` : 
                   (typeof data.cpuUsage === 'number') ? `${data.cpuUsage.toFixed(1)}%` : '未知',
            details: (typeof data.cpu_usage === 'number' && data.cpu_usage > 80) || 
                    (typeof data.cpuUsage === 'number' && data.cpuUsage > 80) ? '使用率较高' : '正常',
            isHealthy: (typeof data.cpu_usage === 'number' && data.cpu_usage < 80) || 
                      (typeof data.cpuUsage === 'number' && data.cpuUsage < 80) || 
                      (typeof data.cpu_usage !== 'number' && typeof data.cpuUsage !== 'number')
        },
        {
            name: '内存使用率',
            status: (typeof data.memory_usage === 'number') ? `${data.memory_usage.toFixed(1)}%` : 
                   (typeof data.memoryUsage === 'number') ? `${data.memoryUsage.toFixed(1)}%` : '未知',
            details: (typeof data.memory_usage === 'number' && data.memory_usage > 85) || 
                    (typeof data.memoryUsage === 'number' && data.memoryUsage > 85) ? '使用率较高' : '正常',
            isHealthy: (typeof data.memory_usage === 'number' && data.memory_usage < 85) || 
                      (typeof data.memoryUsage === 'number' && data.memoryUsage < 85) || 
                      (typeof data.memory_usage !== 'number' && typeof data.memoryUsage !== 'number')
        },
        {
            name: '磁盘使用率',
            status: (typeof data.disk_usage === 'number') ? `${data.disk_usage.toFixed(1)}%` : 
                   (typeof data.diskUsage === 'number') ? `${data.diskUsage.toFixed(1)}%` : '未知',
            details: (typeof data.disk_usage === 'number' && data.disk_usage > 90) || 
                    (typeof data.diskUsage === 'number' && data.diskUsage > 90) ? '空间不足' : '正常',
            isHealthy: (typeof data.disk_usage === 'number' && data.disk_usage < 90) || 
                      (typeof data.diskUsage === 'number' && data.diskUsage < 90) || 
                      (typeof data.disk_usage !== 'number' && typeof data.diskUsage !== 'number')
        },
        {
            name: '运行时间',
            status: data.uptime ? formatUptime(data.uptime) : '未知',
            details: data.uptime ? '系统稳定运行' : '无数据',
            isHealthy: true
        }
    ];
    
    // 添加服务状态到组件列表
    if (data.services) {
        if (data.services.database) {
            components.push({
                name: '数据库',
                status: data.services.database.status === 'connected' ? '已连接' : '未连接',
                details: `响应时间: ${data.services.database.responseTime || 'N/A'}`,
                isHealthy: data.services.database.status === 'connected'
            });
        }
        
        if (data.services.redis) {
            components.push({
                name: 'Redis缓存',
                status: data.services.redis.status === 'connected' ? '已连接' : '未连接',
                details: `响应时间: ${data.services.redis.responseTime || 'N/A'}`,
                isHealthy: data.services.redis.status === 'connected'
            });
        }
        
        if (data.services.dify_api) {
            components.push({
                name: 'Dify API',
                status: data.services.dify_api.status === 'connected' ? '已连接' : '未连接',
                details: `响应时间: ${data.services.dify_api.responseTime || 'N/A'}`,
                isHealthy: data.services.dify_api.status === 'connected'
            });
        }
    }
    
    // 如果没有services数据，尝试从checks数组获取 - 但排除已有的项目
    if (!data.services && data.checks && Array.isArray(data.checks)) {
        data.checks.forEach(check => {
            if (check.name && check.status) {
                // 排除已经在基础组件和状态卡片中显示的项目
                const checkName = check.name.toLowerCase();
                if (checkName.includes('cpu') || checkName.includes('memory') || 
                    checkName.includes('disk') || checkName.includes('内存') || 
                    checkName.includes('磁盘') || checkName.includes('database') ||
                    checkName.includes('数据库') || checkName.includes('redis') ||
                    checkName.includes('db') || checkName.includes('mysql') ||
                    checkName.includes('mariadb')) {
                    return; // 跳过这些项目，避免重复显示
                }
                
                let componentName = check.name;
                let isHealthy = check.status === 'pass';
                let status = isHealthy ? '正常' : '异常';
                let details = check.message || (check.responseTime ? `响应时间: ${check.responseTime}` : '无详细信息');
                
                components.push({
                    name: componentName,
                    status: status,
                    details: details,
                    isHealthy: isHealthy
                });
            }
        });
    }
    
    const html = components.map(comp => {
        const statusBadge = comp.isHealthy 
            ? '<span class="badge bg-success">正常</span>'
            : '<span class="badge bg-danger">异常</span>';
            
        return `
            <tr>
                <td><strong>${comp.name}</strong></td>
                <td>${statusBadge}</td>
                <td>
                    <div>${comp.status}</div>
                    <small class="text-muted">${comp.details}</small>
                </td>
                <td><small class="text-muted">${new Date().toLocaleString()}</small></td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = html || '<tr><td colspan="4" class="text-center text-muted">暂无系统状态数据</td></tr>';
}

// 日志数据加载
async function loadLogsData(level = 'all') {
    try {
        console.log('Loading logs data with level:', level);
        
        // 构建查询参数
        const params = new URLSearchParams();
        if (level !== 'all') {
            params.append('level', level);
        }
        
        const url = `/admin/logs${params.toString() ? '?' + params.toString() : ''}`;
        const response = await apiClient.get(url);
        
        if (response.success && response.data) {
            updateLogsDisplay(response.data);
        } else {
            console.error('Failed to load logs data:', response);
        }
    } catch (error) {
        console.error('Logs data error:', error);
        showErrorMessage('日志数据加载失败');
    }
}

function updateLogsDisplay(logs) {
    console.log('Updating logs display:', logs);
    
    const logsContent = document.getElementById('logsContent');
    if (!logsContent) {
        console.warn('Logs content element not found');
        return;
    }
    
    // 处理日志数据
    let logArray = [];
    if (logs && logs.logs && Array.isArray(logs.logs)) {
        logArray = logs.logs;
    } else if (Array.isArray(logs)) {
        logArray = logs;
    }
    
    if (logArray.length === 0) {
        logsContent.innerHTML = '<span style="color: #888;">暂无日志数据</span>';
        return;
    }
    
    // 定义日志级别颜色
    const levelColors = {
        'ERROR': '#ff6b6b',   // 红色
        'WARN': '#feca57',    // 黄色
        'INFO': '#48dbfb',    // 蓝色
        'DEBUG': '#9c88ff',   // 紫色
        'SYSTEM': '#54a0ff'   // 系统蓝色
    };
    
    // 格式化日志显示 - 使用HTML而不是纯文本以支持颜色
    const logHtml = logArray.map(log => {
        const timestamp = (log.timestamp || log.created_at || new Date().toISOString()).substring(0, 19);
        const level = (log.level || 'info').toUpperCase();
        const source = (log.source || 'system').toUpperCase();
        const message = log.message || '';
        const user = log.userName ? ` [${log.userName}]` : '';
        const ip = log.ip_address || log.ip ? ` (${log.ip_address || log.ip})` : '';
        
        const levelColor = levelColors[level] || '#00ff00';
        
        return `<div style="margin-bottom: 2px;">
            <span style="color: #888;">${timestamp}</span>
            <span style="color: ${levelColor}; font-weight: bold;">[${level.padEnd(5)}]</span>
            <span style="color: #ddd;">${source.padEnd(8)}</span>
            <span style="color: #ccc;">${user}</span>
            <span style="color: #999;">${ip}</span>
            <span style="color: #fff;">: ${message}</span>
        </div>`;
    }).join('');
    
    logsContent.innerHTML = logHtml;
    
    // 自动滚动到底部显示最新日志
    logsContent.scrollTop = logsContent.scrollHeight;
}

// 消息显示函数
function showErrorMessage(message) {
    console.error('Error:', message);
    // 这里可以实现toast通知
    alert(message);
}

function showSuccessMessage(message) {
    console.log('Success:', message);
    // 这里可以实现toast通知
    alert(message);
}

// 防抖函数
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

// 搜索处理函数
function handleUserSearch(e) {
    const query = e.target.value.trim();
    console.log('User search:', query);
    loadUsersData(1, query);
}

function handleAgentSearch(e) {
    const query = e.target.value.trim();
    console.log('Agent search:', query);
    loadAgentsData(1, query);
}

function handleConversationSearch(e) {
    const query = e.target.value.trim();
    console.log('Conversation search:', query);
    loadConversationsData(1, query);
}

// 工具函数
function formatDate(dateString) {
    if (!dateString) return '未知';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Date format error:', error);
        return '格式错误';
    }
}

function getRoleName(role) {
    const roleNames = {
        'user': '用户',
        'admin': '管理员',
        'superadmin': '超级管理员'
    };
    return roleNames[role] || role || '未知';
}

// 格式化运行时间
function formatUptime(seconds) {
    if (!seconds || seconds < 0) return '0秒';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}天${hours}时`;
    if (hours > 0) return `${hours}时${minutes}分`;
    return `${minutes}分`;
}

// 处理头像加载错误
function handleAvatarError(img) {
    // 防止无限循环重试
    if (img.dataset.errorHandled) return;
    
    img.dataset.errorHandled = 'true';
    
    // 尝试使用默认头像
    if (img.src !== '/assets/images/default-avatar.png') {
        img.src = '/assets/images/default-avatar.png';
        return;
    }
    
    // 如果默认头像也失败，使用SVG占位符
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiNlZWVlZWUiLz4KPHA7YXRoIGQ9Im0xMiAxMmMyLjIxIDAgNC0xLjc5IDQtNHMtMS43OS00LTQtNC00IDEuNzktNCA0IDEuNzkgNCA0IDRabTAgMmMtMi42NyAwLTggMS4zNC04IDR2MmgxNnYtMmMwLTIuNjYtNS4zMy00LTgtNFoiIGZpbGw9IiM5OTk5OTkiLz4KPC9zdmc+Cg==';
}

function getStatusName(status) {
    const statusNames = {
        'active': '激活',
        'inactive': '未激活',
        'suspended': '暂停',
        'pending': '待审核',
        'online': '在线',
        'offline': '离线',
        'healthy': '健康',
        'unhealthy': '异常',
        'disabled': '已禁用'
    };
    return statusNames[status] || '激活';
}

// 占位符函数 - 用户管理
function editUser(userId) {
    alert(`编辑用户功能开发中... (用户ID: ${userId})`);
}

function deleteUser(userId) {
    if (confirm('确定要删除这个用户吗？')) {
        alert(`删除用户功能开发中... (用户ID: ${userId})`);
    }
}

// 用户管理功能
function showCreateUserModal() {
    console.log('Showing create user modal');
    
    // 清空表单
    const form = document.getElementById('createUserForm');
    if (form) {
        form.reset();
        form.classList.remove('was-validated');
    }
    
    // 根据当前用户角色限制超级管理员选项
    restrictAdminRoleOptions('createRole');
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('createUserModal'));
    modal.show();
}

async function createUser() {
    console.log('Creating new user...');
    
    // 获取表单元素
    const form = document.getElementById('createUserForm');
    const createBtn = document.getElementById('createUserBtn');
    
    if (!form) {
        console.error('Create user form not found');
        return;
    }
    
    // 表单验证
    if (!validateCreateUserForm()) {
        form.classList.add('was-validated');
        return;
    }
    
    // 获取表单数据
    const formData = new FormData(form);
    const userData = {
        username: formData.get('username').trim(),
        email: formData.get('email').trim(),
        password: formData.get('password'),
        nickname: formData.get('nickname')?.trim() || '',
        role: formData.get('role') || 'user',
        status: formData.get('status') || 'active',
        emailVerified: formData.get('emailVerified') === 'on'
    };
    
    console.log('User data to create:', { ...userData, password: '[HIDDEN]' });
    
    // 显示加载状态
    if (createBtn) {
        createBtn.disabled = true;
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>创建中...';
    }
    
    try {
        // 调用后端API创建用户
        const response = await apiClient.post('/admin/users', userData);
        
        console.log('Create user response:', response);
        
        if (response.success) {
            showSuccessMessage(`用户 "${userData.username}" 创建成功`);
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('createUserModal'));
            if (modal) {
                modal.hide();
            }
            
            // 刷新用户列表
            await loadUsersData();
            
            // 刷新仪表盘数据
            await loadDashboardData();
            
        } else {
            const errorMessage = response.message || '创建用户失败';
            console.error('Create user failed:', errorMessage);
            showErrorMessage(errorMessage);
        }
        
    } catch (error) {
        console.error('Create user error:', error);
        
        let errorMessage = '创建用户失败';
        
        if (error.status === 409) {
            if (error.message?.includes('用户名')) {
                errorMessage = '用户名已存在，请选择其他用户名';
            } else if (error.message?.includes('邮箱')) {
                errorMessage = '邮箱地址已被注册，请使用其他邮箱';
            } else {
                errorMessage = error.message || '用户名或邮箱已存在';
            }
        } else if (error.status === 400) {
            errorMessage = error.message || '输入信息格式不正确';
        } else if (error.status === 403) {
            errorMessage = '权限不足，无法创建用户';
        } else {
            errorMessage = error.message || '网络错误，请稍后重试';
        }
        
        showErrorMessage(errorMessage);
        
    } finally {
        // 恢复按钮状态
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.innerHTML = '<i class="fas fa-user-plus me-1"></i>创建用户';
        }
    }
}

// 验证创建用户表单
function validateCreateUserForm() {
    const form = document.getElementById('createUserForm');
    if (!form) return false;
    
    let isValid = true;
    
    // 用户名验证
    const username = form.querySelector('#createUsername');
    if (username && !validateUsername(username.value)) {
        setFieldError(username, '用户名必须为3-50个字符，只能包含字母、数字和下划线');
        isValid = false;
    } else {
        clearFieldError(username);
    }
    
    // 邮箱验证
    const email = form.querySelector('#createEmail');
    if (email && !validateEmail(email.value)) {
        setFieldError(email, '请输入有效的邮箱地址');
        isValid = false;
    } else {
        clearFieldError(email);
    }
    
    // 密码验证
    const password = form.querySelector('#createPassword');
    if (password && !validatePassword(password.value)) {
        setFieldError(password, '密码必须至少8个字符，包含字母和数字');
        isValid = false;
    } else {
        clearFieldError(password);
    }
    
    // 确认密码验证
    const passwordConfirm = form.querySelector('#createPasswordConfirm');
    if (passwordConfirm && password && passwordConfirm.value !== password.value) {
        setFieldError(passwordConfirm, '两次输入的密码不一致');
        isValid = false;
    } else {
        clearFieldError(passwordConfirm);
    }
    
    return isValid;
}

// 编辑用户功能
async function showEditUserModal(userId) {
    console.log('Showing edit user modal for:', userId);
    
    if (!userId) {
        showErrorMessage('用户ID不能为空');
        return;
    }
    
    try {
        // 显示加载状态
        showInfoMessage('正在加载用户信息...');
        
        // 获取用户详细信息
        const response = await apiClient.get(`/admin/users/${userId}`);
        
        if (!response.success) {
            showErrorMessage('获取用户信息失败: ' + (response.message || '未知错误'));
            return;
        }
        
        const user = response.data;
        console.log('User data loaded:', user);
        
        // 填充编辑表单
        populateEditUserForm(user);
        
        // 根据当前用户角色限制超级管理员选项
        restrictAdminRoleOptions('editRole');
        
        // 显示编辑模态框
        const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
        modal.show();
        
        // 隐藏加载消息
        hideMessage();
        
    } catch (error) {
        console.error('Load user data error:', error);
        showErrorMessage('获取用户信息失败: ' + (error.message || '网络错误'));
    }
}

// 填充编辑用户表单
function populateEditUserForm(user) {
    const form = document.getElementById('editUserForm');
    if (!form) return;
    
    // 清空之前的验证状态
    form.classList.remove('was-validated');
    form.querySelectorAll('.is-invalid, .is-valid').forEach(field => {
        field.classList.remove('is-invalid', 'is-valid');
    });
    
    // 填充用户ID（隐藏字段）
    const userIdField = form.querySelector('#editUserId');
    if (userIdField) userIdField.value = user.id;
    
    // 填充基本信息
    const usernameField = form.querySelector('#editUsername');
    if (usernameField) usernameField.value = user.username || '';
    
    const emailField = form.querySelector('#editEmail');
    if (emailField) emailField.value = user.email || '';
    
    const nicknameField = form.querySelector('#editNickname');
    if (nicknameField) nicknameField.value = user.nickname || '';
    
    // 角色选择
    const roleField = form.querySelector('#editRole');
    if (roleField) roleField.value = user.role || 'user';
    
    // 状态选择
    const statusField = form.querySelector('#editStatus');
    if (statusField) statusField.value = user.status || 'active';
    
    // 邮箱验证状态（兼容数字和布尔值）
    const emailVerifiedField = form.querySelector('#editEmailVerified');
    if (emailVerifiedField) {
        // 后端可能返回数字0/1或布尔值true/false，这里统一处理
        const isVerified = user.emailVerified === true || user.emailVerified === 1;
        emailVerifiedField.checked = isVerified;
    }
    
    // 显示创建时间和更新时间
    const createdAtField = form.querySelector('#editCreatedAt');
    if (createdAtField) createdAtField.value = formatDateTime(user.createdAt);
    
    const updatedAtField = form.querySelector('#editUpdatedAt');
    if (updatedAtField) updatedAtField.value = formatDateTime(user.updatedAt);
}

async function saveUserChanges() {
    console.log('Saving user changes...');
    
    // 获取表单元素
    const form = document.getElementById('editUserForm');
    const saveBtn = document.getElementById('saveUserBtn');
    
    if (!form) {
        console.error('Edit user form not found');
        return;
    }
    
    // 获取用户ID
    const userId = form.querySelector('#editUserId')?.value;
    if (!userId) {
        showErrorMessage('用户ID缺失');
        return;
    }
    
    // 表单验证
    if (!validateEditUserForm()) {
        form.classList.add('was-validated');
        return;
    }
    
    // 获取表单数据
    const formData = new FormData(form);
    const userData = {
        username: formData.get('username')?.trim(),
        email: formData.get('email')?.trim(),
        nickname: formData.get('nickname')?.trim() || '',
        role: formData.get('role') || 'user',
        status: formData.get('status') || 'active',
        emailVerified: formData.get('emailVerified') === 'on'
    };
    
    // 如果密码字段不为空，则包含密码更新
    const password = formData.get('password');
    if (password && password.trim()) {
        userData.password = password.trim();
    }
    
    console.log('User data to update:', { ...userData, password: userData.password ? '[HIDDEN]' : '[NOT_CHANGED]' });
    
    // 显示加载状态
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>保存中...';
    }
    
    try {
        // 调用后端API更新用户
        const response = await apiClient.put(`/admin/users/${userId}`, userData);
        
        console.log('Update user response:', response);
        
        if (response.success) {
            showSuccessMessage(`用户 "${userData.username}" 更新成功`);
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
            if (modal) {
                modal.hide();
            }
            
            // 刷新用户列表
            await loadUsersData();
            
            // 刷新仪表盘数据
            await loadDashboardData();
            
        } else {
            const errorMessage = response.message || '更新用户失败';
            console.error('Update user failed:', errorMessage);
            showErrorMessage(errorMessage);
        }
        
    } catch (error) {
        console.error('Update user error:', error);
        
        let errorMessage = '更新用户失败';
        
        if (error.status === 409) {
            if (error.message?.includes('用户名')) {
                errorMessage = '用户名已存在，请选择其他用户名';
            } else if (error.message?.includes('邮箱')) {
                errorMessage = '邮箱地址已被其他用户使用';
            } else {
                errorMessage = error.message || '用户名或邮箱已存在';
            }
        } else if (error.status === 400) {
            errorMessage = error.message || '输入信息格式不正确';
        } else if (error.status === 403) {
            errorMessage = '权限不足，无法修改该用户';
        } else if (error.status === 404) {
            errorMessage = '用户不存在';
        } else {
            errorMessage = error.message || '网络错误，请稍后重试';
        }
        
        showErrorMessage(errorMessage);
        
    } finally {
        // 恢复按钮状态
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save me-1"></i>保存修改';
        }
    }
}

// 验证编辑用户表单
function validateEditUserForm() {
    const form = document.getElementById('editUserForm');
    if (!form) return false;
    
    let isValid = true;
    
    // 用户名验证
    const username = form.querySelector('#editUsername');
    if (username && !validateUsername(username.value)) {
        setFieldError(username, '用户名必须为3-50个字符，只能包含字母、数字和下划线');
        isValid = false;
    } else {
        clearFieldError(username);
    }
    
    // 邮箱验证
    const email = form.querySelector('#editEmail');
    if (email && !validateEmail(email.value)) {
        setFieldError(email, '请输入有效的邮箱地址');
        isValid = false;
    } else {
        clearFieldError(email);
    }
    
    // 密码验证（如果填写了密码）
    const password = form.querySelector('#editPassword');
    if (password && password.value.trim() && !validatePassword(password.value)) {
        setFieldError(password, '密码必须至少8个字符，包含字母和数字');
        isValid = false;
    } else {
        clearFieldError(password);
    }
    
    // 确认密码验证（如果填写了密码）
    const passwordConfirm = form.querySelector('#editPasswordConfirm');
    if (passwordConfirm && password && password.value.trim()) {
        if (passwordConfirm.value !== password.value) {
            setFieldError(passwordConfirm, '两次输入的密码不一致');
            isValid = false;
        } else {
            clearFieldError(passwordConfirm);
        }
    }
    
    return isValid;
}

// 删除用户功能
async function deleteUser(userId) {
    console.log('Deleting user:', userId);
    
    if (!confirm('确定要删除这个用户吗？此操作无法撤销！')) {
        return;
    }
    
    try {
        const response = await apiClient.delete(`/admin/users/${userId}`);
        
        if (response.success) {
            showSuccessMessage('用户删除成功');
            // 刷新用户列表
            await loadUsersData();
            // 刷新仪表盘数据  
            await loadDashboardData();
        } else {
            showErrorMessage('删除用户失败: ' + (response.message || '未知错误'));
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showErrorMessage('删除用户失败: ' + (error.message || '未知错误'));
    }
}

// 辅助验证函数
function validateUsername(username) {
    if (!username || username.length < 3 || username.length > 50) {
        return false;
    }
    // 只允许字母、数字和下划线
    const pattern = /^[a-zA-Z0-9_]+$/;
    return pattern.test(username);
}

function validateEmail(email) {
    if (!email) return false;
    // 基础邮箱格式验证
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
}

function validatePassword(password) {
    if (!password || password.length < 8 || password.length > 128) {
        return false;
    }
    // 至少包含一个字母和一个数字
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    return hasLetter && hasNumber;
}

// 表单验证UI辅助函数
function setFieldError(field, message) {
    if (!field) return;
    
    field.classList.add('is-invalid');
    const feedback = field.nextElementSibling;
    if (feedback && feedback.classList.contains('invalid-feedback')) {
        feedback.textContent = message;
    }
}

function clearFieldError(field) {
    if (!field) return;
    
    field.classList.remove('is-invalid');
    field.classList.add('is-valid');
}

// 限制管理员角色选项（普通管理员不能创建超级管理员）
function restrictAdminRoleOptions(selectId) {
    const roleSelect = document.getElementById(selectId);
    if (!roleSelect) return;
    
    // 这里可以根据当前用户角色来限制选项
    // 目前先保持所有选项可用，具体限制由后端处理
    const superAdminOption = roleSelect.querySelector('option[data-admin-only="true"]');
    if (superAdminOption) {
        // 可以在这里根据当前用户权限来显示/隐藏超级管理员选项
        // superAdminOption.style.display = 'none';
    }
}

// 密码可见性切换
function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    const eyeIcon = document.getElementById(fieldId + 'Eye');
    
    if (!field || !eyeIcon) return;
    
    if (field.type === 'password') {
        field.type = 'text';
        eyeIcon.className = 'fas fa-eye-slash';
    } else {
        field.type = 'password';
        eyeIcon.className = 'fas fa-eye';
    }
}

function showCreateUserModal() {
    alert('创建用户功能开发中...');
}

async function createUser() {
    // 创建用户功能开发中
    showErrorMessage('创建用户功能开发中，请联系系统管理员');
}

async function refreshSystemStatus() {
    console.log('Refreshing system status...');
    await loadSystemData();
    showSuccessMessage('系统状态已刷新');
}

async function refreshLogs() {
    console.log('Refreshing logs...');
    await loadLogsData();
    showSuccessMessage('日志已刷新');
}

// 智能体管理功能
async function editAgent(agentId) {
    try {
        console.log('Loading agent data for editing:', agentId);
        
        // 首先尝试从当前已加载的智能体列表中查找
        let agent = null;
        
        // 检查是否已经有智能体数据
        if (currentData.agents && Array.isArray(currentData.agents)) {
            agent = currentData.agents.find(a => a.id === agentId);
            if (agent) {
                console.log('Found agent in cached data:', agent);
            }
        }
        
        // 如果缓存中没有，重新加载列表
        if (!agent) {
            console.log('Agent not found in cache, reloading agents list...');
            await loadAgentsData();
            
            if (currentData.agents && Array.isArray(currentData.agents)) {
                agent = currentData.agents.find(a => a.id === agentId);
            }
        }
        
        if (!agent) {
            console.error('Failed to find agent with ID:', agentId);
            console.log('Available agents:', currentData.agents);
            showErrorMessage('未找到指定的智能体，请刷新页面后重试');
            return;
        }
        
        console.log('Using agent data for editing:', agent);
        
        // 类型映射：中文显示转换为英文值
        const typeMapping = {
            '对话机器人': 'chatbot',
            '工作流': 'workflow', 
            '文本补全': 'completion',
            '智能体': 'agent'
        };
        
        // 检查表单元素是否存在
        const formElements = {
            editAgentId: document.getElementById('editAgentId'),
            editAgentName: document.getElementById('editAgentName'),
            editAgentType: document.getElementById('editAgentType'),
            editAgentDescription: document.getElementById('editAgentDescription'),
            editAgentStatus: document.getElementById('editAgentStatus'),
            editAgentVisibility: document.getElementById('editAgentVisibility'),
            editAgentOwner: document.getElementById('editAgentOwner')
        };
        
        // 检查缺失的表单元素
        const missingElements = Object.entries(formElements).filter(([key, element]) => !element);
        if (missingElements.length > 0) {
            console.error('Missing form elements:', missingElements.map(([key]) => key));
            showErrorMessage('编辑表单元素缺失，请刷新页面');
            return;
        }
        
        // 填充编辑表单
        formElements.editAgentId.value = agent.id || '';
        formElements.editAgentName.value = agent.name || '';
        
        // 设置类型（转换中文显示为英文值）
        const originalType = typeMapping[agent.type] || agent.type || 'chatbot';
        formElements.editAgentType.value = originalType;
        
        formElements.editAgentDescription.value = agent.description || '';
        formElements.editAgentStatus.value = agent.status || 'active';
        formElements.editAgentVisibility.value = agent.visibility || 'private';
        formElements.editAgentOwner.value = agent.owner || agent.ownerUsername || '未知';
        
        // 显示编辑模态框
        const modalElement = document.getElementById('editAgentModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        } else {
            console.error('Edit agent modal not found');
            showErrorMessage('编辑对话框未找到，请刷新页面');
        }
        
    } catch (error) {
        console.error('Load agent error details:', {
            error: error,
            message: error.message,
            stack: error.stack
        });
        showErrorMessage(`加载智能体信息失败: ${error.message || '未知错误'}`);
    }
}

async function saveAgentChanges() {
    try {
        const agentId = document.getElementById('editAgentId').value;
        const formData = {
            name: document.getElementById('editAgentName').value.trim(),
            description: document.getElementById('editAgentDescription').value.trim(),
            status: document.getElementById('editAgentStatus').value,
            visibility: document.getElementById('editAgentVisibility').value
        };
        
        // 验证必填字段
        if (!formData.name) {
            showErrorMessage('智能体名称不能为空');
            return;
        }
        
        if (!formData.description) {
            showErrorMessage('智能体描述不能为空');
            return;
        }
        
        console.log('Updating agent:', agentId, formData);
        
        // 使用PUT接口进行完整更新
        const response = await apiClient.put(`/admin/agents/${agentId}`, formData);
        
        if (response.success) {
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('editAgentModal'));
            modal.hide();
            
            // 显示成功消息
            showSuccessMessage('智能体信息更新成功');
            
            // 重新加载智能体列表
            await loadAgentsData();
        } else {
            showErrorMessage(response.message || '更新智能体失败');
        }
        
    } catch (error) {
        console.error('Update agent error:', error);
        showErrorMessage('保存更改失败');
    }
}

async function deleteAgent(agentId) {
    if (!confirm('确定要删除这个智能体吗？此操作不可恢复！')) {
        return;
    }
    
    try {
        console.log('Deleting agent:', agentId);
        
        const response = await apiClient.delete(`/admin/agents/${agentId}`);
        
        if (response.success) {
            showSuccessMessage('智能体删除成功');
            
            // 强制清除缓存，确保重新从服务器获取数据
            currentData.agents = null;
            delete currentData.agents;
            
            // 添加短暂延迟，确保后端数据库操作完成
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 重新加载智能体列表
            await loadAgentsData();
        } else {
            showErrorMessage(response.message || '删除智能体失败');
        }
        
    } catch (error) {
        console.error('Delete agent error:', error);
        showErrorMessage(`删除智能体失败: ${error.message || '未知错误'}`);
    }
}

function showCreateAgentModal() {
    // 清空表单
    document.getElementById('createAgentForm').reset();
    
    // 显示创建模态框
    const modal = new bootstrap.Modal(document.getElementById('createAgentModal'));
    modal.show();
}

async function createAgent() {
    try {
        const form = document.getElementById('createAgentForm');
        const formData = new FormData(form);
        
        const agentData = {
            name: formData.get('name').trim(),
            type: formData.get('type'),
            description: formData.get('description').trim(),
            visibility: formData.get('visibility') || 'private'
        };
        
        // 验证必填字段
        if (!agentData.name) {
            showErrorMessage('智能体名称不能为空');
            return;
        }
        
        if (!agentData.description) {
            showErrorMessage('智能体描述不能为空');
            return;
        }
        
        console.log('Creating new agent:', agentData);
        
        const response = await apiClient.post('/admin/agents', agentData);
        
        if (response.success) {
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('createAgentModal'));
            modal.hide();
            
            // 显示成功消息
            showSuccessMessage('智能体创建成功');
            
            // 重新加载智能体列表
            await loadAgentsData();
        } else {
            showErrorMessage(response.message || '创建智能体失败');
        }
        
    } catch (error) {
        console.error('Create agent error:', error);
        showErrorMessage('创建智能体失败');
    }
}

// 占位符函数 - 对话管理
async function viewConversation(conversationId) {
    try {
        console.log('Viewing conversation:', conversationId);
        const response = await apiClient.get(`/admin/conversations/${conversationId}`);
        
        if (response.success && response.data) {
            const conversation = response.data.conversation || response.data;
            const messages = response.data.messages || [];
            
            // 创建对话详情显示
            let messagesHtml = '';
            if (messages.length > 0) {
                messagesHtml = messages.map(msg => {
                    const role = msg.role === 'user' ? '用户' : 'AI助手';
                    const timestamp = formatDate(msg.timestamp || msg.created_at);
                    return `
                        <div class="message-item mb-3 p-3 border rounded">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <strong class="text-${msg.role === 'user' ? 'primary' : 'success'}">${role}</strong>
                                <small class="text-muted">${timestamp}</small>
                            </div>
                            <div class="message-content">${msg.content || ''}</div>
                        </div>
                    `;
                }).join('');
            } else {
                messagesHtml = '<p class="text-muted text-center">暂无消息</p>';
            }
            
            // 显示对话详情模态框
            const modalHtml = `
                <div class="modal fade" id="conversationDetailModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">对话详情</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <strong>对话ID:</strong> ${conversation.id || '-'}
                                    </div>
                                    <div class="col-md-6">
                                        <strong>标题:</strong> ${conversation.title || '未命名对话'}
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <strong>用户:</strong> ${conversation.userName || '匿名用户'}
                                    </div>
                                    <div class="col-md-6">
                                        <strong>消息数量:</strong> ${conversation.messageCount || messages.length || 0}
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <strong>创建时间:</strong> ${formatDate(conversation.createdAt || conversation.created_at)}
                                    </div>
                                    <div class="col-md-6">
                                        <strong>最后更新:</strong> ${formatDate(conversation.updatedAt || conversation.updated_at)}
                                    </div>
                                </div>
                                <hr>
                                <h6>消息列表:</h6>
                                <div style="max-height: 400px; overflow-y: auto;">
                                    ${messagesHtml}
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // 移除已存在的模态框
            const existingModal = document.getElementById('conversationDetailModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // 添加新模态框
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // 显示模态框
            const modal = new bootstrap.Modal(document.getElementById('conversationDetailModal'));
            modal.show();
            
        } else {
            showErrorMessage('获取对话详情失败');
        }
    } catch (error) {
        console.error('View conversation error:', error);
        showErrorMessage('获取对话详情失败: ' + (error.message || '未知错误'));
    }
}

async function deleteConversation(conversationId) {
    if (!confirm('确定要删除这个对话吗？此操作不可恢复！')) {
        return;
    }
    
    try {
        console.log('Deleting conversation:', conversationId);
        const response = await apiClient.delete(`/admin/conversations/${conversationId}`);
        
        if (response.success) {
            showSuccessMessage('对话删除成功');
            // 刷新对话列表
            loadConversationsData();
            // 刷新仪表盘数据
            loadDashboardData();
        } else {
            showErrorMessage('删除对话失败: ' + (response.message || '未知错误'));
        }
    } catch (error) {
        console.error('Delete conversation error:', error);
        showErrorMessage('删除对话失败: ' + (error.message || '未知错误'));
    }
}

// 导出全局函数以供HTML onclick使用
window.showSection = showSection;
window.refreshSystemStatus = refreshSystemStatus;
window.refreshLogs = refreshLogs;
window.showCreateUserModal = showCreateUserModal;
// 格式化日期时间
function formatDateTime(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        // 格式化为本地时间字符串
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (error) {
        console.error('Date formatting error:', error);
        return '';
    }
}

// 隐藏消息
function hideMessage() {
    // 查找并隐藏当前显示的消息
    const alerts = document.querySelectorAll('.alert:not(.d-none)');
    alerts.forEach(alert => {
        alert.classList.add('d-none');
    });
    
    // 或者可以使用 Bootstrap 的 toast 来隐藏消息
    const toasts = document.querySelectorAll('.toast.show');
    toasts.forEach(toast => {
        const bsToast = bootstrap.Toast.getInstance(toast);
        if (bsToast) {
            bsToast.hide();
        }
    });
}

// 显示信息消息
function showInfoMessage(message) {
    console.log('Info:', message);
    
    // 创建或更新信息提示
    let infoAlert = document.getElementById('info-alert');
    if (!infoAlert) {
        // 创建新的信息警告框
        infoAlert = document.createElement('div');
        infoAlert.id = 'info-alert';
        infoAlert.className = 'alert alert-info alert-dismissible fade show position-fixed';
        infoAlert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        
        infoAlert.innerHTML = `
            <i class="fas fa-info-circle me-2"></i>
            <span class="alert-message">${message}</span>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.body.appendChild(infoAlert);
    } else {
        // 更新现有警告框
        const messageSpan = infoAlert.querySelector('.alert-message');
        if (messageSpan) {
            messageSpan.textContent = message;
        }
        infoAlert.classList.remove('d-none');
        infoAlert.classList.add('show');
    }
    
    // 3秒后自动隐藏
    setTimeout(() => {
        if (infoAlert) {
            infoAlert.classList.add('d-none');
        }
    }, 3000);
}

window.createUser = createUser;
window.showEditUserModal = showEditUserModal;
window.saveUserChanges = saveUserChanges;
window.deleteUser = deleteUser;
window.togglePasswordVisibility = togglePasswordVisibility;
window.editAgent = editAgent;
window.saveAgentChanges = saveAgentChanges;
window.deleteAgent = deleteAgent;
window.showCreateAgentModal = showCreateAgentModal;
window.createAgent = createAgent;
window.viewConversation = viewConversation;
window.deleteConversation = deleteConversation;
window.handleAvatarError = handleAvatarError;

console.log('Admin controller script loaded');
