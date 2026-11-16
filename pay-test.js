require('dotenv').config();
const { buyDataset } = require('./buyer-sdk');

async function main() {
  const arg = process.argv[2];
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  // Backward compatible: no arg buys the original protected endpoint.
  // With a dataset id arg: buys /dataset/<id>.
  const url = arg
    ? (arg.startsWith('http://') || arg.startsWith('https://') ? arg : `${baseUrl}/dataset/${arg}`)
    : `${baseUrl}/paid-dataset`;

  const data = await buyDataset(url, {
    buyerAccount: process.env.NEAR_PAYER_ACCOUNT_ID,
    buyerSecretKey: process.env.NEAR_PAYER_SECRET_KEY,
  });

  console.log('STATUS: 200');
  if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch((err) => {
  console.error('Purchase failed:', err && err.message ? err.message : err);
  if (err && err.data) {
    console.error(typeof err.data === 'string' ? err.data : JSON.stringify(err.data, null, 2));
  }
  process.exit(1);
});
