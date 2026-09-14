import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, saveSession, savedSession } from './api';
import type { Session } from './api';

const session: Session = { user: { id: 'user-a', phone: '+263771234567', accountType: 'CUSTOMER' }, accessToken: 'access', refreshToken: 'refresh', sessionId: 'session-a' };

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('session storage', () => {
  it('returns null when no session has been saved', () => {
    expect(savedSession()).toBeNull();
  });

  it('recovers gracefully from corrupted session data instead of throwing', () => {
    localStorage.setItem('zimmarket.session', '{not-json');
    expect(savedSession()).toBeNull();
  });

  it('round-trips a saved session', () => {
    saveSession(session);
    expect(savedSession()).toEqual(session);
  });

  it('clears the stored session when saved with null', () => {
    saveSession(session);
    saveSession(null);
    expect(savedSession()).toBeNull();
  });
});

describe('api requests', () => {
  it('sends the identifier and password to the login endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => session });
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.login('user@zim.co.zw', 'password123');

    expect(result).toEqual(session);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/auth\/login$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ identifier: 'user@zim.co.zw', password: 'password123' });
  });

  it('attaches a bearer token when one is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'user-a' }) });
    vi.stubGlobal('fetch', fetchMock);

    await api.profile('access-token');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer access-token');
  });

  it('joins a validation error array into a single message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: ['phone must be a phone number', 'password is too short'] }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.login('bad', 'x')).rejects.toThrow('phone must be a phone number, password is too short');
  });

  it('falls back to a generic message when the error body has none', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('not json'); } });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.login('user', 'pass')).rejects.toThrow('Request failed (500)');
  });
});
