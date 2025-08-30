import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const password_hash = await bcrypt.hash(password, 10);
    const result = await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [
      name || email.split('@')[0],
      email,
      password_hash,
      'user'
    ]);
    const id = result.lastID;
    res.json({ id, name, email, role: 'user' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.get('SELECT id, name, email, password_hash, role, active FROM users WHERE email = ?', [email]);
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await db.get('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
  res.json({ user });
});

export default router;

