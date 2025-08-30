import { Router } from 'express';
import { db, logAudit } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

// Dashboard stats
router.get('/stats', async (_req, res) => {
  const [users, issues, resolved, pending, categories, recentActivity] = await Promise.all([
    db.get('SELECT COUNT(*) as count FROM users'),
    db.get('SELECT COUNT(*) as count FROM issues'),
    db.get("SELECT COUNT(*) as count FROM issues WHERE status = 'resolved'"),
    db.get("SELECT COUNT(*) as count FROM issues WHERE status != 'resolved'"),
    db.all('SELECT id, name, active FROM categories ORDER BY name'),
    db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20')
  ]);

  res.json({
    totalUsers: users.count,
    totalIssues: issues.count,
    resolvedIssues: resolved.count,
    pendingIssues: pending.count,
    categories,
    recentActivity
  });
});

// Users
router.get('/users', async (_req, res) => {
  const rows = await db.all('SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at DESC');
  res.json(rows);
});

router.patch('/users/:id', async (req, res) => {
  const { name, role, active } = req.body;
  const id = Number(req.params.id);
  const user = await db.get('SELECT id FROM users WHERE id = ?', [id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await db.run('UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role), active = COALESCE(?, active) WHERE id = ?', [name, role, typeof active === 'number' ? active : null, id]);
  await logAudit(req.user.id, 'UPDATE_USER', 'user', id, { name, role, active });
  res.json({ ok: true });
});

router.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  await db.run('DELETE FROM users WHERE id = ?', [id]);
  await logAudit(req.user.id, 'DELETE_USER', 'user', id);
  res.json({ ok: true });
});

// Issues
router.get('/issues', async (req, res) => {
  const { status, categoryId, q } = req.query;
  const conditions = [];
  const params = [];
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (categoryId) { conditions.push('category_id = ?'); params.push(Number(categoryId)); }
  if (q) { conditions.push('(title LIKE ? OR description LIKE ? OR city LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.all(`SELECT * FROM issues ${where} ORDER BY reported_date DESC LIMIT 500`, params);
  res.json(rows);
});

router.patch('/issues/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { title, description, status, category_id, priority } = req.body;
  const issue = await db.get('SELECT id FROM issues WHERE id = ?', [id]);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  await db.run(
    'UPDATE issues SET title = COALESCE(?, title), description = COALESCE(?, description), status = COALESCE(?, status), category_id = COALESCE(?, category_id), priority = COALESCE(?, priority) WHERE id = ?',
    [title, description, status, category_id, priority, id]
  );
  await logAudit(req.user.id, 'UPDATE_ISSUE', 'issue', id, { title, status, category_id, priority });
  res.json({ ok: true });
});

router.delete('/issues/:id', async (req, res) => {
  const id = Number(req.params.id);
  await db.run('DELETE FROM issues WHERE id = ?', [id]);
  await logAudit(req.user.id, 'DELETE_ISSUE', 'issue', id);
  res.json({ ok: true });
});

// Categories
router.get('/categories', async (_req, res) => {
  const rows = await db.all('SELECT id, name, description, active FROM categories ORDER BY name');
  res.json(rows);
});

router.post('/categories', async (req, res) => {
  const { name, description } = req.body;
  const result = await db.run('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || null]);
  await logAudit(req.user.id, 'CREATE_CATEGORY', 'category', result.lastID, { name });
  res.json({ id: result.lastID, name, description });
});

router.patch('/categories/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, active } = req.body;
  await db.run('UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description), active = COALESCE(?, active) WHERE id = ?', [name, description, typeof active === 'number' ? active : null, id]);
  await logAudit(req.user.id, 'UPDATE_CATEGORY', 'category', id, { name, active });
  res.json({ ok: true });
});

router.delete('/categories/:id', async (req, res) => {
  const id = Number(req.params.id);
  await db.run('DELETE FROM categories WHERE id = ?', [id]);
  await logAudit(req.user.id, 'DELETE_CATEGORY', 'category', id);
  res.json({ ok: true });
});

// Settings
router.get('/settings', async (_req, res) => {
  const rows = await db.all('SELECT key, value FROM settings');
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(settings);
});

router.put('/settings', async (req, res) => {
  const entries = Object.entries(req.body || {});
  for (const [key, value] of entries) {
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, typeof value === 'object' ? JSON.stringify(value) : String(value)]);
  }
  await logAudit(req.user.id, 'UPDATE_SETTINGS', 'settings', null, req.body);
  res.json({ ok: true });
});

// Audit logs
router.get('/audit-logs', async (_req, res) => {
  const rows = await db.all('SELECT a.*, u.email as admin_email FROM audit_logs a JOIN users u ON u.id = a.admin_user_id ORDER BY a.created_at DESC LIMIT 200');
  res.json(rows);
});

export default router;

