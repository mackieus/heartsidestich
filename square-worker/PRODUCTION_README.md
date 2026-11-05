# Heartside Stitch — Production Square Checkout (branch: production-checkout)

This branch is **ready to flip, not live by default**. The live site on `main`
is unchanged until this branch is merged *and* the production steps below
are completed.

## What is in this branch

- `index.html`
  - North Carolina Buy Now stays hidden (from the earlier hide fix).
  - Raleigh and Outer Banks Buy Now links still go to Etsy until
    on-site checkout is verified live.
  - A new hidden `Square Checkout` cart section: $24.99 per shirt,
    S/M/L only, $4.95 flat shipping per order, $0 sales tax for now,
    size-required guard on Add to cart, and a subtotal + shipping + tax
    total breakdown.
  - Production config is gated by `HS_PRODUCTION_ENABLED=false`.
    The production card form only loads when that flag is flipped
    *and* the placeholder Square IDs are replaced.
  - Sandbox test code is repaired (the broken sandbox status string)
    and the stray duplicate code after `</body></html>` is removed.
    Sandbox mode (`?square-test=1`) is unchanged, except its shipping
    preview still shows the sandbox $5.99 — production shipping is $4.95.
- `square-worker/src/production.js`
  - `POST /api/payment` to live Square (`connect.squareup.com`).
  - Validates the 3 products, S/M/L, quantities, payment token,
    idempotency key, and buyer shipping details (name, email, address,
    city, 2-letter state, ZIP).
  - Charges merchandise + $4.95 shipping + $0 tax, in USD, with
    `buyer_email_address` so Square sends the buyer a receipt.
  - Returns a structured `orderRecord` (pending fulfillment) that can
    be saved to Cloudflare D1 later without changing the frontend.
  - Optional seller-email hook: if `EMAIL_WEBHOOK_URL` is set, the
    Worker POSTs the order summary there; a webhook failure does not
    fail an already-completed payment.
- `square-worker/wrangler.production.toml`
  - Deploys `src/production.js` as `heartside-square-production`.
  - `SQUARE_LOCATION_ID` is a placeholder variable.
  - `SQUARE_ACCESS_TOKEN` and `EMAIL_WEBHOOK_URL` must be secrets.

## What is NOT in this branch

- No production Square credentials, tokens, or live payment capability
  until the enable steps below are done.
- No sales tax calculation (owner decision: no tax for now).
- No database order storage (owner decision: email + Square records
  at launch; add D1 later using the structured `orderRecord`).
- No change to the live site until merge + Worker deploy + verification.

## Enable steps (in order)

1. Create a production Square account, application, and location.
   Note the production Web Payments Application ID and Location ID.
2. In Cloudflare Workers & Pages, deploy this production Worker:
   `npx wrangler deploy -c square-worker/wrangler.production.toml`
   (run from the repo root, on the `production-checkout` branch).
3. Set Worker secrets, never in the repo or in chat:
   `npx wrangler secret put SQUARE_ACCESS_TOKEN`
   Optional: `npx wrangler secret put EMAIL_WEBHOOK_URL`
4. Visit `https://<production-worker>.<your-subdomain>.workers.dev/health`
   and confirm `{"status":"ok","environment":"production"}`.
5. In `index.html` on this branch, set `HS_PRODUCTION_ENABLED=true`,
   replace `HS_PRODUCTION_APP_ID`, `HS_PRODUCTION_LOCATION_ID`, and
   `HS_PRODUCTION_WORKER` with the real production values.
6. In Square, enable seller notifications and confirm the buyer
   receipt settings, so orders are emailed as well as recorded in
   Square.
7. Test in a private browser: add a shirt, complete a small real
   payment, confirm the Square receipt, the seller notification /
   webhook, and the on-site confirmation. Refund the test if needed.
8. Merge `production-checkout` to `main`, wait for GitHub Pages to
   deploy, then re-test the live site. Keep the Etsy Buy Now links
   until that live test passes.

## Rollback

- Set `HS_PRODUCTION_ENABLED=false` and redeploy, or revert the merge.
- The cart falls back to "Checkout coming soon" and the Etsy links
  for Raleigh / Outer Banks remain available.

## Security notes

- Never paste a Square access token into chat, frontend HTML, or Git.
- Regenerate any Square token that was previously shared, per the
  sandbox Worker README.
- The frontend never sees the access token; only the Worker does.
