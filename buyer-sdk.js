require('dotenv').config();
const { createNearPaymentFetch } = require('@fastnear/x402');
const { createLocalNearSigner } = require('@fastnear/x402/node');

async function buyDataset(url, { buyerAccount, buyerSecretKey } = {}) {
  const accountId = buyerAccount || process.env.NEAR_PAYER_ACCOUNT_ID || process.env.BUYER_ACCOUNT_ID;
  const secretKey = buyerSecretKey || process.env.NEAR_PAYER_SECRET_KEY || process.env.BUYER_SECRET_KEY;

  if (!accountId || !secretKey) {
    throw new Error('Missing buyer credentials: provide buyerAccount/buyerSecretKey or set NEAR_PAYER_ACCOUNT_ID and NEAR_PAYER_SECRET_KEY in env.');
  }

  const signer = createLocalNearSigner({
    accountId,
    secretKey,
    rpcUrls: { 'near:testnet': process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com' },
  });

  // x402-aware fetch: handles 402 challenge, signs NEAR payment, retries with payment header
  const paidFetch = createNearPaymentFetch({ signer, network: 'near:testnet' });
  const res = await paidFetch(url);

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err = new Error(`Purchase failed with status ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

module.exports = { buyDataset };
