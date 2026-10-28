import { buildAuthUrl, getConfig, randomState, redirect, redirectUri, serializeCookie, STATE_COOKIE } from '../_lib/google.js';

/** Startet die Google-Anmeldung: leitet zur Google-Einwilligungsseite weiter. */
export function GET(request: Request): Response {
  const config = getConfig();
  if (!config) return redirect('/?drive=not_configured');
  const state = randomState();
  return redirect(buildAuthUrl(config.clientId, redirectUri(request.url), state), [
    ['Set-Cookie', serializeCookie(STATE_COOKIE, state, 10 * 60)],
  ]);
}
