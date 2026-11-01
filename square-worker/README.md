# Heartside Stitch Square Sandbox Worker

This is a **sandbox-only** payment prototype, not production checkout. The existing website purchase links stay enabled.

## Deploy

1. In Cloudflare Workers & Pages, create a Worker named `heartside-square-sandbox`.
2. Deploy `src/index.js` as the Worker source (or use Wrangler in this folder: `npx wrangler deploy`).
3. In Worker Settings > Variables and Secrets, add `SQUARE_SANDBOX_ACCESS_TOKEN` as type **Secret**. Regenerate the previously shared token first.
4. Set `SQUARE_SANDBOX_LOCATION_ID` to `LPCV122D` (already provided by wrangler.toml when deployed through Wrangler).
5. Visit `https://<worker-name>.<your-subdomain>.workers.dev/health` and confirm JSON `{"status":"ok","environment":"sandbox"}`.
6. Do **not** paste the token into chat, frontend HTML, or the repository.

The payment route is `POST /api/sandbox-payment` with JSON `{sourceId,idempotencyKey,items:[{name,size,quantity}]}`. The server recalculates amounts, rather than trusting client-supplied prices.

**Not ready for production:** tax, shipping, order persistence, buyer information, fraud controls, payment verification, refunds, and fulfillment need to be implemented and tested before enabling checkout. Frontend Square Web Payments SDK integration is pending the Sandbox Application ID and deployed Worker URL.
