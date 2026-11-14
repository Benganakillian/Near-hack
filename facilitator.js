// Local x402 facilitator for NEAR testnet (hackathon/demo use)
// Exposes /verify, /settle, /supported for HTTPFacilitatorClient.
// Uses a relayer account/key from env (no hardcoded secrets).

require('dotenv').config();
const express = require('express');
const { createNearFacilitator } = require('@fastnear/x402/facilitator');

const app = express();
app.use(express.json());

const PORT = process.env.FACILITATOR_PORT || 4000;
const relayerAccountId = process.env.FACILITATOR_RELAYER_ACCOUNT_ID;
const relayerSecretKey = process.env.FACILITATOR_RELAYER_SECRET_KEY;
const rpcUrl = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';

if (!relayerAccountId || !relayerSecretKey) {
  console.error('Missing FACILITATOR_RELAYER_ACCOUNT_ID or FACILITATOR_RELAYER_SECRET_KEY in environment.');
  console.error('Set them in .env before starting the local facilitator.');
  process.exit(1);
}

// Create a NEAR x402 facilitator for testnet with an explicit relayer (sponsors gas/yoctoNEAR)
const facilitator = createNearFacilitator({
  registrations: [
    {
      network: 'near:testnet',
      signer: {
        relayers: [
          {
            accountId: relayerAccountId,
            secretKey: relayerSecretKey,
          },
        ],
        rpcUrls: {
          'near:testnet': rpcUrl,
        },
      },
    },
  ],
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Local NEAR x402 facilitator running', network: 'near:testnet' });
});

// Advertise supported schemes/networks
app.get('/supported', (req, res) => {
  try {
    const supported = facilitator.getSupported();
    res.json(supported);
  } catch (err) {
    console.error('GET /supported error:', err);
    res.status(500).json({ error: err && err.message ? err.message : 'Failed to get supported capabilities' });
  }
});

// Verify a payment payload against payment requirements
app.post('/verify', async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body || {};
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (err) {
    console.error('POST /verify error:', err);
    res.status(500).json({
      isValid: false,
      invalidReason: err && err.message ? err.message : 'Verification failed',
    });
  }
});

// Settle a verified payment on-chain via the relayer
app.post('/settle', async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body || {};
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (err) {
    console.error('POST /settle error:', err);
    res.status(500).json({
      success: false,
      errorReason: err && err.message ? err.message : 'Settlement failed',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Local facilitator running on http://localhost:${PORT}`);
  console.log(`Relayer: ${relayerAccountId} (near:testnet, RPC: ${rpcUrl})`);
});
