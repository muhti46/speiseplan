import {
  clearCookie,
  exchangeCode,
  getConfig,
  parseCookies,
  redirect,
  redirectUri,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  serializeCookie,
  STATE_COOKIE,
} from '../_lib/google.js';

/** Rücksprung von Google: Code gegen Refresh-Token tauschen und als HttpOnly-Cookie ablegen. */
export async function GET(request: Request): Promise<Response> {
  const config = getConfig();
  if (!config) return redirect('/?drive=not_configured');

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = parseCookies(request.headers.get('cookie'))[STATE_COOKIE];
  const clearState: [string, string] = ['Set-Cookie', clearCookie(STATE_COOKIE)];

  // Ablehnung durch den Nutzer oder fremder/abgelaufener Anmeldeversuch (CSRF-Schutz über state).
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirect('/?drive=error', [clearState]);
  }

  const tokens = await exchangeCode(config, code, redirectUri(request.url));
  if (!tokens.refresh_token) return redirect('/?drive=error', [clearState]);

  return redirect('/?drive=connected', [
    clearState,
    ['Set-Cookie', serializeCookie(REFRESH_COOKIE, tokens.refresh_token, REFRESH_COOKIE_MAX_AGE)],
  ]);
}
