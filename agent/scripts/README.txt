Local / staging testing (do not commit secrets)
===============================================

1) Relay URL
   - Prefer environment variable: RELAY_URL=http://host:8080
   - Or create agent/config.json (gitignored) or agent/config.local.json (gitignored, overrides)
     with "relayUrl": "http://...". ClawWallet reads config.json + config.local.json from cwd when RELAY_URL is unset.

2) Smoke script (no Desktop UI required for health + tools list)
   cd agent
   npm run build
   RELAY_URL=http://your-relay:8080 npm run smoke
   PAIR_CODE=XXXX npm run smoke    # after you generate pairing code in Desktop

3) Full transfer test
   Requires Desktop running, unlocked, paired with the same Agent dataDir used for pairing.
   Use wallet_send via your skill; agent policy enforces USD limits; desktop wallet enforces trusted recipients and signing.

4) Never commit
   - agent/config.json, agent/config.local.json (ignored)
   - desktop/config.json, desktop/config.local.json (ignored)
   - Private relay URLs, IPs, or tokens — use .env.local (ignored) or shell env only.
