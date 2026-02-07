const express = require('express');
const router = express.Router();
const { DOMAIN_PRICING, TREASURY_WALLET, getTier, getPrice, validateName } = require('../config/domains');
const { verifyDomainPayment } = require('../services/solana');
const { getPrice: getSOLPrice } = require('../services/priceCache');
const { getCached, setCache } = require('../utils/cache');

// Helper: get Supabase client (lazy require to avoid circular deps)
function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return null;
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

// In-memory fallback for demo/dev when Supabase is not configured
const memoryDomains = new Map();

// ============================================================
// GET /check/:name — Check domain availability
// ============================================================
router.get('/check/:name', async (req, res) => {
  try {
    const rawName = decodeURIComponent(req.params.name).trim();
    const validation = validateName(rawName);
    if (!validation.valid) {
      return res.json({ available: false, error: validation.error });
    }

    const name = validation.name;
    const nameLower = name.toLowerCase();
    const domain = `${name}.os`;
    const tier = getTier(name);
    const price = getPrice(name);

    // Check Supabase first
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from('agent_profiles')
        .select('wallet_address, os_domain, verified_at')
        .ilike('os_domain', `${nameLower}.os`)
        .maybeSingle();

      if (data) {
        return res.json({
          available: false,
          name,
          domain: data.os_domain,
          owner: data.wallet_address,
          registeredAt: data.verified_at,
        });
      }
    }

    // Check in-memory fallback
    if (memoryDomains.has(nameLower)) {
      const d = memoryDomains.get(nameLower);
      return res.json({
        available: false,
        name,
        domain: d.domain,
        owner: d.wallet,
        registeredAt: d.registeredAt,
      });
    }

    return res.json({
      available: true,
      name,
      domain,
      tier,
      price,
      tierInfo: DOMAIN_PRICING[tier],
    });
  } catch (error) {
    console.error('[Domains] Check error:', error.message);
    res.status(500).json({ error: 'Failed to check domain' });
  }
});

// ============================================================
// GET /price/:name — Get pricing for a name
// ============================================================
router.get('/price/:name', async (req, res) => {
  try {
    const rawName = decodeURIComponent(req.params.name).trim();
    const validation = validateName(rawName);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const name = validation.name;
    const tier = getTier(name);
    const price = getPrice(name);

    // Get SOL price for USD conversion
    let priceUsd = null;
    try {
      const solData = await getSOLPrice('sol');
      priceUsd = price * (solData?.price || 90);
    } catch {
      priceUsd = price * 90; // fallback estimate
    }

    res.json({
      name,
      domain: `${name}.os`,
      tier,
      price,
      priceUsd: Math.round(priceUsd * 100) / 100,
      tierInfo: DOMAIN_PRICING[tier],
      treasury: TREASURY_WALLET,
    });
  } catch (error) {
    console.error('[Domains] Price error:', error.message);
    res.status(500).json({ error: 'Failed to get price' });
  }
});

// ============================================================
// POST /register — Register a .os domain
// ============================================================
router.post('/register', async (req, res) => {
  try {
    const { name, wallet, txSignature } = req.body;

    if (!name || !wallet || !txSignature) {
      return res.status(400).json({ error: 'name, wallet, and txSignature are required' });
    }

    // Validate name
    const validation = validateName(name);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const cleanName = validation.name;
    const nameLower = cleanName.toLowerCase();
    const domain = `${cleanName}.os`;
    const tier = getTier(cleanName);
    const price = getPrice(cleanName);

    // Check availability
    const supabase = getSupabase();
    if (supabase) {
      const { data: existing } = await supabase
        .from('agent_profiles')
        .select('os_domain')
        .ilike('os_domain', `${nameLower}.os`)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'Domain is already taken' });
      }
    } else if (memoryDomains.has(nameLower)) {
      return res.status(409).json({ error: 'Domain is already taken' });
    }

    // Verify payment on-chain
    let verification;
    try {
      verification = await verifyDomainPayment(txSignature, wallet, price);
    } catch (err) {
      return res.status(400).json({ error: `Payment verification failed: ${err.message}` });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    // Register in Supabase
    if (supabase) {
      // Update agent profile
      const { error: updateErr } = await supabase
        .from('agent_profiles')
        .update({
          os_domain: domain,
          is_verified: true,
          verified_at: now.toISOString(),
          verification_tx: txSignature,
          domain_expires_at: expiresAt.toISOString(),
          domain_tier: tier,
        })
        .eq('wallet_address', wallet);

      if (updateErr) {
        console.error('[Domains] Update error:', updateErr);
        // Try upsert if profile doesn't exist yet
        const { error: upsertErr } = await supabase
          .from('agent_profiles')
          .upsert({
            wallet_address: wallet,
            os_domain: domain,
            is_verified: true,
            verified_at: now.toISOString(),
            verification_tx: txSignature,
            domain_expires_at: expiresAt.toISOString(),
            domain_tier: tier,
          }, { onConflict: 'wallet_address' });

        if (upsertErr) {
          console.error('[Domains] Upsert error:', upsertErr);
          return res.status(500).json({ error: 'Failed to save registration' });
        }
      }

      // Log registration
      await supabase.from('domain_registrations').insert({
        os_domain: domain,
        wallet_address: wallet,
        tx_signature: txSignature,
        amount_sol: verification.amountSol,
        tier,
        expires_at: expiresAt.toISOString(),
      }).catch(err => console.warn('[Domains] Failed to log registration:', err.message));
    }

    // In-memory fallback
    memoryDomains.set(nameLower, {
      domain,
      wallet,
      tier,
      registeredAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      txSignature,
    });

    console.log(`[Domains] Registered: ${domain} (${tier}) for ${wallet.slice(0, 8)}...`);

    res.json({
      success: true,
      domain,
      tier,
      tierInfo: DOMAIN_PRICING[tier],
      expiresAt: expiresAt.toISOString(),
      txSignature,
      testMode: verification.testMode || false,
    });
  } catch (error) {
    console.error('[Domains] Register error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ============================================================
// GET /my/:wallet — Get domain info for a wallet
// ============================================================
router.get('/my/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet;

    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from('agent_profiles')
        .select('os_domain, is_verified, verified_at, domain_expires_at, domain_tier, agent_name')
        .eq('wallet_address', wallet)
        .maybeSingle();

      if (data && data.os_domain) {
        return res.json({
          domain: data.os_domain,
          verified: data.is_verified,
          tier: data.domain_tier,
          expiresAt: data.domain_expires_at,
          verifiedAt: data.verified_at,
          agentName: data.agent_name,
        });
      }
    }

    // Check in-memory
    for (const [, d] of memoryDomains) {
      if (d.wallet === wallet) {
        return res.json({
          domain: d.domain,
          verified: true,
          tier: d.tier,
          expiresAt: d.expiresAt,
          verifiedAt: d.registeredAt,
        });
      }
    }

    res.json({ domain: null, verified: false });
  } catch (error) {
    console.error('[Domains] My domain error:', error.message);
    res.status(500).json({ error: 'Failed to get domain info' });
  }
});

// ============================================================
// GET /lookup/:domain — Reverse lookup: domain → wallet
// ============================================================
router.get('/lookup/:domain', async (req, res) => {
  try {
    let domain = decodeURIComponent(req.params.domain).trim();
    if (!domain.endsWith('.os')) domain += '.os';
    const nameLower = domain.replace('.os', '').toLowerCase();

    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from('agent_profiles')
        .select('wallet_address, agent_name, os_domain, domain_tier, is_verified, level, win_rate, total_trades')
        .ilike('os_domain', `${nameLower}.os`)
        .maybeSingle();

      if (data) {
        return res.json({
          domain: data.os_domain,
          wallet: data.wallet_address,
          agent: {
            name: data.agent_name,
            tier: data.domain_tier,
            verified: data.is_verified,
            level: data.level,
            winRate: data.win_rate,
            trades: data.total_trades,
          },
        });
      }
    }

    // Check in-memory
    if (memoryDomains.has(nameLower)) {
      const d = memoryDomains.get(nameLower);
      return res.json({
        domain: d.domain,
        wallet: d.wallet,
        agent: { name: nameLower, tier: d.tier, verified: true },
      });
    }

    res.status(404).json({ error: 'Domain not found' });
  } catch (error) {
    console.error('[Domains] Lookup error:', error.message);
    res.status(500).json({ error: 'Failed to look up domain' });
  }
});

// ============================================================
// GET /leaderboard — Top verified agents
// ============================================================
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('agent_profiles')
        .select('agent_name, os_domain, domain_tier, level, win_rate, total_trades, agent_avatar, wallet_address')
        .eq('is_verified', true)
        .order('level', { ascending: false })
        .order('win_rate', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return res.json({ agents: data });
      }
    }

    // In-memory fallback
    const agents = Array.from(memoryDomains.values()).map(d => ({
      agent_name: d.domain.replace('.os', ''),
      os_domain: d.domain,
      domain_tier: d.tier,
      wallet_address: d.wallet,
    }));
    res.json({ agents });
  } catch (error) {
    console.error('[Domains] Leaderboard error:', error.message);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// ============================================================
// GET /stats — Domain registration stats
// ============================================================
router.get('/stats', async (req, res) => {
  try {
    const supabase = getSupabase();
    let stats = { totalRegistered: 0, totalRevenue: { sol: 0, usd: 0 }, tiers: {}, recentRegistrations: [] };

    if (supabase) {
      const { data: regs } = await supabase
        .from('domain_registrations')
        .select('os_domain, tier, amount_sol, registered_at')
        .order('registered_at', { ascending: false })
        .limit(100);

      if (regs) {
        stats.totalRegistered = regs.length;
        stats.totalRevenue.sol = regs.reduce((sum, r) => sum + parseFloat(r.amount_sol || 0), 0);

        const tiers = {};
        for (const r of regs) {
          if (!tiers[r.tier]) tiers[r.tier] = { count: 0, revenue: 0 };
          tiers[r.tier].count++;
          tiers[r.tier].revenue += parseFloat(r.amount_sol || 0);
        }
        stats.tiers = tiers;
        stats.recentRegistrations = regs.slice(0, 5).map(r => ({
          domain: r.os_domain,
          tier: r.tier,
          registeredAt: r.registered_at,
        }));
      }
    }

    // Include in-memory registrations
    for (const [, d] of memoryDomains) {
      stats.totalRegistered++;
      const price = getPrice(d.domain.replace('.os', ''));
      stats.totalRevenue.sol += price;
    }

    // USD conversion
    try {
      const solData = await getSOLPrice('sol');
      stats.totalRevenue.usd = Math.round(stats.totalRevenue.sol * (solData?.price || 90) * 100) / 100;
    } catch {
      stats.totalRevenue.usd = Math.round(stats.totalRevenue.sol * 90 * 100) / 100;
    }

    res.json(stats);
  } catch (error) {
    console.error('[Domains] Stats error:', error.message);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
