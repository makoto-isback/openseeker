-- Add .os domain fields to agent_profiles table
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS os_domain TEXT UNIQUE;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS verification_tx TEXT;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS domain_expires_at TIMESTAMPTZ;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS domain_tier TEXT DEFAULT 'free';

-- Create index for domain lookups
CREATE INDEX IF NOT EXISTS idx_agent_profiles_os_domain ON agent_profiles(os_domain);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_verified ON agent_profiles(is_verified);

-- Domain registration log (for tracking all registrations + revenue)
CREATE TABLE IF NOT EXISTS domain_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE,
  os_domain TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_signature TEXT NOT NULL,
  amount_sol NUMERIC NOT NULL,
  amount_usd NUMERIC,
  tier TEXT NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year')
);
