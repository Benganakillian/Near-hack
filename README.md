# NEAR x402 Paywall - Agent Economy

## 🎥 Demo Video
Watch the full real payment flow (402 -> Paid -> STATUS 200):  
<a href="https://youtu.be/RdRx6W043y4" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>

Backup video + screenshots on Google Drive:  
<a href="https://drive.google.com/drive/folders/1gn6ZgvemnPDHOQn6pq_jF0dwgP3_e-Hq?usp=drive_link" target="_blank" rel="noopener noreferrer">View Demo Assets on Google Drive</a>

---

## 📸 Proof - Real Payment Settled on NEAR Testnet

### Step 1: Local Facilitator Running
<a href="https://drive.google.com/file/d/1xU5cCM3BkOI7SylH3BQdXaV6LWc4bgsk/view?usp=drive_link" target="_blank" rel="noopener noreferrer">
  <img src="https://drive.google.com/uc?export=view&id=1xU5cCM3BkOI7SylH3BQdXaV6LWc4bgsk" alt="Step 1 - Facilitator" />
</a>

*Caption: Local x402 facilitator running on http://localhost:4000. No external API key needed for demo.*

### Step 2: Paywall Server Running
<a href="https://drive.google.com/file/d/144_AwWfEPGJs1FE3u-v-52TLQk6vIUt4/view?usp=drive_link" target="_blank" rel="noopener noreferrer">
  <img src="https://drive.google.com/uc?export=view&id=144_AwWfEPGJs1FE3u-v-52TLQk6vIUt4" alt="Step 2 - Paywall Server" />
</a>

*Caption: Express server with x402 middleware enabled for GET /paid-dataset. PAY_TO: bengana.testnet*

### Step 3: Agent Hits Paywall - Gets 402
<a href="https://drive.google.com/file/d/1jQ6ryLMjci_bVhv-yW6hBbJvXwK4RnoY/view?usp=drive_link" target="_blank" rel="noopener noreferrer">
  <img src="https://drive.google.com/uc?export=view&id=1jQ6ryLMjci_bVhv-yW6hBbJvXwK4RnoY" alt="Step 3 - 402 Payment Required" />
</a>

*Caption: `curl -i http://localhost:3000/paid-dataset` returns 402 Payment Required + PAYMENT-REQUIRED header with price 0.01 USDC.*

### Step 4: Agent Pays - Gets Data
<a href="https://drive.google.com/file/d/1oMU4UznsQxGz1BWtwinMlxHJQAKTE_ct/view?usp=drive_link" target="_blank" rel="noopener noreferrer">
  <img src="https://drive.google.com/uc?export=view&id=1oMU4UznsQxGz1BWtwinMlxHJQAKTE_ct" alt="Step 4 - Paid and Data Returned" />
</a>

*Caption: `node pay-test.js` returns STATUS: 200 + SECRET_DATASET_CONTENT. Buyer bengana-buyer.testnet paid Seller bengana.testnet 0.01 USDC. Payment verified and settled via facilitator.*

---

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

---

Track: Agent Economy | Payout Account: bengana.testnet | Built for NEAR HACKATHON
