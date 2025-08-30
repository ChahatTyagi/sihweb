const API_BASE = 'http://localhost:4000/api';

function getToken() {
	return localStorage.getItem('token');
}

async function api(path, options = {}) {
	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${getToken()}`,
			...(options.headers || {})
		}
	});
	if (!res.ok) throw new Error(`API error ${res.status}`);
	return res.json();
}

function ensureAdmin() {
	const role = localStorage.getItem('role');
	if (role !== 'admin') {
		window.location.href = 'login.html';
	}
}

function toggleProfileMenu() {
	const dropdown = document.getElementById('profileDropdown');
	dropdown.classList.toggle('active');
}

function logout() {
	localStorage.clear();
	window.location.href = 'login.html';
}

function setupTabs() {
	document.querySelectorAll('.tab-button').forEach(btn => {
		btn.addEventListener('click', () => {
			document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
			document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
			btn.classList.add('active');
			document.getElementById(btn.dataset.tab).style.display = 'block';
		});
	});
}

async function loadStats() {
	const data = await api('/admin/stats', { method: 'GET' });
	document.getElementById('statUsers').textContent = data.totalUsers;
	document.getElementById('statIssues').textContent = data.totalIssues;
	document.getElementById('statResolved').textContent = data.resolvedIssues;
	document.getElementById('statPending').textContent = data.pendingIssues;
}

async function loadUsers() {
	const users = await api('/admin/users');
	const tbody = document.getElementById('usersTableBody');
	tbody.innerHTML = users.map(u => `
		<tr>
			<td>${u.id}</td>
			<td><input value="${u.name || ''}" data-id="${u.id}" class="user-name-input"></td>
			<td>${u.email}</td>
			<td>
				<select data-id="${u.id}" class="user-role-select">
					<option value="user" ${u.role==='user'?'selected':''}>user</option>
					<option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
				</select>
			</td>
			<td>
				<select data-id="${u.id}" class="user-active-select">
					<option value="1" ${u.active? 'selected': ''}>active</option>
					<option value="0" ${!u.active? 'selected': ''}>inactive</option>
				</select>
			</td>
			<td>
				<button class="btn btn-secondary" data-action="save-user" data-id="${u.id}"><i class="fas fa-save"></i></button>
				<button class="btn btn-danger" data-action="delete-user" data-id="${u.id}"><i class="fas fa-trash"></i></button>
			</td>
		</tr>
	`).join('');

	tbody.addEventListener('click', async (e) => {
		const btn = e.target.closest('button');
		if (!btn) return;
		const id = btn.dataset.id;
		if (btn.dataset.action === 'save-user') {
			const name = document.querySelector(`.user-name-input[data-id="${id}"]`).value;
			const role = document.querySelector(`.user-role-select[data-id="${id}"]`).value;
			const active = parseInt(document.querySelector(`.user-active-select[data-id="${id}"]`).value, 10);
			await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ name, role, active }) });
		} else if (btn.dataset.action === 'delete-user') {
			if (confirm('Delete user?')) {
				await api(`/admin/users/${id}`, { method: 'DELETE' });
				loadUsers();
			}
		}
	});
}

async function loadIssues() {
	const status = document.getElementById('issueStatusFilter').value;
	const q = document.getElementById('issueSearch').value;
	const params = new URLSearchParams();
	if (status) params.set('status', status);
	if (q) params.set('q', q);
	const issues = await api(`/admin/issues?${params.toString()}`);
	const tbody = document.getElementById('issuesTableBody');
	tbody.innerHTML = issues.map(i => `
		<tr>
			<td>${i.id}</td>
			<td><input value="${i.title}" data-id="${i.id}" class="issue-title-input"></td>
			<td>
				<select data-id="${i.id}" class="issue-status-select">
					${['reported','investigating','in-progress','resolved'].map(s=>`<option value="${s}" ${i.status===s?'selected':''}>${s}</option>`).join('')}
				</select>
			</td>
			<td>
				<select data-id="${i.id}" class="issue-priority-select">
					${['low','medium','high','urgent'].map(p=>`<option value="${p}" ${i.priority===p?'selected':''}>${p}</option>`).join('')}
				</select>
			</td>
			<td>${i.city || ''}</td>
			<td>
				<button class="btn btn-secondary" data-action="save-issue" data-id="${i.id}"><i class="fas fa-save"></i></button>
				<button class="btn btn-danger" data-action="delete-issue" data-id="${i.id}"><i class="fas fa-trash"></i></button>
			</td>
		</tr>
	`).join('');

	tbody.addEventListener('click', async (e) => {
		const btn = e.target.closest('button');
		if (!btn) return;
		const id = btn.dataset.id;
		if (btn.dataset.action === 'save-issue') {
			const title = document.querySelector(`.issue-title-input[data-id="${id}"]`).value;
			const status = document.querySelector(`.issue-status-select[data-id="${id}"]`).value;
			const priority = document.querySelector(`.issue-priority-select[data-id="${id}"]`).value;
			await api(`/admin/issues/${id}`, { method: 'PATCH', body: JSON.stringify({ title, status, priority }) });
		} else if (btn.dataset.action === 'delete-issue') {
			if (confirm('Delete issue?')) {
				await api(`/admin/issues/${id}`, { method: 'DELETE' });
				loadIssues();
			}
		}
	});

	document.getElementById('issueStatusFilter').addEventListener('change', loadIssues);
	document.getElementById('issueSearch').addEventListener('input', () => setTimeout(loadIssues, 300));
}

async function loadCategories() {
	const categories = await api('/admin/categories');
	const tbody = document.getElementById('categoriesTableBody');
	tbody.innerHTML = categories.map(c => `
		<tr>
			<td>${c.id}</td>
			<td><input value="${c.name}" data-id="${c.id}" class="cat-name-input"></td>
			<td>
				<select data-id="${c.id}" class="cat-active-select">
					<option value="1" ${c.active? 'selected': ''}>active</option>
					<option value="0" ${!c.active? 'selected': ''}>inactive</option>
				</select>
			</td>
			<td>
				<button class="btn btn-secondary" data-action="save-cat" data-id="${c.id}"><i class="fas fa-save"></i></button>
				<button class="btn btn-danger" data-action="delete-cat" data-id="${c.id}"><i class="fas fa-trash"></i></button>
			</td>
		</tr>
	`).join('');

	document.getElementById('addCategoryBtn').onclick = async () => {
		const name = document.getElementById('newCategoryName').value.trim();
		const description = document.getElementById('newCategoryDescription').value.trim();
		if (!name) return;
		await api('/admin/categories', { method: 'POST', body: JSON.stringify({ name, description }) });
		document.getElementById('newCategoryName').value = '';
		document.getElementById('newCategoryDescription').value = '';
		loadCategories();
	};

	tbody.addEventListener('click', async (e) => {
		const btn = e.target.closest('button');
		if (!btn) return;
		const id = btn.dataset.id;
		if (btn.dataset.action === 'save-cat') {
			const name = document.querySelector(`.cat-name-input[data-id="${id}"]`).value;
			const active = parseInt(document.querySelector(`.cat-active-select[data-id="${id}"]`).value, 10);
			await api(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name, active }) });
		} else if (btn.dataset.action === 'delete-cat') {
			if (confirm('Delete category?')) {
				await api(`/admin/categories/${id}`, { method: 'DELETE' });
				loadCategories();
			}
		}
	});
}

async function loadSettings() {
	const settings = await api('/admin/settings');
	document.getElementById('settingEmailReminders').value = String(settings.emailReminders === 'true' || settings.emailReminders === true);
	document.getElementById('settingNotifications').value = String(settings.notifications === 'true' || settings.notifications === true);
	document.getElementById('saveSettingsBtn').onclick = async () => {
		const body = {
			emailReminders: document.getElementById('settingEmailReminders').value,
			notifications: document.getElementById('settingNotifications').value
		};
		await api('/admin/settings', { method: 'PUT', body: JSON.stringify(body) });
	};
}

async function loadActivity() {
	const logs = await api('/admin/audit-logs');
	const tbody = document.getElementById('activityTableBody');
	tbody.innerHTML = logs.map(l => `
		<tr>
			<td>${new Date(l.created_at).toLocaleString()}</td>
			<td>${l.admin_email}</td>
			<td>${l.action}</td>
			<td>${l.entity_type || ''} ${l.entity_id || ''}</td>
			<td><code>${l.details || ''}</code></td>
		</tr>
	`).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
	ensureAdmin();
	setupTabs();
	await loadStats();
	await loadUsers();
	await loadIssues();
	await loadCategories();
	await loadSettings();
	await loadActivity();
});

