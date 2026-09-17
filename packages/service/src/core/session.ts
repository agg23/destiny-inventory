const ENCODER = new TextEncoder();

const SESSION_DAYS = 90;

/** Matches Bungie's refresh window. Re-minted on every refresh */
export const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export interface Session {
  membershipId: string;
  expires: number;
}

const signingKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

const encode = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const decode = (text: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

/** Signed proof of which Bungie membership signed in, safe to hand to the browser */
export const mintSession = async (
  secret: string,
  membershipId: string,
  expires: number,
): Promise<string> => {
  const session: Session = { membershipId, expires };
  const payload = encode(ENCODER.encode(JSON.stringify(session)));

  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    ENCODER.encode(payload),
  );

  return `${payload}.${encode(new Uint8Array(signature))}`;
};

/** Undefined for anything forged, malformed, or expired */
export const readSession = async (
  secret: string,
  token: string,
  now: number,
): Promise<Session | undefined> => {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return undefined;
  }

  try {
    const signed = await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      decode(signature),
      ENCODER.encode(payload),
    );

    if (!signed) {
      return undefined;
    }

    const session = JSON.parse(
      new TextDecoder().decode(decode(payload)),
    ) as Session;

    return session.expires > now ? session : undefined;
  } catch {
    return undefined;
  }
};
