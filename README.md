# deriv-token-proxy

The one server-side step Deriv's OAuth2 + PKCE flow requires: exchanging an
authorization `code` for an `access_token`. Everything else (starting the
login, generating the PKCE challenge, reading the callback) happens in the
Dollar.com HTML file itself.

## Deploy

1. Push this folder to its own GitHub repo.
2. In Render, create a **Web Service** from that repo:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
3. Set these environment variables on the service:
   - `DERIV_CLIENT_ID` = `34igmgttTRbzDlyaW0KXT`
   - `ALLOWED_ORIGIN` = `https://sido6992.github.io`
4. Once deployed, Render gives you a URL like
   `https://deriv-token-proxy.onrender.com`. Your token endpoint is
   `https://deriv-token-proxy.onrender.com/token` — put that into
   `DERIV_TOKEN_PROXY_URL` near the top of the `<script>` in Dollar_com.html.

## Note on the free plan

Render's free web services spin down after inactivity and take a few seconds
to wake back up on the next request — the first login after a quiet period
may feel slow. Upgrade the plan if that's not acceptable.
