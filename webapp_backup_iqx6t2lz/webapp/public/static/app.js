// UniWay - Main Application JS

const API = '';
let currentUser = null;
let currentRole = null;
let currentPage = 'home';
let internshipsPage = 1;
let currentInternshipId = null;
let currentTaskId = null;
let resumeSkills = [];
let resumeLanguages = [];
let registerRole = 'student';

// ==================== UTILITIES ====================

function showNotification(message, type = 'success') {
  const container = document.getElementById('notifications');
  const id = 'notif-' + Date.now();
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
  const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500', warning: 'bg-yellow-500' };
  const el = document.createElement('div');
  el.id = id;
  el.className = `notification ${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 max-w-sm text-sm font-medium`;
  el.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = 'all 0.3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + endpoint, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }

function getFieldIcon(field) {
  const icons = { frontend: '💻', backend: '⚙️', data: '📊', design: '🎨', marketing: '📢', product: '📦', hr: '👥', mobile: '📱' };
  return icons[field] || '🎯';
}
function getFieldLabel(field) {
  const labels = { frontend: 'Frontend', backend: 'Backend', data: 'Аналитика', design: 'Дизайн', marketing: 'Маркетинг', product: 'Product', hr: 'HR', mobile: 'Mobile' };
  return labels[field] || field;
}
function getLevelBadge(level) {
  const map = { beginner: ['level-badge-easy', 'Beginner'], intern: ['level-badge-medium', 'Intern'], junior: ['level-badge-hard', 'Junior'], easy: ['level-badge-easy', 'Лёгкое'], medium: ['level-badge-medium', 'Среднее'], hard: ['level-badge-hard', 'Сложное'] };
  const [cls, label] = map[level] || ['level-badge-easy', level];
  return `<span class="tag ${cls}">${label}</span>`;
}
function getFormatBadge(format) {
  const map = { offline: ['bg-gray-100 text-gray-600', '🏢 Офис'], online: ['bg-green-100 text-green-700', '🌐 Удалённо'], hybrid: ['bg-blue-100 text-blue-700', '🔄 Гибрид'] };
  const [cls, label] = map[format] || ['bg-gray-100 text-gray-600', format];
  return `<span class="tag ${cls}">${label}</span>`;
}
function getStatusBadge(status) {
  const map = { pending: ['bg-yellow-100 text-yellow-700', 'На рассмотрении'], reviewed: ['bg-blue-100 text-blue-700', 'Просмотрено'], interview: ['bg-purple-100 text-purple-700', 'Интервью'], accepted: ['bg-green-100 text-green-700', 'Принят'], rejected: ['bg-red-100 text-red-700', 'Отказ'] };
  const [cls, label] = map[status] || ['bg-gray-100 text-gray-600', status];
  return `<span class="tag ${cls}">${label}</span>`;
}
function formatDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }); }

// Kazakhstan tenge formatter
function formatKZT(amount) {
  if (!amount) return '';
  // Already formatted string like '250 000–350 000 ₸/мес'
  if (typeof amount === 'string') return amount;
  return new Intl.NumberFormat('ru-KZ', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(amount);
}

// ==================== NAVIGATION ====================

function navigate(page, params = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (!el) { console.warn('Page not found:', page); return; }
  el.classList.add('active');
  currentPage = page;
  window.scrollTo(0, 0);

  // Apply params
  if (params.field && page === 'internships') {
    setTimeout(() => {
      const el = document.getElementById('filter-field');
      if (el) { el.value = params.field; showFilters(); loadInternships(); }
    }, 100);
  }

  // Page-specific loading
  if (page === 'home') loadHomeInternships();
  if (page === 'internships') { internshipsPage = 1; loadInternships(); }
  if (page === 'tasks') loadTasks();
  if (page === 'interview') loadInterviewQuestions('hr');
  if (page === 'dashboard') {
    if (!currentUser) { navigate('login'); return; }
    if (currentRole === 'employer') { navigate('employer-dashboard'); return; }
    loadDashboard();
  }
  if (page === 'employer-dashboard') {
    if (!currentUser || currentRole !== 'employer') { navigate('login'); return; }
    loadEmployerDashboard();
  }
}

function requireAuth(cb) {
  if (!currentUser) { showNotification('Войди в аккаунт чтобы продолжить', 'info'); navigate('login'); return; }
  cb();
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  menu.classList.toggle('hidden');
}

function openSidebar() {
  document.querySelector('.sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('visible');
}
function closeSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}
function toggleFilters() { document.getElementById('filters-panel').classList.toggle('hidden'); }
function showFilters() { document.getElementById('filters-panel').classList.remove('hidden'); }
function togglePassword(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

// ==================== AUTH ====================

function updateNavAuth() {
  const authBtns = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu');
  if (currentUser) {
    authBtns.classList.add('hidden');
    userMenu.classList.remove('hidden');
    const name = currentUser.full_name || currentUser.company_name || currentUser.email || 'U';
    document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('user-name-nav').textContent = name.split(' ')[0];
  } else {
    authBtns.classList.remove('hidden');
    userMenu.classList.add('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Вхожу...';
  btn.disabled = true;
  errEl.classList.add('hidden');
  try {
    const data = await apiCall('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: document.getElementById('login-email').value, password: document.getElementById('login-password').value }) });
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    currentRole = data.role;
    updateNavAuth();
    showNotification('Добро пожаловать! 👋');
    if (data.role === 'employer') navigate('employer-dashboard');
    else if (data.role === 'admin') navigate('admin-dashboard');
    else navigate('dashboard');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.innerHTML = '<span>Войти</span>';
    btn.disabled = false;
  }
}

function setRegisterRole(role) {
  registerRole = role;
  const studentBtn = document.getElementById('role-student');
  const employerBtn = document.getElementById('role-employer');
  const studentForm = document.getElementById('register-student-form');
  const employerForm = document.getElementById('register-employer-form');
  if (role === 'student') {
    studentBtn.className = 'flex-1 py-3 rounded-xl border-2 border-primary-500 bg-primary-50 text-primary-700 font-semibold text-sm flex items-center justify-center gap-2';
    employerBtn.className = 'flex-1 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-600 font-semibold text-sm flex items-center justify-center gap-2';
    studentForm.classList.remove('hidden');
    employerForm.classList.add('hidden');
  } else {
    employerBtn.className = 'flex-1 py-3 rounded-xl border-2 border-primary-500 bg-primary-50 text-primary-700 font-semibold text-sm flex items-center justify-center gap-2';
    studentBtn.className = 'flex-1 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-600 font-semibold text-sm flex items-center justify-center gap-2';
    employerForm.classList.remove('hidden');
    studentForm.classList.add('hidden');
  }
}

async function handleRegister(e, role) {
  e.preventDefault();
  const errEl = document.getElementById(role === 'student' ? 'reg-error' : 'emp-reg-error');
  errEl.classList.add('hidden');
  try {
    let body;
    if (role === 'student') {
      body = {
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        full_name: document.getElementById('reg-name').value,
        university: document.getElementById('reg-university').value,
        major: document.getElementById('reg-major').value,
        year: parseInt(document.getElementById('reg-year').value),
        city: document.getElementById('reg-city').value,
        desired_field: document.getElementById('reg-field').value
      };
    } else {
      body = {
        email: document.getElementById('emp-email').value,
        password: document.getElementById('emp-password').value,
        company_name: document.getElementById('emp-company').value,
        description: document.getElementById('emp-description').value,
        industry: document.getElementById('emp-industry').value,
        contact_person: document.getElementById('emp-contact').value
      };
    }
    const data = await apiCall(`/api/auth/register/${role}`, { method: 'POST', body: JSON.stringify(body) });
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    currentRole = data.role;
    updateNavAuth();
    showNotification('Аккаунт создан! Добро пожаловать в UniWay 🎉');
    if (role === 'employer') navigate('employer-dashboard');
    else navigate('dashboard');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function handleLogout() {
  localStorage.removeItem('token');
  currentUser = null;
  currentRole = null;
  updateNavAuth();
  showNotification('Вы вышли из аккаунта');
  navigate('home');
}

async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const data = await apiCall('/api/auth/me');
    currentUser = data.user;
    currentRole = data.role;
    updateNavAuth();
  } catch {
    localStorage.removeItem('token');
  }
}

// ==================== INTERNSHIPS ====================

function buildInternshipCard(i, showSave = true) {
  const skillsArr = safeJson(i.skills, []);
  const skills = skillsArr.slice(0, 3).map(s => `<span class="tag bg-gray-100 text-gray-600">${s}</span>`).join('');
  const extraSkills = skillsArr.length > 3 ? `<span class="tag bg-gray-100 text-gray-500">+${skillsArr.length - 3}</span>` : '';
  return `
  <div class="bg-white rounded-2xl p-5 card-hover shadow-sm border border-gray-100 cursor-pointer" onclick="openInternship(${i.id})">
    <div class="flex items-start justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center text-2xl overflow-hidden">
          ${i.logo ? `<img src="${i.logo}" class="w-full h-full object-cover rounded-xl" onerror="this.parentNode.textContent='${getFieldIcon(i.field)}'">` : getFieldIcon(i.field)}
        </div>
        <div>
          <div class="font-bold text-gray-900 text-sm">${i.title}</div>
          <div class="text-xs text-gray-500">${i.company_name || 'Компания'}</div>
        </div>
      </div>
      ${showSave ? `<button onclick="event.stopPropagation();toggleSave(${i.id},this)" class="save-btn p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-primary-600" data-id="${i.id}"><i class="far fa-bookmark"></i></button>` : ''}
    </div>
    <div class="flex flex-wrap gap-1.5 mb-4">
      ${getLevelBadge(i.level)} ${getFormatBadge(i.format)}
      ${i.is_paid ? '<span class="tag bg-green-100 text-green-700">💰 Оплачиваемая</span>' : '<span class="tag bg-gray-100 text-gray-500">Неоплачиваемая</span>'}
    </div>
    <div class="text-xs text-gray-500 mb-3 flex items-center gap-1"><i class="fas fa-map-marker-alt text-primary-400"></i>${i.city || 'Удалённо'}</div>
    <div class="flex flex-wrap gap-1.5 mb-4">${skills}${extraSkills}</div>
    <div class="flex items-center justify-between pt-3 border-t border-gray-50">
      <div class="text-xs text-gray-400 flex items-center gap-1">
        ${i.deadline ? `<i class="fas fa-clock"></i> До ${formatDate(i.deadline)}` : `<i class="fas fa-calendar"></i> ${formatDate(i.created_at)}`}
      </div>
      <div class="text-xs font-medium text-primary-600">${getFieldLabel(i.field)}</div>
    </div>
  </div>`;
}

async function loadHomeInternships() {
  const grid = document.getElementById('home-internships');
  if (!grid) return;
  try {
    const data = await apiCall('/api/internships?limit=6');
    const items = data.internships || [];
    grid.innerHTML = items.length ? items.map(i => buildInternshipCard(i)).join('') : '<div class="col-span-3 text-center text-gray-500 py-8">Стажировки скоро появятся</div>';
  } catch { grid.innerHTML = '<div class="col-span-3 text-center text-gray-500 py-8">Не удалось загрузить стажировки</div>'; }
}

async function loadInternships() {
  const grid = document.getElementById('internships-grid');
  if (!grid) return;
  const search = document.getElementById('search-input')?.value || '';
  const field = document.getElementById('filter-field')?.value || '';
  const level = document.getElementById('filter-level')?.value || '';
  const format = document.getElementById('filter-format')?.value || '';
  const is_paid = document.getElementById('filter-paid')?.value || '';

  let params = `page=${internshipsPage}&limit=12`;
  if (search) params += `&search=${encodeURIComponent(search)}`;
  if (field) params += `&field=${field}`;
  if (level) params += `&level=${level}`;
  if (format) params += `&format=${format}`;
  if (is_paid) params += `&is_paid=${is_paid}`;

  if (internshipsPage === 1) grid.innerHTML = '<div class="col-span-3"><div class="skeleton h-64 rounded-2xl mb-4"></div><div class="skeleton h-64 rounded-2xl"></div></div>';

  try {
    const data = await apiCall(`/api/internships?${params}`);
    const items = data.internships || [];
    const total = data.total || 0;
    document.getElementById('internships-count').textContent = total;

    if (internshipsPage === 1) {
      grid.innerHTML = items.length ? items.map(i => buildInternshipCard(i)).join('') : '<div class="col-span-3 text-center py-16"><div class="text-4xl mb-4">😔</div><div class="text-gray-500 font-medium">Ничего не найдено</div><div class="text-gray-400 text-sm mt-2">Попробуй изменить фильтры</div></div>';
    } else {
      items.forEach(i => grid.insertAdjacentHTML('beforeend', buildInternshipCard(i)));
    }

    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) loadMoreBtn.classList.toggle('hidden', items.length < 12);
  } catch (err) { grid.innerHTML = `<div class="col-span-3 text-center text-gray-500 py-8">${err.message}</div>`; }
}

function loadMoreInternships() { internshipsPage++; loadInternships(); }

function resetFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-field').value = '';
  document.getElementById('filter-level').value = '';
  document.getElementById('filter-format').value = '';
  document.getElementById('filter-paid').value = '';
  internshipsPage = 1;
  loadInternships();
}

async function openInternship(id) {
  currentInternshipId = id;
  const modal = document.getElementById('internship-modal');
  const content = document.getElementById('internship-modal-content');
  content.innerHTML = '<div class="p-8 text-center"><i class="fas fa-spinner fa-spin text-primary-500 text-3xl"></i></div>';
  openModal('internship-modal');
  try {
    const i = await apiCall(`/api/internships/${id}`);
    const skillsArr = safeJson(i.skills, []);
    content.innerHTML = `
      <div class="sticky top-0 bg-white p-4 border-b border-gray-100 flex items-center justify-between z-10">
        <div class="font-bold text-gray-900">${i.title}</div>
        <button onclick="closeModal('internship-modal')" class="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><i class="fas fa-times"></i></button>
      </div>
      <div class="p-6">
        <div class="flex items-start gap-4 mb-6">
          <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-3xl overflow-hidden flex-shrink-0">
            ${i.logo ? `<img src="${i.logo}" class="w-full h-full object-cover" onerror="this.parentNode.textContent='${getFieldIcon(i.field)}'">` : getFieldIcon(i.field)}
          </div>
          <div>
            <h2 class="text-xl font-black text-gray-900">${i.title}</h2>
            <div class="text-gray-500 font-medium">${i.company_name}</div>
            <div class="flex flex-wrap gap-1.5 mt-2">${getLevelBadge(i.level)} ${getFormatBadge(i.format)} ${i.is_paid ? '<span class="tag bg-green-100 text-green-700">💰 Оплачиваемая</span>' : ''}</div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div class="flex items-center gap-2 text-gray-600"><i class="fas fa-map-marker-alt text-primary-400 w-4"></i>${i.city || 'Удалённо'}</div>
          ${i.salary ? `<div class="flex items-center gap-2 text-gray-600"><i class="fas fa-coins text-green-500 w-4"></i>${i.salary}</div>` : ''}
          ${i.deadline ? `<div class="flex items-center gap-2 text-gray-600"><i class="fas fa-clock text-orange-400 w-4"></i>До ${formatDate(i.deadline)}</div>` : ''}
          <div class="flex items-center gap-2 text-gray-600"><i class="fas fa-tag text-violet-400 w-4"></i>${getFieldLabel(i.field)}</div>
        </div>
        ${i.description ? `<div class="mb-5"><h4 class="font-bold text-gray-900 mb-2">О стажировке</h4><p class="text-gray-600 text-sm leading-relaxed">${i.description}</p></div>` : ''}
        ${i.requirements ? `<div class="mb-5"><h4 class="font-bold text-gray-900 mb-2">Требования</h4><p class="text-gray-600 text-sm leading-relaxed">${i.requirements}</p></div>` : ''}
        ${i.responsibilities ? `<div class="mb-5"><h4 class="font-bold text-gray-900 mb-2">Обязанности</h4><p class="text-gray-600 text-sm leading-relaxed">${i.responsibilities}</p></div>` : ''}
        ${skillsArr.length ? `<div class="mb-6"><h4 class="font-bold text-gray-900 mb-2">Нужные навыки</h4><div class="flex flex-wrap gap-2">${skillsArr.map(s => `<span class="tag bg-blue-50 text-blue-700">${s}</span>`).join('')}</div></div>` : ''}
        ${i.company_description ? `<div class="mb-6 bg-gray-50 rounded-xl p-4"><h4 class="font-bold text-gray-900 mb-2">О компании</h4><p class="text-gray-600 text-sm">${i.company_description}</p>${i.website ? `<a href="${i.website}" target="_blank" class="text-primary-600 text-sm hover:underline mt-2 inline-block"><i class="fas fa-external-link-alt mr-1"></i>Сайт компании</a>` : ''}</div>` : ''}
        <div class="flex gap-3 sticky bottom-0 bg-white pt-4 border-t border-gray-100">
          <button onclick="applyToInternship(${i.id})" class="flex-1 bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors">
            <i class="fas fa-paper-plane mr-2"></i>Откликнуться
          </button>
          <button onclick="toggleSave(${i.id},this)" class="save-btn px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors" data-id="${i.id}">
            <i class="far fa-bookmark"></i>
          </button>
        </div>
      </div>`;
  } catch (err) { content.innerHTML = `<div class="p-8 text-center text-red-500">${err.message}</div>`; }
}

function applyToInternship(id) {
  if (!currentUser) { showNotification('Войди в аккаунт чтобы откликнуться', 'info'); navigate('login'); return; }
  if (currentRole !== 'student') { showNotification('Только студенты могут откликаться на стажировки', 'warning'); return; }
  currentInternshipId = id;
  closeModal('internship-modal');
  openModal('apply-modal');
}

async function submitApplication() {
  const coverLetter = document.getElementById('cover-letter').value;
  try {
    await apiCall('/api/applications', { method: 'POST', body: JSON.stringify({ internship_id: currentInternshipId, cover_letter: coverLetter }) });
    closeModal('apply-modal');
    document.getElementById('cover-letter').value = '';
    showNotification('Отклик успешно отправлен! 🎉');
  } catch (err) { showNotification(err.message, 'error'); }
}

async function toggleSave(id, btn) {
  if (!currentUser || currentRole !== 'student') { showNotification('Войди как студент чтобы сохранять стажировки', 'info'); return; }
  try {
    const data = await apiCall(`/api/internships/${id}/save`, { method: 'POST' });
    const icon = btn.querySelector('i');
    if (data.saved) { icon.className = 'fas fa-bookmark'; btn.classList.add('text-primary-600'); showNotification('Добавлено в сохранённые'); }
    else { icon.className = 'far fa-bookmark'; btn.classList.remove('text-primary-600'); showNotification('Удалено из сохранённых'); }
  } catch (err) { showNotification(err.message, 'error'); }
}

// ==================== TASKS ====================

let allTasks = [];

async function loadTasks(category = '') {
  const grid = document.getElementById('tasks-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="col-span-3"><div class="skeleton h-56 rounded-2xl mb-4"></div><div class="skeleton h-56 rounded-2xl"></div></div>';
  try {
    let url = '/api/tasks';
    if (category) url += `?category=${category}`;
    allTasks = await apiCall(url);
    renderTasks(allTasks);
  } catch (err) { grid.innerHTML = `<div class="text-center text-gray-500 py-8">${err.message}</div>`; }
}

function renderTasks(tasks) {
  const grid = document.getElementById('tasks-grid');
  if (!tasks.length) { grid.innerHTML = '<div class="col-span-3 text-center py-8 text-gray-500">Задания не найдены</div>'; return; }
  grid.innerHTML = tasks.map(t => `
    <div class="bg-white rounded-2xl p-5 card-hover shadow-sm border border-gray-100 cursor-pointer" onclick="openTask(${t.id})">
      <div class="flex items-start justify-between mb-3">
        <div class="field-icon bg-${getCatColor(t.category)}-100">${getCatEmoji(t.category)}</div>
        ${getLevelBadge(t.level)}
      </div>
      <h3 class="font-bold text-gray-900 mb-2">${t.title}</h3>
      <p class="text-gray-500 text-sm mb-4 line-clamp-2">${t.description || ''}</p>
      <div class="flex items-center justify-between pt-3 border-t border-gray-50 text-xs text-gray-500">
        <span class="flex items-center gap-1"><i class="fas fa-clock text-orange-400"></i>${t.deadline_days} дней</span>
        <span class="capitalize font-medium text-${getCatColor(t.category)}-600">${getCatLabel(t.category)}</span>
      </div>
    </div>`).join('');
}

function getCatColor(cat) { return { frontend: 'blue', backend: 'green', design: 'pink', marketing: 'orange', product: 'indigo', data: 'purple', hr: 'teal' }[cat] || 'gray'; }
function getCatEmoji(cat) { return { frontend: '💻', backend: '⚙️', design: '🎨', marketing: '📢', product: '📦', data: '📊', hr: '👥' }[cat] || '📝'; }
function getCatLabel(cat) { return { frontend: 'Frontend', backend: 'Backend', design: 'Дизайн', marketing: 'Маркетинг', product: 'Product', data: 'Data', hr: 'HR' }[cat] || cat; }

function filterTasksByCategory(cat) {
  document.querySelectorAll('.task-cat-btn').forEach(btn => {
    btn.className = btn.dataset.cat === cat
      ? 'task-cat-btn active px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white'
      : 'task-cat-btn px-4 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50';
  });
  loadTasks(cat);
}

async function openTask(id) {
  currentTaskId = id;
  const modal = document.getElementById('task-modal');
  const content = document.getElementById('task-modal-content');
  content.innerHTML = '<div class="p-8 text-center"><i class="fas fa-spinner fa-spin text-primary-500 text-3xl"></i></div>';
  openModal('task-modal');
  try {
    const t = await apiCall(`/api/tasks/${id}`);
    content.innerHTML = `
      <div class="sticky top-0 bg-white p-4 border-b border-gray-100 flex items-center justify-between">
        <div class="font-bold text-gray-900">${t.title}</div>
        <button onclick="closeModal('task-modal')" class="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><i class="fas fa-times"></i></button>
      </div>
      <div class="p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="field-icon bg-${getCatColor(t.category)}-100 text-2xl">${getCatEmoji(t.category)}</div>
          <div>
            <div class="text-sm text-gray-500 capitalize">${getCatLabel(t.category)}</div>
            <div class="flex gap-1">${getLevelBadge(t.level)}</div>
          </div>
        </div>
        <div class="flex items-center gap-4 text-sm text-gray-500 mb-6">
          <span class="flex items-center gap-1"><i class="fas fa-clock text-orange-400"></i>Срок: ${t.deadline_days} дней</span>
        </div>
        <div class="mb-5">
          <h4 class="font-bold text-gray-900 mb-2">Описание задания</h4>
          <p class="text-gray-600 text-sm leading-relaxed">${t.description || ''}</p>
        </div>
        ${t.expected_result ? `<div class="bg-blue-50 rounded-xl p-4 mb-6"><h4 class="font-semibold text-blue-900 mb-1 flex items-center gap-2"><i class="fas fa-check-circle"></i>Ожидаемый результат</h4><p class="text-blue-700 text-sm">${t.expected_result}</p></div>` : ''}
        <div class="bg-yellow-50 rounded-xl p-4 mb-6">
          <h4 class="font-semibold text-yellow-900 mb-1 flex items-center gap-2"><i class="fas fa-star"></i>Что ты получишь</h4>
          <ul class="text-yellow-700 text-sm space-y-1">
            <li>• Задание добавится в твоё портфолио</li>
            <li>• Получишь оценку и фидбэк</li>
            <li>• Увеличится рейтинг готовности</li>
          </ul>
        </div>
        <div class="flex gap-3">
          <button onclick="openSubmitTask(${t.id},'${t.title.replace(/'/g,"\\'")}');closeModal('task-modal')" class="flex-1 bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors">
            <i class="fas fa-upload mr-2"></i>Отправить решение
          </button>
          <button onclick="closeModal('task-modal')" class="border border-gray-200 text-gray-700 px-4 py-3 rounded-xl font-medium hover:bg-gray-50">Закрыть</button>
        </div>
      </div>`;
  } catch (err) { content.innerHTML = `<div class="p-8 text-center text-red-500">${err.message}</div>`; }
}

function openSubmitTask(id, title) {
  if (!currentUser) { showNotification('Войди в аккаунт', 'info'); navigate('login'); return; }
  if (currentRole !== 'student') { showNotification('Только студенты могут выполнять задания', 'warning'); return; }
  currentTaskId = id;
  document.getElementById('submit-task-name').textContent = title;
  document.getElementById('solution-url').value = '';
  document.getElementById('solution-comment').value = '';
  openModal('submit-task-modal');
}

async function submitTaskSolution() {
  const url = document.getElementById('solution-url').value;
  const comment = document.getElementById('solution-comment').value;
  if (!url && !comment) { showNotification('Добавь ссылку или комментарий', 'warning'); return; }
  try {
    const data = await apiCall(`/api/tasks/${currentTaskId}/submit`, { method: 'POST', body: JSON.stringify({ file_url: url, comment }) });
    closeModal('submit-task-modal');
    showNotification(`Решение принято! Оценка: ${data.score}/100 🎉`);
    if (data.feedback) setTimeout(() => showNotification(`💡 ${data.feedback}`, 'info'), 1000);
  } catch (err) { showNotification(err.message, 'error'); }
}

// ==================== RESUME ====================

function safeJson(str, def = []) {
  try { return typeof str === 'string' ? JSON.parse(str) : (str || def); } catch { return def; }
}

function addResumeSkill() {
  const input = document.getElementById('new-skill-input');
  const val = input.value.trim();
  if (!val || resumeSkills.includes(val)) return;
  resumeSkills.push(val);
  input.value = '';
  renderResumeSkills();
  updateResumePreview();
}
function addSkillQuick(s) {
  if (!resumeSkills.includes(s)) { resumeSkills.push(s); renderResumeSkills(); updateResumePreview(); }
}
function renderResumeSkills() {
  const container = document.getElementById('resume-skills-container');
  if (!container) return;
  container.innerHTML = resumeSkills.map((s, i) => `<span class="tag bg-blue-50 text-blue-700">${s}<button class="ml-1 text-blue-400 hover:text-blue-600" onclick="removeResumeSkill(${i})">×</button></span>`).join('');
}
function removeResumeSkill(i) { resumeSkills.splice(i, 1); renderResumeSkills(); updateResumePreview(); }

function addResumeLanguage() {
  const input = document.getElementById('new-lang-input');
  const val = input.value.trim();
  if (!val) return;
  resumeLanguages.push(val);
  input.value = '';
  renderResumeLanguages();
}
function renderResumeLanguages() {
  const container = document.getElementById('resume-languages-container');
  if (!container) return;
  container.innerHTML = resumeLanguages.map((l, i) => `<span class="tag bg-green-50 text-green-700">${l}<button class="ml-1 text-green-400 hover:text-green-600" onclick="removeResumeLang(${i})">×</button></span>`).join('');
}
function removeResumeLang(i) { resumeLanguages.splice(i, 1); renderResumeLanguages(); }

function addEducation() {
  const container = document.getElementById('education-items');
  const div = document.createElement('div');
  div.className = 'education-item border border-gray-100 rounded-xl p-4 mt-4';
  div.innerHTML = `<div class="grid grid-cols-2 gap-3"><input type="text" placeholder="Университет" class="edu-institution col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"><input type="text" placeholder="Специальность" class="edu-field border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"><input type="text" placeholder="Степень" class="edu-degree border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"><input type="text" placeholder="Год начала" class="edu-year_start border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"><input type="text" placeholder="Год окончания" class="edu-year_end border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"></div><button onclick="this.parentNode.remove()" class="mt-2 text-xs text-red-500">Удалить</button>`;
  container.appendChild(div);
}
function addProject() {
  const container = document.getElementById('projects-items');
  const div = document.createElement('div');
  div.className = 'project-item border border-gray-100 rounded-xl p-4 mt-4';
  div.innerHTML = `<input type="text" placeholder="Название проекта" class="proj-name w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 mb-2"><textarea rows="2" placeholder="Описание" class="proj-description w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none mb-2"></textarea><input type="text" placeholder="Технологии" class="proj-tech w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"><button onclick="this.parentNode.remove()" class="mt-2 text-xs text-red-500">Удалить</button>`;
  container.appendChild(div);
}
function addCertificate() {
  const container = document.getElementById('certificates-items');
  const div = document.createElement('div');
  div.className = 'cert-item flex gap-2 mt-3';
  div.innerHTML = `<input type="text" placeholder="Название" class="cert-name flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"><input type="text" placeholder="Год" class="cert-year w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm"><button onclick="this.parentNode.remove()" class="text-red-400 px-2">×</button>`;
  container.appendChild(div);
}

function collectResumeData() {
  const education = Array.from(document.querySelectorAll('.education-item')).map(el => ({
    institution: el.querySelector('.edu-institution')?.value || '',
    field: el.querySelector('.edu-field')?.value || '',
    degree: el.querySelector('.edu-degree')?.value || '',
    year_start: el.querySelector('.edu-year_start')?.value || '',
    year_end: el.querySelector('.edu-year_end')?.value || ''
  })).filter(e => e.institution);

  const projects = Array.from(document.querySelectorAll('.project-item')).map(el => ({
    name: el.querySelector('.proj-name')?.value || '',
    description: el.querySelector('.proj-description')?.value || '',
    tech: el.querySelector('.proj-tech')?.value || ''
  })).filter(p => p.name);

  const certificates = Array.from(document.querySelectorAll('.cert-item')).map(el => ({
    name: el.querySelector('.cert-name')?.value || '',
    year: el.querySelector('.cert-year')?.value || ''
  })).filter(c => c.name);

  return {
    summary: document.getElementById('res-summary')?.value || '',
    education, projects,
    skills: resumeSkills,
    languages: resumeLanguages,
    certificates,
    achievements: document.getElementById('res-achievements')?.value || ''
  };
}

function updateResumePreview() {
  const data = collectResumeData();
  const name = currentUser?.full_name || 'Твоё имя';
  document.getElementById('prev-name').textContent = name;
  document.getElementById('prev-contact').textContent = currentUser?.email || '';
  document.getElementById('prev-summary').textContent = data.summary || 'Краткое описание о тебе';
  document.getElementById('prev-education').innerHTML = data.education.length ? data.education.map(e => `<div class="mb-1"><span class="font-medium">${e.institution}</span>${e.field ? `, ${e.field}` : ''} ${e.year_start ? `(${e.year_start}–${e.year_end || 'н.в.'})` : ''}</div>`).join('') : 'Заполни образование';
  document.getElementById('prev-projects').innerHTML = data.projects.length ? data.projects.map(p => `<div class="mb-1"><span class="font-medium">${p.name}</span>${p.tech ? ` — ${p.tech}` : ''}</div>`).join('') : 'Добавь проекты';
  document.getElementById('prev-skills').innerHTML = data.skills.length ? data.skills.map(s => `<span class="tag bg-blue-50 text-blue-700 text-xs">${s}</span>`).join('') : '';
  document.getElementById('prev-achievements').textContent = data.achievements || 'Добавь достижения';
}

async function saveResume() {
  if (!currentUser) { showNotification('Войди в аккаунт чтобы сохранить резюме', 'info'); navigate('login'); return; }
  const data = collectResumeData();
  try {
    await apiCall('/api/resume', { method: 'POST', body: JSON.stringify(data) });
    showNotification('Резюме сохранено! ✅');
  } catch (err) { showNotification(err.message, 'error'); }
}

function printResume() {
  const data = collectResumeData();
  const name = currentUser?.full_name || 'Студент UniWay';
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`<!DOCTYPE html><html><head><title>Резюме - ${name}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1a1a1a}h1{color:#1d4ed8;font-size:24px;margin-bottom:4px}.subtitle{color:#6b7280;margin-bottom:20px}h2{color:#1d4ed8;font-size:14px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #dbeafe;padding-bottom:4px;margin-top:24px;margin-bottom:12px}.item{margin-bottom:12px}.item-title{font-weight:bold}.item-sub{color:#6b7280;font-size:14px}.skills{display:flex;flex-wrap:wrap;gap:6px}.skill{background:#dbeafe;color:#1e40af;padding:2px 10px;border-radius:20px;font-size:13px}@media print{body{padding:20px}}</style></head><body>
    <h1>${name}</h1><div class="subtitle">${currentUser?.email || ''}</div>
    ${data.summary ? `<p>${data.summary}</p>` : ''}
    ${data.education.length ? `<h2>Образование</h2>${data.education.map(e => `<div class="item"><div class="item-title">${e.institution}</div><div class="item-sub">${e.field}${e.degree ? ', ' + e.degree : ''} — ${e.year_start}–${e.year_end || 'н.в.'}</div></div>`).join('')}` : ''}
    ${data.projects.length ? `<h2>Проекты</h2>${data.projects.map(p => `<div class="item"><div class="item-title">${p.name}</div>${p.description ? `<div class="item-sub">${p.description}</div>` : ''}${p.tech ? `<div class="item-sub" style="color:#7c3aed">Стек: ${p.tech}</div>` : ''}</div>`).join('')}` : ''}
    ${data.skills.length ? `<h2>Навыки</h2><div class="skills">${data.skills.map(s => `<span class="skill">${s}</span>`).join('')}</div>` : ''}
    ${data.languages.length ? `<h2>Языки</h2><div class="skills">${data.languages.map(l => `<span class="skill">${l}</span>`).join('')}</div>` : ''}
    ${data.certificates.length ? `<h2>Курсы и сертификаты</h2>${data.certificates.map(c => `<div class="item"><span class="item-title">${c.name}</span>${c.year ? ` — ${c.year}` : ''}</div>`).join('')}` : ''}
    ${data.achievements ? `<h2>Достижения</h2><p>${data.achievements}</p>` : ''}
    <p style="color:#9ca3af;font-size:12px;margin-top:40px;text-align:center">Создано на UniWay.kz — Платформа для студентов Казахстана</p></body></html>`);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}

async function loadResume() {
  if (!currentUser || currentRole !== 'student') return;
  try {
    const data = await apiCall('/api/resume');
    if (data.summary) document.getElementById('res-summary').value = data.summary;
    if (data.achievements) document.getElementById('res-achievements').value = data.achievements;
    resumeSkills = safeJson(data.skills, []);
    resumeLanguages = safeJson(data.languages, []);
    renderResumeSkills();
    renderResumeLanguages();
    updateResumePreview();
  } catch {}
}

// ==================== INTERVIEW ====================

const interviewData = {
  hr: [
    { q: 'Расскажи о себе', tip: 'Используй формулу: кто ты → что изучаешь → почему эта роль → что ты можешь предложить. 1-2 минуты, уверенно.', hint: 'Подготовь "питч" заранее и практикуй вслух' },
    { q: 'Почему ты хочешь работать в нашей компании?', tip: 'Покажи, что изучил компанию: продукты, культура, миссия. Свяжи с твоими интересами и карьерными целями.', hint: 'Изучи сайт, новости, соцсети компании перед интервью' },
    { q: 'Почему мы должны взять именно тебя?', tip: 'Назови 2-3 конкретных качества/навыка. Подкрепи примерами из учёбы или проектов. Покажи мотивацию учиться.', hint: 'Без опыта? Говори об энтузиазме, навыках и готовности расти' },
    { q: 'Каковы твои слабые стороны?', tip: 'Называй реальную слабость, которая не критична для роли. Обязательно добавь как ты над ней работаешь.', hint: 'Плохой ответ: "я слишком перфекционист". Хороший: называй что-то реальное' },
    { q: 'Где ты видишь себя через 3-5 лет?', tip: 'Покажи амбиции, но реалистичные. Упомяни рост внутри компании/индустрии. Свяжи с этой ролью как первым шагом.', hint: 'Честность и конкретика работают лучше расплывчатых ответов' },
    { q: 'Расскажи о своём самом большом достижении', tip: 'Используй метод STAR: Ситуация → Задача → Действие → Результат. Из учёбы: проекты, победы, решённые проблемы.', hint: 'Конкретные цифры и результаты делают ответ сильным' },
  ],
  product: [
    { q: 'Как ты определяешь, что делать дальше в продукте?', tip: 'Говори о данных, пользовательских исследованиях, бизнес-целях и приоритизации (RICE, MoSCoW). Упомяни баланс user needs vs business goals.', hint: 'Без опыта? Расскажи как бы ты подошёл к задаче теоретически' },
    { q: 'Опиши свой любимый продукт. Что бы ты улучшил?', tip: 'Выбери продукт который реально используешь. Структура: что хорошего → что болит → твоя идея улучшения с обоснованием.', hint: 'Покажи product sense — понимание пользователей и бизнеса' },
    { q: 'Что такое хорошая метрика успеха?', tip: 'Хорошая метрика: измеримая, actionable, напрямую влияет на цель бизнеса, не имеет нежелательных побочных эффектов.', hint: 'Приведи пример плохой и хорошей метрики для конкретного продукта' },
  ],
  frontend: [
    { q: 'Объясни разницу между CSS Flexbox и Grid', tip: 'Flexbox — для одномерных макетов (строки/столбцы). Grid — для двумерных (таблицы, сложные макеты). На практике часто комбинируются.', hint: 'Покажи что умеешь применять оба на практике' },
    { q: 'Что такое event loop в JavaScript?', tip: 'Event loop обрабатывает очередь задач. Call stack → Web APIs → Callback queue → Event loop проверяет стек. Объясни на примере setTimeout(fn, 0).', hint: 'Практика: нарисуй схему на бумаге и объясни вслух' },
    { q: 'Как оптимизировать производительность веб-приложения?', tip: 'Lazy loading, code splitting, кэширование, минификация, оптимизация изображений, избегание лишних re-renders в React.', hint: 'Упомяни инструменты: Lighthouse, Chrome DevTools Performance' },
  ],
  backend: [
    { q: 'Что такое REST API и его принципы?', tip: 'Stateless, Client-Server, Cacheable, Uniform Interface (CRUD → GET/POST/PUT/DELETE), Layered System. Разница от GraphQL/gRPC.', hint: 'Расскажи про HTTP статусы: 200, 201, 400, 401, 404, 500' },
    { q: 'Объясни разницу SQL vs NoSQL базы данных', tip: 'SQL: реляционные, схема, ACID, JOIN. NoSQL: документы/ключ-значение/граф, гибкая схема, горизонтальное масштабирование, BASE.', hint: 'Когда использовать что? Приведи примеры' },
    { q: 'Что такое индексы в базах данных?', tip: 'Индекс ускоряет поиск но замедляет запись. Работает как оглавление книги. Составные индексы, покрывающие индексы.', hint: 'EXPLAIN ANALYZE в PostgreSQL — инструмент для анализа запросов' },
  ],
  design: [
    { q: 'Как ты подходишь к UX исследованиям?', tip: 'User interviews, usability testing, surveys, analytics. Jobs-to-be-done framework. Как синтезировать инсайты.', hint: 'Расскажи конкретный пример даже из учёбы' },
    { q: 'Объясни разницу между UX и UI', tip: 'UX — опыт взаимодействия, решение задач пользователя. UI — визуальное оформление. UX — WHY и HOW, UI — HOW it looks.', hint: 'Аналогия: UX — архитектор здания, UI — interior designer' },
    { q: 'Как обеспечить доступность (accessibility) дизайна?', tip: 'WCAG guidelines: контраст 4.5:1, alt тексты, keyboard navigation, aria-labels, размер интерактивных элементов минимум 44px.', hint: 'Figma: плагин Contrast и Accessibility Checker' },
  ],
  data: [
    { q: 'Объясни разницу между средним, медианой и модой', tip: 'Среднее: сумма/количество (чувствительно к выбросам). Медиана: центральное значение (устойчива). Мода: наиболее частое. Когда что использовать.', hint: 'Пример: зарплаты лучше описывать медианой из-за выбросов' },
    { q: 'Как ты проверяешь качество данных?', tip: 'Пропуски, дубликаты, выбросы, несогласованные форматы, распределение. df.info(), df.describe(), df.isnull().sum() в pandas.', hint: 'EDA (Exploratory Data Analysis) — обязательный первый шаг' },
    { q: 'Что такое A/B тест и когда его применять?', tip: 'Контролируемый эксперимент: группа А (контроль) vs группа Б (тест). Статистическая значимость, p-value < 0.05, sample size.', hint: 'Common pitfall: слишком маленькая выборка или слишком короткий тест' },
  ]
};

function filterInterview(cat) {
  document.querySelectorAll('.int-cat-btn').forEach(btn => {
    btn.className = btn.textContent.toLowerCase().includes(getCatLabel(cat).toLowerCase()) || (btn.textContent === 'HR вопросы' && cat === 'hr')
      ? 'int-cat-btn active px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white'
      : 'int-cat-btn px-4 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600';
  });
  loadInterviewQuestions(cat);
}

function loadInterviewQuestions(cat = 'hr') {
  const container = document.getElementById('interview-questions');
  if (!container) return;
  const questions = interviewData[cat] || interviewData.hr;
  container.innerHTML = questions.map((item, i) => `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onclick="toggleQuestion(${i})" class="w-full p-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 font-bold text-sm flex-shrink-0">${i+1}</div>
          <div class="font-semibold text-gray-900">${item.q}</div>
        </div>
        <i class="fas fa-chevron-down text-gray-400 transition-transform flex-shrink-0 ml-4" id="q-icon-${i}"></i>
      </button>
      <div id="q-answer-${i}" class="hidden px-5 pb-5 border-t border-gray-50">
        <div class="mt-4 bg-blue-50 rounded-xl p-4 mb-3">
          <div class="font-semibold text-blue-900 text-sm mb-1 flex items-center gap-2"><i class="fas fa-lightbulb text-yellow-500"></i>Как ответить</div>
          <p class="text-blue-700 text-sm">${item.tip}</p>
        </div>
        <div class="bg-gray-50 rounded-xl p-3">
          <div class="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><i class="fas fa-bookmark text-gray-400"></i>Подсказка</div>
          <p class="text-gray-600 text-sm">${item.hint}</p>
        </div>
        <div class="mt-4">
          <button onclick="practiceQuestion(this, '${item.q.replace(/'/g, "\\'")}');" class="text-sm bg-primary-50 text-primary-700 px-4 py-2 rounded-xl font-medium hover:bg-primary-100 transition-colors">
            <i class="fas fa-play mr-1"></i>Потренироваться
          </button>
        </div>
        <div class="practice-area hidden mt-4 bg-gray-50 rounded-xl p-4">
          <div class="text-sm font-medium text-gray-700 mb-2">Напиши свой ответ (как будто отвечаешь вслух):</div>
          <textarea rows="4" class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none bg-white" placeholder="Пиши здесь свой ответ..."></textarea>
          <div class="text-xs text-gray-400 mt-2">Тренировка помогает запомнить структуру ответа</div>
        </div>
      </div>
    </div>`).join('');
}

function toggleQuestion(i) {
  const answer = document.getElementById(`q-answer-${i}`);
  const icon = document.getElementById(`q-icon-${i}`);
  answer.classList.toggle('hidden');
  icon.style.transform = answer.classList.contains('hidden') ? '' : 'rotate(180deg)';
}

function practiceQuestion(btn, question) {
  const area = btn.closest('.practice-area') || btn.parentElement.nextElementSibling;
  const practiceArea = btn.parentElement.parentElement.querySelector('.practice-area');
  practiceArea.classList.toggle('hidden');
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
  if (!currentUser) return;
  try {
    const data = await apiCall('/api/students/dashboard');
    const { student, applications, savedInternships, submissions, resume, recommended } = data;

    // Update sidebar info
    const name = student.full_name || currentUser.email;
    document.getElementById('dash-name').textContent = name;
    document.getElementById('dash-avatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('dash-greeting-name').textContent = name.split(' ')[0];
    const score = student.readiness_score || 0;
    document.getElementById('dash-score').textContent = score + '%';
    document.getElementById('dash-score-bar').style.width = score + '%';
    document.getElementById('stat-score').textContent = score;
    document.getElementById('stat-applications').textContent = applications.length;
    document.getElementById('stat-tasks').textContent = submissions.length;
    document.getElementById('stat-saved').textContent = savedInternships.length;

    // Profile fields
    document.getElementById('prof-name').value = student.full_name || '';
    document.getElementById('prof-city').value = student.city || '';
    document.getElementById('prof-university').value = student.university || '';
    document.getElementById('prof-major').value = student.major || '';
    document.getElementById('prof-year').value = student.year || 1;
    document.getElementById('prof-field').value = student.desired_field || '';
    document.getElementById('prof-about').value = student.about || '';
    document.getElementById('prof-skills').value = safeJson(student.skills, []).join(', ');
    document.getElementById('prof-languages').value = safeJson(student.languages, []).join(', ');
    document.getElementById('profile-name-display').textContent = student.full_name || 'Студент';
    document.getElementById('profile-avatar-big').textContent = (student.full_name || 'С').charAt(0).toUpperCase();
    document.getElementById('profile-detail-display').textContent = `${student.university || ''}${student.major ? ', ' + student.major : ''}${student.year ? ', ' + student.year + ' курс' : ''}`;

    // Recent applications
    const appsEl = document.getElementById('recent-applications');
    if (applications.length) {
      appsEl.innerHTML = applications.slice(0, 3).map(a => `
        <div class="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
          <div class="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-lg overflow-hidden">
            ${a.logo ? `<img src="${a.logo}" class="w-full h-full object-cover rounded-xl" onerror="this.parentNode.textContent='${getFieldIcon(a.field)}'">` : getFieldIcon(a.field)}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm text-gray-900 truncate">${a.title}</div>
            <div class="text-xs text-gray-500">${a.company_name}</div>
          </div>
          ${getStatusBadge(a.status)}
        </div>`).join('');
    }

    // Recommended
    const recEl = document.getElementById('recommended-internships');
    if (recommended.length) {
      recEl.innerHTML = recommended.map(i => `
        <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors" onclick="navigate('internships');setTimeout(()=>openInternship(${i.id}),200)">
          <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">${getFieldIcon(i.field)}</div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm text-gray-900 truncate">${i.title}</div>
            <div class="text-xs text-gray-500">${i.company_name}</div>
          </div>
        </div>`).join('');
    }

    // Applications tab
    const appsListEl = document.getElementById('applications-list');
    if (applications.length) {
      appsListEl.innerHTML = applications.map(a => `
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
          <div class="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
            ${a.logo ? `<img src="${a.logo}" class="w-full h-full object-cover rounded-xl" onerror="this.parentNode.textContent='${getFieldIcon(a.field)}'">` : getFieldIcon(a.field)}
          </div>
          <div class="flex-1">
            <div class="font-bold text-gray-900">${a.title}</div>
            <div class="text-sm text-gray-500">${a.company_name} · ${a.city || 'Удалённо'}</div>
            <div class="text-xs text-gray-400 mt-1">${formatDate(a.created_at)}</div>
          </div>
          ${getStatusBadge(a.status)}
        </div>`).join('');
    } else {
      appsListEl.innerHTML = '<div class="text-center py-8 text-gray-500"><div class="text-4xl mb-3">📭</div><div class="font-medium">Пока нет откликов</div><button onclick="navigate(\'internships\')" class="mt-3 text-primary-600 text-sm font-medium">Найти стажировку →</button></div>';
    }

    // Saved tab
    const savedEl = document.getElementById('saved-list');
    if (savedInternships.length) {
      savedEl.innerHTML = savedInternships.map(i => buildInternshipCard(i, false)).join('');
    } else {
      savedEl.innerHTML = '<div class="col-span-2 text-center py-8 text-gray-500"><div class="text-4xl mb-3">🔖</div><div class="font-medium">Нет сохранённых стажировок</div><button onclick="navigate(\'internships\')" class="mt-3 text-primary-600 text-sm font-medium">Смотреть стажировки →</button></div>';
    }

    // Portfolio tab
    const portEl = document.getElementById('portfolio-content');
    if (submissions.length) {
      portEl.innerHTML = `
        <div class="bg-gradient-to-r from-primary-50 to-violet-50 rounded-2xl p-6 mb-6 border border-primary-100">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-lg text-gray-900">${student.full_name}</div>
              <div class="text-sm text-gray-500">${student.university || ''} · ${getFieldLabel(student.desired_field || '')}</div>
              <div class="flex flex-wrap gap-2 mt-2">${safeJson(student.skills, []).slice(0, 5).map(s => `<span class="tag bg-white text-gray-700 shadow-sm">${s}</span>`).join('')}</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-black text-primary-600">${score}%</div>
              <div class="text-xs text-gray-500">Готовность</div>
            </div>
          </div>
        </div>
        <h3 class="font-bold text-gray-900 mb-4">Выполненные задания (${submissions.length})</h3>
        <div class="space-y-3">
          ${submissions.map(s => `
          <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
            <div class="w-10 h-10 bg-${getCatColor(s.category)}-100 rounded-xl flex items-center justify-center text-xl">${getCatEmoji(s.category)}</div>
            <div class="flex-1">
              <div class="font-medium text-sm text-gray-900">${s.task_title}</div>
              <div class="text-xs text-gray-500">${getCatLabel(s.category)} · ${formatDate(s.created_at)}</div>
            </div>
            ${s.score ? `<div class="text-right"><div class="font-bold text-lg text-primary-600">${s.score}</div><div class="text-xs text-gray-500">/100</div></div>` : '<span class="tag bg-yellow-100 text-yellow-700">Ожидает</span>'}
          </div>`).join('')}
        </div>`;
    } else {
      portEl.innerHTML = '<div class="text-center py-8 text-gray-500"><div class="text-4xl mb-3">📁</div><div class="font-medium">Портфолио пустое</div><p class="text-sm text-gray-400 mt-2">Выполни тестовые задания чтобы наполнить портфолио</p><button onclick="navigate(\'tasks\')" class="mt-3 bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium">Начать задания</button></div>';
    }

    // Update readiness tips
    updateImprovementTips(student, submissions, resume);

  } catch (err) { console.error(err); showNotification('Ошибка загрузки данных', 'error'); }
}

function updateImprovementTips(student, submissions, resume) {
  const el = document.getElementById('improvement-tips');
  const tips = [];
  if (!student.about || student.about.length < 50) {
    tips.push({ icon: 'fa-user-edit', color: 'blue', title: 'Заполни описание профиля', desc: 'Расскажи о себе, своих интересах и целях — это +15% к рейтингу', action: () => showDashTab('profile'), label: 'Заполнить' });
  }
  if (!resume || !resume.summary) {
    tips.push({ icon: 'fa-file-alt', color: 'violet', title: 'Создай резюме', desc: 'Работодатели хотят видеть структурированную информацию', action: () => navigate('resume'), label: 'Создать', external: true });
  }
  if (submissions.length < 3) {
    tips.push({ icon: 'fa-tasks', color: 'green', title: `Выполни ${3 - submissions.length} задания`, desc: 'Задания в портфолио показывают реальные навыки', action: () => navigate('tasks'), label: 'Начать', external: true });
  }
  if (!student.desired_field) {
    tips.push({ icon: 'fa-compass', color: 'orange', title: 'Выбери направление', desc: 'Укажи желаемое направление для персональных рекомендаций', action: () => showDashTab('profile'), label: 'Выбрать' });
  }
  if (tips.length === 0) {
    tips.push({ icon: 'fa-trophy', color: 'yellow', title: 'Отлично! Профиль заполнен', desc: 'Откликайся на стажировки и покоряй рынок труда!', action: () => navigate('internships'), label: 'Смотреть', external: true });
  }
  el.innerHTML = tips.slice(0, 3).map(t => `
    <div class="flex items-start gap-3 bg-white rounded-xl p-3">
      <div class="w-8 h-8 bg-${t.color}-100 rounded-lg flex items-center justify-center flex-shrink-0"><i class="fas ${t.icon} text-${t.color}-600 text-sm"></i></div>
      <div class="flex-1"><div class="font-medium text-sm text-gray-900">${t.title}</div><div class="text-xs text-gray-500">${t.desc}</div></div>
      <button onclick="(${t.action.toString()})()" class="ml-auto text-xs bg-${t.color}-600 text-white px-3 py-1 rounded-lg flex-shrink-0">${t.label}</button>
    </div>`).join('');
}

function showDashTab(tab) {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.add('hidden'));
  document.getElementById('tab-' + tab)?.classList.remove('hidden');
  document.querySelectorAll('.sidebar-item').forEach(item => {
    if (item.dataset.tab === tab) item.classList.add('sidebar-active');
    else item.classList.remove('sidebar-active');
  });
  closeSidebar();
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  const skills = document.getElementById('prof-skills').value.split(',').map(s => s.trim()).filter(Boolean);
  const languages = document.getElementById('prof-languages').value.split(',').map(l => l.trim()).filter(Boolean);
  try {
    await apiCall('/api/students/profile', {
      method: 'PUT',
      body: JSON.stringify({
        full_name: document.getElementById('prof-name').value,
        city: document.getElementById('prof-city').value,
        university: document.getElementById('prof-university').value,
        major: document.getElementById('prof-major').value,
        year: parseInt(document.getElementById('prof-year').value),
        desired_field: document.getElementById('prof-field').value,
        about: document.getElementById('prof-about').value,
        skills, languages
      })
    });
    showNotification('Профиль сохранён! ✅');
    loadDashboard();
  } catch (err) { showNotification(err.message, 'error'); }
}

// ==================== EMPLOYER DASHBOARD ====================

async function loadEmployerDashboard() {
  if (!currentUser || currentRole !== 'employer') return;
  try {
    const employer = await apiCall('/api/employers/profile');
    document.getElementById('emp-company-name-nav').textContent = employer.company_name;
    document.getElementById('emp-avatar').textContent = employer.company_name.charAt(0).toUpperCase();
    document.getElementById('emp-prof-name').value = employer.company_name || '';
    document.getElementById('emp-prof-industry').value = employer.industry || '';
    document.getElementById('emp-prof-contact').value = employer.contact_person || '';
    document.getElementById('emp-prof-desc').value = employer.description || '';

    const vacancies = await apiCall('/api/employers/internships');
    document.getElementById('emp-stat-vacancies').textContent = vacancies.length;
    const total = vacancies.reduce((s, v) => s + (v.applications_count || 0), 0);
    document.getElementById('emp-stat-applications').textContent = total;

    // Render vacancies
    const vacEl = document.getElementById('emp-vacancies-list');
    vacEl.innerHTML = vacancies.length ? vacancies.map(v => `
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-bold text-gray-900">${v.title}</div>
            <div class="flex items-center gap-2 mt-1 text-sm text-gray-500">
              ${getLevelBadge(v.level)} ${getFormatBadge(v.format)}
              <span class="text-gray-400">·</span>
              <span>${v.applications_count || 0} откликов</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="tag ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${v.is_active ? 'Активна' : 'Закрыта'}</span>
          </div>
        </div>
      </div>`).join('')
      : '<div class="text-center py-8 text-gray-500">Нет активных вакансий<br><button onclick="openCreateVacancyModal()" class="mt-3 text-primary-600 font-medium text-sm">Создать вакансию →</button></div>';

    // Employer applications
    const apps = await apiCall('/api/applications/employer');
    document.getElementById('emp-stat-pending').textContent = apps.filter(a => a.status === 'pending').length;

    const empAppsEl = document.getElementById('emp-applications-list');
    const recentAppsEl = document.getElementById('emp-recent-apps');
    if (apps.length) {
      const html = apps.map(a => `
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-primary-400 to-violet-400 rounded-xl flex items-center justify-center text-white font-bold">${(a.full_name || 'С').charAt(0)}</div>
            <div class="flex-1">
              <div class="font-bold text-sm text-gray-900">${a.full_name}</div>
              <div class="text-xs text-gray-500">${a.university || '—'} · ${a.internship_title}</div>
              <div class="flex items-center gap-2 mt-1">
                <span class="tag bg-blue-50 text-blue-700 text-xs">Готовность: ${a.readiness_score || 0}%</span>
                ${getStatusBadge(a.status)}
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick="viewStudentProfile(${a.student_id})" class="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200">Профиль</button>
              <select onchange="updateApplicationStatus(${a.id}, this.value)" class="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
                <option value="pending" ${a.status==='pending'?'selected':''}>На рассм.</option>
                <option value="reviewed" ${a.status==='reviewed'?'selected':''}>Просмотрено</option>
                <option value="interview" ${a.status==='interview'?'selected':''}>Интервью</option>
                <option value="accepted" ${a.status==='accepted'?'selected':''}>Принят</option>
                <option value="rejected" ${a.status==='rejected'?'selected':''}>Отказ</option>
              </select>
            </div>
          </div>
        </div>`).join('');
      empAppsEl.innerHTML = html;
      recentAppsEl.innerHTML = html.split('</div>\n        ').slice(0, 3).join('</div>\n        ');
    } else {
      empAppsEl.innerHTML = '<div class="text-center py-8 text-gray-500">Пока нет откликов</div>';
      recentAppsEl.innerHTML = '<div class="text-sm text-gray-500 text-center py-4">Пока нет откликов</div>';
    }
  } catch (err) { console.error(err); }
}

function showEmpTab(tab) {
  document.querySelectorAll('.emp-tab').forEach(t => t.classList.add('hidden'));
  document.getElementById('tab-' + tab)?.classList.remove('hidden');
  document.querySelectorAll('.emp-sidebar-item').forEach(item => {
    if (item.dataset.tab === tab) item.classList.add('sidebar-active');
    else item.classList.remove('sidebar-active');
  });
}

function openCreateVacancyModal() {
  if (!currentUser || currentRole !== 'employer') { navigate('login'); return; }
  openModal('create-vacancy-modal');
}

async function handleCreateVacancy(e) {
  e.preventDefault();
  try {
    const skills = document.getElementById('vac-title').value.split(' ').slice(0, 3);
    await apiCall('/api/internships', {
      method: 'POST',
      body: JSON.stringify({
        title: document.getElementById('vac-title').value,
        field: document.getElementById('vac-field').value,
        level: document.getElementById('vac-level').value,
        format: document.getElementById('vac-format').value,
        city: document.getElementById('vac-city').value,
        salary: document.getElementById('vac-salary').value,
        deadline: document.getElementById('vac-deadline').value,
        is_paid: document.getElementById('vac-paid').checked,
        description: document.getElementById('vac-description').value,
        requirements: document.getElementById('vac-requirements').value,
        responsibilities: document.getElementById('vac-responsibilities').value,
        skills: []
      })
    });
    closeModal('create-vacancy-modal');
    showNotification('Вакансия создана! ✅');
    loadEmployerDashboard();
  } catch (err) { showNotification(err.message, 'error'); }
}

async function updateApplicationStatus(id, status) {
  try {
    await apiCall(`/api/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    showNotification('Статус обновлён');
  } catch (err) { showNotification(err.message, 'error'); }
}

async function updateEmployerProfile(e) {
  e.preventDefault();
  try {
    await apiCall('/api/employers/profile', {
      method: 'PUT',
      body: JSON.stringify({
        company_name: document.getElementById('emp-prof-name').value,
        industry: document.getElementById('emp-prof-industry').value,
        contact_person: document.getElementById('emp-prof-contact').value,
        description: document.getElementById('emp-prof-desc').value
      })
    });
    showNotification('Профиль обновлён ✅');
  } catch (err) { showNotification(err.message, 'error'); }
}

async function viewStudentProfile(id) {
  try {
    const data = await apiCall(`/api/employers/students/${id}`);
    const { student, submissions, resume } = data;
    const skills = safeJson(student.skills, []);
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="p-4 border-b flex items-center justify-between">
          <span class="font-bold text-gray-900">Профиль кандидата</span>
          <button onclick="this.closest('.fixed').remove()" class="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><i class="fas fa-times"></i></button>
        </div>
        <div class="p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-14 h-14 bg-gradient-to-br from-primary-400 to-violet-400 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">${(student.full_name||'С').charAt(0)}</div>
            <div>
              <div class="font-bold text-xl">${student.full_name}</div>
              <div class="text-gray-500 text-sm">${student.university || ''} · ${student.major || ''} · ${student.year || ''} курс</div>
              <div class="mt-1"><span class="tag bg-primary-100 text-primary-700">Готовность: ${student.readiness_score}%</span></div>
            </div>
          </div>
          ${student.about ? `<p class="text-gray-600 text-sm mb-4">${student.about}</p>` : ''}
          ${skills.length ? `<div class="mb-4"><div class="font-semibold text-sm text-gray-700 mb-2">Навыки</div><div class="flex flex-wrap gap-1">${skills.map(s => `<span class="tag bg-blue-50 text-blue-700">${s}</span>`).join('')}</div></div>` : ''}
          ${submissions.length ? `<div><div class="font-semibold text-sm text-gray-700 mb-2">Выполненные задания (${submissions.length})</div><div class="space-y-2">${submissions.map(s => `<div class="flex items-center gap-3 bg-gray-50 rounded-xl p-3"><span class="text-lg">${getCatEmoji(s.category)}</span><div class="flex-1 text-sm font-medium">${s.task_title}</div>${s.score ? `<span class="font-bold text-primary-600">${s.score}/100</span>` : ''}</div>`).join('')}</div></div>` : ''}
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  } catch (err) { showNotification(err.message, 'error'); }
}

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  loadHomeInternships();
  
  // Live preview for resume
  setInterval(updateResumePreview, 2000);
  
  // Load resume if on resume page
  if (currentPage === 'resume') loadResume();
});

// Add live event listeners for resume preview
document.addEventListener('input', (e) => {
  if (e.target.closest('#page-resume')) updateResumePreview();
});
