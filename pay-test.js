require('dotenv').config();
const { createNearPaymentFetch } = require('@fastnear/x402');
const { createLocalNearSigner } = require('@fastnear/x402/node');

async function main() {
  const signer = createLocalNearSigner({
    accountId: process.env.NEAR_PAYER_ACCOUNT_ID,
    secretKey: process.env.NEAR_PAYER_SECRET_KEY,
    rpcUrls: { 'near:testnet': 'https://rpc.testnet.fastnear.com' }
  });
  const paidFetch = createNearPaymentFetch({ signer, network: 'near:testnet' });
  const res = await paidFetch('http://localhost:3000/paid-dataset');
  console.log('STATUS:', res.status);
  console.log(await res.text());
}
main();