/**
 * SQLite database setup for x402 credit system.
 * Uses better-sqlite3 for synchronous, fast operations.
 */
const Database = require('better-sqlite3');
const path = require('path');

// Database file stored in server directory
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'openseeker.db');

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // Better performance for concurrent reads

console.log(`[DB] SQLite database initialized at ${DB_PATH}`);

// Create tables if they don't exist
db.exec(`
  -- Users table: tracks wallet balances
  CREATE TABLE IF NOT EXISTS users (
    wallet_address TEXT PRIMARY KEY,
    balance_usdc REAL DEFAULT 0,
    total_deposited REAL DEFAULT 0,
    total_spent REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Deposits table: tracks USDC deposits for reconciliation
  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    tx_signature TEXT UNIQUE NOT NULL,
    amount_usdc REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    FOREIGN KEY (wallet_address) REFERENCES users(wallet_address)
  );

  -- Spend log: tracks all API usage
  CREATE TABLE IF NOT EXISTS spend_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    amount_usdc REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_address) REFERENCES users(wallet_address)
  );

  -- Create indexes for faster queries
  CREATE INDEX IF NOT EXISTS idx_deposits_wallet ON deposits(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
  CREATE INDEX IF NOT EXISTS idx_spend_log_wallet ON spend_log(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_spend_log_created ON spend_log(created_at);
`);

console.log('[DB] Tables created/verified');

// Prepared statements for common operations
const statements = {
  // Users
  getUser: db.prepare('SELECT * FROM users WHERE wallet_address = ?'),
  createUser: db.prepare('INSERT OR IGNORE INTO users (wallet_address) VALUES (?)'),
  updateBalance: db.prepare(`
    UPDATE users
    SET balance_usdc = balance_usdc + ?,
        total_deposited = total_deposited + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE wallet_address = ?
  `),
  deductBalance: db.prepare(`
    UPDATE users
    SET balance_usdc = balance_usdc - ?,
        total_spent = total_spent + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE wallet_address = ?
  `),

  // Deposits
  getDeposit: db.prepare('SELECT * FROM deposits WHERE tx_signature = ?'),
  createDeposit: db.prepare(`
    INSERT INTO deposits (wallet_address, tx_signature, amount_usdc, status, confirmed_at)
    VALUES (?, ?, ?, 'confirmed', CURRENT_TIMESTAMP)
  `),

  // Spend log
  logSpend: db.prepare(`
    INSERT INTO spend_log (wallet_address, endpoint, amount_usdc)
    VALUES (?, ?, ?)
  `),
  getSpendStats: db.prepare(`
    SELECT
      SUM(amount_usdc) as total,
      COUNT(*) as count
    FROM spend_log
    WHERE wallet_address = ? AND created_at >= ?
  `),
};

// Helper functions
function getOrCreateUser(walletAddress) {
  statements.createUser.run(walletAddress);
  return statements.getUser.get(walletAddress);
}

function getUser(walletAddress) {
  return statements.getUser.get(walletAddress);
}

function creditDeposit(walletAddress, txSignature, amount) {
  // Check if tx already processed
  const existing = statements.getDeposit.get(txSignature);
  if (existing) {
    return { success: false, error: 'Transaction already processed' };
  }

  // Credit balance and record deposit in a transaction
  const creditTx = db.transaction(() => {
    statements.createUser.run(walletAddress);
    statements.updateBalance.run(amount, amount, walletAddress);
    statements.createDeposit.run(walletAddress, txSignature, amount);
  });

  creditTx();
  console.log(`[DB] Credited $${amount} to ${walletAddress.slice(0, 8)}... (tx: ${txSignature.slice(0, 8)}...)`);
  return { success: true };
}

function deductSpend(walletAddress, endpoint, amount) {
  const user = getOrCreateUser(walletAddress);

  if (user.balance_usdc < amount) {
    return {
      success: false,
      error: 'Insufficient balance',
      balance: user.balance_usdc,
    };
  }

  const deductTx = db.transaction(() => {
    statements.deductBalance.run(amount, amount, walletAddress);
    statements.logSpend.run(walletAddress, endpoint, amount);
  });

  deductTx();
  return { success: true, newBalance: user.balance_usdc - amount };
}

function getSpendStats(walletAddress, since) {
  return statements.getSpendStats.get(walletAddress, since.toISOString());
}

module.exports = {
  db,
  getUser,
  getOrCreateUser,
  creditDeposit,
  deductSpend,
  getSpendStats,
};
