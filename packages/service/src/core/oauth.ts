const TOKEN = "https://www.bungie.net/Platform/App/OAuth/Token/";

export interface OAuthConfig {
  apiKey: string;
  clientId: string;
  clientSecret: string;
}

export interface Tokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  membership_id: string;
}

const post = async (config: OAuthConfig, body: URLSearchParams): Promise<Tokens> => {
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);

  const response = await fetch(TOKEN, {
    method: "POST",
    headers: {
      "X-API-Key": config.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Token endpoint returned ${response.status}`);
  }

  return (await response.json()) as Tokens;
};

export const exchangeCode = (config: OAuthConfig, code: string): Promise<Tokens> =>
  post(config, new URLSearchParams({ grant_type: "authorization_code", code }));

export const refreshTokens = (config: OAuthConfig, refreshToken: string): Promise<Tokens> =>
  post(
    config,
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  );
