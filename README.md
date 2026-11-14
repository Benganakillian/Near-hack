# NEAR x402 Paywall - Agent Economy
**Tagline:** Agents pay for data with USDC via x402, sellers get paid on NEAR.

## 1. What it does
- Serves a protected API endpoint (`GET /paid-dataset`) that returns **HTTP 402 Payment Required** until paid.
- Verifies and settles x402 payments on NEAR testnet via a local facilitator, then unlocks premium data.
- Enables agent-to-agent commerce where a buyer pays in USDC and the seller receives payment on NEAR.

## 2. How it works
Buyer agent (`bengana-buyer.testnet`) → `402` challenge → signs NEP-366 delegate → local facilitator verifies/settles → seller (`bengana.testnet`) receives USDC.

## 3. Proof
`STATUS 200` + `SECRET_DATASET_CONTENT` returned after payment.

**3-terminal run commands:**
```bash
# Terminal 1 (local facilitator)
node facilitator.js

# Terminal 2 (paywall server)
npm start

# Terminal 3 (buyer test client)
node pay-test.js
```

## 4. Run it
1. `npm install`
2. `cp .env.example .env`
3. `node facilitator.js`
4. `npm start`
5. `node pay-test.js`

## 5. Tech
- NEAR Testnet
- x402 v2 (exact)
- `@fastnear/x402` (with `@x402/express`, `@x402/core`, `@x402/near`)
- NEAR Intents concept (buyer on any chain, seller on NEAR)

## 6. Track
- **Track:** Agent Economy
- **NEAR account for payout:** `bengana.testnet`
