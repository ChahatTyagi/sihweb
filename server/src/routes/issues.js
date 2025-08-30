import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// Public endpoints for issues (basic create/list for current frontend integration)
router.get('/', async (_req, res) => {
  const rows = await db.all('SELECT * FROM issues ORDER BY reported_date DESC LIMIT 200');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const {
    reporter_user_id,
    type,
    priority,
    title,
    description,
    address,
    city,
    landmark,
    status,
    contact,
    gps_location,
    category_id
  } = req.body || {};

  if (!title) return res.status(400).json({ error: 'Title required' });
  const result = await db.run(
    `INSERT INTO issues (reporter_user_id, type, priority, title, description, address, city, landmark, status, contact, gps_location, category_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'reported'), ?, ?, ?)`,
    [reporter_user_id || null, type || null, priority || null, title, description || null, address || null, city || null, landmark || null, status, contact || null, gps_location || null, category_id || null]
  );
  const created = await db.get('SELECT * FROM issues WHERE id = ?', [result.lastID]);
  res.json(created);
});

export default router;

