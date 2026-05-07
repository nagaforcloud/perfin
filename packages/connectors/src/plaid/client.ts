import {
  Configuration, PlaidApi, PlaidEnvironments,
  type LinkTokenCreateRequest, type ItemPublicTokenExchangeRequest,
} from 'plaid';
import type { PlaidConfig } from './types';

export function createPlaid(config: PlaidConfig) {
  const plaidConfig = new Configuration({
    basePath: PlaidEnvironments[config.env],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': config.clientId,
        'PLAID-SECRET': config.secret,
      },
    },
  });
  return new PlaidApi(plaidConfig);
}

export async function createLinkToken(
  client: PlaidApi,
  userId: number,
  webhookUrl: string,
): Promise<string> {
  const req: LinkTokenCreateRequest = {
    client_name: 'Perfin',
    user: { client_user_id: String(userId) },
    products: ['transactions'] as LinkTokenCreateRequest['products'],
    country_codes: ['US', 'IN', 'GB'] as LinkTokenCreateRequest['country_codes'],
    language: 'en',
    webhook: webhookUrl,
  };
  const res = await client.linkTokenCreate(req);
  return res.data.link_token;
}

export async function exchangePublicToken(
  client: PlaidApi,
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  const req: ItemPublicTokenExchangeRequest = { public_token: publicToken };
  const res = await client.itemPublicTokenExchange(req);
  return { accessToken: res.data.access_token, itemId: res.data.item_id };
}
