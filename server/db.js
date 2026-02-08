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

  -- Agent memory table: persistent facts about the user
  CREATE TABLE IF NOT EXISTS agent_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,
    source TEXT DEFAULT 'chat',
    confidence REAL DEFAULT 0.8,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Agent daily log: daily events and summaries
  CREATE TABLE IF NOT EXISTS agent_daily_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    date TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'event',
    content TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Free message tracking for x402 standard
  CREATE TABLE IF NOT EXISTS free_messages (
    wallet_address TEXT PRIMARY KEY,
    remaining INTEGER DEFAULT 100,
    total_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- x402 payment log (standard x402 protocol payments)
  CREATE TABLE IF NOT EXISTS x402_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT,
    endpoint TEXT NOT NULL,
    amount_usdc TEXT NOT NULL,
    tx_signature TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes for faster queries
  CREATE INDEX IF NOT EXISTS idx_deposits_wallet ON deposits(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
  CREATE INDEX IF NOT EXISTS idx_spend_log_wallet ON spend_log(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_spend_log_created ON spend_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_agent_memory_wallet ON agent_memory(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(wallet_address, category);
  CREATE INDEX IF NOT EXISTS idx_agent_daily_log_wallet ON agent_daily_log(wallet_address, date);
`);

// Add spirit_animal column if not exists
try {
  db.exec(`ALTER TABLE users ADD COLUMN spirit_animal TEXT DEFAULT NULL`);
  console.log('[DB] Added spirit_animal column to users');
} catch (e) {
  // Column already exists — ignore
}

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

  // Free messages
  getFreeMessages: db.prepare('SELECT * FROM free_messages WHERE wallet_address = ?'),
  createFreeMessages: db.prepare('INSERT OR IGNORE INTO free_messages (wallet_address) VALUES (?)'),
  decrementFreeMessages: db.prepare(`
    UPDATE free_messages
    SET remaining = remaining - 1,
        total_used = total_used + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE wallet_address = ? AND remaining > 0
  `),

  // x402 payment log
  logX402Payment: db.prepare(`
    INSERT INTO x402_payments (wallet_address, endpoint, amount_usdc, tx_signature)
    VALUES (?, ?, ?, ?)
  `),

  // Spirit animal
  setSpiritAnimal: db.prepare(`
    UPDATE users SET spirit_animal = ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_address = ?
  `),
  getSpiritAnimal: db.prepare(`
    SELECT spirit_animal FROM users WHERE wallet_address = ?
  `),

  // Agent memory
  getMemories: db.prepare(`
    SELECT * FROM agent_memory
    WHERE wallet_address = ?
    ORDER BY updated_at DESC
  `),
  getMemoriesByCategory: db.prepare(`
    SELECT * FROM agent_memory
    WHERE wallet_address = ? AND category = ?
    ORDER BY updated_at DESC
  `),
  insertMemory: db.prepare(`
    INSERT INTO agent_memory (wallet_address, category, content, source, confidence)
    VALUES (?, ?, ?, ?, ?)
  `),
  deleteMemory: db.prepare(`
    DELETE FROM agent_memory WHERE id = ? AND wallet_address = ?
  `),
  deleteMemoryByContent: db.prepare(`
    DELETE FROM agent_memory WHERE wallet_address = ? AND content LIKE ?
  `),
  countMemories: db.prepare(`
    SELECT COUNT(*) as count FROM agent_memory WHERE wallet_address = ?
  `),

  // Agent daily log
  getDailyLog: db.prepare(`
    SELECT * FROM agent_daily_log
    WHERE wallet_address = ? AND date = ?
    ORDER BY created_at ASC
  `),
  getRecentDailyLogs: db.prepare(`
    SELECT * FROM agent_daily_log
    WHERE wallet_address = ?
    ORDER BY created_at DESC
    LIMIT ?
  `),
  insertDailyEvent: db.prepare(`
    INSERT INTO agent_daily_log (wallet_address, date, event_type, content, metadata)
    VALUES (?, ?, ?, ?, ?)
  `),
  getDailySummary: db.prepare(`
    SELECT date, GROUP_CONCAT(content, ' | ') as events, COUNT(*) as event_count
    FROM agent_daily_log
    WHERE wallet_address = ? AND date >= ?
    GROUP BY date
    ORDER BY date DESC
  `),
};

// Helper functions
// Free tier: new wallets get $0.20 (100 messages at $0.002 each)
const FREE_TIER_CREDIT = 0.20;

function getOrCreateUser(walletAddress) {
  const existing = statements.getUser.get(walletAddress);
  if (existing) return existing;

  // New user — create with free tier credit
  statements.createUser.run(walletAddress);
  statements.updateBalance.run(FREE_TIER_CREDIT, FREE_TIER_CREDIT, walletAddress);
  console.log(`[DB] New user ${walletAddress.slice(0, 8)}... — credited $${FREE_TIER_CREDIT} free tier (100 messages)`);
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

// === Free message functions ===

function getFreeMessagesRemaining(walletAddress) {
  statements.createFreeMessages.run(walletAddress);
  const row = statements.getFreeMessages.get(walletAddress);
  return row ? row.remaining : 0;
}

function decrementFreeMessages(walletAddress) {
  statements.createFreeMessages.run(walletAddress);
  const result = statements.decrementFreeMessages.run(walletAddress);
  return result.changes > 0;
}

function logX402Payment(walletAddress, endpoint, amountUsdc, txSignature) {
  statements.logX402Payment.run(walletAddress || '', endpoint, amountUsdc, txSignature || '');
}

// === Spirit animal functions ===

function setSpiritAnimal(walletAddress, animal) {
  getOrCreateUser(walletAddress);
  statements.setSpiritAnimal.run(animal, walletAddress);
  return { success: true };
}

function getSpiritAnimal(walletAddress) {
  const row = statements.getSpiritAnimal.get(walletAddress);
  return row ? row.spirit_animal : null;
}

// === Memory functions ===

function getMemories(walletAddress, category) {
  if (category) {
    return statements.getMemoriesByCategory.all(walletAddress, category);
  }
  return statements.getMemories.all(walletAddress);
}

function saveMemory(walletAddress, content, category = 'general', source = 'chat', confidence = 0.8) {
  statements.insertMemory.run(walletAddress, category, content, source, confidence);
  return { success: true };
}

function deleteMemory(walletAddress, memoryId) {
  const result = statements.deleteMemory.run(memoryId, walletAddress);
  return { success: result.changes > 0 };
}

function deleteMemoryByContent(walletAddress, searchTerm) {
  const result = statements.deleteMemoryByContent.run(walletAddress, `%${searchTerm}%`);
  return { success: true, deleted: result.changes };
}

function getMemoryCount(walletAddress) {
  const row = statements.countMemories.get(walletAddress);
  return row ? row.count : 0;
}

function getDailyLog(walletAddress, date) {
  return statements.getDailyLog.all(walletAddress, date);
}

function getRecentDailyLogs(walletAddress, limit = 50) {
  return statements.getRecentDailyLogs.all(walletAddress, limit);
}

function appendDailyEvent(walletAddress, eventType, content, metadata = null) {
  const today = new Date().toISOString().split('T')[0];
  statements.insertDailyEvent.run(
    walletAddress,
    today,
    eventType,
    content,
    metadata ? JSON.stringify(metadata) : null,
  );
  return { success: true };
}

function getDailySummaries(walletAddress, sinceDaysAgo = 7) {
  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);
  const sinceStr = since.toISOString().split('T')[0];
  return statements.getDailySummary.all(walletAddress, sinceStr);
}

module.exports = {
  db,
  getUser,
  getOrCreateUser,
  creditDeposit,
  deductSpend,
  getSpendStats,
  // Free messages (x402 standard)
  getFreeMessagesRemaining,
  decrementFreeMessages,
  logX402Payment,
  // Spirit animal
  setSpiritAnimal,
  getSpiritAnimal,
  // Memory
  getMemories,
  saveMemory,
  deleteMemory,
  deleteMemoryByContent,
  getMemoryCount,
  getDailyLog,
  getRecentDailyLogs,
  appendDailyEvent,
  getDailySummaries,
};
