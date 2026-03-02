import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, apiRequest, setAuthTokenGetter, setOnUnauthorized } from '../client';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('apiRequest', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Reset auth state between tests
    setAuthTokenGetter(null as unknown as () => Promise<string | null>);
    setOnUnauthorized(null as unknown as (hadToken: boolean) => void);
  });

  it('makes a GET request and returns JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: '1', name: 'Trail' }]),
    });

    const result = await apiRequest('/api/v1/trails');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/trails',
      expect.objectContaining({
        headers: expect.not.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    expect(result).toEqual([{ id: '1', name: 'Trail' }]);
  });

  it('handles 204 No Content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await apiRequest('/api/v1/trails/1', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('throws ApiClientError on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
    });

    await expect(apiRequest('/api/v1/trails/nope')).rejects.toThrow(ApiClientError);
    await expect(apiRequest('/api/v1/trails/nope')).rejects.toThrow('API Error 404');
  });

  it('passes method and body for POST', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: 'new' }),
    });

    await apiRequest('/api/v1/foraging/spots', {
      method: 'POST',
      body: JSON.stringify({ type: 'Mushrooms' }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: '{"type":"Mushrooms"}',
      }),
    );
  });

  it('attaches Authorization header when token getter is set', async () => {
    setAuthTokenGetter(async () => 'test-firebase-token');

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: '1' }),
    });

    await apiRequest('/api/v1/trails');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-firebase-token',
        }),
      }),
    );
  });

  it('does not attach Authorization header when token getter returns null', async () => {
    setAuthTokenGetter(async () => null);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });

    await apiRequest('/api/v1/trails');

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty('Authorization');
  });

  it('calls onUnauthorized with hadToken=true on 401 when token was sent', async () => {
    const onUnauthorized = vi.fn();
    setAuthTokenGetter(async () => 'valid-token');
    setOnUnauthorized(onUnauthorized);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    await expect(apiRequest('/api/v1/trails')).rejects.toThrow(ApiClientError);
    expect(onUnauthorized).toHaveBeenCalledWith(true);
  });

  it('calls onUnauthorized with hadToken=false on 401 when no token available', async () => {
    const onUnauthorized = vi.fn();
    setOnUnauthorized(onUnauthorized);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    await expect(apiRequest('/api/v1/trails')).rejects.toThrow(ApiClientError);
    expect(onUnauthorized).toHaveBeenCalledWith(false);
  });
});
