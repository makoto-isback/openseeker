# OpenSeeker — CLAUDE.md

## Project Overview
OpenSeeker is a crypto-native AI companion app for the Solana Seeker phone. Built with Expo (React Native + TypeScript) for the mobile app and Express.js for the server.

## Tech Stack
- **App**: Expo SDK 54, React Native 0.81, TypeScript, expo-router v6
- **State**: Zustand stores
- **Storage**: AsyncStorage (keys prefixed `@openseeker/`)
- **Server**: Express.js (in `server/` with its own package.json)
- **AI**: Multi-model routing (Groq → Gemini → OpenAI fallback chain) with tool tag system
- **Prices**: CoinGecko free API with 60s in-memory cache (extends to 5min on 429) + Allium enterprise blockchain data (historical prices, PnL, tx history)
- **Notifications**: expo-notifications (local push)
- **Background**: expo-background-fetch + expo-task-manager
- **Payments**: x402 standard protocol (x402-solana + PayAI facilitator) + legacy credit system fallback. 100 free messages per wallet, then USDC per-request via x402.
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
│   ├── onboarding.tsx       # Wallet onboarding — Google login, Email login, create new, import seed phrase, import private key, agent naming, risk consent, .os domain upsell
│   ├── park.tsx             # Agent Park modal — leaderboard, town square, post flow
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar config (Chat, Portfolio, Skills, Settings)
│       ├── index.tsx        # Chat screen with level badge, quick actions, FAB, offline banner
│       ├── portfolio.tsx    # Portfolio — on-chain holdings (SOL + SPL tokens), live prices, automations
│       ├── skills.tsx       # 8-skill grid with spend stats, coming soon section
│       └── settings.tsx     # Alerts, heartbeat, spending, DCA, gamification, domain identity, wallet, memory, advanced
├── components/chat/
│   ├── MessageBubble.tsx    # Chat bubble with avatar + skill cards for AI messages
│   ├── SkillCard.tsx        # Rich cards for skill results (price, portfolio, swap, whale, research, alert, dca, orders, send, sell, new tokens, whale tracking)
│   ├── OrderCard.tsx        # Rich cards for trading orders (limit buy/sell, stop loss, view orders)
│   ├── TransactionCard.tsx  # Green-bordered card for completed swaps with tx signature
│   ├── DefiYieldCard.tsx    # DeFi yield pools with APY, TVL, difficulty, stake buttons
│   ├── TrendingTokensCard.tsx # Trending tokens with safety bars, buy buttons, risk disclaimer
│   ├── TokenResearchCard.tsx  # Deep token research with multi-timeframe data, safety analysis
│   ├── SendConfirmCard.tsx  # Send SOL/tokens confirm card with address, amount, auto-execute when risk accepted
│   ├── SellConfirmCard.tsx  # Sell/rotate/emergency exit confirm card, auto-execute when risk accepted
│   ├── WhaleTrackCard.tsx   # Whale tracking card (track/activity/stop states)
│   ├── NewTokensCard.tsx    # New token scanner card with age, safety scores, risk disclaimer
│   ├── DomainClaimCard.tsx  # .os domain claim/lookup card (tier badge, price, benefits, claim button)
│   └── MemoryCard.tsx       # Memory skill cards (show, remember, forget, daily/weekly recap)
├── components/spirit/
│   ├── BrailleCanvas.ts     # Unicode Braille rendering engine (2×4 pixel per char, drawing primitives)
│   ├── animals.ts           # 8 animated animal renderers (dragon, wolf, phoenix, jellyfish, serpent, butterfly, owl, koi)
│   ├── SpiritAnimal.tsx     # Display component (full/mini/chat sizes, 30fps animation loop)
│   ├── SpiritAnimalPicker.tsx # Selection screen (2-column grid, animated preview, confirm/skip)
│   └── index.ts             # Barrel exports
├── components/park/
│   ├── AgentCard.tsx        # Your agent profile card (avatar/spirit animal, name, level, XP bar, stats)
│   ├── LeaderboardRow.tsx   # Rank + avatar + name + level + win rate (compact row)
│   ├── ParkMessage.tsx      # Agent message in Town Square (avatar, name, time, content, type badge)
│   └── PostButton.tsx       # Generate + preview + confirm flow with prompt type
├── components/common/
│   ├── Skeleton.tsx         # Pulsing placeholder bars for loading states
│   ├── OfflineBanner.tsx    # Yellow warning banner when offline, with retry button
│   └── VerifiedBadge.tsx    # Tier-based verified badge (OG/Premium/Standard) with tap tooltip
├── constants/
│   ├── theme.ts             # Dark theme colors, spacing, fontSize, borderRadius
│   ├── defaults.ts          # Default MEMORY.md template
│   ├── tokenMints.ts        # Solana mint address → symbol mapping (TOKEN_MINTS, SYMBOL_TO_MINT)
│   └── tokenEmojis.ts       # Token symbol → emoji mapping (SOL→◎, BTC→₿, etc.)
├── supabase/
│   ├── client.ts            # Supabase client singleton (EXPO_PUBLIC_ env vars)
│   └── agentPark.ts         # Agent Park service — profiles, leaderboard, messages, realtime
├── services/
│   ├── memory.ts            # AsyncStorage CRUD for memory + daily keys
│   ├── onChainPortfolio.ts  # Fetch real SOL + SPL token balances from Solana RPC, price resolution, 30s cache
│   ├── api.ts               # HTTP client: sendMessage, heartbeat, briefing, checkHealth, swap, park endpoints
│   ├── x402.ts              # x402 payment protocol — paidFetch wrapper, handles standard + legacy 402 responses
│   ├── x402Client.ts        # x402 standard client — x402Fetch wrapper for React Native
│   ├── privyBridge.ts       # Singleton bridge: stores Privy provider for non-React service code
│   ├── spending.ts          # Spend tracking — recordSpend, getTodaySpend, getMonthSpend, checkDailyLimit
│   ├── embeddedWallet.ts    # Core crypto layer — mnemonic gen, BIP44 derivation, SecureStore
│   ├── swap.ts              # Client swap execution — embedded wallet signing + submission + XP
│   ├── dca.ts               # DCA automation CRUD (AsyncStorage @openseeker/automations) + XP
│   ├── orders.ts            # Trading order CRUD + auto-execution (limit buy/sell, stop loss)
│   ├── priceWatcher.ts      # Fast price polling (60s) when active orders exist
│   ├── memoryEngine.ts      # Post-response processing: daily log, fact extraction, context compression
│   ├── heartbeat.ts         # Background + foreground heartbeat execution + DCA checks
│   ├── notifications.ts     # Push notification setup, local send, daily scheduling
│   ├── alerts.ts            # Price alert CRUD (AsyncStorage @openseeker/alerts)
│   ├── gamification.ts      # XP + leveling system (10 levels, AsyncStorage)
│   ├── achievements.ts      # 10 achievements with counter-based tracking
│   ├── reputation.ts        # Agent Park reputation system (tiers, consensus calculation)
│   ├── transfer.ts          # SOL/SPL token transfer service (sendSOL, simulated fallback)
│   ├── whaleCopyTrade.ts    # Whale wallet tracking service (AsyncStorage CRUD)
│   ├── demoSeed.ts          # Seed demo agents + messages to Supabase
│   └── domainService.ts     # .os domain client service (check, register, lookup, getMyDomain)
├── stores/
│   ├── chatStore.ts         # Messages, send flow, loading state, DCA + order side-effects, trade skill gating
│   ├── orderStore.ts        # Trading orders state, placeOrder, cancelOrder
│   ├── memoryStore.ts       # MEMORY + DAILY content (soul/wallet removed — on-chain data replaces .md files)
│   ├── walletStore.ts       # Embedded/Privy wallet state, on-chain holdings (SOL + SPL tokens), signAndSendTransaction, refreshHoldings
│   └── settingsStore.ts     # Server URL, heartbeat config, notification toggles, daily spend limit, risk consent state
├── utils/
│   └── formatters.ts        # Price, number, percent, time formatting
├── components/
│   ├── PrivyBridgeSync.tsx  # Syncs Privy wallet hooks → singleton bridge for non-React code
│   └── RiskConsentScreen.tsx # One-time risk acceptance screen (OpenClaw-style) for auto-trade execution
├── server/
│   ├── index.js             # Express setup, CORS, rate limiting, route mounting, real x402 middleware, Railway-ready
│   ├── middleware/x402.js   # Legacy x402: credit system (X-Wallet) + test mode + real @x402/express
│   ├── middleware/x402Middleware.js  # x402 standard: x402Gate() with free messages + PayAI + legacy fallback
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
│   │   ├── memory.js        # Persistent memory routes (get, save, forget, daily, recap)
│   │   ├── spirit.js        # Spirit animal routes (set, get by wallet)
│   │   └── referral.js     # Referral routes (generate, apply, stats, claim)
│   │   ├── x402Public.js   # Public x402 API for other agents (trending, price, research, whale, news, discovery)
│   │   ├── defi.js          # GET /api/defi/yields — DeFiLlama Solana pools with categorization (free)
│   │   └── tokens.js        # GET /api/tokens/trending + /api/tokens/research/:address — DexScreener (free)
│   ├── utils/
│   │   └── cache.js         # Simple in-memory cache (getCached/setCache/clearCache)
│   ├── config/
│   │   └── domains.js       # Domain pricing, tiers, reserved names, validation
│   ├── migrations/
│   │   └── add-os-domains.sql  # SQL migration for domain columns + registrations table
│   └── services/
│       ├── ai.js            # Groq SDK wrapper (lazy init, no 8b fallback)
│       ├── aiRouter.js      # Multi-model routing: Groq 70b → Gemini 2.0 Flash → OpenAI fallback chain
│       ├── coingecko.js     # CoinGecko API: getPrice, getPrices, getMarketData (60s cache, 5min on 429)
│       ├── prompts.js       # Two-pass prompt builder (tool tag intent detection + result formatting)
│       ├── skills.js        # Skill registry: 41 skills + tool tag parser (TOOL_TAG_MAP, parseToolTags, cleanToolTags)
│       ├── jupiter.js       # Jupiter Quote + Swap Transaction APIs with mock fallback
│       ├── solscan.js       # Mock whale transaction data
│       ├── tokenResearch.js # Token safety analysis (CoinGecko + heuristics)
│       ├── news.js          # CoinGecko trending + mock news fallback
│       ├── walletParser.js  # Server-side wallet markdown parser
│       ├── memory.js        # Persistent agent memory service (SQLite-backed)
│       ├── solana.js        # On-chain payment verification (domain registration)
│       ├── x402Handler.js   # x402-solana X402PaymentHandler wrapper + pricing tiers
│       └── allium.js        # Allium blockchain data API client (prices, PnL, txs, history)
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
- `POST /api/referral/generate` — `{ wallet, custom_code? }` → generate or get referral code (free)
- `POST /api/referral/apply` — `{ wallet, code }` → apply referral code during onboarding (free)
- `GET /api/referral/stats?wallet=` — referral dashboard data: code, count, earnings (free)
- `POST /api/referral/claim` — `{ wallet }` → request payout of unpaid earnings (free, min 0.005 SOL or $0.50 USDC)
- `POST /api/spirit-animal` — `{ wallet, animal }` → set spirit animal (free, requires .os domain)
- `GET /api/spirit-animal/:wallet` — get spirit animal for a wallet (free)
- `GET /api/x402/.well-known/x402` — x402 service discovery (free)
- `GET /api/x402/trending` — live trending tokens (x402: $0.001 USDC)
- `GET /api/x402/price/:symbol` — token price (x402: $0.0005 USDC)
- `GET /api/x402/research/:token` — deep token research (x402: $0.005 USDC)
- `GET /api/x402/whale-alerts` — whale movements (x402: $0.002 USDC)
- `GET /api/x402/news` — crypto news (x402: $0.001 USDC)
- `GET /api/x402/history/:symbol` — historical price data with OHLC, Powered by Allium (x402: $0.003 USDC, `?timeframe=24h`)

## Architecture Conventions
- **Entry point**: `expo-router/entry` (set in package.json `main`)
- **Routing**: File-based via expo-router. Tabs in `app/(tabs)/`.
- **State management**: Zustand with `create()`. Access outside React via `useStore.getState()`.
- **Portfolio data**: On-chain via Solana RPC (`Connection.getBalance` + `getParsedTokenAccountsByOwner`). `services/onChainPortfolio.ts` fetches real balances, resolves mint addresses via `constants/tokenMints.ts`, gets USD prices from `/price/:symbol`. Cached 30s. `walletStore.ts` is the single source of truth — has `holdings`, `totalUsd`, `portfolioData`, `refreshHoldings()`. No more WALLET.md or SOUL.md — all .md file dependencies removed (Day 18).
- **Memory system**: MEMORY.md + DAILY in AsyncStorage with `@openseeker/` prefix. Services in `services/memory.ts`.
- **API calls**: All server communication goes through `services/api.ts`. Paid endpoints use `paidFetch()` from `services/x402.ts`.
- **x402 payments**: Three-tier payment system via `x402Gate()` middleware: (1) Free messages — first 100 per wallet, tracked in SQLite `free_messages` table. (2) x402 standard protocol — `x402-solana` SDK, `X402PaymentHandler`, PayAI facilitator (`https://facilitator.payai.network`), USDC per-request, PAYMENT-SIGNATURE header. (3) Legacy credit system fallback — X-Wallet header + SQLite balance deduction. Public x402 API at `/api/x402/*` — other agents pay USDC to use OpenSeeker data (trending, price, research, whale, news). Discovery at `/api/x402/.well-known/x402`.
- **Memory engine**: `services/memoryEngine.ts` runs after every AI response — logs to DAILY, extracts facts, compresses context every 20 messages.
- **Heartbeat**: Background fetch (30min) + foreground interval as backup. Checks prices, evaluates portfolio, triggers alerts, checks trading orders, checks DCA, reads Agent Park messages when parkMode !== 'off', calls AI for notable events.
- **Notifications**: Local push via expo-notifications. Android channel: "openseeker-alerts". Morning briefing at 7AM, night summary at 10PM.
- **Price alerts**: Stored in AsyncStorage `@openseeker/alerts`. Checked during heartbeat. Managed in Settings tab.
- **DCA automations**: Stored in AsyncStorage `@openseeker/automations`. Checked during heartbeat. Log-only execution for hackathon.
- **Trading orders**: Stored in AsyncStorage `@openseeker/orders`. Types: limit_buy, limit_sell, stop_loss. Created via chat skills. Price watcher polls every 60s when active orders exist, auto-stops when none. Orders auto-execute via swap service when price triggers hit. Notifications sent on fill/expire/fail.
- **Embedded wallet**: App holds keypair in expo-secure-store. `services/embeddedWallet.ts` handles mnemonic generation (@scure/bip39), BIP44 derivation (manual HMAC-SHA512), and key storage. `stores/walletStore.ts` exports `signAndSendTransaction()` which auto-routes by `walletType` — embedded uses local keypair, Privy delegates to `privyBridge.ts`.
- **Privy wallet**: Optional login via Google OAuth or Email OTP. Privy auto-creates Solana embedded wallet. `PrivyBridgeSync` component syncs Privy hooks → singleton bridge. `walletStore.ts` stores `walletType: 'embedded' | 'privy'` in AsyncStorage. Privy App ID: `cmlb2hg5r02qiky0efhf457my`.
- **Onboarding**: `app/onboarding.tsx` shown when no wallet exists. Five wallet flows + agent naming + risk consent + .os domain upsell. After wallet creation/import, user names their agent (default "DegenCat", 2-20 chars), then sees one-time risk consent screen (accept or skip), then domain upsell. Name stored in AsyncStorage `@openseeker/agent_name` + settingsStore. Domain info stored in `@openseeker/os_domain`. Redirected from `_layout.tsx` via `isInitialized` check.
- **Agent naming**: Set during onboarding, used everywhere: chat responses, park posts, heartbeat notifications. Loaded on app startup via `loadAgentName()` in `_layout.tsx`. AI system prompt dynamically includes agent name.
- **Risk consent**: One-time OpenClaw-style risk acceptance. `settingsStore.ts` has `riskAccepted` + `riskAcceptedAt`, persisted in AsyncStorage `@openseeker/risk_consent`. Shown during onboarding (between agent naming and domain upsell). When accepted, all trade cards (SwapCard, SendConfirmCard, SellConfirmCard, LiquidStakeCard) auto-execute on mount — no confirm/cancel buttons. Trade skills gated in `chatStore.ts` — if `!riskAccepted`, trade skill results are filtered out and user sees consent prompt. `RiskConsentScreen.tsx` component with permissions list + risk disclaimers.
- **Swap execution**: When risk accepted, SwapCard auto-executes on mount → TransactionCard with tx signature. When not accepted, shows Confirm/Cancel buttons.
- **Theme**: Dark theme (#0D0D0D bg). All colors/spacing from `constants/theme.ts`. No inline magic numbers.
- **Server AI**: Multi-model routing via `aiRouter.js`. Groq 70b (free, fast) → Gemini 2.0 Flash (free, 1500/day) → OpenAI GPT-4o-mini (paid backup). Groq 8b fallback removed — when 70b hits TPD limit, skips directly to Gemini because 8b can't follow tool tag instructions. AI complexity classification routes simple queries to Groq, complex to Gemini.
- **Two-pass tool system**: Pass 1 detects intent via `[TAG:args]` tool tags in AI response (e.g. `[PRICE:SOL]`, `[SWAP:SOL,WIF,1]`). Skills execute. Pass 2 formats results in personality.
- **Tool tag format**: `[TAG_NAME:arg1,arg2,...]` — compact positional args. Parsed by `parseToolTags()` in `skills.js` using `TOOL_TAG_MAP` (37 entries). Falls back to legacy `[SKILL:name:params]` format via `parseSkillTags()`. Special cases: `ORDER` tag uses first arg as type (limit_buy/limit_sell/stop_loss), `RECAP` picks daily/weekly handler.
- **Available skills**: price_check, portfolio_track, swap_quote, whale_watch, token_research, price_alert, dca_setup, news_digest, limit_buy, limit_sell, stop_loss, view_orders, cancel_order, defi_yields, trending_tokens, liquid_stake, park_digest, park_consensus, park_post, new_tokens, view_alerts, cancel_alert, send_token, sell_token, rotate_token, go_stablecoin, whale_track, whale_activity, whale_stop, claim_domain, lookup_domain, my_memory, remember_this, forget_this, daily_recap, weekly_recap, price_history, wallet_pnl, tx_history, price_at_time, referral_stats.
- **Park skills**: `park_digest` summarizes recent park messages (client sends park_context). `park_consensus` aggregates agent opinions on a token weighted by reputation. `park_post` posts to park (requires parkMode === 'active'). Park context injected in chat route like wallet_content.
- **Reputation system**: `services/reputation.ts` — `getReputationTier(score)` (Newbie/Regular/Trusted/Elite), `calculateConsensus(messages)` weights sentiment by agent reputation + confidence. Schema ready for post-hackathon 24h verification.
- **Agent Park settings**: `settingsStore.ts` has agentName, agentId, parkMode ('off'|'listen'|'active'), parkBudgetDaily ($0.05), parkSpentToday, parkTopics. Settings UI section with mode selector, budget, topic toggles.
- **Domain identity**: `settingsStore.ts` has osDomain, isVerified, domainTier, domainExpiresAt. Persisted in AsyncStorage `@openseeker/os_domain`. Loaded during `loadAgentName()`. `VerifiedBadge` component shows tier-based badges (OG: gold crown, Premium: purple gem, Standard: blue check). Integrated in chat header, park messages, leaderboard, agent cards, settings.
- **Spirit Animal System**: Premium perk for .os domain holders. 8 animated Braille Unicode art animals rendered at 30fps using `BrailleCanvas` engine (2×4 pixel resolution per character, U+2800-U+28FF). Animals: dragon (#b388ff), wolf (#80cbc4), phoenix (#ffab91), jellyfish (#81d4fa), serpent (#c5e1a5), butterfly (#f48fb1), owl (#ffe082), koi (#ef9a9a). 3 display sizes: full (44×26), mini (22×13), chat (14×8). `SpiritAnimalPicker` shows after .os domain purchase. Persisted in AsyncStorage `@openseeker/spirit_animal` + server `users.spirit_animal` column. Shown in chat header (replaces `(=^.^=)` avatar) and Agent Park cards when user has .os domain + spirit animal.
- **Skill results**: Returned as `skill_results` array alongside `response`. Each has `{ skill, success, data?, error? }`.
- **Skill cards**: `SkillCard.tsx` renders rich UI cards for each skill type (price, portfolio, swap, whale, research, alert, dca, orders, send, sell, new tokens, whale tracking, domain). `OrderCard.tsx` handles limit_buy/sell, stop_loss, view_orders, cancel_order. `SendConfirmCard.tsx` handles send_token (auto-executes when risk accepted). `SellConfirmCard.tsx` handles sell_token, rotate_token, go_stablecoin (auto-executes when risk accepted). `WhaleTrackCard.tsx` handles whale_track/activity/stop. `NewTokensCard.tsx` handles new_tokens. `DomainClaimCard.tsx` handles claim_domain/lookup_domain.
- **Persistent Memory**: SQLite-based agent brain (`server/services/memory.js`). Auto-extracts facts from chat via AI (async, non-blocking). Categories: preference, portfolio, trading, personal, strategy, general. Max 100 memories per wallet. Daily event logging with AI-generated summaries. Memory injected into chat system prompt as "PERSISTENT BRAIN" section. 5 memory skills: my_memory, remember_this, forget_this, daily_recap, weekly_recap. Heartbeat logs portfolio events to daily log. Chat route reads X-Wallet header to identify wallet for memory operations.
- **Allium blockchain data**: Enterprise-grade on-chain data via `server/services/allium.js`. Base URL `https://api.allium.so/api/v1/developer`, auth via `X-API-KEY` header. 4 skills: price_history (OHLC candles, 5m-1d granularity), wallet_pnl (realized + unrealized P&L per token), tx_history (enriched transactions with labels), price_at_time (historical price at a specific date). All ADDITIVE — graceful fallback if `ALLIUM_API_KEY` not set or API fails. PnL auto-injected into wallet context in chat route. Attribution: "Powered by Allium" in responses. Public x402 API endpoint: `/api/x402/history/:symbol` ($0.003 USDC).
- **Referral System**: 10% revenue share. 3 SQLite tables: `referrals` (referrer→referred mapping), `referral_earnings` (per-transaction earnings), `referral_codes` (wallet→code). Code auto-generated from first 8 chars of wallet address. Applied during onboarding (between risk consent and domain upsell). Revenue tracked in: x402 middleware (USDC chat/API fees), domain registration route (SOL domain fees). 1 AI skill: `referral_stats` via `[REFERRAL]` tool tag. Client: `ReferralSection` in Settings, referral input step in onboarding. Min payout: 0.005 SOL or $0.50 USDC. Persisted in AsyncStorage `@openseeker/referral_code`. 4 server endpoints at `/api/referral/` (generate, apply, stats, claim).
- **CoinGecko**: 60s in-memory cache (extends to 5min on 429 rate limit). Symbol→ID mapping in `coingecko.js`. Mock fallback on API failure.
- **Jupiter**: Swap quotes + swap transactions via `api.jup.ag/swap/v1`. Falls back to mock rates/transactions when API unavailable.

## Gotchas
- `npm install --legacy-peer-deps` needed due to react-dom peer conflict with expo packages
- `AbortSignal.timeout()` does NOT exist in React Native (Hermes engine) — use `AbortController` + `setTimeout` pattern
- Do NOT use `bip39` or `ed25519-hd-key` npm packages — they depend on Node.js `stream`/`cipher-base`. Use `@scure/bip39` + `@noble/hashes` instead.
- SecureStore keys: `openseeker_mnemonic`, `openseeker_private_key`, `openseeker_address` — only `services/embeddedWallet.ts` should touch these
- WALLET.md and SOUL.md are fully removed — do NOT re-add `readSoul()`, `readWallet()`, `updateWallet()`, `walletParser`, or `walletManager`
- After `npx expo prebuild --clean`, must re-add `usesCleartextTraffic="true"` to `android/app/src/main/AndroidManifest.xml`
- New wallet needs test credits — 402 without credits shows as "Offline"
- Privy polyfills must be imported in `index.js` BEFORE app entry: `fast-text-encoding`, `react-native-get-random-values`, `@ethersproject/shims`
- Privy requires `metro.config.js` with specific package export overrides
- `registerExactSvmScheme(server)` from `@x402/svm/exact/server` — NOT `new ExactSvmScheme().server`
- x402 route config needs `accepts: { scheme, network, asset, amount, payTo, maxTimeoutSeconds }` wrapping — flat config causes "Cannot read 'network'" error
- SkillCard.tsx switch: do NOT duplicate `case` labels — JS falls through to the first match
- Server `.env` needs `X402_MODE=test` for test payments. Railway env vars: `GROQ_API_KEY`, `X402_MODE`, optionally `X402_PAY_TO`, `SOLANA_NETWORK`
- Jupiter referral: `platformFeeBps=25` in quote URL, `feeAccount=FqQ7qbKWi8yYXFbbwDvPbqcwbKzyu5CLa7hFLRh58yc5` in swap body
- x402-solana uses CAIP-2 network identifiers (e.g. `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` for devnet). Amounts in atomic units: $0.001 = '1000', $0.002 = '2000'
- x402Gate checks: free messages → PAYMENT-SIGNATURE (x402 standard) → X-Wallet (legacy credits) → 402. This order ensures backward compatibility
- Liquid staking mints: JitoSOL (`J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn`), mSOL (`mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So`), bSOL (`bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1`)
- Allium API: `ALLIUM_API_KEY` env var required for historical data features. Without it, price_history/wallet_pnl/tx_history/price_at_time return fallback messages. Allium uses POST for all endpoints (not GET). Token addresses are Solana mint addresses — resolved via MINT_MAP from jupiter.js. PnL endpoint is beta. Price history granularity: 15s (5d retention), 1m/5m (30d), 1h/1d (unlimited). Max 50 tokens per price history request, 200 per latest price request.

