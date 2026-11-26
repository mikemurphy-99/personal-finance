const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { init } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let dbApi = null;

// Serve frontend static files
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// ========== ACCOUNTS ==========
app.get('/api/accounts', (req, res) => {
  try {
    const accounts = dbApi.all(`
      SELECT a.*,
        COALESCE(
          a.starting_balance + 
          COALESCE((SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) 
                    FROM transactions WHERE account_id = a.id), 0)
        , a.starting_balance) as current_balance
      FROM accounts a
      ORDER BY a.name
    `);
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts', (req, res) => {
  try {
    const { name, type = 'checking', starting_balance = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const id = uuidv4();
    dbApi.run(`
      INSERT INTO accounts (id, name, type, starting_balance)
      VALUES (?, ?, ?, ?)
    `, [id, name, type, starting_balance]);

    const account = dbApi.get('SELECT * FROM accounts WHERE id = ?', [id]);
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/accounts/:id', (req, res) => {
  try {
    const { name, type, starting_balance } = req.body;
    const existing = dbApi.get('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Account not found' });

    dbApi.run(`
      UPDATE accounts SET 
        name = ?, 
        type = ?,
        starting_balance = ?
      WHERE id = ?
    `, [
      name ?? existing.name,
      type ?? existing.type,
      starting_balance ?? existing.starting_balance,
      req.params.id
    ]);

    const account = dbApi.get('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/accounts/:id', (req, res) => {
  try {
    const existing = dbApi.get('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Account not found' });
    dbApi.run('DELETE FROM accounts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CATEGORIES ==========
app.get('/api/categories', (req, res) => {
  try {
    const categories = dbApi.all('SELECT * FROM categories ORDER BY type, name');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Name and type required' });

    const id = uuidv4();
    dbApi.run('INSERT INTO categories (id, name, type) VALUES (?, ?, ?)', [id, name, type]);
    const category = dbApi.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json(category);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const existing = dbApi.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Category not found' });
    dbApi.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== TRANSACTIONS ==========
app.get('/api/transactions', (req, res) => {
  try {
    const { account_id, limit = 100 } = req.query;
    let sql = `
      SELECT t.*, c.name as category_name, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
    `;
    const params = [];

    if (account_id) {
      sql += ' WHERE t.account_id = ?';
      params.push(account_id);
    }

    sql += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ?';
    params.push(Number(limit));

    const transactions = dbApi.all(sql, params);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', (req, res) => {
  try {
    const { account_id, category_id, amount, type, description, payee, date, recurring_id, reconciled } = req.body;

    if (!account_id || amount == null || !type || !date) {
      return res.status(400).json({ error: 'account_id, amount, type, and date are required' });
    }

    const id = uuidv4();
    dbApi.run(`
      INSERT INTO transactions (id, account_id, category_id, amount, type, description, payee, date, recurring_id, reconciled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, account_id, category_id || null, Math.abs(amount), type, description || null, payee || null, date, recurring_id || null, reconciled ? 1 : 0]);

    const transaction = dbApi.get(`
      SELECT t.*, c.name as category_name, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.id = ?
    `, [id]);

    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/transactions/:id', (req, res) => {
  try {
    const existing = dbApi.get('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });

    const { account_id, category_id, amount, type, description, payee, date, reconciled } = req.body;

    dbApi.run(`
      UPDATE transactions SET
        account_id = ?,
        category_id = ?,
        amount = ?,
        type = ?,
        description = ?,
        payee = ?,
        date = ?,
        reconciled = ?
      WHERE id = ?
    `, [
      account_id ?? existing.account_id,
      category_id !== undefined ? category_id : existing.category_id,
      amount != null ? Math.abs(amount) : existing.amount,
      type ?? existing.type,
      description !== undefined ? description : existing.description,
      payee !== undefined ? payee : existing.payee,
      date ?? existing.date,
      reconciled !== undefined ? (reconciled ? 1 : 0) : existing.reconciled,
      req.params.id
    ]);

    const transaction = dbApi.get(`
      SELECT t.*, c.name as category_name, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.id = ?
    `, [req.params.id]);

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', (req, res) => {
  try {
    const existing = dbApi.get('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });
    if (existing.transfer_id) {
      dbApi.run('DELETE FROM transactions WHERE transfer_id = ?', [existing.transfer_id]);
    } else {
      dbApi.run('DELETE FROM transactions WHERE id = ?', [req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== RECURRING ==========
app.get('/api/recurring', (req, res) => {
  try {
    const items = dbApi.all(`
      SELECT r.*, c.name as category_name, a.name as account_name
      FROM recurring r
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN accounts a ON r.account_id = a.id
      WHERE r.active = 1
      ORDER BY r.name
    `);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/recurring', (req, res) => {
  try {
    const { name, amount, category_id, account_id, to_account_id, type = 'expense', freq_count = 1, freq_unit = 'month', due_date, end_date, one_time } = req.body;

    if (!name || amount == null) {
      return res.status(400).json({ error: 'Name and amount are required' });
    }

    const id = uuidv4();
    dbApi.run(`
      INSERT INTO recurring (id, name, amount, category_id, account_id, to_account_id, type, freq_count, freq_unit, due_date, end_date, one_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, Math.abs(amount), category_id || null, account_id || null, to_account_id || null, type, freq_count || 1, freq_unit || 'month', due_date || null, end_date || null, one_time ? 1 : 0]);

    const item = dbApi.get(`
      SELECT r.*, c.name as category_name, a.name as account_name
      FROM recurring r
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN accounts a ON r.account_id = a.id
      WHERE r.id = ?
    `, [id]);

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/recurring/:id', (req, res) => {
  try {
    const existing = dbApi.get('SELECT * FROM recurring WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Recurring item not found' });

    const { name, amount, category_id, account_id, to_account_id, type, freq_count, freq_unit, active, due_date, end_date, one_time } = req.body;

    dbApi.run(`
      UPDATE recurring SET
        name = ?,
        amount = ?,
        category_id = ?,
        account_id = ?,
        to_account_id = ?,
        type = ?,
        freq_count = ?,
        freq_unit = ?,
        active = ?,
        due_date = ?,
        end_date = ?,
        one_time = ?
      WHERE id = ?
    `, [
      name ?? existing.name,
      amount != null ? Math.abs(amount) : existing.amount,
      category_id !== undefined ? category_id : existing.category_id,
      account_id !== undefined ? account_id : existing.account_id,
      to_account_id !== undefined ? to_account_id : existing.to_account_id,
      type ?? existing.type,
      freq_count ?? existing.freq_count,
      freq_unit ?? existing.freq_unit,
      active !== undefined ? active : existing.active,
      due_date !== undefined ? due_date : existing.due_date,
      end_date !== undefined ? end_date : existing.end_date,
      one_time !== undefined ? (one_time ? 1 : 0) : existing.one_time,
      req.params.id
    ]);

    const item = dbApi.get(`
      SELECT r.*, c.name as category_name, a.name as account_name
      FROM recurring r
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN accounts a ON r.account_id = a.id
      WHERE r.id = ?
    `, [req.params.id]);

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/recurring/:id', (req, res) => {
  try {
    const existing = dbApi.get('SELECT * FROM recurring WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Recurring item not found' });
    dbApi.run('UPDATE recurring SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post a recurring item as a transaction
app.post('/api/recurring/:id/post', (req, res) => {
  try {
    const { account_id, date } = req.body;

    const recurring = dbApi.get('SELECT * FROM recurring WHERE id = ? AND active = 1', [req.params.id]);
    if (!recurring) return res.status(404).json({ error: 'Recurring item not found' });

    const targetAccountId = account_id || recurring.account_id;
    if (!targetAccountId) {
      return res.status(400).json({ error: 'No account specified and recurring item has no default account' });
    }

    const txDate = date || new Date().toISOString().split('T')[0];
    let txId = null;

    if (recurring.type === 'transfer' && recurring.to_account_id) {
      const transferId = uuidv4();
      const desc = recurring.name || 'Transfer';
      txId = uuidv4();
      dbApi.run(`
        INSERT INTO transactions (id, account_id, amount, type, description, date, payee, transfer_id, recurring_id)
        VALUES (?, ?, ?, 'expense', ?, ?, 'Transfer', ?, ?)
      `, [txId, targetAccountId, recurring.amount, desc, txDate, transferId, recurring.id]);
      dbApi.run(`
        INSERT INTO transactions (id, account_id, amount, type, description, date, payee, transfer_id, recurring_id)
        VALUES (?, ?, ?, 'income', ?, ?, 'Transfer', ?, ?)
      `, [uuidv4(), recurring.to_account_id, recurring.amount, desc, txDate, transferId, recurring.id]);
    } else {
      txId = uuidv4();
      dbApi.run(`
        INSERT INTO transactions (id, account_id, category_id, amount, type, description, date, recurring_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        txId,
        targetAccountId,
        recurring.category_id,
        recurring.amount,
        recurring.type,
        recurring.name,
        txDate,
        recurring.id
      ]);
    }

    // Advance due date (unless one-time)
    if (recurring.due_date && !recurring.one_time) {
      const current = new Date(recurring.due_date + 'T00:00:00');
      const count = recurring.freq_count || 1;
      const unit = recurring.freq_unit || 'month';
      if (unit === 'day') current.setDate(current.getDate() + count);
      else if (unit === 'week') current.setDate(current.getDate() + count * 7);
      else if (unit === 'month') current.setMonth(current.getMonth() + count);
      else if (unit === 'year') current.setFullYear(current.getFullYear() + count);
      const next = current.toISOString().split('T')[0];

      // If next is past end_date, deactivate
      if (recurring.end_date && next > recurring.end_date) {
        dbApi.run('UPDATE recurring SET active = 0, due_date = ? WHERE id = ?', [next, recurring.id]);
      } else {
        dbApi.run('UPDATE recurring SET due_date = ? WHERE id = ?', [next, recurring.id]);
      }
    } else if (recurring.one_time) {
      dbApi.run('UPDATE recurring SET active = 0 WHERE id = ?', [recurring.id]);
    }

    const transaction = dbApi.get(`
      SELECT t.*, c.name as category_name, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.id = ?
    `, [txId]);

    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transfer between accounts
app.post('/api/transfers', (req, res) => {
  try {
    const { from_account_id, to_account_id, amount, date, description } = req.body;
    if (!from_account_id || !to_account_id || !amount || !date) {
      return res.status(400).json({ error: 'from_account_id, to_account_id, amount, and date required' });
    }
    if (from_account_id === to_account_id) {
      return res.status(400).json({ error: 'Cannot transfer to the same account' });
    }

    const transferId = uuidv4();
    const desc = description || 'Transfer';

    // Expense from source
    dbApi.run(`
      INSERT INTO transactions (id, account_id, amount, type, description, date, payee, transfer_id)
      VALUES (?, ?, ?, 'expense', ?, ?, 'Transfer', ?)
    `, [uuidv4(), from_account_id, Math.abs(amount), desc, date, transferId]);

    // Income to destination
    dbApi.run(`
      INSERT INTO transactions (id, account_id, amount, type, description, date, payee, transfer_id)
      VALUES (?, ?, ?, 'income', ?, ?, 'Transfer', ?)
    `, [uuidv4(), to_account_id, Math.abs(amount), desc, date, transferId]);

    res.status(201).json({ success: true, transferId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backup
app.get('/api/backup', (req, res) => {
  try {
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
    const dbPath = path.join(dataDir, 'finance.db');
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'No database' });
    res.download(dbPath, 'finance-backup.db');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore
const upload = multer({ storage: multer.memoryStorage() });
app.post('/api/restore', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
    const dbPath = path.join(dataDir, 'finance.db');
    fs.writeFileSync(dbPath, req.file.buffer);
    // Re-init db
    init().then(api => {
      dbApi = api;
      res.json({ success: true });
    }).catch(err => res.status(500).json({ error: err.message }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV Import for an account
app.post('/api/accounts/:id/import', (req, res) => {
  try {
    const accountId = req.params.id;
    const account = dbApi.get('SELECT * FROM accounts WHERE id = ?', [accountId]);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'csv text is required' });
    }

    const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
    let imported = 0;
    let skipped = 0;

    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length < 4) { skipped++; continue; }

      const dateRaw = parts[0].trim();
      const description = parts[1] ? parts[1].trim() : '';
      const expenseRaw = parts[2] ? parts[2].trim() : '';
      const incomeRaw = parts[3] ? parts[3].trim() : '';

      const dateMatch = dateRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!dateMatch) { skipped++; continue; }
      const [, m, d, y] = dateMatch;
      const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

      const expense = parseFloat(expenseRaw) || 0;
      const income = parseFloat(incomeRaw) || 0;

      let amount = 0;
      let type = 'expense';
      if (income > 0) {
        amount = income;
        type = 'income';
      } else if (expense > 0) {
        amount = expense;
        type = 'expense';
      } else {
        skipped++;
        continue;
      }

      const existing = dbApi.get(`
        SELECT id FROM transactions
        WHERE account_id = ? AND date = ? AND amount = ? AND (description = ? OR description IS NULL)
        LIMIT 1
      `, [accountId, date, amount, description || null]);

      if (existing) {
        skipped++;
        continue;
      }

      const id = uuidv4();
      dbApi.run(`
        INSERT INTO transactions (id, account_id, amount, type, description, date, reconciled)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `, [id, accountId, amount, type, description || null, date]);

      imported++;
    }

    res.json({ imported, skipped, total: lines.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) {
      res.status(404).json({ error: 'Frontend not built yet. Run the frontend build first.' });
    }
  });
});

// Start
init().then((api) => {
  dbApi = api;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Finance app running on http://0.0.0.0:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
