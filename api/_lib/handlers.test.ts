import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as start } from '../google/start.js';
import { GET as callback } from '../google/callback.js';
import { GET as token } from '../google/token.js';
import { POST as logout } from '../google/logout.js';

const BASE = 'https://speiseplan.example';

function cookiePair(response: Response, name: string): string {
  const header = response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return header ? header.split(';')[0] : '';
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'cid');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('google drive login flow', () => {
  it('start -> callback -> token -> logout', async () => {
    const google = vi.fn(async (url: string, init: RequestInit) => {
      const body = new URLSearchParams(init.body as URLSearchParams);
      if (url.endsWith('/revoke')) return new Response('');
      if (body.get('grant_type') === 'authorization_code') {
        expect(body.get('redirect_uri')).toBe(`${BASE}/api/google/callback`);
        return Response.json({ access_token: 'a1', refresh_token: 'r1', expires_in: 3599 });
      }
      expect(body.get('refresh_token')).toBe('r1');
      return Response.json({ access_token: 'a2', expires_in: 3599 });
    });
    vi.stubGlobal('fetch', google);

    const started = start(new Request(`${BASE}/api/google/start`));
    expect(started.status).toBe(302);
    const state = new URL(started.headers.get('location')!).searchParams.get('state')!;
    const stateCookie = cookiePair(started, 'sp_gdrive_state');

    const done = await callback(
      new Request(`${BASE}/api/google/callback?code=c1&state=${state}`, { headers: { cookie: stateCookie } }),
    );
    expect(done.headers.get('location')).toBe('/?drive=connected');
    const refreshCookie = cookiePair(done, 'sp_gdrive_rt');
    expect(refreshCookie).toBe('sp_gdrive_rt=r1');

    const tokenResponse = await token(new Request(`${BASE}/api/google/token`, { headers: { cookie: refreshCookie } }));
    expect(await tokenResponse.json()).toEqual({ accessToken: 'a2', expiresIn: 3599 });

    const out = await logout(new Request(`${BASE}/api/google/logout`, { method: 'POST', headers: { cookie: refreshCookie } }));
    expect(cookiePair(out, 'sp_gdrive_rt')).toBe('sp_gdrive_rt=');
    expect(google).toHaveBeenCalledWith('https://oauth2.googleapis.com/revoke', expect.anything());
  });

  it('rejects a callback with a foreign state (CSRF)', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const response = await callback(
      new Request(`${BASE}/api/google/callback?code=c1&state=evil`, { headers: { cookie: 'sp_gdrive_state=mine' } }),
    );
    expect(response.headers.get('location')).toBe('/?drive=error');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports not_configured / not_connected / expired', async () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    expect((await token(new Request(`${BASE}/api/google/token`))).status).toBe(501);
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
    expect((await token(new Request(`${BASE}/api/google/token`))).status).toBe(401);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'invalid_grant' }, { status: 400 })));
    const expired = await token(new Request(`${BASE}/api/google/token`, { headers: { cookie: 'sp_gdrive_rt=r1' } }));
    expect(expired.status).toBe(401);
    expect(await expired.json()).toEqual({ error: 'expired' });
  });
});
