import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, apiRequest } from '../client';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('apiRequest', () => {
  beforeEach(() => {
    mockFetch.mockReset();
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
});
