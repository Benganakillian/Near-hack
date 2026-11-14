# NEAR x402 Paywall - Agent Economy

## Phase 2 Status
Real x402 verification flow integrated with NEAR (via `@x402/express`, `@fastnear/x402`, `@x402/near`) and a facilitator-backed paywall path. Flagged/protected URLs are stored in `flagged-urls.json`, and `POST /flag-url` provides a simple creator-dashboard backend to add/update protected routes.

## How to run
1. `npm install`
2. `cp .env.example .env`
3. Edit `.env`:
   - set `PAY_TO` (NEAR testnet account, e.g. `bengana.testnet`)
   - set `FACILITATOR_URL` to a NEAR-capable x402 facilitator (e.g. `https://test.x402.mikedotexe.com`) for real verification/settlement
   - optionally set `FACILITATOR_API_KEY` if your facilitator requires it for `/verify` and `/settle`
4. `node server.js`

## How to test
- Without payment (should return HTTP 402 with payment requirements):
  ```bash
  curl -i http://localhost:3000/paid-dataset
  ```
- With a **real** x402 payment (use an x402-compatible client/wallet that handles the 402 challenge, signs a NEAR payment, and retries with the payment header):
  ```bash
  # Example using a client that can pay x402-protected URLs (replace with your x402 client flow)
  # The client fetches the 402 challenge from /paid-dataset, pays on NEAR (near:testnet),
  # then retries with the required payment header; a valid payment returns the secret dataset.
  curl -i http://localhost:3000/paid-dataset
  ```
- Flag/update a protected URL (creator dashboard backend):
  ```bash
  curl -i -X POST http://localhost:3000/flag-url \
    -H "Content-Type: application/json" \
    -d '{"url":"/paid-dataset","price":"0.01"}'
  ```
  Restart the server after changes to `flagged-urls.json` so route protection is re-applied.

## NEAR Intents (how cross-chain payment works)
- A buyer can pay from another chain (e.g. Base or Solana) while the resource is priced on NEAR, using NEAR Intents / 1Click to route and swap funds into the required NEAR asset.
- The intent flow deposits to a NEAR 1Click deposit address and settles to the seller in NEAR USDC (to `payTo`) as part of the x402 payment fulfillment.
- This lets agents pay in their native chain liquidity while creators receive payment on NEAR, without custom bridge logic in this server.

## Tools used
- Express, Node.js
- `@x402/express`, `@x402/core`, `@x402/near`, `@fastnear/x402`
- NEAR Testnet (x402 concept) + facilitator-based verification/settlement
- NEAR Intents (1Click) for cross-chain-to-NEAR payment routing (buyer on Base/Solana -> seller receives NEAR USDC)