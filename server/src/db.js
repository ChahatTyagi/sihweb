import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';

sqlite3.verbose();

let _db;
export const db = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      _db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      _db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      _db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      _db.exec(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
};

export async function initDb() {
  _db = new sqlite3.Database(process.env.SQLITE_PATH || './data.sqlite');

  await db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_user_id INTEGER,
      type TEXT,
      priority TEXT,
      title TEXT NOT NULL,
      description TEXT,
      address TEXT,
      city TEXT,
      landmark TEXT,
      status TEXT NOT NULL DEFAULT 'reported',
      reported_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      contact TEXT,
      upvotes INTEGER NOT NULL DEFAULT 0,
      gps_location TEXT,
      category_id INTEGER,
      FOREIGN KEY (reporter_user_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_user_id) REFERENCES users(id)
    );
  `);

  const row = await db.get('SELECT COUNT(*) as count FROM categories');
  if (!row || row.count === 0) {
    const defaultCategories = [
      ['Garbage & Waste', 'Garbage and waste management issues'],
      ['Road & Infrastructure', 'Roads, potholes, infrastructure'],
      ['Water Supply', 'Water leakage and supply'],
      ['Electricity', 'Power cuts and street lights'],
      ['Safety & Security', 'Public safety'],
      ['Public Transport', 'Buses, trains, metro'],
      ['Parks & Recreation', 'Parks and recreation'],
      ['Noise Pollution', 'Noise complaints'],
      ['Air Quality', 'Air pollution'],
      ['Other', 'Miscellaneous']
    ];
    for (const [name, description] of defaultCategories) {
      await db.run('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description]);
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@sih.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const admin = await db.get('SELECT id FROM users WHERE email = ?', [adminEmail]);
  if (!admin) {
    const password_hash = await bcrypt.hash(adminPassword, 10);
    await db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [
      'Administrator',
      adminEmail,
      password_hash,
      'admin'
    ]);
    console.log('Seeded admin user:', adminEmail);
  }

  return db;
}

export async function logAudit(adminUserId, action, entityType, entityId, details) {
  await db.run(
    'INSERT INTO audit_logs (admin_user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
    [adminUserId, action, entityType, entityId ?? null, details ? JSON.stringify(details) : null]
  );
}

