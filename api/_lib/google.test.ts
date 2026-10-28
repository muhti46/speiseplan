import { describe, expect, it } from 'vitest';
import { buildAuthUrl, getConfig, parseCookies, redirectUri, serializeCookie } from './google.js';

describe('google auth helpers', () => {
  it('is only configured when both id and secret are set', () => {
    expect(getConfig({ GOOGLE_CLIENT_ID: 'id' })).toBeNull();
    expect(getConfig({ GOOGLE_CLIENT_ID: ' id ', GOOGLE_CLIENT_SECRET: 's' })).toEqual({ clientId: 'id', clientSecret: 's' });
  });

  it('builds the callback URL from the request host', () => {
    expect(redirectUri('https://speiseplan.example/api/google/start?x=1')).toBe(
      'https://speiseplan.example/api/google/callback',
    );
  });

  it('asks for offline drive.file access with state', () => {
    const url = new URL(buildAuthUrl('cid', 'https://h/api/google/callback', 'abc'));
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('state')).toBe('abc');
  });

  it('round-trips cookies and scopes them to /api/google', () => {
    const cookie = serializeCookie('sp_gdrive_rt', '1//a=b', 60);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/google');
    const header = `other=1; ${cookie.split(';')[0]}`;
    expect(parseCookies(header).sp_gdrive_rt).toBe('1//a=b');
  });
});
