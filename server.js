const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Specific route for Admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API Routes

// 1. Get Form Configuration (Public & Admin)
app.get('/api/form-config', (req, res) => {
  try {
    const settings = db.getFormSettings();
    const fields = db.getFormFields();
    res.json({
      success: true,
      settings: {
        title: settings.title,
        description: settings.description,
        is_active: Boolean(settings.is_active),
        updated_at: settings.updated_at
      },
      fields
    });
  } catch (err) {
    console.error('Error fetching form config:', err);
    res.status(500).json({ success: false, message: 'ফর্মের কনফিগারেশন লোড করা সম্ভব হয়নি।' });
  }
});

// 2. Save Form Configuration (Admin)
app.post('/api/form-config', (req, res) => {
  try {
    const { title, description, is_active, fields } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ success: false, message: 'ফর্মের শিরোনাম দিন।' });
    }

    // Update settings
    db.updateFormSettings(title.trim(), (description || '').trim(), Boolean(is_active));

    // Update fields if provided
    if (Array.isArray(fields)) {
      db.saveFormFields(fields);
    }

    res.json({
      success: true,
      message: 'ফর্মের সেটিংস ও ফিল্ডসমূহ সফলভাবে আপডেট করা হয়েছে।'
    });
  } catch (err) {
    console.error('Error saving form config:', err);
    res.status(500).json({ success: false, message: 'ফর্ম সংরক্ষণ করতে সমস্যা হয়েছে।' });
  }
});

// 3. Submit an Application (Public User)
app.post('/api/submissions', (req, res) => {
  try {
    const settings = db.getFormSettings();
    if (!settings.is_active) {
      return res.status(403).json({
        success: false,
        message: 'দুঃখিত, এই ফর্মটিতে বর্তমানে নতুন আবেদন গ্রহণ সাময়িকভাবে বন্ধ রয়েছে।'
      });
    }

    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: 'সঠিক তথ্য প্রদান করুন।' });
    }

    // Validate required fields
    const fields = db.getFormFields();
    const missingFields = [];

    for (const field of fields) {
      if (field.required) {
        const val = data[field.id];
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
          missingFields.push(field.label);
        }
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `অনুগ্রহ করে আবশ্যক ফিল্ডগুলো পূরণ করুন: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    const result = db.createSubmission(data);

    res.status(201).json({
      success: true,
      message: 'আপনার আবেদন সফলভাবে গৃহীত হয়েছে!',
      submission_code: result.submission_code,
      id: result.id,
      created_at: result.created_at
    });
  } catch (err) {
    console.error('Error submitting application:', err);
    res.status(500).json({ success: false, message: 'আবেদন প্রক্রিয়াকরণে সমস্যা দেখা দিয়েছে।' });
  }
});

// 4. Get Submissions List & Stats (Admin)
app.get('/api/submissions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 500;
    const offset = parseInt(req.query.offset, 10) || 0;
    const search = (req.query.search || '').trim().toLowerCase();

    const data = db.getSubmissions(limit, offset);
    const stats = db.getStats();
    const fields = db.getFormFields();

    let filteredList = data.submissions;
    if (search) {
      filteredList = filteredList.filter(item => {
        if (item.submission_code.toLowerCase().includes(search)) return true;
        if (item.summary_name && item.summary_name.toLowerCase().includes(search)) return true;
        // Search inside any field value
        return Object.values(item.data).some(v => 
          typeof v === 'string' && v.toLowerCase().includes(search)
        );
      });
    }

    res.json({
      success: true,
      stats,
      fields,
      total: search ? filteredList.length : data.total,
      submissions: filteredList
    });
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ success: false, message: 'আবেদনসমূহ আনতে সমস্যা হয়েছে।' });
  }
});

// 5. Get Single Submission Details (Admin)
app.get('/api/submissions/:id', (req, res) => {
  try {
    const item = db.getSubmissionById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'আবেদনটি খুঁজে পাওয়া যায়নি।' });
    }
    const fields = db.getFormFields();
    res.json({ success: true, submission: item, fields });
  } catch (err) {
    console.error('Error fetching submission detail:', err);
    res.status(500).json({ success: false, message: 'তথ্য লোড করতে সমস্যা হয়েছে।' });
  }
});

// 6. Delete Submission (Admin)
app.delete('/api/submissions/:id', (req, res) => {
  try {
    db.deleteSubmission(req.params.id);
    res.json({ success: true, message: 'আবেদনটি সফলভাবে মুছে ফেলা হয়েছে।' });
  } catch (err) {
    console.error('Error deleting submission:', err);
    res.status(500).json({ success: false, message: 'আবেদনটি মুছতে সমস্যা হয়েছে।' });
  }
});

// 7. Export Submissions to CSV (Admin)
app.get('/api/export/csv', (req, res) => {
  try {
    const data = db.getSubmissions(10000, 0);
    const fields = db.getFormFields();

    // Prepare CSV header
    const headers = ['ক্রমিক (SL)', 'আবেদন কোড (Code)', 'তারিখ ও সময় (Date)'];
    fields.forEach(f => headers.push(`"${f.label.replace(/"/g, '""')}"`));

    const rows = [headers.join(',')];

    data.submissions.forEach((sub, index) => {
      const row = [
        index + 1,
        `"${sub.submission_code}"`,
        `"${new Date(sub.created_at).toLocaleString('bn-BD')}"`
      ];

      fields.forEach(f => {
        let val = sub.data[f.id];
        if (val === undefined || val === null) val = '';
        if (Array.isArray(val)) val = val.join(', ');
        const cleanVal = String(val).replace(/"/g, '""');
        row.push(`"${cleanVal}"`);
      });

      rows.push(row.join(','));
    });

    // Add UTF-8 BOM (\uFEFF) for Excel Bengali character compatibility
    const csvContent = '\uFEFF' + rows.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="applications_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    res.status(500).send('CSV এক্সপোর্ট করতে সমস্যা হয়েছে।');
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Form Application Server running on port ${PORT}`);
  console.log(`📋 Public User Form:  http://localhost:${PORT}`);
  console.log(`⚙️  Admin Dashboard:   http://localhost:${PORT}/admin`);
  console.log(`===============================================`);
});
