-- Migration: Add persistent memory system
-- Applied to SQLite (server/db.js) on startup
-- This file documents the schema for reference

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

-- Categories: preference, portfolio, trading, personal, strategy, general
-- Sources: chat (auto from conversation), chat_extraction (AI-extracted),
--          user_explicit (user said "remember this"), trade (from swap),
--          heartbeat (from heartbeat events), test (testing)

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

-- Event types: chat, chat_skill, trade, heartbeat, alert, dca, park, order

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_memory_wallet ON agent_memory(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(wallet_address, category);
CREATE INDEX IF NOT EXISTS idx_agent_daily_log_wallet ON agent_daily_log(wallet_address, date);
