// Manual. The redirect URL may be https, and a self-signed cert to catch one code isn't
// worth it. Phase 2 does this properly

import { createInterface } from "node:readline/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const AUTHORIZE = "https://www.bungie.net/en/OAuth/Authorize";
const TOKEN = "https://www.bungie.net/Platform/App/OAuth/Token/";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const TOKENS = join(REPO_ROOT, ".cache", "tokens.json");

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  membership_id: string;
}

const requireEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Set ${name} in .env`);
  }

  return value;
};

// Bungie rejects a scope param, it's fixed at registration
const authorizeUrl = (clientId: string): string => {
  const state = crypto.randomUUID();

  return `${AUTHORIZE}?client_id=${clientId}&response_type=code&state=${state}`;
};

const extractCode = (pasted: string): string => {
  const trimmed = pasted.trim();

  if (!trimmed) {
    throw new Error("Nothing pasted");
  }

  if (!trimmed.includes("?") && !trimmed.includes("=")) {
    return trimmed;
  }

  const query = trimmed.slice(trimmed.indexOf("?") + 1);
  const code = new URLSearchParams(query).get("code");

  if (!code) {
    throw new Error(`No code parameter in ${trimmed}`);
  }

  return code;
};

// Basic auth, and a bare OAuth body rather than Bungie's envelope
const exchange = async (
  code: string,
  clientId: string,
  clientSecret: string,
  apiKey: string,
): Promise<TokenResponse> => {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body as TokenResponse;
};

const main = async () => {
  const apiKey = requireEnv("BUNGIE_API_KEY");
  const clientId = requireEnv("BUNGIE_CLIENT_ID");
  const clientSecret = requireEnv("BUNGIE_CLIENT_SECRET");

  console.log("Open this, sign in, and approve:\n");
  console.log(`  ${authorizeUrl(clientId)}\n`);
  console.log("Bungie redirects to your registered URL. That page will probably fail to");
  console.log("load, which is fine. Copy the full URL out of the address bar.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pasted = await rl.question("Redirected URL: ");
  rl.close();

  const tokens = await exchange(extractCode(pasted), clientId, clientSecret, apiKey);

  await mkdir(join(REPO_ROOT, ".cache"), { recursive: true });
  await writeFile(TOKENS, JSON.stringify(tokens, undefined, 2), "utf8");

  const hours = Math.round(tokens.expires_in / 3600);
  const days = tokens.refresh_expires_in
    ? Math.round(tokens.refresh_expires_in / 86400)
    : undefined;

  console.log(`\nWrote ${TOKENS}`);
  console.log(`  membership: ${tokens.membership_id}`);
  console.log(`  access token expires in ~${hours}h`);

  if (days) {
    console.log(`  refresh token expires in ~${days}d`);
  } else {
    console.log("  no refresh token, so the app is registered as Public, not Confidential");
  }
};

await main();
