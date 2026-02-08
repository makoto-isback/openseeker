require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Initialize database (creates tables on startup)
require('./db');

const chatRouter = require('./routes/chat');
const heartbeatRouter = require('./routes/heartbeat');
const priceRouter = require('./routes/price');
const healthRouter = require('./routes/health');
const briefingRouter = require('./routes/briefing');
const swapRouter = require('./routes/swap');
const parkRouter = require('./routes/park');
const balanceRouter = require('./routes/balance');
const depositRouter = require('./routes/deposit');
const defiRouter = require('./routes/defi');
const tokensRouter = require('./routes/tokens');
const whaleRouter = require('./routes/whale');
const domainsRouter = require('./routes/domains');
const memoryRouter = require('./routes/memory');
const pricesRouter = require('./routes/prices');
const x402PublicRouter = require('./routes/x402Public');
const spiritRouter = require('./routes/spirit');
const referralRouter = require('./routes/referral');
const { buildRealX402Middleware } = require('./middleware/x402');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Trust proxy for Railway (needed for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Rate limiter: 200 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Real x402 protocol middleware (handles PAYMENT-SIGNATURE header)
// Falls through to credit system for X-Wallet header requests
const realX402 = buildRealX402Middleware();
app.use(realX402);

// Routes
app.use('/chat', chatRouter);
app.use('/heartbeat', heartbeatRouter);
app.use('/price', priceRouter);
app.use('/health', healthRouter);
app.use('/briefing', briefingRouter);
app.use('/swap', swapRouter);
app.use('/park', parkRouter);
app.use('/balance', balanceRouter);
app.use('/deposit', depositRouter);
app.use('/api/defi', defiRouter);
app.use('/api/tokens', tokensRouter);
app.use('/api/whale', whaleRouter);
app.use('/api/domains', domainsRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/x402', x402PublicRouter);
app.use('/api/spirit-animal', spiritRouter);
app.use('/api/referral', referralRouter);

// Log startup config
console.log(`[Server] Port: ${PORT}`);
console.log(`[Server] x402 mode: ${process.env.X402_MODE || 'production'}`);
console.log(`[Server] Deposit wallet: ${process.env.DEPOSIT_WALLET || '(not set)'}`);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OpenSeeker server running on port ${PORT}`);
});
