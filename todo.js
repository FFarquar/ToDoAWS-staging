// ============================
// STATE
// ============================
let currentListId = null;
let currentListName = '';
const userRole = localStorage.getItem('userRole') || 'USER';
const userLoginID = localStorage.getItem('userLoginID') || '';

// ============================
// INIT
// ============================
(function init() {
  if (!localStorage.getItem('authToken')) {
    window.location.href = 'login.html';
    return;
  }
  if (userRole === 'ADMIN') {
    document.getElementById('btnAdmin').style.display = 'inline-flex';
  }
  loadLists();
})();

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// ============================
// LISTS VIEW
// ============================
function showListsView() {
  currentListId = null;
  currentListName = '';
  document.getElementById('listsView').style.display = '';
  document.getElementById('itemsView').style.display = 'none';
}

async function loadLists() {
  let lists;
  if (window.APP_CONFIG?.USE_MOCK) {
    const res = await fetch('./mockdata/mock-lists.json');
    lists = await res.json();
  } else {
    lists = await apiGet('/lists');
  }
  renderLists(lists || []);
}

function renderLists(lists) {
  const grid = document.getElementById('listsGrid');

  if (lists.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <h3>No lists yet</h3>
      <p>Click "New List" to create your first todo list.</p>
    </div>`;
    return;
  }

  grid.innerHTML = lists.map(list => `
    <div class="list-card" onclick="openList('${esc(list.listId)}', '${esc(list.name)}')">
      <div class="list-card-name">${esc(list.name)}</div>
      <div class="list-card-meta">${list.itemCount != null ? `${list.itemCount} item${list.itemCount !== 1 ? 's' : ''}` : ''}</div>
      <div class="list-card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-primary btn-icon" style="font-size:12px;"
          onclick="openList('${esc(list.listId)}', '${esc(list.name)}')">Open</button>
        <button class="btn btn-danger btn-icon" style="font-size:12px;"
          onclick="confirmDeleteListFromCard('${esc(list.listId)}', '${esc(list.name)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// ============================
// ITEMS VIEW
// ============================
async function openList(listId, listName) {
  currentListId = listId;
  currentListName = listName;
  document.getElementById('listsView').style.display = 'none';
  document.getElementById('itemsView').style.display = 'block';
  document.getElementById('currentListTitle').textContent = listName;
  document.getElementById('addItemInput').value = '';
  await loadItems();
}

async function loadItems() {
  let items;
  if (window.APP_CONFIG?.USE_MOCK) {
    const res = await fetch('./mockdata/mock-items.json');
    const all = await res.json();
    items = all[currentListId] || [];
  } else {
    items = await apiGet(`/lists/${currentListId}/items`);
  }
  renderItems(items || []);
}

function renderItems(items) {
  const container = document.getElementById('itemsList');

  if (items.length === 0) {
    container.innerHTML = '<div class="items-empty">No tasks yet. Add one above.</div>';
    return;
  }

  container.innerHTML = '';
  items.forEach(item => container.appendChild(buildItemRow(item)));
}

function buildItemRow(item) {
  const row = document.createElement('div');
  row.className = `todo-item${item.completed ? ' completed' : ''}`;
  row.id = `item-${item.itemId}`;
  row.dataset.itemId = item.itemId;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-checkbox';
  checkbox.checked = item.completed;
  checkbox.addEventListener('change', () => toggleItem(item.itemId, checkbox.checked, row, checkbox));

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'todo-text';
  textInput.value = item.text;
  textInput.maxLength = 500;
  textInput.setAttribute('aria-label', 'Task text');
  // Save on blur — no page scroll involved
  textInput.addEventListener('blur', () => saveItemText(item.itemId, textInput.value, textInput, indicator));
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); textInput.blur(); }
    if (e.key === 'Escape') { textInput.value = textInput.dataset.lastSaved || textInput.value; textInput.blur(); }
  });
  textInput.dataset.lastSaved = item.text;

  const indicator = document.createElement('span');
  indicator.className = 'save-indicator';
  indicator.textContent = '✓';

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-delete-item';
  delBtn.innerHTML = '&#x2715;';
  delBtn.title = 'Delete task';
  delBtn.addEventListener('click', () => confirmDeleteItem(item.itemId, row));

  row.appendChild(checkbox);
  row.appendChild(textInput);
  row.appendChild(indicator);
  row.appendChild(delBtn);
  return row;
}

function appendNewItem(item) {
  const container = document.getElementById('itemsList');
  // Remove empty state message if present
  const emptyMsg = container.querySelector('.items-empty');
  if (emptyMsg) emptyMsg.remove();
  container.appendChild(buildItemRow(item));
}

// ============================
// ITEM ACTIONS (in-place, no scroll)
// ============================
async function toggleItem(itemId, completed, rowEl, checkboxEl) {
  // Optimistic UI update first
  rowEl.classList.toggle('completed', completed);
  const textInput = rowEl.querySelector('.todo-text');
  checkboxEl.disabled = true;

  try {
    if (!window.APP_CONFIG?.USE_MOCK) {
      await apiPut(`/lists/${currentListId}/items/${itemId}`, { completed });
    }
  } catch (err) {
    // Revert on failure
    rowEl.classList.toggle('completed', !completed);
    checkboxEl.checked = !completed;
    alert('Failed to update task: ' + err.message);
  } finally {
    checkboxEl.disabled = false;
  }
}

async function saveItemText(itemId, text, inputEl, indicatorEl) {
  const trimmed = text.trim();
  if (!trimmed) {
    inputEl.value = inputEl.dataset.lastSaved || '';
    return;
  }
  if (trimmed === inputEl.dataset.lastSaved) return;

  try {
    if (!window.APP_CONFIG?.USE_MOCK) {
      await apiPut(`/lists/${currentListId}/items/${itemId}`, { text: trimmed });
    }
    inputEl.dataset.lastSaved = trimmed;
    inputEl.value = trimmed;
    // Brief "saved" indicator — no scroll change
    if (indicatorEl) {
      indicatorEl.classList.add('visible');
      setTimeout(() => indicatorEl.classList.remove('visible'), 1500);
    }
  } catch (err) {
    inputEl.value = inputEl.dataset.lastSaved || trimmed;
    alert('Failed to save: ' + err.message);
  }
}

async function addItem() {
  const input = document.getElementById('addItemInput');
  const text = input.value.trim();
  if (!text) { input.focus(); return; }

  const btn = input.nextElementSibling;
  btn.disabled = true;
  btn.classList.add('loading');

  try {
    if (window.APP_CONFIG?.USE_MOCK) {
      const fakeItem = {
        itemId: 'mock-' + Date.now(),
        listId: currentListId,
        text,
        completed: false,
        createdDate: new Date().toISOString(),
      };
      appendNewItem(fakeItem);
    } else {
      const created = await apiPost(`/lists/${currentListId}/items`, { text });
      appendNewItem(created);
    }
    input.value = '';
    input.focus();
  } catch (err) {
    alert('Failed to add task: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

function confirmDeleteItem(itemId, rowEl) {
  showConfirm('Delete this task?', async () => {
    rowEl.style.opacity = '0.4';
    try {
      if (!window.APP_CONFIG?.USE_MOCK) {
        await apiDelete(`/lists/${currentListId}/items/${itemId}`);
      }
      rowEl.remove();
      // Show empty state if no items left
      if (document.getElementById('itemsList').children.length === 0) {
        document.getElementById('itemsList').innerHTML = '<div class="items-empty">No tasks yet. Add one above.</div>';
      }
    } catch (err) {
      rowEl.style.opacity = '';
      alert('Failed to delete: ' + err.message);
    }
  });
}

// ============================
// LIST ACTIONS
// ============================
let _listFormMode = 'create';

function openCreateListModal() {
  _listFormMode = 'create';
  document.getElementById('listFormTitle').textContent = 'New List';
  document.getElementById('listNameInput').value = '';
  openModal('listFormModal');
  setTimeout(() => document.getElementById('listNameInput').focus(), 50);
}

function openRenameListModal() {
  _listFormMode = 'rename';
  document.getElementById('listFormTitle').textContent = 'Rename List';
  document.getElementById('listNameInput').value = currentListName;
  openModal('listFormModal');
  setTimeout(() => { const i = document.getElementById('listNameInput'); i.focus(); i.select(); }, 50);
}

function closeListFormModal() { closeModal('listFormModal'); }

async function saveListForm(btn) {
  const name = document.getElementById('listNameInput').value.trim();
  if (!name) { document.getElementById('listNameInput').focus(); return; }

  btn.disabled = true;
  btn.classList.add('loading');

  try {
    if (_listFormMode === 'create') {
      let created;
      if (window.APP_CONFIG?.USE_MOCK) {
        created = { listId: 'mock-' + Date.now(), name, itemCount: 0, createdDate: new Date().toISOString() };
      } else {
        created = await apiPost('/lists', { name });
      }
      closeListFormModal();
      await loadLists();
      // Auto-open the new list
      openList(created.listId, created.name);
    } else {
      if (!window.APP_CONFIG?.USE_MOCK) {
        await apiPut(`/lists/${currentListId}`, { name });
      }
      currentListName = name;
      document.getElementById('currentListTitle').textContent = name;
      closeListFormModal();
    }
  } catch (err) {
    alert('Failed to save: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

function confirmDeleteListFromCard(listId, listName) {
  showConfirm(`Delete list "${listName}" and all its tasks?`, async () => {
    try {
      if (!window.APP_CONFIG?.USE_MOCK) {
        await apiDelete(`/lists/${listId}`);
      }
      await loadLists();
    } catch (err) {
      alert('Failed to delete list: ' + err.message);
    }
  });
}

function confirmDeleteList() {
  showConfirm(`Delete list "${currentListName}" and all its tasks?`, async () => {
    try {
      if (!window.APP_CONFIG?.USE_MOCK) {
        await apiDelete(`/lists/${currentListId}`);
      }
      showListsView();
      await loadLists();
    } catch (err) {
      alert('Failed to delete list: ' + err.message);
    }
  });
}

// ============================
// CONFIRM MODAL
// ============================
let _confirmCallback = null;

function showConfirm(message, onConfirm) {
  document.getElementById('confirmMsg').textContent = message;
  _confirmCallback = onConfirm;
  openModal('confirmModal');
  document.getElementById('btnConfirmYes').onclick = async () => {
    closeConfirmModal();
    if (_confirmCallback) await _confirmCallback();
    _confirmCallback = null;
  };
}

function closeConfirmModal() { closeModal('confirmModal'); }

// ============================
// ADMIN PANEL
// ============================
async function openAdminModal() {
  openModal('adminModal');
  await loadAdminUsers();
}

function closeAdminModal() { closeModal('adminModal'); }

async function loadAdminUsers() {
  let users;
  if (window.APP_CONFIG?.USE_MOCK) {
    const res = await fetch('./mockdata/mock-admin-users.json');
    users = await res.json();
  } else {
    users = await apiGet('/admin/users');
  }
  renderAdminUsers(users || []);
}

function renderAdminUsers(users) {
  const tbody = document.getElementById('adminUsersBody');
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:20px;">No users found</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${esc(u.loginID)}</td>
      <td><span class="badge ${u.role === 'ADMIN' ? 'badge-admin' : 'badge-user'}">${u.role}</span></td>
      <td><span class="badge ${u.active ? 'badge-active' : 'badge-inactive'}">${u.active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary" style="font-size:11px; padding:4px 8px;"
            onclick="openEditUserForm('${esc(u.loginID)}', '${u.role}', ${u.active})">Edit</button>
          <button class="btn btn-secondary" style="font-size:11px; padding:4px 8px;"
            onclick="openChangePasswordModal('${esc(u.loginID)}')">Password</button>
          <button class="btn btn-danger" style="font-size:11px; padding:4px 8px;"
            onclick="deleteAdminUser('${esc(u.loginID)}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

let _adminEditingLoginId = null;

function openAdminUserForm() {
  _adminEditingLoginId = null;
  document.getElementById('adminUserFormTitle').textContent = 'Add User';
  document.getElementById('loginIdGroup').style.display = '';
  document.getElementById('adminLoginId').value = '';
  document.getElementById('adminRole').value = 'USER';
  document.getElementById('adminActive').value = 'true';
  document.getElementById('adminPassword').value = '';
  document.getElementById('adminPasswordConfirm').value = '';
  document.getElementById('adminPasswordGroup').style.display = '';
  document.getElementById('adminPasswordConfirmGroup').style.display = '';
  openModal('adminUserFormModal');
}

function openEditUserForm(loginID, role, active) {
  _adminEditingLoginId = loginID;
  document.getElementById('adminUserFormTitle').textContent = 'Edit User';
  document.getElementById('loginIdGroup').style.display = 'none';
  document.getElementById('adminRole').value = role;
  document.getElementById('adminActive').value = String(active);
  document.getElementById('adminPasswordGroup').style.display = 'none';
  document.getElementById('adminPasswordConfirmGroup').style.display = 'none';
  openModal('adminUserFormModal');
}

function closeAdminUserForm() { closeModal('adminUserFormModal'); }

async function saveAdminUser(btn) {
  const role = document.getElementById('adminRole').value;
  const active = document.getElementById('adminActive').value === 'true';

  btn.disabled = true;
  btn.classList.add('loading');

  try {
    if (_adminEditingLoginId) {
      if (!window.APP_CONFIG?.USE_MOCK) {
        await apiPut(`/admin/users/${_adminEditingLoginId}`, { role, active });
      }
    } else {
      const loginID = document.getElementById('adminLoginId').value.trim();
      const password = document.getElementById('adminPassword').value;
      const confirm = document.getElementById('adminPasswordConfirm').value;

      if (!loginID) { alert('Login ID is required'); return; }
      if (password.length < 6) { alert('Password must be at least 6 characters'); return; }
      if (password !== confirm) { alert('Passwords do not match'); return; }

      if (!window.APP_CONFIG?.USE_MOCK) {
        await apiPost('/admin/users', { loginID, password, role, active });
      }
    }
    closeAdminUserForm();
    await loadAdminUsers();
  } catch (err) {
    alert('Failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

let _pwdTargetLoginId = null;

function openChangePasswordModal(loginID) {
  _pwdTargetLoginId = loginID;
  document.getElementById('adminPwdTarget').textContent = `User: ${loginID}`;
  document.getElementById('adminNewPassword').value = '';
  document.getElementById('adminConfirmPassword').value = '';
  openModal('adminPasswordModal');
}

function closeAdminPasswordModal() { closeModal('adminPasswordModal'); }

async function saveAdminPassword(btn) {
  const newPwd = document.getElementById('adminNewPassword').value;
  const confirmPwd = document.getElementById('adminConfirmPassword').value;

  if (newPwd.length < 6) { alert('Password must be at least 6 characters'); return; }
  if (newPwd !== confirmPwd) { alert('Passwords do not match'); return; }

  btn.disabled = true;
  btn.classList.add('loading');

  try {
    if (!window.APP_CONFIG?.USE_MOCK) {
      await apiPut(`/admin/users/${_pwdTargetLoginId}/password`, { password: newPwd });
    }
    closeAdminPasswordModal();
  } catch (err) {
    alert('Failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

async function deleteAdminUser(loginID) {
  showConfirm(`Delete user "${loginID}"?`, async () => {
    try {
      if (!window.APP_CONFIG?.USE_MOCK) {
        await apiDelete(`/admin/users/${loginID}`);
      }
      await loadAdminUsers();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  });
}

// ============================
// MODAL HELPERS
// ============================
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modal on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ============================
// UTIL
// ============================
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
