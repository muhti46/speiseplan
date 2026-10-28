import { clearCookie, getConfig, json, parseCookies, REFRESH_COOKIE, refreshAccessToken } from '../_lib/google.js';

/**
 * Liefert dem Frontend einen kurzlebigen Access-Token für Google Drive.
 * 501 = nicht eingerichtet, 401 = nicht (mehr) verbunden.
 */
export async function GET(request: Request): Promise<Response> {
  const config = getConfig();
  if (!config) return json({ error: 'not_configured' }, 501);

  const refreshToken = parseCookies(request.headers.get('cookie'))[REFRESH_COOKIE];
  if (!refreshToken) return json({ error: 'not_connected' }, 401);

  const tokens = await refreshAccessToken(config, refreshToken);
  if (!tokens.access_token) {
    // invalid_grant = Zugriff widerrufen oder abgelaufen -> Cookie verwerfen, neu verbinden.
    const expired = tokens.error === 'invalid_grant';
    return json({ error: expired ? 'expired' : 'google_error' }, expired ? 401 : 502, expired ? [['Set-Cookie', clearCookie(REFRESH_COOKIE)]] : []);
  }
  return json({ accessToken: tokens.access_token, expiresIn: tokens.expires_in ?? 3600 });
}
