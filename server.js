// Minimal backend for the Dollar.com Deriv OAuth2 + PKCE login flow.
//
// Deriv's docs require the authorization-code-for-token exchange to happen
// server-side (never directly from a browser). Everything else in the OAuth
// flow — generating the PKCE challenge, redirecting to Deriv, reading the
// callback — stays in the static HTML app. This service does ONLY that one
// exchange step, then hands the resulting access token back to the browser.
//
// Required environment variables (set these in the Render dashboard):
//   DERIV_CLIENT_ID   - the OAuth2 client_id registered with Deriv
//                        (34igmgttTRbzDlyaW0KXT)
//   ALLOWED_ORIGIN    - the origin allowed to call this service
//                        (https://sido6992.github.io)
//
// Deriv never needs a client_secret here — PKCE is what makes this safe
// without one, since only the browser that started the login holds the
// original code_verifier.

const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://sido6992.github.io';
const DERIV_CLIENT_ID = process.env.DERIV_CLIENT_ID || '34igmgttTRbzDlyaW0KXT';
const DERIV_TOKEN_URL = 'https://auth.deriv.com/oauth2/token';

app.use(cors({ origin: ALLOWED_ORIGIN }));

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'deriv-token-proxy' });
});

app.post('/token', async (req, res) => {
  const { code, code_verifier, redirect_uri } = req.body || {};
  if (!code || !code_verifier || !redirect_uri) {
    return res.status(400).json({ error: 'missing_params', error_description: 'code, code_verifier and redirect_uri are all required.' });
  }
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: DERIV_CLIENT_ID,
      code,
      code_verifier,
      redirect_uri,
    });
    const derivRes = await fetch(DERIV_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await derivRes.json().catch(() => null);
    if (!derivRes.ok || !data) {
      return res.status(derivRes.status || 502).json(data || { error: 'token_exchange_failed' });
    }
    // data looks like: { access_token, expires_in, token_type }
    return res.json(data);
  } catch (e) {
    return res.status(502).json({ error: 'proxy_error', error_description: String(e && e.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('deriv-token-proxy listening on port ' + PORT);
});
