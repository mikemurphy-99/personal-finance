const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'finance.db');

let db = null;

function save() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Schema
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'checking',
      starting_balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      category_id TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      description TEXT,
      payee TEXT,
      date TEXT NOT NULL,
      reconciled INTEGER NOT NULL DEFAULT 0,
      recurring_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (recurring_id) REFERENCES recurring(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS recurring (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id TEXT,
      account_id TEXT,
      type TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('income', 'expense', 'transfer')),
      frequency TEXT NOT NULL DEFAULT 'monthly',
      due_date TEXT,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
    );
  `);

  // Migrations for existing databases
  try {
    const txCols = all("PRAGMA table_info(transactions)");
    const txColNames = txCols.map(c => c.name);
    if (!txColNames.includes('payee')) {
      run("ALTER TABLE transactions ADD COLUMN payee TEXT");
    }
    if (!txColNames.includes('reconciled')) {
      run("ALTER TABLE transactions ADD COLUMN reconciled INTEGER NOT NULL DEFAULT 0");
    }
    if (!txColNames.includes('transfer_id')) {
      run("ALTER TABLE transactions ADD COLUMN transfer_id TEXT");
    }

    const recCols = all("PRAGMA table_info(recurring)");
    const recColNames = recCols.map(c => c.name);
    if (!recColNames.includes('due_date')) {
      run("ALTER TABLE recurring ADD COLUMN due_date TEXT");
    }
    if (!recColNames.includes('freq_count')) {
      run("ALTER TABLE recurring ADD COLUMN freq_count INTEGER DEFAULT 1");
    }
    if (!recColNames.includes('freq_unit')) {
      run("ALTER TABLE recurring ADD COLUMN freq_unit TEXT DEFAULT 'month'");
    }
    if (!recColNames.includes('to_account_id')) {
      run("ALTER TABLE recurring ADD COLUMN to_account_id TEXT");
    }
    if (!recColNames.includes('end_date')) {
      run("ALTER TABLE recurring ADD COLUMN end_date TEXT");
    }
    if (!recColNames.includes('one_time')) {
      run("ALTER TABLE recurring ADD COLUMN one_time INTEGER DEFAULT 0");
    }

    // Allow 'transfer' type on recurring (recreate table if needed)
    const tableSql = get("SELECT sql FROM sqlite_master WHERE type='table' AND name='recurring'");
    if (tableSql && tableSql.sql && !tableSql.sql.includes("'transfer'")) {
      run("ALTER TABLE recurring RENAME TO recurring_old");
      run(`
        CREATE TABLE recurring (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          category_id TEXT,
          account_id TEXT,
          to_account_id TEXT,
          type TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('income', 'expense', 'transfer')),
          frequency TEXT NOT NULL DEFAULT 'monthly',
          due_date TEXT,
          notes TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          freq_count INTEGER DEFAULT 1,
          freq_unit TEXT DEFAULT 'month',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
        )
      `);
      run(`
        INSERT INTO recurring (id, name, amount, category_id, account_id, to_account_id, type, frequency, due_date, notes, active, freq_count, freq_unit, created_at)
        SELECT id, name, amount, category_id, account_id, to_account_id, type, frequency, due_date, notes, active, 
               COALESCE(freq_count, 1), COALESCE(freq_unit, 'month'), created_at
        FROM recurring_old
      `);
      run("DROP TABLE recurring_old");
      console.log('Migrated recurring table to allow transfer type');
    }
  } catch (e) {
    console.log('Migration note:', e.message);
  }

  // Seed if empty
  const countRow = get('SELECT COUNT(*) as count FROM accounts');
  if (!countRow || countRow.count === 0) {
    const checkingId = uuidv4();
    const creditId = uuidv4();

    run(`INSERT INTO accounts (id, name, type, starting_balance) VALUES (?, ?, ?, ?)`,
      [checkingId, 'Checking', 'checking', 0]);
    run(`INSERT INTO accounts (id, name, type, starting_balance) VALUES (?, ?, ?, ?)`,
      [creditId, 'Credit Card', 'credit', 0]);

    const defaultCategories = [
      { name: 'Salary', type: 'income' },
      { name: 'Freelance', type: 'income' },
      { name: 'Other Income', type: 'income' },
      { name: 'Groceries', type: 'expense' },
      { name: 'Rent/Mortgage', type: 'expense' },
      { name: 'Utilities', type: 'expense' },
      { name: 'Transportation', type: 'expense' },
      { name: 'Dining Out', type: 'expense' },
      { name: 'Entertainment', type: 'expense' },
      { name: 'Healthcare', type: 'expense' },
      { name: 'Subscriptions', type: 'expense' },
      { name: 'Shopping', type: 'expense' },
      { name: 'Other Expense', type: 'expense' },
    ];

    for (const cat of defaultCategories) {
      run(`INSERT INTO categories (id, name, type) VALUES (?, ?, ?)`,
        [uuidv4(), cat.name, cat.type]);
    }

    console.log('Database seeded with default accounts and categories');
  }

  console.log('Database ready');
  return { run, get, all, save, db };
}

module.exports = { init };
