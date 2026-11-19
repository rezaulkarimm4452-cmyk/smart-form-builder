const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'app.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for better concurrency and performance
db.exec('PRAGMA journal_mode = WAL;');

// Initialize tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS form_settings (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS form_fields (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      type TEXT NOT NULL,
      placeholder TEXT DEFAULT '',
      required INTEGER NOT NULL DEFAULT 0,
      options TEXT DEFAULT '[]',
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_code TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      summary_name TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  // Seed default settings if not exists
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM form_settings').get().count;
  if (settingsCount === 0) {
    db.prepare(`
      INSERT INTO form_settings (id, title, description, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      1,
      'অনলাইন আবেদন ও নিবন্ধন ফর্ম',
      'অনুগ্রহ করে নিচের তথ্যগুলো মনোযোগ দিয়ে সঠিকভাবে পূরণ করে আবেদন নিশ্চিত করুন। ফর্মটি সফলভাবে জমা হলে আপনি একটি কনফার্মেশন কোড পাবেন।',
      1,
      new Date().toISOString()
    );
  }

  // Seed default fields if empty
  const fieldsCount = db.prepare('SELECT COUNT(*) as count FROM form_fields').get().count;
  if (fieldsCount === 0) {
    const defaultFields = [
      {
        id: 'f_name',
        label: 'আপনার পূর্ণ নাম',
        type: 'text',
        placeholder: 'যেমন: মোহাম্মদ আব্দুল্লাহ',
        required: 1,
        options: '[]',
        order_index: 1
      },
      {
        id: 'f_email',
        label: 'ইমেইল ঠিকানা',
        type: 'email',
        placeholder: 'example@domain.com',
        required: 1,
        options: '[]',
        order_index: 2
      },
      {
        id: 'f_phone',
        label: 'মোবাইল নম্বর',
        type: 'tel',
        placeholder: '০১XXXXXXXXX',
        required: 1,
        options: '[]',
        order_index: 3
      },
      {
        id: 'f_division',
        label: 'আপনার বিভাগ নির্বাচন করুন',
        type: 'select',
        placeholder: 'একটি বিভাগ বেছে নিন',
        required: 1,
        options: JSON.stringify(['ঢাকা', 'চট্টগ্রাম', 'রাজশাহী', 'খুলনা', 'বরিশাল', 'সিলেট', 'রংপুর', 'ময়মনসিংহ']),
        order_index: 4
      },
      {
        id: 'f_gender',
        label: 'লিঙ্গ',
        type: 'radio',
        placeholder: '',
        required: 1,
        options: JSON.stringify(['পুরুষ', 'মহিলা', 'অন্যান্য']),
        order_index: 5
      },
      {
        id: 'f_dob',
        label: 'জন্ম তারিখ',
        type: 'date',
        placeholder: '',
        required: 0,
        options: '[]',
        order_index: 6
      },
      {
        id: 'f_notes',
        label: 'আবেদনের বিবরণ বা বিশেষ মন্তব্য',
        type: 'textarea',
        placeholder: 'আপনার আবেদন বা যোগ্যতা সম্পর্কে সংক্ষেপে লিখুন...',
        required: 0,
        options: '[]',
        order_index: 7
      }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO form_fields (id, label, type, placeholder, required, options, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const field of defaultFields) {
      insertStmt.run(
        field.id,
        field.label,
        field.type,
        field.placeholder,
        field.required,
        field.options,
        field.order_index
      );
    }
  }
}

initDb();

module.exports = {
  db,
  // Helper queries
  getFormSettings: () => {
    return db.prepare('SELECT * FROM form_settings WHERE id = 1').get();
  },
  updateFormSettings: (title, description, is_active) => {
    db.prepare(`
      UPDATE form_settings 
      SET title = ?, description = ?, is_active = ?, updated_at = ?
      WHERE id = 1
    `).run(title, description, is_active ? 1 : 0, new Date().toISOString());
  },
  getFormFields: () => {
    const fields = db.prepare('SELECT * FROM form_fields ORDER BY order_index ASC').all();
    return fields.map(f => ({
      ...f,
      required: Boolean(f.required),
      options: JSON.parse(f.options || '[]')
    }));
  },
  saveFormFields: (fields) => {
    db.exec('DELETE FROM form_fields');
    const insertStmt = db.prepare(`
      INSERT INTO form_fields (id, label, type, placeholder, required, options, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    fields.forEach((f, idx) => {
      const fieldId = f.id || `field_${Date.now()}_${idx}`;
      const optionsStr = typeof f.options === 'string' ? f.options : JSON.stringify(f.options || []);
      insertStmt.run(
        fieldId,
        f.label || 'শিরোনামহীন ফিল্ড',
        f.type || 'text',
        f.placeholder || '',
        f.required ? 1 : 0,
        optionsStr,
        idx + 1
      );
    });
  },
  createSubmission: (data) => {
    // Generate a unique human-friendly code
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const submission_code = `REG-${dateStr}-${randomSuffix}`;

    // Extract a representative name for summary
    let summary_name = '';
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === 'string' && val.trim().length > 0 && !summary_name) {
        summary_name = val.trim();
      }
    }

    const stmt = db.prepare(`
      INSERT INTO submissions (submission_code, data, summary_name, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(submission_code, JSON.stringify(data), summary_name, new Date().toISOString());

    return {
      id: Number(result.lastInsertRowid),
      submission_code,
      summary_name,
      created_at: new Date().toISOString()
    };
  },
  getSubmissions: (limit = 200, offset = 0) => {
    const rows = db.prepare(`
      SELECT * FROM submissions 
      ORDER BY id DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM submissions').get().count;

    return {
      total,
      submissions: rows.map(r => ({
        id: r.id,
        submission_code: r.submission_code,
        summary_name: r.summary_name,
        data: JSON.parse(r.data || '{}'),
        created_at: r.created_at
      }))
    };
  },
  getSubmissionById: (id) => {
    const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id,
      submission_code: row.submission_code,
      summary_name: row.summary_name,
      data: JSON.parse(row.data || '{}'),
      created_at: row.created_at
    };
  },
  deleteSubmission: (id) => {
    return db.prepare('DELETE FROM submissions WHERE id = ?').run(id);
  },
  getStats: () => {
    const totalSubmissions = db.prepare('SELECT COUNT(*) as count FROM submissions').get().count;
    const today = new Date().toISOString().slice(0, 10);
    const todaySubmissions = db.prepare(`
      SELECT COUNT(*) as count FROM submissions WHERE created_at LIKE ?
    `).get(`${today}%`).count;
    const settings = db.prepare('SELECT is_active FROM form_settings WHERE id = 1').get();
    const fieldsCount = db.prepare('SELECT COUNT(*) as count FROM form_fields').get().count;

    return {
      totalSubmissions,
      todaySubmissions,
      isActive: Boolean(settings?.is_active),
      fieldsCount
    };
  }
};
