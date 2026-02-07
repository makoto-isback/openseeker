# OpenSeeker — CLAUDE.md

## Project Overview
OpenSeeker is a crypto-native AI companion app for the Solana Seeker phone. Built with Expo (React Native + TypeScript) for the mobile app and Express.js for the server.

## Tech Stack
- **App**: Expo SDK 54, React Native 0.81, TypeScript, expo-router v6
- **State**: Zustand stores
- **Storage**: AsyncStorage (keys prefixed `@openseeker/`)
- **Server**: Express.js (in `server/` with its own package.json)
- **AI**: Groq SDK (`llama-3.3-70b-versatile`) with lazy init
- **Prices**: CoinGecko free API with 60s in-memory cache (extends to 5min on 429)
- **Notifications**: expo-notifications (local push)
- **Background**: expo-background-fetch + expo-task-manager
- **Payments**: x402 micropayment protocol — dual mode: real x402 SDK (@x402/express + @x402/svm) + credit system fallback
- **Social**: Supabase (Agent Park, Realtime)
- **Gamification**: XP/Level system with achievements
- **Wallet**: Embedded wallet (expo-secure-store + @scure/bip39 + @noble/hashes + tweetnacl) OR Privy wallet (Google/Email login)
- **Auth (optional)**: Privy SDK (@privy-io/expo) — Google OAuth + Email OTP login with auto-created Solana embedded wallet
- **Persistent Memory**: SQLite-based agent brain — auto-extracts facts from chat, daily logging, weekly recaps

## Project Structure
```
openseeker/
├── app/                     # expo-router file-based routing
│   ├── _layout.tsx          # Root layout (init memory, heartbeat, notifications, wallet, onboarding redirect)
│   ├── onboarding.tsx       # Wallet onboarding — Google login, Email login, create new, import seed phrase, import private key, agent naming, .os domain upsell
│   ├── park.tsx             # Agent Park modal — leaderboard, town square, post flow
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar config (Chat, Portfolio, Skills, Settings)
│       ├── index.tsx        # Chat screen with level badge, quick actions, FAB, offline banner
│       ├── portfolio.tsx    # Portfolio value, holdings with live prices, automations
│       ├── skills.tsx       # 8-skill grid with spend stats, coming soon section
│       └── settings.tsx     # SOUL.md editor, alerts, heartbeat, spending, DCA, gamification, domain identity, wallet, memory, advanced
├── components/chat/
│   ├── MessageBubble.tsx    # Chat bubble with avatar + skill cards for AI messages
│   ├── SkillCard.tsx        # Rich cards for skill results (price, portfolio, swap, whale, research, alert, dca, orders, send, sell, new tokens, whale tracking)
│   ├── OrderCard.tsx        # Rich cards for trading orders (limit buy/sell, stop loss, view orders)
│   ├── TransactionCard.tsx  # Green-bordered card for completed swaps with tx signature
│   ├── DefiYieldCard.tsx    # DeFi yield pools with APY, TVL, difficulty, stake buttons
│   ├── TrendingTokensCard.tsx # Trending tokens with safety bars, buy buttons, risk disclaimer
│   ├── TokenResearchCard.tsx  # Deep token research with multi-timeframe data, safety analysis
│   ├── SendConfirmCard.tsx  # Send SOL/tokens confirm card with address, amount, confirm/cancel
│   ├── SellConfirmCard.tsx  # Sell/rotate/emergency exit confirm card with swap quote
│   ├── WhaleTrackCard.tsx   # Whale tracking card (track/activity/stop states)
│   ├── NewTokensCard.tsx    # New token scanner card with age, safety scores, risk disclaimer
│   ├── DomainClaimCard.tsx  # .os domain claim/lookup card (tier badge, price, benefits, claim button)
│   └── MemoryCard.tsx       # Memory skill cards (show, remember, forget, daily/weekly recap)
├── components/park/
│   ├── AgentCard.tsx        # Your agent profile card (avatar, name, level, XP bar, stats)
│   ├── LeaderboardRow.tsx   # Rank + avatar + name + level + win rate (compact row)
│   ├── ParkMessage.tsx      # Agent message in Town Square (avatar, name, time, content, type badge)
│   └── PostButton.tsx       # Generate + preview + confirm flow with prompt type
├── components/common/
│   ├── Skeleton.tsx         # Pulsing placeholder bars for loading states
│   ├── OfflineBanner.tsx    # Yellow warning banner when offline, with retry button
│   └── VerifiedBadge.tsx    # Tier-based verified badge (OG/Premium/Standard) with tap tooltip
├── constants/
│   ├── theme.ts             # Dark theme colors, spacing, fontSize, borderRadius
│   ├── defaults.ts          # Default SOUL.md, MEMORY.md, WALLET.md templates
│   └── tokenEmojis.ts       # Token symbol → emoji mapping (SOL→◎, BTC→₿, etc.)
├── supabase/
│   ├── client.ts            # Supabase client singleton (EXPO_PUBLIC_ env vars)
│   └── agentPark.ts         # Agent Park service — profiles, leaderboard, messages, realtime
├── services/
│   ├── memory.ts            # AsyncStorage CRUD for all memory keys
│   ├── api.ts               # HTTP client: sendMessage, heartbeat, briefing, checkHealth, swap, park endpoints
│   ├── x402.ts              # x402 payment protocol — paidFetch wrapper, test mode headers
│   ├── privyBridge.ts       # Singleton bridge: stores Privy provider for non-React service code
│   ├── spending.ts          # Spend tracking — recordSpend, getTodaySpend, getMonthSpend, checkDailyLimit
│   ├── embeddedWallet.ts    # Core crypto layer — mnemonic gen, BIP44 derivation, SecureStore
│   ├── swap.ts              # Client swap execution — embedded wallet signing + submission + XP
│   ├── dca.ts               # DCA automation CRUD (AsyncStorage @openseeker/automations) + XP
│   ├── orders.ts            # Trading order CRUD + auto-execution (limit buy/sell, stop loss)
│   ├── priceWatcher.ts      # Fast price polling (60s) when active orders exist
│   ├── walletManager.ts     # Update WALLET.md holdings, record trades
│   ├── memoryEngine.ts      # Post-response processing: daily log, fact extraction, context compression
│   ├── heartbeat.ts         # Background + foreground heartbeat execution + DCA checks
│   ├── notifications.ts     # Push notification setup, local send, daily scheduling
│   ├── alerts.ts            # Price alert CRUD (AsyncStorage @openseeker/alerts)
│   ├── walletParser.ts      # Parse WALLET.md/MEMORY.md into structured data
│   ├── gamification.ts      # XP + leveling system (10 levels, AsyncStorage)
│   ├── achievements.ts      # 10 achievements with counter-based tracking
│   ├── reputation.ts        # Agent Park reputation system (tiers, consensus calculation)
│   ├── transfer.ts          # SOL/SPL token transfer service (sendSOL, simulated fallback)
│   ├── whaleCopyTrade.ts    # Whale wallet tracking service (AsyncStorage CRUD)
│   ├── demoSeed.ts          # Seed demo agents + messages to Supabase
│   └── domainService.ts     # .os domain client service (check, register, lookup, getMyDomain)
├── stores/
│   ├── chatStore.ts         # Messages, send flow, loading state, DCA + order side-effects
│   ├── orderStore.ts        # Trading orders state, placeOrder, cancelOrder
│   ├── memoryStore.ts       # SOUL/MEMORY/DAILY/WALLET content
│   ├── walletStore.ts       # Embedded/Privy wallet state, signAndSendTransaction (auto-routes by walletType), balance
│   └── settingsStore.ts     # Server URL, heartbeat config, notification toggles, daily spend limit
├── utils/
│   └── formatters.ts        # Price, number, percent, time formatting
├── components/
│   └── PrivyBridgeSync.tsx  # Syncs Privy wallet hooks → singleton bridge for non-React code
├── server/
│   ├── index.js             # Express setup, CORS, rate limiting, route mounting, real x402 middleware, Railway-ready
│   ├── middleware/x402.js   # Dual-mode x402: real x402 SDK (@x402/express) + credit system fallback
│   ├── routes/
│   │   ├── chat.js          # POST /chat — AI chat with context + skill detection (x402: $0.002)
│   │   ├── health.js        # GET /health — status check (free)
│   │   ├── heartbeat.js     # POST /heartbeat — price check, portfolio calc, alert eval (x402: $0.002)
│   │   ├── briefing.js      # POST /briefing — morning/night AI briefing (x402: $0.005)
│   │   ├── price.js         # GET /price/:symbol — CoinGecko live data with mock fallback (free)
│   │   ├── swap.js          # POST /swap/swap-quote + /swap/swap-execute (x402: $0.003/$0.005)
│   │   ├── park.js          # POST /park/generate — AI-generated park posts (x402: $0.005)
│   │   ├── whale.js         # Whale tracking routes (POST /watch, GET /watched, DELETE /watch/:wallet, GET /activity/:wallet, GET /feed)
│   │   ├── domains.js       # .os domain routes (check, price, register, my, lookup, leaderboard, stats)
│   │   └── memory.js        # Persistent memory routes (get, save, forget, daily, recap)
│   │   ├── defi.js          # GET /api/defi/yields — DeFiLlama Solana pools with categorization (free)
│   │   └── tokens.js        # GET /api/tokens/trending + /api/tokens/research/:address — DexScreener (free)
│   ├── utils/
│   │   └── cache.js         # Simple in-memory cache (getCached/setCache/clearCache)
│   ├── config/
│   │   └── domains.js       # Domain pricing, tiers, reserved names, validation
│   ├── migrations/
│   │   └── add-os-domains.sql  # SQL migration for domain columns + registrations table
│   └── services/
│       ├── ai.js            # Groq SDK wrapper (lazy init)
│       ├── coingecko.js     # CoinGecko API: getPrice, getPrices, getMarketData (60s cache, 5min on 429)
│       ├── prompts.js       # Two-pass prompt builder (intent detection + result formatting)
│       ├── skills.js        # Skill registry: 31 skills (8 original + 5 trading + 3 DeFi + 3 park + 10 advanced + 2 domain)
│       ├── jupiter.js       # Jupiter Quote + Swap Transaction APIs with mock fallback
│       ├── solscan.js       # Mock whale transaction data
│       ├── tokenResearch.js # Token safety analysis (CoinGecko + heuristics)
│       ├── news.js          # CoinGecko trending + mock news fallback
│       ├── walletParser.js  # Server-side wallet markdown parser
│       └── memory.js        # Persistent agent memory service (SQLite-backed)
│       └── solana.js        # On-chain payment verification (domain registration)
├── app.json
├── index.js                 # Entry point — polyfills (fast-text-encoding, @ethersproject/shims) before expo-router
├── metro.config.js          # Metro bundler config — Privy package export overrides
├── package.json             # main: "./index.js" (was "expo-router/entry")
└── tsconfig.json            # moduleResolution: Bundler (for Privy types)
```

## Commands
- **Start app**: `npx expo start` (from project root)
- **Start server**: `cd server && npm start` (requires `.env` with `GROQ_API_KEY`)
- **Server dev mode**: `cd server && npm run dev` (auto-restart on changes)
- **TypeScript check**: `npx tsc --noEmit`
- **Kill port 3000**: `lsof -ti:3000 | xargs kill -9`
- **Build APK**: `cd android && ./gradlew assembleRelease` (output: `android/app/build/outputs/apk/release/app-release.apk`)
- **Install APK**: `adb install -r android/app/build/outputs/apk/release/app-release.apk`
- **Prebuild (after changes)**: `npx expo prebuild --platform android --clean` (then re-add `usesCleartextTraffic` to AndroidManifest)
- **Credit test wallet**: `curl -X POST http://localhost:3000/deposit/credit-test -H "Content-Type: application/json" -d '{"wallet":"ADDRESS","amount":10}'`

## Server Endpoints
- `GET /health` — `{ status: 'ok', timestamp }` (free, no x402)
- `POST /chat` — `{ message, soul, memory, context, wallet, history }` → `{ response, skill_results? }` (x402: $0.002)
- `POST /heartbeat` — `{ soul, memory, wallet, watched_tokens, alerts, portfolio_tokens }` → `{ status, notify, message?, triggers? }` (x402: $0.002)
- `POST /briefing` — `{ type, soul, memory, wallet, daily_log, watched_tokens, portfolio_tokens }` → `{ response, portfolio_value }` (x402: $0.005)
- `GET /price/:symbol` — `{ symbol, price, change_24h, source }` (free, add `?detailed=true` for volume + market cap)
- `POST /swap/swap-quote` — `{ from, to, amount }` → `{ success, quote, rawResponse }` (x402: $0.003)
- `POST /swap/swap-execute` — `{ quoteResponse, userPublicKey }` → `{ success, transaction }` (x402: $0.005)
- `POST /park/generate` — `{ soul, memory, wallet, park_context, prompt_type }` → `{ content, prompt_type }` (x402: $0.005)
- `GET /balance/:wallet` — `{ wallet, balance }` (free)
- `POST /deposit/credit-test` — `{ wallet, amount }` → credits test balance (test mode only)
- `POST /deposit/deposit-address` — `{ wallet }` → `{ depositAddress }` (for SOL deposits)
- `GET /api/defi/yields` — `?sort=apy&limit=10&token=SOL` → `{ pools: [...] }` (free, DeFiLlama, 5min cache)
- `GET /api/tokens/trending` — `?limit=5` → `{ tokens: [...] }` (free, DexScreener, 1min cache)
- `GET /api/tokens/research/:addressOrSymbol` — token research with safety scoring (free, DexScreener, 30s cache)
- `GET /api/tokens/new` — `?limit=10&minLiquidity=10000` → `{ tokens: [...] }` (free, DexScreener latest profiles, 1min cache)
- `POST /api/whale/watch` — `{ wallet, label? }` → add whale to watch list (x402: $0.002)
- `GET /api/whale/watched` — `{ wallets, total }` (free)
- `DELETE /api/whale/watch/:wallet` — remove whale from watch list (free)
- `GET /api/whale/activity/:wallet` — `{ wallet, transactions, source }` (free, Helius API + mock fallback, 1min cache)
- `GET /api/whale/feed` — aggregated feed of all watched wallets (free, 30s cache)
- `GET /api/domains/check/:name` — check .os domain availability (free)
- `GET /api/domains/price/:name` — get domain pricing with USD conversion (free)
- `POST /api/domains/register` — `{ name, wallet, txSignature }` → register .os domain (requires on-chain SOL payment)
- `GET /api/domains/my/:wallet` — get domain info for a wallet (free)
- `GET /api/domains/lookup/:domain` — reverse lookup: domain → wallet (free)
- `GET /api/domains/leaderboard` — top verified agents (free)
- `GET /api/domains/stats` — domain registration stats & revenue (free)
- `GET /api/memory/:wallet` — get all persistent memories for a wallet (free, `?category=trading`)
- `POST /api/memory/save` — `{ wallet, content, category?, source? }` → save a memory fact (free)
- `DELETE /api/memory/:wallet/:id` — delete a specific memory (free)
- `POST /api/memory/forget` — `{ wallet, search_term }` → forget memories matching search (free)
- `GET /api/memory/daily/:wallet` — get today's daily log (free)
- `POST /api/memory/daily/event` — `{ wallet, event_type, content }` → log a daily event (free)
- `GET /api/memory/daily/recent/:wallet` — get recent daily logs (free)
- `GET /api/memory/summary/:wallet` — AI-generated daily summary (free)
- `GET /api/memory/recap/:wallet` — AI-generated weekly recap (free)
- `GET /api/memory/prompt/:wallet` — formatted memory string for AI prompt (free)
- `GET /api/memory/credits/:wallet` — credit balance info (free)

## Architecture Conventions
- **Entry point**: `expo-router/entry` (set in package.json `main`)
- **Routing**: File-based via expo-router. Tabs in `app/(tabs)/`.
- **State management**: Zustand with `create()`. Access outside React via `useStore.getState()`.
- **Memory system**: All persistent data in AsyncStorage with `@openseeker/` prefix. Services in `services/memory.ts`.
- **API calls**: All server communication goes through `services/api.ts`. Paid endpoints use `paidFetch()` from `services/x402.ts`.
- **x402 payments**: Dual-mode on server: (1) Real x402 protocol via @x402/express + @x402/svm — checks PAYMENT-SIGNATURE header, uses Coinbase facilitator for settlement. (2) Credit system fallback via X-Wallet header + SQLite balance. Client `paidFetch()` handles 402 → create payment → retry. Test mode: `test:{wallet}:{timestamp}` header. Spending tracked in `services/spending.ts`.
- **Memory engine**: `services/memoryEngine.ts` runs after every AI response — logs to DAILY, extracts facts, compresses context every 20 messages.
- **Heartbeat**: Background fetch (30min) + foreground interval as backup. Checks prices, evaluates portfolio, triggers alerts, checks trading orders, checks DCA, reads Agent Park messages when parkMode !== 'off', calls AI for notable events.
- **Notifications**: Local push via expo-notifications. Android channel: "openseeker-alerts". Morning briefing at 7AM, night summary at 10PM.
- **Price alerts**: Stored in AsyncStorage `@openseeker/alerts`. Checked during heartbeat. Managed in Settings tab.
- **DCA automations**: Stored in AsyncStorage `@openseeker/automations`. Checked during heartbeat. Log-only execution for hackathon.
- **Trading orders**: Stored in AsyncStorage `@openseeker/orders`. Types: limit_buy, limit_sell, stop_loss. Created via chat skills. Price watcher polls every 60s when active orders exist, auto-stops when none. Orders auto-execute via swap service when price triggers hit. Notifications sent on fill/expire/fail.
- **Embedded wallet**: App holds keypair in expo-secure-store. `services/embeddedWallet.ts` handles mnemonic generation (@scure/bip39), BIP44 derivation (manual HMAC-SHA512), and key storage. `stores/walletStore.ts` exports `signAndSendTransaction()` which auto-routes by `walletType` — embedded uses local keypair, Privy delegates to `privyBridge.ts`.
- **Privy wallet**: Optional login via Google OAuth or Email OTP. Privy auto-creates Solana embedded wallet. `PrivyBridgeSync` component syncs Privy hooks → singleton bridge. `walletStore.ts` stores `walletType: 'embedded' | 'privy'` in AsyncStorage. Privy App ID: `cmlb2hg5r02qiky0efhf457my`.
- **Onboarding**: `app/onboarding.tsx` shown when no wallet exists. Five wallet flows + agent naming step + .os domain upsell. After wallet creation/import, user names their agent (default "DegenCat", 2-20 chars, alphanumeric + underscore/dash), then sees a domain upsell screen offering `{name}.os` with tier/price info. Name stored in AsyncStorage `@openseeker/agent_name` + settingsStore. Domain info stored in `@openseeker/os_domain`. Redirected from `_layout.tsx` via `isInitialized` check.
- **Agent naming**: Set during onboarding, used everywhere: chat responses, park posts, heartbeat notifications. Loaded on app startup via `loadAgentName()` in `_layout.tsx`. AI system prompt dynamically includes agent name.
- **Swap execution**: SwapCard in chat has Confirm/Cancel buttons. On confirm: embedded wallet signing → TransactionCard with tx signature.
- **Theme**: Dark theme (#0D0D0D bg). All colors/spacing from `constants/theme.ts`. No inline magic numbers.
- **Server AI**: Groq client lazily initialized to avoid crash when no API key. Model: `llama-3.3-70b-versatile`.
- **Two-pass skill system**: Pass 1 detects intent via `[SKILL:name:params]` tags in AI response. Skills execute. Pass 2 formats results in personality.
- **Skill tag format**: `[SKILL:skill_name:param1=value1,param2=value2]`. Parsed by `parseSkillTags()` in `skills.js`.
- **Available skills**: price_check, portfolio_track, swap_quote, whale_watch, token_research, price_alert, dca_setup, news_digest, limit_buy, limit_sell, stop_loss, view_orders, cancel_order, defi_yields, trending_tokens, liquid_stake, park_digest, park_consensus, park_post, new_tokens, view_alerts, cancel_alert, send_token, sell_token, rotate_token, go_stablecoin, whale_track, whale_activity, whale_stop, claim_domain, lookup_domain, my_memory, remember_this, forget_this, daily_recap, weekly_recap.
- **Park skills**: `park_digest` summarizes recent park messages (client sends park_context). `park_consensus` aggregates agent opinions on a token weighted by reputation. `park_post` posts to park (requires parkMode === 'active'). Park context injected in chat route like wallet_content.
- **Reputation system**: `services/reputation.ts` — `getReputationTier(score)` (Newbie/Regular/Trusted/Elite), `calculateConsensus(messages)` weights sentiment by agent reputation + confidence. Schema ready for post-hackathon 24h verification.
- **Agent Park settings**: `settingsStore.ts` has agentName, agentId, parkMode ('off'|'listen'|'active'), parkBudgetDaily ($0.05), parkSpentToday, parkTopics. Settings UI section with mode selector, budget, topic toggles.
- **Domain identity**: `settingsStore.ts` has osDomain, isVerified, domainTier, domainExpiresAt. Persisted in AsyncStorage `@openseeker/os_domain`. Loaded during `loadAgentName()`. `VerifiedBadge` component shows tier-based badges (OG: gold crown, Premium: purple gem, Standard: blue check). Integrated in chat header, park messages, leaderboard, agent cards, settings.
- **Skill results**: Returned as `skill_results` array alongside `response`. Each has `{ skill, success, data?, error? }`.
- **Skill cards**: `SkillCard.tsx` renders rich UI cards for each skill type (price, portfolio, swap, whale, research, alert, dca, orders, send, sell, new tokens, whale tracking, domain). `OrderCard.tsx` handles limit_buy/sell, stop_loss, view_orders, cancel_order. `SendConfirmCard.tsx` handles send_token. `SellConfirmCard.tsx` handles sell_token, rotate_token, go_stablecoin. `WhaleTrackCard.tsx` handles whale_track/activity/stop. `NewTokensCard.tsx` handles new_tokens. `DomainClaimCard.tsx` handles claim_domain/lookup_domain.
- **Persistent Memory**: SQLite-based agent brain (`server/services/memory.js`). Auto-extracts facts from chat via AI (async, non-blocking). Categories: preference, portfolio, trading, personal, strategy, general. Max 100 memories per wallet. Daily event logging with AI-generated summaries. Memory injected into chat system prompt as "PERSISTENT BRAIN" section. 5 memory skills: my_memory, remember_this, forget_this, daily_recap, weekly_recap. Heartbeat logs portfolio events to daily log. Chat route reads X-Wallet header to identify wallet for memory operations.
- **CoinGecko**: 60s in-memory cache (extends to 5min on 429 rate limit). Symbol→ID mapping in `coingecko.js`. Mock fallback on API failure.
- **Jupiter**: Swap quotes + swap transactions via `api.jup.ag/swap/v1`. Falls back to mock rates/transactions when API unavailable.

## Key Design Decisions
- Tab icons are emoji `<Text>` components (not vector icons) for simplicity
- `Platform.select()` used for font family in StyleSheet (iOS: Menlo, Android: monospace)
- Server and app have separate `package.json` / `node_modules`
- Chat history (last 10 messages) sent with every request for conversation continuity
- Connection status dot (green/red) checks `/health` every 30 seconds
- Heartbeat runs initial check 5s after app launch, then on configured interval
- CoinGecko free API — batch requests where possible to minimize calls
- Wallet parser supports both `- SOL: 10 @ $180` and `| SOL | 10 | 180 |` formats
- x402 dual-mode: real x402 SDK (PAYMENT-SIGNATURE header) + credit system (X-Wallet header). Health and price routes are free
- Swap execution uses embedded wallet auto-signing — no external wallet popup
- DCA runs in heartbeat but only logs (no actual swap execution for hackathon safety)
- Daily spend limit defaults to $1.00, configurable in Settings
- Portfolio fetches prices individually per holding from `/price/:symbol` (free endpoint)
- Agent Park uses Supabase for persistence + Realtime for live feed updates
- Park posts generated via `/park/generate` (x402: $0.005) with personality-driven AI
- Gamification: 10 levels (Newborn→Transcendent), XP earned from chat (+1), swap (+5/+10), DCA (+5), park post (+2)
- Achievements: 10 counter-based achievements tracked in AsyncStorage
- Quick action chips send pre-filled messages to the chat
- Agent Park is a modal screen accessed via FAB button on Chat tab

## Gotchas
- `llama-3.1-70b-versatile` was decommissioned — use `llama-3.3-70b-versatile`
- zsh shell mangles JSON with escaped characters — use `-d @file.json` for curl testing
- Must kill port 3000 between server restarts: `lsof -ti:3000 | xargs kill -9`
- CoinGecko free tier: 10-30 calls/min — cache auto-extends to 5min on 429
- `npm install --legacy-peer-deps` needed due to react-dom peer conflict with expo packages
- Background fetch on mobile is unreliable — foreground interval is the primary mechanism
- Jupiter v6 API (`quote-api.jup.ag`) deprecated — now `api.jup.ag/swap/v1` (may need API key). Mock fallback included.
- Skill handlers accept both `token` and `symbol` params for robustness (AI may use either)
- x402 middleware is dual-mode: real x402 SDK runs globally (checks PAYMENT-SIGNATURE), credit system is per-route via `x402(price)`. `req.x402Settled` flag prevents double-charging.
- Server `.env` needs `X402_MODE=test` for test payment verification. For real x402: set `X402_PAY_TO` (Solana address to receive payments), `X402_FACILITATOR_URL` (defaults to https://x402.org/facilitator), `SOLANA_NETWORK=mainnet` for prod.
- `paidFetch()` won't re-charge on second-request failure — only charges after successful retry
- Supabase needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` env vars
- Agent Park requires Supabase tables: `agent_profiles` (with unique wallet_address) and `park_messages` (with FK to agent_profiles)
- Supabase RLS: public read, insert for all, update owner-only on profiles
- `AbortSignal.timeout()` does NOT exist in React Native (Hermes engine) — use `AbortController` + `setTimeout` pattern instead (see `timeoutSignal()` helper in `services/balance.ts`)
- Embedded wallet: `signAndSendTransaction()` handles both legacy `Transaction` (from balance.ts deposits) and `Uint8Array` (from Jupiter VersionedTransaction). It auto-detects the type.
- SOL deposit flow: get deposit address from server → build `SystemProgram.transfer` tx → auto-sign with embedded wallet → confirm on-chain → server verifies and credits x402 balance
- SecureStore keys: `openseeker_mnemonic`, `openseeker_private_key`, `openseeker_address` — only `services/embeddedWallet.ts` should touch these
- Do NOT use `bip39` or `ed25519-hd-key` npm packages — they depend on Node.js `stream`/`cipher-base` which don't exist in React Native. Use `@scure/bip39` + `@noble/hashes` instead (pure JS, zero Node deps). BIP44 derivation is manual HMAC-SHA512 in `embeddedWallet.ts`.
- Release APK needs `android:usesCleartextTraffic="true"` in main `AndroidManifest.xml` — Expo prebuild only adds it to debug manifest. Without it, HTTP requests to `10.0.2.2:3000` silently fail.
- After `npx expo prebuild --clean`, must manually re-add `usesCleartextTraffic="true"` to `android/app/src/main/AndroidManifest.xml` `<application>` tag.
- New wallet needs test credits to work — heartbeat/chat return 402 without credits, which shows as "Offline". Credit via: `curl -X POST http://localhost:3000/deposit/credit-test -H "Content-Type: application/json" -d '{"wallet":"FULL_ADDRESS","amount":10}'`
- Dev builds cache JS bundles — Metro hot reload may not reach the app if it disconnects. Use `npx expo run:android` to rebuild with latest code, or ensure dev client URL points to Metro (`10.0.2.2:8081` for emulator)
- Privy requires `metro.config.js` with specific package export overrides (disable for `isows`/`zustand`, enable for `@privy-io/*`, browser condition for `jose`)
- Privy polyfills must be imported in `index.js` BEFORE app entry: `fast-text-encoding`, `react-native-get-random-values`, `@ethersproject/shims`
- Privy wallet cold start takes 1-3s — `signAndSendTransaction` waits up to 10s for provider to be ready when walletType is 'privy'
- `tsconfig.json` needs `"moduleResolution": "Bundler"` for Privy type resolution
- Server is Railway-ready: uses `process.env.PORT`, `trust proxy`, `0.0.0.0` binding. Deploy `server/` directory only.
- Railway env vars needed: `GROQ_API_KEY`, `X402_MODE` (test or production), optionally `X402_PAY_TO`, `SOLANA_NETWORK`
- After Railway deployment: update `DEFAULT_SERVER_URL` in `stores/settingsStore.ts` to Railway URL (e.g., `https://openseeker-server.up.railway.app`), then rebuild APK
- Real x402 SDK packages: `@x402/core`, `@x402/express`, `@x402/svm` (all ^2.3.0) — installed in server/
- `registerExactSvmScheme(server)` from `@x402/svm/exact/server` — NOT `new ExactSvmScheme().server` (that's client-side only)
- x402 route config needs `accepts: { scheme: 'exact', network, asset, amount, payTo, maxTimeoutSeconds }` wrapping — flat config causes "Cannot read 'network'" error
- Jupiter referral: `platformFeeBps=25` in quote URL, `feeAccount=FqQ7qbKWi8yYXFbbwDvPbqcwbKzyu5CLa7hFLRh58yc5` in swap body. 0.25% on all swaps.
- DeFiLlama API: `https://yields.llama.fi/pools` — free, returns all chains, must filter `chain === 'Solana'`. Cache 5min.
- DexScreener API: `token-boosts/top/v1` for trending, `latest/dex/tokens/{address}` for pair data, `latest/dex/search?q=` for symbol search. Free, no auth.
- Safety scoring: 1-10 scale based on liquidity, token age, volume, buy/sell ratio. Flags: LOW_LIQUIDITY, NEW_TOKEN, HIGH_SELL_PRESSURE.
- Liquid staking tokens: JitoSOL (`J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn`), mSOL (`mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So`), bSOL (`bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1`)
- SkillCard.tsx switch: do NOT duplicate `case` labels — JS falls through to the first match. The `token_research` case checks `data?.token` for DexScreener-enhanced rendering vs CoinGecko fallback.
- .os Domain System: Pricing is character-length based (OG 1-2: 2 SOL, Premium 3-4: 0.5 SOL, Standard 5+: 0.1 SOL). Test mode (`X402_MODE=test`) allows `test_simulation` tx signatures for domain registration. Treasury wallet set via `TREASURY_WALLET` env var. In-memory domain storage used as fallback when Supabase is not configured. Domain state persisted in AsyncStorage `@openseeker/os_domain`.
- send_token resolves .os domain names to wallet addresses via `/api/domains/lookup/`. The `osDomain` field in skill result indicates a domain was resolved.
- Onboarding flow now: wallet creation → agent naming → .os domain upsell → main app. Users can skip domain claim and do it later via chat.
- Groq free tier: 100k tokens/day (TPD) limit on `llama-3.3-70b-versatile`. `ai.js` auto-falls back to `llama-3.1-8b-instant` on TPD exhaustion or rate limits. Fallback model has lower quality but keeps the app functional.
- Persistent memory uses X-Wallet header from paidFetch to identify wallet address for memory operations. Memory extraction runs async after each chat response (non-blocking). Max 100 memories per wallet. Memory tables are in the same SQLite DB as credit system (server/openseeker.db).
- Memory extraction AI call uses separate Groq request — counts against TPD. If extraction fails, chat still works (extraction is fire-and-forget).
- Daily log events accumulate without limit — consider periodic cleanup for production.

## Day Progress
- **Day 1**: Foundation — scaffolding, screens, stores, server, memory system
- **Day 2**: AI Chat — api service, memory engine, chat flow with personality + context + skill detection
- **Day 3**: Heartbeat + Notifications — CoinGecko prices, heartbeat engine, price alerts, push notifications, morning/night briefings
- **Day 4**: Skills System — two-pass AI skill detection, 7 skills (price, portfolio, swap, whale, research, alerts, news), rich SkillCard UI, Jupiter/CoinGecko integration
- **Day 5**: x402 Payments + Swap Execution + Polish — x402 micropayment protocol (test mode), spending tracker, swap execution with confirm/cancel UI, TransactionCard, DCA foundation, full Portfolio tab with live prices, Skills tab with 8-skill grid, expanded Settings (spending, DCA, wallet, memory, advanced sections), CoinGecko 429 handling
- **Day 6**: Agent Park + Demo Polish — Supabase integration, Agent Park (profiles, leaderboard, town square, realtime), park post generation via AI, gamification (XP/levels/achievements), quick action chips, level badge, offline banner, improved error messages, token emojis, skeleton loading, demo seed data, DEMO.md script
- **Day 7**: Embedded Wallet Migration — Replaced MWA (Phantom) with embedded wallet (expo-secure-store + @scure/bip39 + @noble/hashes + tweetnacl). App holds keypair, auto-signs all transactions. Added onboarding screen (create/import wallet flows). Removed all MWA dependencies. Fixed Node.js `stream` polyfill error by switching to pure JS crypto libs. Fixed release APK cleartext traffic for local dev server.
- **Day 8**: Trading Order System — Limit buy/sell, stop loss orders via chat. 5 new skills (limit_buy, limit_sell, stop_loss, view_orders, cancel_order). Price watcher (60s polling when orders active). Auto-execution via swap service. OrderCard UI in chat. Active Orders section in Settings. Heartbeat integration for order checking.
- **Day 9**: Privy Integration + Real x402 + Polish — Added Privy SDK for Google/Email login (alternative to embedded wallet). Singleton bridge pattern for non-React Privy access. Real x402 SDK integration on server (dual mode: @x402/express + credit fallback). UI polish: keyboard handling, auto-scroll, offline retry button, improved error messages. Server Railway-ready (PORT env, trust proxy, rate limits). Final APK built and tested.
- **Day 10**: DeFi Skills + Jupiter Referral — Jupiter referral fee (0.25%, account FqQ7qbKWi8yYXFbbwDvPbqcwbKzyu5CLa7hFLRh58yc5) on all swaps. 3 new skills: defi_yields (DeFiLlama API, pool categorization, difficulty ratings), trending_tokens (DexScreener boosts + pair data, safety scoring 1-10), liquid_stake (SOL→JitoSOL/mSOL/bSOL via Jupiter, APY from DeFiLlama). Enhanced token_research with DexScreener data (multi-timeframe prices, liquidity, buy/sell ratio, safety flags). 3 new chat UI cards: DefiYieldCard, TrendingTokensCard, TokenResearchCard. In-memory caching (server/utils/cache.js). New routes: /api/defi/yields, /api/tokens/trending, /api/tokens/research/:addressOrSymbol. Fixed duplicate switch case bug in SkillCard.tsx.
- **Day 11**: Agent Park Enhancement — Agent naming in onboarding (name-agent step after wallet creation, stored in AsyncStorage + settingsStore). Dynamic agent name throughout app (chat, park, heartbeat, notifications, AI system prompt). Park settings in Settings tab (mode: off/listen/active, daily budget, topic toggles). 3 new park skills (park_digest, park_consensus, park_post). Reputation system (services/reputation.ts — tiers, consensus calculation). Heartbeat reads park messages when parkMode !== 'off'. Chat sends agent_name + park_context to server for park skill context injection.
- **Day 12**: Advanced Skills — 10 new skills bringing total to 29. New Token Scanner (DexScreener latest profiles, safety scoring, age tracking). Send SOL/Tokens (services/transfer.ts, SystemProgram.transfer, confirm/cancel UI). Sell/Rotate/Emergency Exit (sell_token, rotate_token, go_stablecoin — all via Jupiter swap with confirm UI). Smart Price Alerts (view_alerts, cancel_alert — client-side alert CRUD). Whale Copy Trade (whale_track, whale_activity, whale_stop — AsyncStorage watched wallets, server /api/whale routes with Helius API + mock fallback). 4 new UI cards: SendConfirmCard, SellConfirmCard, WhaleTrackCard, NewTokensCard. Watched Wallets section in Settings. Extended /api/tokens with /new endpoint. Updated prompts.js with all new skill tags and rules.
- **Day 13**: Full Audit + Bug Fixes — End-to-end testing of all 17 server endpoints and all 29 skills via /chat. Fixed: AI fallback model (llama-3.1-8b-instant) for Groq rate limit/TPD exhaustion in ai.js. Fixed whale_activity skill crash (missing `label` parameter destructuring). Added 4 missing SkillCard cases (news_digest, park_digest, park_consensus, park_post). Added order creation field validation in chatStore.ts. Added swap_quote parameter validation in skills.js. TypeScript 0 errors. Jupiter referral verified on all swap paths. Settings audit: all 14 sections present.
- **Day 14**: .os Domain Identity System — Full domain name system for AI agents. Tiered pricing: OG (1-2 chars, 2 SOL), Premium (3-4 chars, 0.5 SOL), Standard (5+ chars, 0.1 SOL). 7 new server endpoints (check, price, register, my, lookup, leaderboard, stats) at /api/domains/. On-chain SOL payment verification (server/services/solana.js) with replay attack protection. Domain config with reserved names (server/config/domains.js). Client-side domain service (services/domainService.ts). VerifiedBadge component with 3 tiers (OG gold crown, Premium purple gem, Standard blue check). Badge integrated in: chat header, Agent Park messages, leaderboard rows, agent cards, settings. 2 new skills: claim_domain, lookup_domain (total: 31). DomainClaimCard UI for chat. Onboarding .os upsell screen after agent naming. send_token resolves .os domains to wallet addresses. Settings domain identity section. Demo seed data includes verified agents. Supabase queries include domain fields. SQL migration for agent_profiles (os_domain, domain_tier, is_verified, etc.) + domain_registrations table. In-memory fallback for dev/demo. TypeScript 0 errors.
- **Day 15**: Emulator Testing + GitHub Push + Railway Deploy — Full end-to-end testing on Android emulator. Production APK built pointing to Railway server (https://openseeker-production.up.railway.app). GitHub repo live at https://github.com/makoto-isback/openseeker. Server deployed on Railway.
- **Day 16**: Persistent Agent Memory System — OpenClaw-style brain for the AI agent. SQLite-backed persistent memory with auto-extraction from chat. 2 new DB tables: agent_memory (facts about user, categorized, with confidence scores) and agent_daily_log (event logging per day). Server-side memory service (server/services/memory.js) with AI-powered fact extraction, daily summaries, weekly recaps. 12 new API endpoints at /api/memory/. Memory injected into chat system prompt as "PERSISTENT BRAIN" section — AI naturally references stored facts. Heartbeat logs portfolio events. 5 new skills: my_memory (show stored memories), remember_this (explicit save), forget_this (delete by search), daily_recap (AI summary of today), weekly_recap (7-day summary). MemoryCard.tsx component with 5 card variants. Total skills: 36. TypeScript 0 errors. All endpoints tested and working.
- **Day 15 (original)**: Emulator Testing — Full end-to-end testing on Android emulator (Pixel device, API 35). APK built (67MB), installed, and tested every screen and flow. Cold start ~3s. Onboarding flow verified: wallet creation (mnemonic generation + 12-word display), agent naming (default "DegenCat"), .os domain upsell (skip works). Chat tab verified: AI responses, memory engine, skill cards, quick action chips, FAB button, level badge, connection status indicator. All 31 skills tested via server API — all returning correct data (CoinGecko live prices, DexScreener trending/research, DeFiLlama yields, Jupiter swap quotes). Portfolio/Skills/Settings tabs all render without errors. Settings has all 14 sections: SOUL.md, Memory, Wallet, Daily Log, Clear/Reset, Gamification (XP/levels), Domain Identity, Agent Park (mode selector, topics), Deposit SOL (presets + custom), Test Credits, Active Orders, Watched Wallets, Price Alerts, Advanced (Server URL, x402 mode). 402 error handling verified — shows user-friendly "Insufficient credits" message. Zero JS errors, zero warnings (session), zero ANR, zero native crashes, zero TypeScript errors. **VERDICT: READY FOR DEMO.**

## Emulator Test Results (Day 15)
```
Build: PASS (APK 67MB)
Install: PASS
Launch: PASS (~3s cold start)
TypeScript: 0 errors
JS Errors: 0
JS Warnings: 0 (in session)
ANR: 0
Native Crashes: 0

Onboarding: ALL PASS
  - Create wallet (mnemonic gen + display)
  - Agent naming (default + custom)
  - .os domain upsell (claim + skip)

Chat: ALL PASS
  - Send/receive messages
  - AI personality + memory engine
  - Quick action chips
  - Level badge + connection status
  - 402 error handling (user-friendly message)

Skills (31 total): ALL PASS via server API
  - price_check (CoinGecko live)
  - portfolio_track
  - swap_quote (Jupiter)
  - trending_tokens (DexScreener live)
  - defi_yields (DeFiLlama live)
  - token_research (DexScreener + safety scoring)
  - new_tokens (DexScreener)
  - price_alert / view_alerts / cancel_alert
  - limit_buy / limit_sell / stop_loss / view_orders / cancel_order
  - send_token / sell_token / rotate_token / go_stablecoin
  - whale_track / whale_activity / whale_stop
  - claim_domain / lookup_domain
  - park_digest / park_consensus / park_post
  - dca_setup / news_digest / liquid_stake

Tabs: ALL PASS
  - Chat: messages, skill cards, FAB
  - Portfolio: value, holdings, wallet address
  - Skills: 8-skill grid, spend stats
  - Settings: all 14 sections render

Server Endpoints (20+): ALL PASS
  - Free: /health, /price/:symbol, /balance/:wallet, /api/defi/yields,
    /api/tokens/trending, /api/tokens/research/:addr, /api/tokens/new,
    /api/whale/watched, /api/whale/activity/:wallet, /api/whale/feed,
    /api/domains/check/:name, /api/domains/price/:name, /api/domains/my/:wallet,
    /api/domains/lookup/:domain, /api/domains/leaderboard, /api/domains/stats
  - Paid (x402): /chat, /heartbeat, /briefing, /swap/swap-quote,
    /swap/swap-execute, /park/generate, /api/whale/watch
  - Credit: /deposit/credit-test, /deposit/deposit-address
```

## Post-Hackathon Roadmap

### Fine-Tuning Plan (3 weeks post-hackathon)
- Fine-tune Llama 3 70B on 1000+ crypto-specific examples (Solana dApps, DeFi, trading, memecoins, on-chain data, agent personality)
- Data sources: Supabase daily_log + chat history exports, 500 Claude-generated Q&A, 200 manual edge cases
- Format: JSONL messages pairs
- Platform: Together.ai or Fireworks.ai ($50-200 one-time, ~$0.20/1M tokens inference)
- Goal: reduce system prompt by ~50%, model natively speaks crypto

### Post Fine-Tune Routing
- Custom Llama (Together.ai) → all crypto queries
- Gemini 2.0 Flash → general knowledge fallback
- Groq → memory extraction (cheap/fast)

### Current Multi-Model Routing
- Groq (free) → greetings, price checks, simple chat
- Gemini 2.0 Flash (free, 1500/day) → complex analysis, research, trading advice
- GPT-4o-mini → backup if Gemini fails (needs OpenAI key)

### Feature Tiers
- **Month 1**: On-chain history (Helius), tx simulation (Jupiter), push notifications, routing optimization, fine-tune model
- **Month 2-3**: PnL charts, strategy backtesting, multi-program (Raydium/Orca/Tensor), NFT awareness, agent tipping, home widget
- **Month 4+**: Agent marketplace, copy-agent, reputation NFTs, DAO governance, cross-chain (Wormhole), on-chain .os domain NFTs

### Revenue Targets
- Month 1 (50 users): ~$140/month (AI credits + Jupiter referral + .os domains)
- Month 3 (500 users): ~$1,400/month
- Month 6 (5000 users): $10,000/month target

### Competitive Moat
1. Persistent memory (unique in crypto)
2. Mobile-first with embedded wallet
3. Agent Park social layer
4. Fine-tuned crypto AI
5. .os identity system
6. Revenue from day 1 (not token-dependent)

### Pitch Line
"OpenClaw gave AI agents a computer. OpenSeeker gives AI agents a wallet."
