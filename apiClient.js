const USE_MOCK = window.APP_CONFIG?.USE_MOCK;

function handleAuthError(res) {
  if (res.status === 401 || res.status === 403) {
    localStorage.clear();
    window.location.href = 'login.html';
    return true;
  }
  return false;
}

function authHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

async function apiGet(endpoint, mockFile) {
  if (USE_MOCK) {
    const res = await fetch(`./mockdata/${mockFile}`);
    return res.json();
  }
  const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}${endpoint}`, { headers: authHeaders() });
  if (handleAuthError(res)) return null;
  if (!res.ok) throw new Error((await res.json()).message || 'Request failed');
  return res.json();
}

async function apiPost(endpoint, body) {
  if (USE_MOCK) return { success: true, _mock: true };
  const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (handleAuthError(res)) return null;
  if (!res.ok) throw new Error((await res.json()).message || 'Request failed');
  return res.json();
}

async function apiPut(endpoint, body) {
  if (USE_MOCK) return { success: true, _mock: true };
  const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (handleAuthError(res)) return null;
  if (!res.ok) throw new Error((await res.json()).message || 'Request failed');
  return res.json();
}

async function apiDelete(endpoint) {
  if (USE_MOCK) return { success: true, _mock: true };
  const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (handleAuthError(res)) return null;
  if (!res.ok) throw new Error((await res.json()).message || 'Request failed');
  return res.json();
}
