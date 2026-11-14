// Phase 1: x402 Paywall for the Agent Economy
// Simple Express server demonstrating HTTP 402 Payment Required flow.
// No on-chain verification yet (Phase 2 will add @x402/near + NEAR Intents).

require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const PAY_TO = process.env.PAY_TO;

// Simple request logger: method, url, and whether a payment header is present
app.use((req, res, next) => {
  const hasPaymentHeader = Boolean(req.get('x-payment'));
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | x-payment: ${hasPaymentHeader ? 'present' : 'missing'}`);
  next();
});

// Health/status route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'x402 paywall server running' });
});

// Protected route: returns 402 until a payment header is provided
app.get('/paid-dataset', (req, res) => {
  const paymentHeader = req.get('x-payment');

  // If no payment header, respond with HTTP 402 Payment Required (x402 format)
  if (!paymentHeader) {
    const paymentRequired = {
      price: '0.01',
      asset: 'USDC',
      network: 'near:testnet',
      payTo: PAY_TO,
      description: 'Premium dataset - Agent Economy Demo'
    };

    // Include payment requirements in a header as well for clients that expect it
    res.set('x-payment-required', JSON.stringify(paymentRequired));
    return res.status(402).json(paymentRequired);
  }

  // Phase 1: accept any x-payment header without on-chain verification
  console.log('Received x-payment header:', paymentHeader);

  return res.json({
    success: true,
    data: 'SECRET_DATASET_CONTENT: Solana price data sample - 123.45'
  });
});

app.listen(PORT, () => {
  console.log(`x402 paywall server listening on http://localhost:${PORT}`);
  console.log(`payTo: ${PAY_TO || '(not set - configure PAY_TO in .env)'}`);
});
