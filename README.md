# NEAR x402 Paywall - Agent Economy

## Phase 1 Status
402 endpoint working

## How to run
1. `npm install`
2. `cp .env.example .env`
3. Edit `PAY_TO` in `.env` (set your NEAR testnet account, e.g. `yourname.testnet`)
4. `node server.js`

## How to test
- Without payment (should return HTTP 402):
  ```bash
  curl http://localhost:3000/paid-dataset
  ```
- With payment header (Phase 1 mock, should return secret data):
  ```bash
  curl -H "x-payment: test" http://localhost:3000/paid-dataset
  ```

## Tools used in Phase 1
- Express
- Node.js
- NEAR Testnet (x402 concept)

Phase 2 will add `@x402/near` + NEAR Intents for on-chain payment verification.
