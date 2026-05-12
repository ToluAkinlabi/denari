import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

function resolvePlaidEnvironment(name: string) {
  const normalized = name.toLowerCase();
  if (normalized === 'sandbox') return PlaidEnvironments.sandbox;
  if (normalized === 'development') return PlaidEnvironments.development;
  if (normalized === 'production') return PlaidEnvironments.production;
  return PlaidEnvironments.sandbox;
}

export function createPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV ?? 'sandbox';

  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be configured.');
  }

  const config = new Configuration({
    basePath: resolvePlaidEnvironment(env),
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });

  return new PlaidApi(config);
}
