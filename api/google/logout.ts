import { clearCookie, json, parseCookies, REFRESH_COOKIE, revokeToken } from '../_lib/google.js';

/** Trennt die Drive-Verbindung: Token bei Google widerrufen und Cookie löschen. */
export async function POST(request: Request): Promise<Response> {
  const refreshToken = parseCookies(request.headers.get('cookie'))[REFRESH_COOKIE];
  if (refreshToken) await revokeToken(refreshToken);
  return json({ status: 'disconnected' }, 200, [['Set-Cookie', clearCookie(REFRESH_COOKIE)]]);
}
