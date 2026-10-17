import { readStored, writeStored } from "../storage.ts";
import { MINUTE } from "../time.ts";
import { loadConfig } from "./config.ts";

const AUTHORIZE = "https://www.bungie.net/en/OAuth/Authorize";

const TOKENS = "dvm.tokens";
const STATE = "dvm.state";
const DEV_FORWARD = "dvm.devForward";

// Dev has no HTTPS origin of its own
const DEV_ORIGIN = "http://localhost:5183";

const SKEW_MS = MINUTE;

export class NotSignedIn extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotSignedIn";
  }
}

interface Tokens {
  accessToken: string;
  accessExpires: number;
  refreshToken?: string;
  refreshExpires?: number;
  session?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  session?: string;
}

const read = (): Tokens | undefined =>
  readStored(TOKENS) as Tokens | undefined;

const write = (response: TokenResponse): Tokens => {
  const now = Date.now();

  const tokens: Tokens = {
    accessToken: response.access_token,
    accessExpires: now + response.expires_in * 1000,
    refreshToken: response.refresh_token,
    refreshExpires: response.refresh_expires_in
      ? now + response.refresh_expires_in * 1000
      : undefined,
    session: response.session,
  };

  writeStored(TOKENS, tokens);

  return tokens;
};

const post = async (path: string, body: unknown): Promise<TokenResponse> => {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }

  return (await response.json()) as TokenResponse;
};

export const signedIn = (): boolean => {
  const tokens = read();

  return Boolean(
    tokens &&
      (tokens.accessExpires > Date.now() ||
        (tokens.refreshExpires ?? 0) > Date.now()),
  );
};

export const signOut = () => {
  localStorage.removeItem(TOKENS);
};

export const beginLogin = async () => {
  const { clientId, authOrigin } = await loadConfig();

  if (!clientId) {
    throw new Error("Service has no Bungie client id configured");
  }

  // Bungie registers one HTTPS redirect
  if (authOrigin && authOrigin !== location.origin) {
    location.assign(`${authOrigin}/?dev=1`);

    return;
  }

  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE, state);

  const url = new URL(AUTHORIZE);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  location.assign(url.toString());
};

const renew = async (
  tokens: Tokens | undefined,
): Promise<Tokens | undefined> => {
  if (!tokens?.refreshToken || (tokens.refreshExpires ?? 0) < Date.now()) {
    return undefined;
  }

  return write(
    await post("/api/auth/refresh", { refreshToken: tokens.refreshToken }),
  );
};

const renewSession = async (): Promise<string | undefined> =>
  (await renew(read()))?.session;

const sessionToken = async (): Promise<string | undefined> => {
  const tokens = read();

  if (!tokens) {
    return undefined;
  }

  // Sign ins from before sessions existed have none
  return tokens.session ?? (await renewSession());
};

/** Fetches one of our own endpoints with the session token, renewing it once on a 401 */
export const callService = async (
  path: string,
  init?: RequestInit,
): Promise<Response | undefined> => {
  const token = await sessionToken();

  if (!token) {
    return undefined;
  }

  const send = (bearer: string) =>
    fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
    });

  const response = await send(token);

  if (response.status !== 401) {
    return response;
  }

  const renewed = await renewSession();

  return renewed ? send(renewed) : undefined;
};

export const accessToken = async (): Promise<string | undefined> => {
  const tokens = read();

  if (!tokens) {
    return undefined;
  }

  if (tokens.accessExpires - SKEW_MS > Date.now()) {
    return tokens.accessToken;
  }

  const renewed = await renew(tokens);

  if (!renewed) {
    signOut();

    return undefined;
  }

  return renewed.accessToken;
};

/** The access token, or throws NotSignedIn */
export const requireToken = async (): Promise<string> => {
  const token = await accessToken();

  if (!token) {
    throw new NotSignedIn();
  }

  return token;
};

// True when this load only starts a dev sign in
export const markDevLogin = (): boolean => {
  if (new URLSearchParams(location.search).get("dev") !== "1") {
    return false;
  }

  sessionStorage.setItem(DEV_FORWARD, "1");

  return true;
};

// True when it has navigated away
export const completeLogin = async (): Promise<boolean> => {
  const hash = new URLSearchParams(location.hash.slice(1));
  const forwarded = hash.get("refresh_token");

  // Anywhere but the dev origin this is a login CSRF
  if (forwarded && location.origin === DEV_ORIGIN) {
    write({
      access_token: "",
      expires_in: 0,
      refresh_token: forwarded,
      refresh_expires_in: 7_776_000,
    });
    location.replace("/");

    return true;
  }

  const params = new URLSearchParams(location.search);
  const code = params.get("code");

  if (!code) {
    throw new Error("Callback without a code");
  }

  if (params.get("state") !== sessionStorage.getItem(STATE)) {
    throw new Error("OAuth state mismatch, refusing to continue");
  }

  sessionStorage.removeItem(STATE);

  const tokens = write(await post("/api/auth/token", { code }));

  if (sessionStorage.getItem(DEV_FORWARD) === "1" && tokens.refreshToken) {
    sessionStorage.removeItem(DEV_FORWARD);
    location.assign(
      `${DEV_ORIGIN}/auth/callback#refresh_token=${tokens.refreshToken}`,
    );

    return true;
  }

  location.replace("/");

  return true;
};
