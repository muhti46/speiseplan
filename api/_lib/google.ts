// Gemeinsame Logik für die Google-Drive-Anmeldung (Vercel Functions unter /api/google/*).
// Der Refresh-Token liegt nur in einem HttpOnly-Cookie, das ausschließlich an /api/google
// geschickt wird - das Frontend bekommt nur kurzlebige Access-Tokens.

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const REFRESH_COOKIE = 'sp_gdrive_rt';
export const STATE_COOKIE = 'sp_gdrive_state';
const COOKIE_PATH = '/api/google';
// Browser begrenzen Cookie-Laufzeiten ohnehin auf ca. 400 Tage.
export const REFRESH_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

export function getConfig(env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function parseCookies(header: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (name) result[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

export function serializeCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=${COOKIE_PATH}; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(name: string): string {
  return serializeCookie(name, '', 0);
}

/** Muss exakt so in der Google Cloud Console als "Autorisierte Weiterleitungs-URI" eingetragen sein. */
export function redirectUri(requestUrl: string): string {
  return new URL('/api/google/callback', requestUrl).href;
}

export function buildAuthUrl(clientId: string, redirect: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    // offline + consent: nur so liefert Google zuverlässig einen Refresh-Token.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
}

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  return (await response.json()) as TokenResponse;
}

export function exchangeCode(config: GoogleConfig, code: string, redirect: string): Promise<TokenResponse> {
  return postToken({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirect,
    grant_type: 'authorization_code',
  });
}

export function refreshAccessToken(config: GoogleConfig, refreshToken: string): Promise<TokenResponse> {
  return postToken({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  });
}

export async function revokeToken(token: string): Promise<void> {
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

export function json(body: unknown, status = 200, extraHeaders: [string, string][] = []): Response {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  extraHeaders.forEach(([name, value]) => headers.append(name, value));
  return new Response(JSON.stringify(body), { status, headers });
}

export function redirect(location: string, extraHeaders: [string, string][] = []): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  extraHeaders.forEach(([name, value]) => headers.append(name, value));
  return new Response(null, { status: 302, headers });
}
