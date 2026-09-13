/* ==========================================================================
   COPY-TRADING RELAY — paste this block into your existing server.js
   (the deriv-token-proxy service, repo: sido6992/Dollar)

   Where to paste: anywhere after your existing `const app = express();`
   and `app.use(cors(...))` / `app.use(express.json())` setup, and BEFORE
   your `app.listen(...)` call at the bottom of the file.

   New dependency: run this in the repo before deploying:
     npm install redis

   New environment variable to set on the deriv-token-proxy service in Render:
     REDIS_URL = <the Internal Redis URL from your "copytrade-relay" Key Value
                  instance's Render dashboard page — Connect tab>
   ========================================================================== */

const { createClient: createCopyTradeRedisClient } = require('redis');
const copyTradeRedis = createCopyTradeRedisClient({ url: process.env.REDIS_URL });
copyTradeRedis.on('error', (err) => console.error('[copytrade redis]', err));
copyTradeRedis.connect().catch((err) => console.error('[copytrade redis] connect failed', err));

const COPYTRADE_MAX_TRADES = 50;       // keep only the most recent N trades per master
const COPYTRADE_TTL_SECONDS = 60 * 60 * 24; // auto-expire a master's trade list after 24h of inactivity

function copyTradeKey(masterId) {
  return `ct:${masterId}`;
}

// Master's browser calls this right after each trade it places.
// Body: { masterId: "CR123456", trade: { sym, cparams, stake, ts } }
app.post('/copytrade/publish', express.json(), async (req, res) => {
  try {
    const { masterId, trade } = req.body || {};
    if (!masterId || typeof masterId !== 'string' || !trade || typeof trade !== 'object') {
      return res.status(400).json({ error: 'masterId and trade are required' });
    }
    // Basic shape guard — don't let arbitrary junk pile up in Redis.
    if (!trade.sym || !trade.cparams || typeof trade.cparams !== 'object') {
      return res.status(400).json({ error: 'trade.sym and trade.cparams are required' });
    }
    const record = JSON.stringify({
      sym: String(trade.sym),
      cparams: trade.cparams,
      stake: Number(trade.stake) || 0,
      ts: Number(trade.ts) || Date.now(),
    });
    const key = copyTradeKey(masterId);
    await copyTradeRedis.rPush(key, record);
    await copyTradeRedis.lTrim(key, -COPYTRADE_MAX_TRADES, -1);
    await copyTradeRedis.expire(key, COPYTRADE_TTL_SECONDS);
    res.json({ ok: true });
  } catch (err) {
    console.error('[copytrade publish]', err);
    res.status(500).json({ error: 'publish failed' });
  }
});

// Follower's browser polls this every few seconds.
// Query: ?masterId=CR123456&since=<epoch ms>
app.get('/copytrade/trades', async (req, res) => {
  try {
    const masterId = String(req.query.masterId || '');
    const since = Number(req.query.since) || 0;
    if (!masterId) return res.status(400).json({ error: 'masterId is required' });
    const key = copyTradeKey(masterId);
    const raw = await copyTradeRedis.lRange(key, 0, -1);
    const trades = raw
      .map((s) => { try { return JSON.parse(s); } catch { return null; } })
      .filter((t) => t && t.ts > since)
      .sort((a, b) => a.ts - b.ts);
    res.json({ trades });
  } catch (err) {
    console.error('[copytrade trades]', err);
    res.status(500).json({ error: 'lookup failed' });
  }
});

/* ========================================================================== */
