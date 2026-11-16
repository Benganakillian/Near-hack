// Phase 3: x402 Paywall Marketplace for the Agent Economy
// Self-serve dataset marketplace: sellers publish, buyer agents pay via x402 on NEAR.
// Keeps existing /paid-dataset + flagged-urls flow working. Plain Express + JS.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { paymentMiddleware, x402ResourceServer } = require('@x402/express');
const { HTTPFacilitatorClient } = require('@x402/core/server');
const { ExactNearScheme } = require('@x402/near/exact/server');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const FLAGGED_FILE = path.join(__dirname, 'flagged-urls.json');
const DATASETS_FILE = path.join(__dirname, 'datasets.json');
const SALES_FILE = path.join(__dirname, 'sales.json');

app.use(express.json({ limit: '1mb' }));

// Request logger: method, url, and whether a payment-related header is present
app.use((req, res, next) => {
  const paymentHeader = req.get('payment-signature') || req.get('x-payment');
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url} | payment header: ${paymentHeader ? 'present' : 'missing'}`
  );
  next();
});

function readJsonArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`Failed to read ${path.basename(filePath)}:`, err.message);
    return [];
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readFlaggedUrls() {
  return readJsonArray(FLAGGED_FILE);
}

function writeFlaggedUrls(entries) {
  writeJson(FLAGGED_FILE, entries);
}

function readDatasets() {
  return readJsonArray(DATASETS_FILE);
}

function writeDatasets(entries) {
  writeJson(DATASETS_FILE, entries);
}

function readSales() {
  try {
    if (!fs.existsSync(SALES_FILE)) return {};
    const raw = fs.readFileSync(SALES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (err) {
    console.error('Failed to read sales.json:', err.message);
    return {};
  }
}

function writeSales(sales) {
  writeJson(SALES_FILE, sales);
}

function buildPaymentRoutes(entries) {
  const routes = {};
  for (const entry of entries) {
    if (!entry || !entry.url || !entry.price || !entry.payTo) continue;
    routes[`GET ${entry.url}`] = {
      accepts: [
        {
          scheme: 'exact',
          network: 'near:testnet',
          price: `$${entry.price}`,
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
  if (!facilitatorUrl) return null;

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

const resourceServer = createResourceServer();

function applyFlaggedPaywall() {
  const entries = readFlaggedUrls();
  const routes = buildPaymentRoutes(entries);

  if (resourceServer && Object.keys(routes).length > 0) {
    app.use(paymentMiddleware(routes, resourceServer));
    console.log('x402 payment middleware enabled for flagged routes:', Object.keys(routes).join(', '));
  } else {
    // Fallback for legacy /paid-dataset when facilitator is not configured
    app.get('/paid-dataset', (req, res, next) => {
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
      return res.status(402).json({ ...paymentRequired, error: 'Payment verification unavailable: configure FACILITATOR_URL' });
    });
    console.log('x402 middleware not enabled for flagged routes (missing FACILITATOR_URL or routes).');
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function recordSale(dataset) {
  const sales = readSales();
  const id = dataset.id;
  if (!sales[id]) {
    sales[id] = { datasetId: id, sellerAccount: dataset.sellerAccount, count: 0, totalEarned: 0 };
  }
  sales[id].count += 1;
  sales[id].totalEarned = Number((Number(sales[id].totalEarned || 0) + Number(dataset.priceUSDC || 0)).toFixed(6));
  sales[id].sellerAccount = dataset.sellerAccount;
  sales[id].title = dataset.title || sales[id].title || '';
  // TODO: Platform fee split (planned 2% on mainnet). Currently 0% during hackathon; seller receives full amount.
  writeSales(sales);
}

function sellerStats(sellerAccount) {
  const datasets = readDatasets().filter((d) => d.sellerAccount === sellerAccount);
  const sales = readSales();
  let totalSales = 0;
  let totalEarned = 0;
  const rows = datasets.map((d) => {
    const s = sales[d.id] || { count: 0, totalEarned: 0 };
    totalSales += Number(s.count || 0);
    totalEarned += Number(s.totalEarned || 0);
    return { ...d, salesCount: Number(s.count || 0), earned: Number(s.totalEarned || 0) };
  });
  return { datasets: rows, totalSales, totalEarned: Number(totalEarned.toFixed(6)) };
}

// Landing page: list all datasets
app.get('/', (req, res) => {
  const datasets = readDatasets();
  const rows = datasets.map((d) => {
    const url = `/dataset/${d.id}`;
    return `<tr>
      <td>${escapeHtml(d.title)}</td>
      <td>${escapeHtml(d.priceUSDC)} USDC</td>
      <td>${escapeHtml(d.sellerAccount)}</td>
      <td><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Buy →</a></td>
    </tr>`;
  }).join('');

  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NEAR x402 Paywall - Marketplace</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 980px; margin: 2rem auto; padding: 0 1rem; color: #111; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.6rem; text-align: left; vertical-align: top; }
    th { background: #f6f8fa; }
    .btn { display: inline-block; margin-top: 1rem; padding: 0.6rem 1rem; background: #111; color: #fff; text-decoration: none; border-radius: 6px; }
    .muted { color: #555; }
    code { font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>NEAR x402 Paywall - Agent Economy</h1>
  <p class="muted">Agents pay for data with USDC via x402, sellers get paid on NEAR.</p>
  <a class="btn" href="README.md#for-sellers---publish-in-2-mins" target="_blank" rel="noopener noreferrer">Publish Your Dataset</a>
  <p class="muted" style="margin-top:0.5rem">See README docs: <a href="README.md#for-sellers---publish-in-2-mins" target="_blank" rel="noopener noreferrer">"For Sellers - Publish in 2 mins"</a> for the <code>POST /api/publish</code> example.</p>
  <h2>Available Datasets</h2>
  ${datasets.length === 0 ? '<p>No datasets published yet.</p>' : `
  <table>
    <thead><tr><th>Title</th><th>Price</th><th>Seller</th><th>Buy URL</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`}
  <hr style="margin:2rem 0" />
  <p class="muted">Legacy protected endpoint: <code>${escapeHtml(BASE_URL + '/paid-dataset')}</code></p>
</body>
</html>`);
});

// Seller Publish API
app.post('/api/publish', (req, res) => {
  const { title, priceUSDC, sellerAccount, data, description } = req.body || {};

  const priceNum = Number(priceUSDC);
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    return res.status(400).json({ error: 'Invalid priceUSDC. Must be a number > 0.' });
  }
  if (typeof sellerAccount !== 'string' || !sellerAccount.endsWith('.testnet')) {
    return res.status(400).json({ error: 'Invalid sellerAccount. Must end with .testnet.' });
  }
  const dataIsEmpty = data === undefined || data === null || (typeof data === 'string' && data.trim() === '');
  if (dataIsEmpty) {
    return res.status(400).json({ error: 'Invalid data. Data must be non-empty.' });
  }
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Invalid title. Title is required.' });
  }

  const datasets = readDatasets();
  const id = (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex')).slice(0, 8);
  const dataset = {
    id,
    title: title.trim(),
    description: typeof description === 'string' ? description : '',
    priceUSDC: String(priceUSDC),
    sellerAccount,
    data,
    createdAt: new Date().toISOString(),
  };
  datasets.push(dataset);
  writeDatasets(datasets);

  // TODO: Platform fee split (planned 2% on mainnet). Currently 0% during hackathon.

  return res.status(201).json({
    id,
    url: `${BASE_URL}/dataset/${id}`,
    price: dataset.priceUSDC,
    seller: sellerAccount,
  });
});

// Creator dashboard backend (legacy flagged URLs) - kept for compatibility
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

// Apply flagged paywall before route handlers so verified requests can proceed.
applyFlaggedPaywall();

// Protected legacy resource (kept working) - alias to solana-price dataset when available
app.get('/paid-dataset', (req, res) => {
  const datasets = readDatasets();
  const solana = datasets.find((d) => d.id === 'solana-price');
  if (solana) {
    return res.json({
      success: true,
      id: solana.id,
      title: solana.title,
      description: solana.description || '',
      priceUSDC: solana.priceUSDC,
      seller: solana.sellerAccount,
      data: solana.data,
    });
  }
  return res.json({
    success: true,
    data: 'SECRET_DATASET_CONTENT: Solana price data sample - 123.45',
  });
});

// Dynamic dataset access: protected by x402 per dataset (price + seller) when facilitator configured
app.get('/dataset/:id', (req, res, next) => {
  const datasets = readDatasets();
  const dataset = datasets.find((d) => d.id === req.params.id);
  if (!dataset) {
    return res.status(404).json({ error: 'Dataset not found' });
  }

  const sendDataset = () => {
    try {
      recordSale(dataset);
    } catch (err) {
      console.error('Failed to record sale:', err.message);
    }
    return res.json({
      success: true,
      id: dataset.id,
      title: dataset.title,
      description: dataset.description || '',
      priceUSDC: dataset.priceUSDC,
      seller: dataset.sellerAccount,
      data: dataset.data,
    });
  };

  // If no facilitator/resource server configured, cannot perform real x402 verification for dynamic datasets
  if (!resourceServer) {
    const paymentRequired = {
      price: dataset.priceUSDC,
      asset: 'USDC',
      network: 'near:testnet',
      payTo: dataset.sellerAccount,
      description: dataset.title || 'Premium dataset',
    };
    const paymentHeader = req.get('payment-signature') || req.get('x-payment');
    if (!paymentHeader) {
      res.set('x-payment-required', JSON.stringify(paymentRequired));
      return res.status(402).json(paymentRequired);
    }
    return res.status(402).json({ ...paymentRequired, error: 'Payment verification unavailable: configure FACILITATOR_URL' });
  }

  // Build dynamic x402 route config for this dataset (price + seller-specific)
  const routeConfig = {
    [`GET /dataset/${dataset.id}`]: {
      accepts: [
        {
          scheme: 'exact',
          network: 'near:testnet',
          price: `$${dataset.priceUSDC}`,
          payTo: dataset.sellerAccount, // TODO: Platform fee split (planned 2% on mainnet) - currently 0%, full amount to seller
        },
      ],
      description: dataset.description || dataset.title || `Dataset ${dataset.id}`,
      mimeType: 'application/json',
    },
  };

  const middleware = paymentMiddleware(routeConfig, resourceServer);
  return middleware(req, res, (err) => {
    if (err) return next(err);
    return sendDataset();
  });
});

// Seller dashboard (simple HTML, no framework)
app.get('/dashboard/:sellerAccount', (req, res) => {
  const sellerAccount = req.params.sellerAccount;
  const stats = sellerStats(sellerAccount);

  const rows = stats.datasets.map((d) => `<tr>
      <td>${escapeHtml(d.title)}</td>
      <td>${escapeHtml(d.priceUSDC)} USDC</td>
      <td>${escapeHtml(d.salesCount)}</td>
      <td>${escapeHtml(d.earned)} USDC</td>
    </tr>`).join('');

  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Seller Dashboard - ${escapeHtml(sellerAccount)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 980px; margin: 2rem auto; padding: 0 1rem; color: #111; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.6rem; text-align: left; }
    th { background: #f6f8fa; }
    .cards { display: flex; gap: 1rem; flex-wrap: wrap; margin: 1rem 0; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 0.8rem 1rem; min-width: 180px; }
    .muted { color: #555; }
  </style>
</head>
<body>
  <h1>Seller Dashboard</h1>
  <p class="muted">Seller: <strong>${escapeHtml(sellerAccount)}</strong></p>
  <div class="cards">
    <div class="card"><div class="muted">Datasets</div><div><strong>${stats.datasets.length}</strong></div></div>
    <div class="card"><div class="muted">Total Sales</div><div><strong>${stats.totalSales}</strong></div></div>
    <div class="card"><div class="muted">Total Earned</div><div><strong>${stats.totalEarned} USDC</strong></div></div>
  </div>
  <h2>Datasets</h2>
  ${stats.datasets.length === 0 ? '<p>No datasets for this seller yet.</p>' : `
  <table>
    <thead><tr><th>Title</th><th>Price</th><th>Sales</th><th>Earned</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`}
  <p class="muted" style="margin-top:1.5rem">Sales are tracked on successful paid delivery (saved in <code>sales.json</code>).</p>
</body>
</html>`);
});

// Basic JSON error handler
app.use((err, req, res, next) => {
  console.error('Request error:', err && err.message ? err.message : err);
  if (res.headersSent) return next(err);

  const status = err && (err.status || err.statusCode) ? (err.status || err.statusCode) : 500;
  if (status === 402 || req.path === '/paid-dataset' || req.path.startsWith('/dataset/')) {
    let payTo = process.env.PAY_TO;
    let price = '0.01';
    if (req.path === '/paid-dataset') {
      const entries = readFlaggedUrls();
      const entry = entries.find((e) => e.url === req.path) || {};
      payTo = entry.payTo || payTo;
      price = entry.price || price;
    } else if (req.path.startsWith('/dataset/')) {
      const id = req.path.split('/')[2];
      const ds = readDatasets().find((d) => d.id === id);
      if (ds) { payTo = ds.sellerAccount; price = ds.priceUSDC; }
    }
    return res.status(402).json({
      price,
      asset: 'USDC',
      network: 'near:testnet',
      payTo,
      error: err && err.message ? err.message : 'Payment verification failed',
    });
  }

  return res.status(status).json({ error: err && err.message ? err.message : 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`x402 paywall marketplace listening on http://localhost:${PORT}`);
  console.log(`FACILITATOR_URL: ${process.env.FACILITATOR_URL || '(not set)'}`);
  console.log(`PAY_TO (legacy/default): ${process.env.PAY_TO || '(not set)'}`);
});
