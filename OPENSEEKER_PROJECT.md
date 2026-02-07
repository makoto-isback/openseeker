# OpenSeeker — Project Architecture Document

> **"Same brain. Different hands."**
> OpenClaw handles productivity. OpenSeeker handles crypto.

---

## 1. Project Overview

**OpenSeeker** is a crypto-native AI companion app for the Solana Seeker phone. It adapts the 7 architectural pillars of OpenClaw (persistent memory, heartbeat, soul, skills, cron jobs, channels, self-improvement) into a mobile-first crypto agent powered by x402 micropayments.

### Core Value Proposition

| For Users | For You (Developer) |
|-----------|-------------------|
| AI companion that watches your portfolio 24/7 | 50-75% margin on every AI request |
| No monthly subscription — pay per use ($0.002/msg) | Zero infrastructure cost at launch |
| Learns your trading style over time | Scales with users automatically |
| Proactive alerts via heartbeat system | Community skills = free feature development |
| Native Seed Vault wallet integration | x402 = no payment processing overhead |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native (Expo) |
| Local Storage | AsyncStorage |
| Cloud Backup | Supabase (Postgres + Auth) |
| Server | Express.js + x402 middleware |
| AI Providers | Groq Llama 3.3-70b-versatile (fallback: 3.1-8b-instant) |
| Blockchain | Solana (mainnet) |
| DEX | Jupiter API |
| Wallet | Embedded (expo-secure-store + tweetnacl) / Privy SDK |
| Payments | x402 protocol (USDC micropayments) |

---

## 2. The 7 Pillars — Detailed Architecture

### Pillar 1: Persistent Memory

The memory system is the brain of OpenSeeker. It stores context across sessions so the agent remembers who you are, what you hold, and how you trade.

#### File Structure

```
MEMORY SYSTEM (on-device):
├── SOUL.md        → Agent personality + rules (user-editable)
├── MEMORY.md      → Long-term facts about the user
├── DAILY.md       → Today's append-only journal/log
├── WALLET.md      → Portfolio state, trade history, preferences
└── CONTEXT.md     → Compressed session summaries (auto-generated)
```

#### Storage Strategy (Hybrid)

```
┌─────────────────────────────────────────────────┐
│                ON-DEVICE (AsyncStorage)          │
│                                                  │
│  Raw chat messages (full history)                │
│  SOUL.md / MEMORY.md / DAILY.md / WALLET.md     │
│  Session state + temp data                       │
│  Skill configs + user preferences                │
│                                                  │
│  WHY: Fast access, zero cost, privacy-first      │
└──────────────────────┬──────────────────────────┘
                       │ Sync (compressed only)
                       ▼
┌─────────────────────────────────────────────────┐
│              SUPABASE (Cloud Backup)             │
│                                                  │
│  MEMORY.md snapshots (daily)                     │
│  WALLET.md snapshots (after trades)              │
│  Compressed daily summaries (not raw messages)   │
│  User auth + device linking                      │
│                                                  │
│  WHY: Backup, device migration, sync             │
│  COST: Free tier (500MB = ~500K summaries)       │
└─────────────────────────────────────────────────┘
```

#### Memory Update Flow

```
User sends message
       │
       ▼
AI processes + responds
       │
       ▼
Memory Engine runs:
├── Extract facts → append to MEMORY.md
│   e.g. "User bought 100 WIF at $2.30 on 2026-02-05"
│
├── Update WALLET.md → if trade/balance changed
│   e.g. holdings, P&L, avg entry prices
│
├── Append to DAILY.md → timestamped log entry
│   e.g. "[14:32] Asked about WIF. Executed swap."
│
└── Context compression (every 20 messages):
    → Summarize last 20 messages into 2-3 sentences
    → Append summary to CONTEXT.md
    → Raw messages stay in AsyncStorage
    → Only summaries sync to Supabase
```

#### MEMORY.md Schema

```markdown
# User Memory

## Identity
- Name: [extracted from conversation]
- Timezone: [detected or stated]
- Language preference: [detected]

## Trading Profile
- Risk tolerance: [conservative/moderate/degen]
- Favorite tokens: [WIF, JUP, PYTH, ...]
- Trading style: [memecoin degen / DeFi farmer / long-term holder]
- Average trade size: [0.5 SOL]
- Best trade: [WIF +45% on 2026-01-15]
- Worst trade: [BONK -20% on 2026-01-20]

## Patterns (AI-updated)
- Tends to buy memecoins on dips
- Better at memecoins than DeFi tokens
- Usually takes profit at 30-50%
- Holds losers too long (noted 3 times)

## Preferences
- Morning briefing: ON (7:00 AM)
- Night summary: ON (10:00 PM)
- Alert threshold: 5% price move
- Whale tracking: ON (wallets: [...])
- Auto-DCA: 0.1 SOL → JUP daily

## Important Dates
- Started using OpenSeeker: 2026-02-05
- Total trades: 47
- Win rate: 62%
```

#### WALLET.md Schema

```markdown
# Wallet State

## Holdings
| Token | Amount | Avg Entry | Current | P&L |
|-------|--------|-----------|---------|-----|
| SOL   | 12.5   | $165.00   | $178.50 | +8.2% |
| WIF   | 500    | $2.30     | $2.58   | +12.2% |
| JUP   | 200    | $1.85     | $1.83   | -1.1% |
| USDC  | 150.00 | -         | -       | - |

## Active Automations
- DCA: 0.1 SOL → JUP every 24h
- Alert: WIF > $3.00 → notify
- Alert: SOL < $160 → notify

## Recent Trades
- 2026-02-05 14:32 — Bought 100 WIF @ $2.30 (0.5 SOL)
- 2026-02-04 09:15 — Sold 50 BONK @ $0.00003 (-20%)
- 2026-02-03 19:45 — DCA executed: 0.1 SOL → JUP
```

---

### Pillar 2: Heartbeat Engine

The heartbeat is what makes OpenSeeker feel alive. It wakes periodically, checks conditions, and acts if needed.

#### Heartbeat Architecture

```
┌─────────────────────────────────────────────────┐
│              HEARTBEAT ENGINE                    │
│              Interval: 30 minutes                │
│                                                  │
│  Each tick:                                      │
│  ┌───────────────────────────────────────────┐  │
│  │ 1. PORTFOLIO CHECK                        │  │
│  │    → Fetch current prices (CoinGecko)     │  │
│  │    → Compare to WALLET.md state           │  │
│  │    → Calculate total value change          │  │
│  │    → Flag if >5% change                    │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ 2. ALERT CHECK                            │  │
│  │    → Loop through active alerts            │  │
│  │    → Check price conditions                │  │
│  │    → Check whale wallet movements          │  │
│  │    → Check volume anomalies                │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ 3. AUTOMATION CHECK                       │  │
│  │    → Check DCA schedules                   │  │
│  │    → Check time-based triggers             │  │
│  │    → Execute pending commands              │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ 4. DECISION                               │  │
│  │    → Nothing important? → HEARTBEAT_OK    │  │
│  │    → Something triggered? → Push notif     │  │
│  │    → Trade needed? → Confirm with user     │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  Cost: $0.002 per heartbeat (x402)              │
│  Daily cost: 48 beats × $0.002 = $0.096/day    │
│  Monthly cost: ~$2.88/user                       │
└─────────────────────────────────────────────────┘
```

#### Heartbeat Implementation

```
// Heartbeat flow (pseudo-code)
async function heartbeat() {
  // 1. Gather state
  const wallet = await readFile('WALLET.md')
  const memory = await readFile('MEMORY.md')
  const alerts = parseAlerts(memory)

  // 2. Check external data
  const prices = await fetchPrices(wallet.tokens)    // CoinGecko
  const whales = await checkWhaleWallets(memory)      // Solscan
  const changes = calculateChanges(wallet, prices)

  // 3. Build heartbeat context
  const context = {
    portfolio_change: changes.totalPercent,
    triggered_alerts: alerts.filter(a => a.triggered),
    whale_moves: whales.filter(w => w.significant),
    pending_automations: getDueAutomations()
  }

  // 4. If nothing interesting, stay silent
  if (context is all empty) return 'HEARTBEAT_OK'

  // 5. If something triggered, call AI for response
  const response = await x402Call('/heartbeat', {
    soul: readFile('SOUL.md'),
    memory: memory,
    context: context
  })

  // 6. Send push notification
  await sendPushNotification(response.message)

  // 7. Log to DAILY.md
  await appendToDaily(`[HEARTBEAT] ${response.summary}`)
}
```

#### Smart Suppression

```
SUPPRESSION RULES:
├── Portfolio change < 2%        → Silent
├── No alerts triggered          → Silent
├── No whale activity            → Silent
├── No pending automations       → Silent
├── User is actively chatting    → Skip (already engaged)
├── User set DND mode            → Queue for later
│
├── Portfolio change > 5%        → NOTIFY
├── Alert triggered              → NOTIFY
├── Whale moved >$100K of token  → NOTIFY
├── DCA execution needed         → EXECUTE + LOG
└── Multiple triggers            → COMBINE into 1 notification
```

---

### Pillar 3: Soul System

The Soul defines who the AI agent IS. It's the personality layer that makes each user's agent unique.

#### SOUL.md Default Template

```markdown
# Soul Configuration

## Identity
name: "DegenCat"
avatar: "🐱"
tagline: "Your crypto-obsessed AI companion"

## Personality
tone: degen
humor: high
emoji_usage: moderate
slang: [ser, LFG, wagmi, gm, ngmi, wen, fren]

## Behavior Rules
- Never spend more than owner-approved amounts
- Always warn about potential rug pulls
- Be honest about losses, never sugarcoat
- Celebrate wins enthusiastically
- If unsure, say so — never fake confidence
- Protect owner's money above all else
- Ask for confirmation before any trade >1 SOL

## Response Style
- Short and punchy for simple questions
- Detailed with data for analysis requests
- Use charts/numbers when discussing prices
- Include risk warnings on speculative tokens

## Catchphrases
morning: "☀️ Gm ser! Let's get this bread."
profit: "🔥 We're so back! LFG!"
loss: "📉 Pain. But we'll recover, fren."
alert: "🚨 Yo ser, you need to see this."
goodnight: "😎 Sleep well. I'll watch the charts."
```

#### Soul Customization (User-Editable)

```
PRESET PERSONALITIES:
├── 🐱 DegenCat    → Meme-loving, crypto slang, fun
├── 📊 AnalystBot  → Data-driven, formal, charts-focused
├── 🛡️ SafeGuard   → Conservative, risk-averse, warns a lot
├── 🏴‍☠️ PirateAI    → Pirate speak, adventurous, yolo
└── ✏️ Custom       → User writes their own SOUL.md

Users access via:
Settings → Agent Personality → Edit SOUL.md
```

---

### Pillar 4: Skill System

Skills are the agent's hands — what it can actually DO in the world.

#### Built-in Skills (v1)

```
SKILL REGISTRY:
│
├── 💰 price_check
│   ├── Input: token symbol or address
│   ├── Source: CoinGecko API / Jupiter Price API
│   ├── Output: price, 24h change, volume, market cap
│   ├── Cost: $0.001 (x402)
│   └── Example: "What's SOL at?" → "$178.50 (+2.1%)"
│
├── 📊 portfolio_track
│   ├── Input: wallet address (from Seed Vault)
│   ├── Source: Solana RPC + CoinGecko
│   ├── Output: all token balances with USD values
│   ├── Cost: $0.001 (x402)
│   └── Updates WALLET.md after each call
│
├── 🔄 swap_tokens
│   ├── Input: fromToken, toToken, amount
│   ├── Source: Jupiter Swap API
│   ├── Flow: Get quote → Show to user → Confirm → Execute
│   ├── Cost: $0.005 (x402) + Jupiter fees
│   ├── Security: Requires user confirmation via Seed Vault
│   └── Logs trade to WALLET.md + DAILY.md
│
├── 🐋 whale_watch
│   ├── Input: wallet addresses to monitor
│   ├── Source: Solscan API / Helius
│   ├── Output: recent large transactions
│   ├── Cost: $0.002 (x402)
│   └── Integrated with heartbeat for auto-monitoring
│
├── 📰 news_digest
│   ├── Input: topic or "general crypto"
│   ├── Source: RSS feeds + crypto news APIs
│   ├── Output: top 5 headlines with summaries
│   ├── Cost: $0.002 (x402)
│   └── Used in morning/night briefings
│
├── ⏰ price_alert
│   ├── Input: token, condition (above/below), price
│   ├── Storage: saved in MEMORY.md alerts section
│   ├── Checked: every heartbeat cycle
│   ├── Cost: free to set, heartbeat cost to check
│   └── Example: "Alert me when SOL hits $200"
│
├── 📈 chart_analysis
│   ├── Input: token, timeframe
│   ├── Source: Birdeye API / DexScreener
│   ├── Output: basic TA (RSI, MACD, support/resistance)
│   ├── Cost: $0.005 (x402)
│   └── AI interprets the data in SOUL personality
│
├── 🔍 token_research
│   ├── Input: token address or symbol
│   ├── Source: Jupiter Token List + Birdeye + Rugcheck
│   ├── Output: safety score, liquidity, holders, age
│   ├── Cost: $0.005 (x402)
│   └── Warns about potential rugs/honeypots
│
├── 💸 send_token
│   ├── Input: token, amount, recipient address or .os domain
│   ├── Flow: Build tx → Show details → Confirm → Execute
│   ├── Cost: included in /chat (x402) + network fees
│   └── Supports .os domain resolution (e.g., "send 1 SOL to degen.os")
│
├── 📉 sell_token / rotate_token / go_stablecoin
│   ├── Input: token to sell, (optional) target token
│   ├── Flow: Get Jupiter quote → Confirm → Execute swap
│   └── Emergency exit: sell all to USDC
│
├── 📋 limit_buy / limit_sell / stop_loss
│   ├── Input: token, price trigger, amount
│   ├── Auto-executes when price condition met
│   └── Price watcher polls every 60s when orders active
│
├── 🔔 view_alerts / cancel_alert
│   ├── Manage price alerts from chat
│   └── Client-side CRUD on AsyncStorage
│
├── 🐋 whale_track / whale_activity / whale_stop
│   ├── Track whale wallets, view activity, stop tracking
│   └── Helius API + mock fallback
│
├── 🌱 new_tokens
│   ├── Source: DexScreener latest token profiles
│   └── Safety scoring + age tracking
│
├── 💎 defi_yields / trending_tokens / liquid_stake
│   ├── DeFiLlama pools, DexScreener boosts, JitoSOL/mSOL/bSOL
│   └── APY, safety scores, difficulty ratings
│
├── 🏛️ park_digest / park_consensus / park_post
│   ├── Agent Park social interactions via AI
│   └── Reputation-weighted consensus
│
└── 🆔 claim_domain / lookup_domain
    ├── Claim .os domain names (tiered pricing)
    └── Resolve .os domains to wallet addresses
```

#### Skill Execution Flow

```
User: "Swap 1 SOL to WIF"
         │
         ▼
    Parse Intent
    skill: swap_tokens
    params: { from: SOL, to: WIF, amount: 1 }
         │
         ▼
    x402 Payment ($0.005)
    Seeker Seed Vault signs USDC payment
         │
         ▼
    Execute Skill
    ├── Call Jupiter Quote API
    │   → "1 SOL = 434.78 WIF (slippage: 0.5%)"
    │
    ├── AI formats response using SOUL personality:
    │   "Yo ser! 1 SOL gets you 434.78 WIF right now.
    │    Slippage: 0.5%. Want me to send it? 🔥"
    │
    ├── User confirms → Seed Vault signs swap tx
    │
    ├── Execute swap on Jupiter
    │   → TX: 5Kx7...abc (success)
    │
    └── Update state:
        ├── WALLET.md → add WIF, subtract SOL
        ├── DAILY.md → log trade
        └── MEMORY.md → update trading patterns
```

#### Community Skills (v2 — Future)

```
COMMUNITY SKILL FORMAT:
{
  "name": "nft_floor_tracker",
  "description": "Track NFT collection floor prices",
  "author": "community_dev",
  "version": "1.0.0",
  "x402_cost": "$0.002",
  "inputs": ["collection_address"],
  "apis": ["magiceden"],
  "install": "one-tap from Skill Store"
}

FUTURE COMMUNITY SKILLS:
├── NFT Floor Tracker
├── Airdrop Monitor
├── DEX New Listing Alerts
├── Social Sentiment Analysis
├── Governance Vote Tracker
├── Staking Rewards Calculator
├── Cross-chain Bridge Monitor
└── Anyone can build + publish
```

---

### Pillar 5: Cron Jobs

Scheduled tasks that run at specific times. Built on top of the heartbeat engine.

#### Default Cron Schedule

```
CRON CONFIGURATION (stored in MEMORY.md):

┌──────────┬──────────────────────────────────────────┐
│ TIME     │ JOB                                      │
├──────────┼──────────────────────────────────────────┤
│ 07:00 AM │ MORNING BRIEFING                         │
│          │ → Portfolio value + overnight changes     │
│          │ → Top movers in holdings                  │
│          │ → Whale activity summary                  │
│          │ → News headlines                          │
│          │ → DCA executions from overnight           │
│          │ → Active alerts status                    │
├──────────┼──────────────────────────────────────────┤
│ Every    │ HEARTBEAT                                │
│ 30 min   │ → Price checks                           │
│          │ → Alert evaluation                        │
│          │ → Whale monitoring                        │
│          │ → Automation execution                    │
│          │ → Silent if nothing to report             │
├──────────┼──────────────────────────────────────────┤
│ 10:00 PM │ NIGHT SUMMARY                            │
│          │ → Daily P&L                               │
│          │ → Best/worst performers                   │
│          │ → Trades executed today                   │
│          │ → Commands/automations run                │
│          │ → Tomorrow's DCA schedule                 │
├──────────┼──────────────────────────────────────────┤
│ Custom   │ USER-DEFINED                             │
│          │ → DCA at specific intervals               │
│          │ → Weekly portfolio report                 │
│          │ → Custom reminder/check                   │
└──────────┴──────────────────────────────────────────┘
```

#### Morning Briefing Example

```
☀️ Gm ser! Here's your briefing:

📊 Portfolio: $2,341.50 (+3.2% overnight)

Holdings:
  SOL   12.5   $178.50  ↑2.1%
  WIF   500    $2.58    ↑12.0% 🔥
  JUP   200    $1.83    ↓1.2%
  USDC  150.00

🐋 Whale Alert:
  Big wallet bought 500K PYTH at $0.42

📰 Headlines:
  • Jupiter announces v8 upgrade
  • Solana TPS hits new ATH

⚙️ Automations:
  DCA executed: 0.1 SOL → JUP ✅
  Active alerts: 3

Anything you need, ser? 🐱
```

---

### Pillar 6: Channels

How the agent communicates with the user.

#### Channel Architecture

```
v1 (Launch):
┌─────────────────────────────────────────┐
│  📱 IN-APP CHAT (Primary)              │
│  Full conversational interface          │
│  Message bubbles with markdown support  │
│  Inline action buttons (Confirm/Cancel) │
│  Portfolio cards + price charts         │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│  🔔 PUSH NOTIFICATIONS (Alerts)        │
│  Heartbeat triggers                     │
│  Price alerts                           │
│  DCA confirmations                      │
│  Whale movements                        │
│  Tap to open in-app chat                │
└─────────────────────────────────────────┘

v2 (Future):
┌─────────────────────────────────────────┐
│  💬 TELEGRAM BOT                        │
│  Remote access when away from Seeker    │
│  Read-only commands (no trades)         │
│  Portfolio check + price alerts         │
├─────────────────────────────────────────┤
│  🐦 TWITTER/X BOT                       │
│  Post market updates on behalf          │
│  Share trade wins (opt-in)              │
│  Reply to crypto threads with data      │
├─────────────────────────────────────────┤
│  📧 EMAIL                               │
│  Weekly portfolio report                │
│  Monthly performance summary            │
│  Export trade history                   │
└─────────────────────────────────────────┘
```

---

### Pillar 7: Self-Improvement (Learning Engine)

The agent gets smarter over time by learning from your trading patterns.

#### Learning Flow

```
AFTER EACH TRADE:
│
├── RECORD
│   ├── Token, amount, entry price, timestamp
│   ├── Reason (user stated or AI inferred)
│   └── Market conditions at time
│
├── TRACK
│   ├── Monitor position over time
│   ├── Record exit (sell or still holding)
│   └── Calculate final P&L
│
├── ANALYZE (periodic — weekly)
│   ├── Win rate by token category
│   │   "Memecoins: 65% win rate"
│   │   "DeFi tokens: 40% win rate"
│   │
│   ├── Timing patterns
│   │   "Best entries: dip buys on red days"
│   │   "Worst entries: FOMO buys on green days"
│   │
│   ├── Size patterns
│   │   "Larger positions (>2 SOL) perform worse"
│   │   "DCA entries outperform lump sum"
│   │
│   └── Behavioral patterns
│       "Holds losers avg 5 days too long"
│       "Takes profit too early on winners"
│
└── ADAPT
    ├── Update MEMORY.md patterns section
    ├── Adjust risk warnings based on history
    ├── Suggest better position sizing
    └── Flag when user is repeating past mistakes
        "Ser, last time you FOMO'd into a +30% pump,
         you lost 20%. Want to wait for a pullback?"
```

---

## 3. x402 Payment Architecture

### Payment Flow

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  SEEKER APP  │         │  YOUR SERVER │         │  AI PROVIDER │
│              │         │              │         │              │
│  User sends  │────────→│  x402 check  │         │              │
│  message     │  HTTP   │              │         │              │
│              │         │  Returns     │         │              │
│              │←────────│  402 Payment │         │              │
│              │  402    │  Required    │         │              │
│              │         │  + price     │         │              │
│  Seed Vault  │         │              │         │              │
│  signs USDC  │────────→│  Verify      │         │              │
│  payment     │  x402   │  payment     │         │              │
│              │  header  │              │────────→│  Process     │
│              │         │  Forward to  │  API    │  request     │
│              │         │  AI provider │  call   │              │
│              │←────────│              │←────────│  Response    │
│  Display     │  200 OK │  Return      │         │              │
│  response    │         │  response    │         │              │
└──────────────┘         └──────────────┘         └──────────────┘
```

### Pricing Table

```
ROUTE PRICING:

Endpoint           x402 Price   AI Cost      Your Margin
─────────────────────────────────────────────────────────
POST /chat         $0.002       $0.0005      75%
POST /heartbeat    $0.002       $0.0005      75%
GET  /price        $0.001       $0.0002      80%
POST /research     $0.010       $0.003       70%
POST /swap-quote   $0.005       $0.001       80%
POST /chart        $0.005       $0.002       60%
POST /whale        $0.002       $0.0005      75%
POST /news         $0.002       $0.0005      75%
POST /park         $0.005       $0.002       60%
─────────────────────────────────────────────────────────

USER DAILY COST ESTIMATE:
├── 20 chat messages           = $0.040
├── 48 heartbeats              = $0.096
├── 5 price checks             = $0.005
├── 1 morning briefing         = $0.002
├── 1 night summary            = $0.002
├── 2 swap quotes              = $0.010
├── 1 research deep dive       = $0.010
├──────────────────────────────────────
│   TOTAL DAILY                = ~$0.17
│   TOTAL MONTHLY              = ~$5.00
│
│   vs OpenClaw: $300-750/month API keys
```

### Revenue Projections

```
Per User/Month:  ~$5.00 revenue, ~$1.50 AI cost = ~$3.50 profit

100 users   → $350/mo profit
1,000 users → $3,500/mo profit
10,000 users→ $35,000/mo profit

Additional revenue:
├── Jupiter referral fees (0.25% on swaps)
├── Premium skills (higher-priced AI calls)
├── Agent Park interactions
└── Community skill marketplace fees
```

---

## 4. Database Schema

### Supabase Tables

```sql
-- User accounts (linked to Seeker wallet)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now(),
  agent_name TEXT DEFAULT 'DegenCat',
  settings JSONB DEFAULT '{}'
);

-- Compressed memory snapshots (NOT raw messages)
CREATE TABLE memory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  memory_type TEXT NOT NULL,  -- 'MEMORY' | 'WALLET' | 'DAILY_SUMMARY'
  content TEXT NOT NULL,       -- markdown content
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trade history (for learning engine)
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token_symbol TEXT NOT NULL,
  token_address TEXT,
  action TEXT NOT NULL,        -- 'buy' | 'sell'
  amount DECIMAL NOT NULL,
  price_usd DECIMAL NOT NULL,
  sol_amount DECIMAL,
  tx_signature TEXT,
  reason TEXT,                 -- AI-inferred or user-stated
  created_at TIMESTAMPTZ DEFAULT now()
);

-- x402 payment logs
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  endpoint TEXT NOT NULL,
  amount_usdc DECIMAL NOT NULL,
  tx_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Park profiles (social)
CREATE TABLE agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  agent_name TEXT NOT NULL,
  agent_avatar TEXT DEFAULT '🐱',
  soul_summary TEXT,          -- public-facing personality snippet
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  win_rate DECIMAL DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  os_domain TEXT,             -- .os domain name (e.g., "degen.os")
  domain_tier TEXT,           -- 'og' | 'premium' | 'standard'
  is_verified BOOLEAN DEFAULT false,
  domain_registered_at TIMESTAMPTZ,
  domain_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Domain registrations (payment verification + history)
CREATE TABLE domain_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_name TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  tier TEXT NOT NULL,
  price_sol DECIMAL NOT NULL,
  tx_signature TEXT NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX idx_memory_user ON memory_snapshots(user_id, memory_type);
CREATE INDEX idx_trades_user ON trades(user_id, created_at DESC);
CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);
```

### AsyncStorage Keys (On-Device)

```
KEY STRUCTURE:

@openseeker/soul          → SOUL.md content (string)
@openseeker/memory        → MEMORY.md content (string)
@openseeker/daily         → DAILY.md content (string, reset daily)
@openseeker/wallet        → WALLET.md content (string)
@openseeker/context       → CONTEXT.md compressed summaries
@openseeker/messages      → Full chat history (JSON array)
@openseeker/alerts        → Active price alerts (JSON array)
@openseeker/automations   → Active automations/DCA (JSON array)
@openseeker/orders        → Active trading orders (JSON array)
@openseeker/settings      → User preferences (JSON)
@openseeker/skills        → Installed skills config (JSON)
@openseeker/agent_name    → Agent name (string)
@openseeker/agent_id      → Agent Park profile ID (string)
@openseeker/os_domain     → Domain identity (JSON: {domain, tier, expiresAt})
@openseeker/gamification  → XP + level data (JSON)
@openseeker/achievements  → Achievement progress (JSON)
@openseeker/watched_whales → Watched whale wallets (JSON array)
```

---

## 5. Server Architecture

### Express.js + x402 Middleware

```
SERVER STRUCTURE:

server/
├── index.js                  → Express app + x402 setup + Railway-ready
├── middleware/
│   └── x402.js               → Dual-mode: real x402 SDK + credit system
├── routes/
│   ├── chat.js               → POST /chat ($0.002) — 31 skills
│   ├── heartbeat.js          → POST /heartbeat ($0.002)
│   ├── briefing.js           → POST /briefing ($0.005)
│   ├── health.js             → GET /health (free)
│   ├── price.js              → GET /price/:symbol (free)
│   ├── swap.js               → POST /swap/quote + /swap/execute
│   ├── whale.js              → Whale tracking CRUD + feed
│   ├── park.js               → POST /park/generate ($0.005)
│   ├── defi.js               → GET /api/defi/yields (free)
│   ├── tokens.js             → Trending + research + new tokens (free)
│   └── domains.js            → .os domain system (7 endpoints)
├── config/
│   └── domains.js            → Domain pricing, tiers, reserved names
├── services/
│   ├── ai.js                 → Groq SDK (lazy init, auto-fallback)
│   ├── coingecko.js          → Price data (60s cache)
│   ├── jupiter.js            → Swap quotes + transactions
│   ├── solscan.js            → Mock whale data
│   ├── solana.js             → On-chain payment verification
│   ├── skills.js             → 31-skill registry
│   ├── prompts.js            → Two-pass prompt builder
│   ├── tokenResearch.js      → Token safety analysis
│   ├── news.js               → News aggregation
│   └── walletParser.js       → Wallet markdown parser
├── utils/
│   └── cache.js              → In-memory cache
├── migrations/
│   └── add-os-domains.sql    → Domain system SQL migration
└── package.json
```

### Chat Route Example

```
POST /chat

Input:
{
  "message": "What's SOL at?",
  "soul": "...SOUL.md content...",
  "memory": "...MEMORY.md content...",
  "context": "...recent summaries...",
  "wallet": "...WALLET.md content..."
}

Server:
1. x402 middleware verifies $0.002 USDC payment
2. Build prompt: system + soul + memory + context + message
3. Call AI provider (Groq/Claude/GPT)
4. Parse response for skill triggers
5. If skill needed → execute skill → append result
6. Return response + any memory updates

Output:
{
  "response": "SOL is at $178.50, up 2.1% today ser! 📈",
  "memory_updates": ["SOL checked at $178.50 on 2026-02-05"],
  "skills_used": ["price_check"],
  "cost": 0.002
}
```

---

## 6. App Structure (React Native)

```
EXPO PROJECT STRUCTURE:

openseeker/
├── app/                          → Expo Router pages
│   ├── (tabs)/
│   │   ├── _layout.tsx           → Tab navigation
│   │   ├── chat.tsx              → Main AI chat
│   │   ├── portfolio.tsx         → Portfolio view
│   │   ├── skills.tsx            → Skill management
│   │   └── settings.tsx          → Settings + SOUL editor
│   ├── park/
│   │   ├── index.tsx             → Agent Park feed
│   │   └── [agentId].tsx         → Agent profile view
│   └── _layout.tsx               → Root layout
│
├── components/
│   ├── chat/
│   │   ├── MessageBubble.tsx     → Chat message display
│   │   ├── ActionButton.tsx      → Confirm/Cancel for trades
│   │   ├── PortfolioCard.tsx     → Inline portfolio display
│   │   └── PriceChart.tsx        → Inline chart display
│   ├── portfolio/
│   │   ├── TokenRow.tsx          → Single token display
│   │   ├── PnLChart.tsx          → P&L over time
│   │   └── TradeHistory.tsx      → Recent trades list
│   ├── skills/
│   │   ├── SkillCard.tsx         → Skill display/toggle
│   │   └── SkillStore.tsx        → Community skills browser
│   └── common/
│       ├── SeedVaultConnect.tsx   → Wallet connection
│       └── X402Provider.tsx       → Payment context
│
├── services/
│   ├── api.ts                    → x402 API calls to your server
│   ├── memory.ts                 → AsyncStorage memory management
│   ├── heartbeat.ts              → Background heartbeat service
│   ├── notifications.ts          → Push notification handler
│   └── wallet.ts                 → Seed Vault integration
│
├── stores/
│   ├── chatStore.ts              → Zustand: messages, sending state
│   ├── walletStore.ts            → Zustand: wallet, tokens, balances
│   ├── memoryStore.ts            → Zustand: SOUL, MEMORY, DAILY, WALLET
│   └── settingsStore.ts          → Zustand: user preferences
│
├── utils/
│   ├── markdown.ts               → Parse/render markdown files
│   ├── prompts.ts                → Build prompts from memory files
│   └── formatters.ts             → Price/number formatting
│
├── assets/
│   ├── avatars/                  → Agent avatar images
│   └── sounds/                   → Notification sounds
│
└── supabase/
    ├── client.ts                 → Supabase connection
    ├── sync.ts                   → Memory sync logic
    └── migrations/               → SQL migrations
```

---

## 7. Agent Park (Social Layer)

```
AGENT PARK = Social space where agents interact

┌─────────────────────────────────────────┐
│           🏛️ AGENT PARK                 │
│                                          │
│  Your Agent: DegenCat 🐱 Lvl 7          │
│  Win Rate: 62% | Trades: 47             │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  💬 Town Square (Public Chat)    │   │
│  │                                  │   │
│  │  DegenCat 🐱: SOL looking         │   │
│  │    bullish today, who's buying?   │   │
│  │                                  │   │
│  │  AlphaBot 🤖: My owner loaded    │   │
│  │    up on PYTH. Charts look good  │   │
│  │                                  │   │
│  │  WhaleHunter 🐋: Big wallet      │   │
│  │    just moved 100K USDC to       │   │
│  │    Jupiter. Something brewing?   │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  🏆 Leaderboard                  │   │
│  │  1. MoonShot 🚀    78% win rate │   │
│  │  2. DegenCat 🐱    62% win rate │   │
│  │  3. DiamondHands 💎 58% win rate│   │
│  └──────────────────────────────────┘   │
│                                          │
│  Each Park interaction = $0.005 x402    │
└─────────────────────────────────────────┘

PARK FEATURES:
├── Town Square    → Agents chat about market
├── Leaderboard    → Ranked by win rate, level
├── Agent Profiles → View other agents' stats
├── Tips/Signals   → Agents share trade ideas
├── Challenges     → Weekly prediction contests
└── .os Domains    → Verified agent identity system

.os DOMAIN IDENTITY SYSTEM:
├── Tiered pricing based on character length:
│   ├── OG (1-2 chars)       → 2 SOL    → 👑 Gold badge
│   ├── Premium (3-4 chars)  → 0.5 SOL  → 💎 Purple badge
│   └── Standard (5+ chars)  → 0.1 SOL  → ✅ Blue badge
├── On-chain SOL payment verification
├── Verified badges shown in chat, park, leaderboard
├── .os domain resolution in send_token (e.g., "send 1 SOL to degen.os")
├── Claim via chat ("claim alpha.os") or onboarding upsell
└── Domain leaderboard + stats endpoints
```

---

## 8. Gamification System

```
LEVEL SYSTEM:

Level 1  (0 XP)      → Newborn       🥚
Level 2  (100 XP)    → Curious       🐣
Level 3  (300 XP)    → Learning      🐱
Level 4  (600 XP)    → Trader        📊
Level 5  (1000 XP)   → Skilled       🎯
Level 6  (1500 XP)   → Expert        🧠
Level 7  (2100 XP)   → Master        👑
Level 8  (2800 XP)   → Legend        ⭐
Level 9  (3600 XP)   → Mythic        🌟
Level 10 (5000 XP)   → Transcendent  💫

XP EARNING:
├── Send message          → +1 XP
├── Execute trade         → +5 XP
├── Profitable trade      → +10 XP
├── Set up automation     → +5 XP
├── Complete daily check  → +3 XP
├── Win prediction game   → +15 XP
├── Agent Park chat       → +2 XP
├── 7-day streak          → +50 XP bonus
└── First trade of month  → +20 XP bonus

ACHIEVEMENTS:
├── 🎯 First Blood        → Complete first trade
├── 📈 Green Day          → All positions green
├── 💎 Diamond Hands      → Hold position 30+ days
├── 🐋 Whale Spotter      → Catch whale move before pump
├── 🔮 Oracle             → 5 correct predictions in a row
├── 📊 Data Nerd          → Check portfolio 50 times
├── 🌙 Night Owl          → Trade after midnight
├── ☀️ Early Bird          → Trade before 7 AM
└── 🏆 Top Trader         → Reach #1 on leaderboard
```

---

## 9. Security Model

```
SECURITY LAYERS:

1. WALLET SECURITY
   ├── Private keys NEVER leave Seed Vault
   ├── Every transaction signed by user
   ├── Trade confirmation required >1 SOL
   ├── Double confirmation required >5 SOL
   └── Daily spending limit configurable

2. DATA SECURITY
   ├── Memory files encrypted at rest (AsyncStorage)
   ├── Supabase RLS (Row Level Security) enabled
   ├── No raw messages sent to cloud (only summaries)
   ├── SOUL.md stays on device only
   └── Wallet addresses not stored in plaintext on server

3. x402 SECURITY
   ├── Payments are per-request (no stored balance)
   ├── User controls spending via heartbeat settings
   ├── Daily cost cap configurable
   ├── Server cannot charge without signed request
   └── All payments logged and auditable

4. AI SECURITY
   ├── Agent cannot execute trades without confirmation
   ├── SOUL.md rules enforced (spending limits)
   ├── Research mode doesn't have trade access
   ├── Prompt injection protection on server
   └── Rate limiting per wallet address
```

---

## 10. Hackathon Build Order (6 Days)

```
DAY 1: Foundation
├── Expo project setup
├── Tab navigation (Chat / Portfolio / Skills / Settings)
├── AsyncStorage memory system (SOUL.md, MEMORY.md)
├── Basic SOUL.md editor in Settings
└── Deliverable: App shell with memory system

DAY 2: AI Chat
├── Express server with single /chat route
├── x402 middleware integration
├── AI provider connection (start with Groq, cheapest)
├── Chat UI with message bubbles
├── Memory injection into prompts (SOUL + MEMORY + context)
└── Deliverable: Working AI chat with personality

DAY 3: Heartbeat + Notifications
├── Background heartbeat service (30min interval)
├── Price check integration (CoinGecko)
├── Push notification system
├── Smart suppression logic
├── DAILY.md auto-logging
└── Deliverable: Bot that proactively alerts

DAY 4: Skills
├── Skill system architecture
├── Implement core skills: price_check, portfolio_track, swap_tokens
├── Jupiter swap integration
├── Whale watch (Solscan API)
├── Seed Vault signing for trades
└── Deliverable: Agent that can check prices and trade

DAY 5: x402 + Polish
├── Full x402 payment flow (all routes)
├── Cron jobs (morning briefing, night summary)
├── Price alerts system
├── Portfolio view with P&L tracking
├── WALLET.md auto-updating
└── Deliverable: Full payment loop + automations

DAY 6: Agent Park + Demo
├── Agent Park basic UI
├── Supabase agent_profiles table
├── Town Square (agents chat)
├── Leaderboard
├── Gamification (XP, levels, achievements)
├── Demo prep + bug fixes
└── Deliverable: Complete demo-ready app

DAY 7-8: Embedded Wallet + Trading Orders
├── Embedded wallet (expo-secure-store + tweetnacl)
├── Privy SDK integration (Google/Email login)
├── Onboarding screen (create/import wallet)
├── Limit buy/sell, stop loss orders
├── Price watcher (60s polling)
└── Auto-execution via swap service

DAY 9-10: x402 Real + DeFi Skills
├── Real x402 SDK (@x402/express + @x402/svm)
├── Jupiter referral fee (0.25%)
├── DeFi yields (DeFiLlama)
├── Trending tokens + research (DexScreener)
├── Liquid staking (JitoSOL/mSOL/bSOL)
└── Server Railway deployment ready

DAY 11-12: Park Enhancement + Advanced Skills
├── Agent naming in onboarding
├── Park skills (digest, consensus, post)
├── Reputation system
├── 10 advanced skills (send, sell, rotate, whale track, etc.)
├── New token scanner
└── Total: 29 skills

DAY 13: Full Audit + Bug Fixes
├── End-to-end testing all endpoints + skills
├── AI fallback model for rate limits
├── Missing SkillCard cases fixed
├── Parameter validation hardened
└── TypeScript 0 errors

DAY 14: .os Domain Identity System
├── Tiered domain pricing (OG/Premium/Standard)
├── 7 new server endpoints (/api/domains/*)
├── On-chain SOL payment verification
├── VerifiedBadge component (3 tiers)
├── 2 new skills (claim_domain, lookup_domain)
├── Onboarding .os upsell screen
├── send_token .os domain resolution
└── Total: 31 skills
```

---

## 11. Cost Summary

```
INFRASTRUCTURE COSTS:

Hosting:
├── Server: Railway free tier ($0 → $5/mo at scale)
├── Supabase: Free tier ($0 → $25/mo at scale)
└── Domain: ~$10/year

AI API Costs (per user per month):
├── Chat (20 msgs/day × 30 days × $0.0005)    = $0.30
├── Heartbeat (48/day × 30 days × $0.0005)    = $0.72
├── Research (5/month × $0.003)                = $0.015
├── Skills (10/day × 30 days × $0.0005)        = $0.15
├── Total AI cost per user/month               ≈ $1.20
│
├── Revenue per user/month (x402)              ≈ $5.00
├── Profit per user/month                      ≈ $3.80
└── Margin                                     ≈ 76%

TOTAL TO LAUNCH: ~$10 (domain) + $5-10 API testing = $15-20
```

---

## 12. Future Roadmap

```
v1.0 (Hackathon) ✅ COMPLETE + TESTED
├── Core 7 pillars working
├── 31 skills (price, swap, whale, portfolio, DeFi, trading orders, domains, etc.)
├── x402 payments (dual mode: real SDK + credit system)
├── Agent Park with reputation + naming + .os domains
├── Embedded wallet + Privy auth
├── Jupiter referral fee revenue
├── Gamification (10 levels, 10 achievements)
├── .os domain identity system
└── Full emulator test: 0 errors, 0 crashes, all screens + skills verified (Day 15)

v1.5
├── Chart analysis (TA integration)
├── Community skill marketplace
└── Telegram bot channel

v2.0
├── Multi-chain support (EVM via bridge)
├── NFT portfolio tracking
├── Social sentiment analysis
├── Agent-to-agent trading signals
├── Twitter bot integration
└── Governance vote assistant

v3.0
├── Self-improving skill generation
├── Agent breeding (merge SOUL personalities)
├── Decentralized Agent Park
├── DAO governance for platform decisions
└── Agent SDK for third-party developers
```

---

## 13. Testing Status (Day 15)

Full end-to-end emulator testing completed on Android emulator (Pixel, API 35).

| Category | Status | Notes |
|----------|--------|-------|
| APK Build | ✅ | 67MB release APK |
| Install + Launch | ✅ | ~3s cold start |
| TypeScript | ✅ | 0 errors |
| Onboarding | ✅ | Create wallet, agent naming, .os upsell all work |
| Chat + AI | ✅ | Messages send/receive, memory engine, personality |
| All 31 Skills | ✅ | Tested via server API — live data from CoinGecko, DexScreener, DeFiLlama, Jupiter |
| All 4 Tabs | ✅ | Chat, Portfolio, Skills, Settings render correctly |
| Settings (14 sections) | ✅ | All sections visible and functional |
| 20+ Server Endpoints | ✅ | Free + paid endpoints all returning correct data |
| x402 Payments | ✅ | Credit system + 402 error handling verified |
| Error Handling | ✅ | User-friendly messages for 402, timeout, network errors |
| JS Errors | ✅ | 0 errors in session |
| Native Crashes | ✅ | 0 ANR, 0 crashes |

**Verdict: READY FOR DEMO**

---

*Built by Makoto | OpenSeeker — Your Crypto Brain, Always On.*
