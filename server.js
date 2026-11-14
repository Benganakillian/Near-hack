// Phase 2: x402 Paywall for the Agent Economy
// Real x402 payment flow with facilitator verification (when configured) + NEAR Intents support.
// Plain Express + JS, no frontend, no private keys in code.

/**
 * This is in the incase that this command
 * node --dns-result-order=ipv4first --no-network-family-autoselection server.js
 * needs to be solved in file
 * 
const net = require('net');
net.setDefaultAutoSelectFamily(false);

const { Agent, setGlobalDispatcher } = require('undici');
setGlobalDispatcher(new Agent({ connect: { timeout: 30000 } }));
 * 
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { paymentMiddleware, x402ResourceServer } = require('@x402/express');
const { HTTPFacilitatorClient } = require('@x402/core/server');
const { ExactNearScheme } = require('@x402/near/exact/server');


const app = express();
const PORT = process.env.PORT || 3000;
const FLAGGED_FILE = path.join(__dirname, 'flagged-urls.json');

app.use(express.json());

// Simple request logger: method, url, and whether a payment-related header is present
app.use((req, res, next) => {
  const paymentHeader = req.get('payment-signature') || req.get('x-payment');
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url} | payment header: ${paymentHeader ? 'present' : 'missing'}`
  );
  next();
});

function readFlaggedUrls() {
  try {
    const raw = fs.readFileSync(FLAGGED_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Failed to read flagged-urls.json:', err.message);
    return [];
  }
}

function writeFlaggedUrls(entries) {
  fs.writeFileSync(FLAGGED_FILE, JSON.stringify(entries, null, 2));
}

function buildPaymentRoutes(entries) {
  const routes = {};
  for (const entry of entries) {
    if (!entry || !entry.url || !entry.price || !entry.payTo) continue;
    // Configure x402-protected GET routes from flagged-urls.json
    routes[`GET ${entry.url}`] = {
      accepts: [
        {
          scheme: 'exact',
          network: 'near:testnet',
          price: `$${entry.price}`, // string price resolved by ExactNearScheme (USDC on NEAR by default)
          payTo: entry.payTo,
        },
      ],
      description: `Premium resource ${entry.url} (Agent Economy Demo)`,
      mimeType: 'application/json',
    };
  }
  return routes;
}

function createResourceServer() {
  const facilitatorUrl = process.env.FACILITATOR_URL;
  if (!facilitatorUrl) {
    return null;
  }

  const facilitatorApiKey = process.env.FACILITATOR_API_KEY;
  const authHeaders = facilitatorApiKey ? { 'X-API-Key': facilitatorApiKey } : {};

  const facilitatorClient = new HTTPFacilitatorClient({
    url: facilitatorUrl,
    createAuthHeaders: async () => ({
      verify: authHeaders,
      settle: authHeaders,
      supported: {},
    }),
  });

  return new x402ResourceServer(facilitatorClient).register('near:*', new ExactNearScheme());
}


function applyPaywall() {
  const entries = readFlaggedUrls();
  const routes = buildPaymentRoutes(entries);
  const resourceServer = createResourceServer();

  if (resourceServer && Object.keys(routes).length > 0) {
    // Official @x402/express pattern: middleware returns 402 when unpaid and verifies/settles
    // via the configured facilitator when a valid payment header is provided.
    app.use(paymentMiddleware(routes, resourceServer));
    console.log('x402 payment middleware enabled for routes:', Object.keys(routes).join(', '));
  } else {
    // Fallback: preserve Phase 1-style 402 behavior if facilitator/routes are not configured.
    app.get('/paid-dataset', (req, res, next) => {
      // If a facilitator is configured for other routes, let middleware handle it; otherwise 402.
      if (resourceServer) return next();
      const entry = entries.find((e) => e.url === '/paid-dataset') || {
        price: process.env.PRICE || '0.01',
        asset: 'USDC',
        payTo: process.env.PAY_TO,
      };
      const paymentRequired = {
        price: entry.price,
        asset: entry.asset || 'USDC',
        network: 'near:testnet',
        payTo: entry.payTo || process.env.PAY_TO,
        description: 'Premium dataset - Agent Economy Demo',
      };
      const paymentHeader = req.get('payment-signature') || req.get('x-payment');
      if (!paymentHeader) {
        res.set('x-payment-required', JSON.stringify(paymentRequired));
        return res.status(402).json(paymentRequired);
      }
      // Without a facilitator we cannot perform real cryptographic/on-chain verification here.
      return res.status(402).json({ ...paymentRequired, error: 'Payment verification unavailable: configure FACILITATOR_URL' });
    });
    console.log('x402 middleware not enabled (missing FACILITATOR_URL or flagged routes). Using fallback 402 responses.');
  }
}

// Health/status route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'x402 paywall server running (Phase 2)' });
});

// Creator dashboard backend: flag/protect a URL by saving it to flagged-urls.json
app.post('/flag-url', (req, res) => {
  const { url, price } = req.body || {};
  if (!url || typeof url !== 'string' || !url.startsWith('/')) {
    return res.status(400).json({ success: false, error: 'Invalid url. Provide a path like "/paid-dataset".' });
  }
  if (price === undefined || price === null || String(price).trim() === '') {
    return res.status(400).json({ success: false, error: 'Invalid price. Provide a price like "0.01".' });
  }

  const entries = readFlaggedUrls();
  const payTo = process.env.PAY_TO || 'bengana.testnet';
  const normalizedPrice = String(price);
  const existingIndex = entries.findIndex((e) => e.url === url);
  const record = { url, price: normalizedPrice, asset: 'USDC', payTo };

  if (existingIndex >= 0) entries[existingIndex] = record;
  else entries.push(record);

  try {
    writeFlaggedUrls(entries);
  } catch (err) {
    return res.status(500).json({ success: false, error: `Failed to save flagged URL: ${err.message}` });
  }

  return res.json({
    success: true,
    saved: record,
    note: 'Saved to flagged-urls.json. Restart the server to apply new/updated x402 route protection.',
  });
});

// Apply paywall before protected route handlers so verified requests can proceed.
applyPaywall();

// Protected resource: reached only after successful x402 verification/settlement by middleware
app.get('/paid-dataset', (req, res) => {
  res.json({
    success: true,
    data: 'SECRET_DATASET_CONTENT: Solana price data sample - 123.45',
  });
});

// Basic JSON error handler (e.g. invalid payment/verification errors surfaced by middleware)
app.use((err, req, res, next) => {
  console.error('Request error:', err && err.message ? err.message : err);
  if (res.headersSent) return next(err);

  // If a protected request fails verification, respond with 402 and error details.
  const status = err && (err.status || err.statusCode) ? (err.status || err.statusCode) : 500;
  if (status === 402 || req.path === '/paid-dataset') {
    const entries = readFlaggedUrls();
    const entry = entries.find((e) => e.url === req.path) || {};
    return res.status(402).json({
      price: entry.price || '0.01',
      asset: entry.asset || 'USDC',
      network: 'near:testnet',
      payTo: entry.payTo || process.env.PAY_TO,
      error: err && err.message ? err.message : 'Payment verification failed',
    });
  }

  return res.status(status).json({ error: err && err.message ? err.message : 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`x402 paywall server listening on http://localhost:${PORT}`);
  console.log(`FACILITATOR_URL: ${process.env.FACILITATOR_URL || '(not set)'}`);
  console.log(`PAY_TO: ${process.env.PAY_TO || '(not set)'}`);
});
