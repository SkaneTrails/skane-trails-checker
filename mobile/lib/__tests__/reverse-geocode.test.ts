import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reverseGeocode } from '../reverse-geocode';

describe('reverseGeocode', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  function mockFetchResponse(data: unknown, ok = true) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok,
      json: () => Promise.resolve(data),
    });
  }

  it('returns village name from Nominatim response', async () => {
    mockFetchResponse({
      address: { village: 'Brösarp', municipality: 'Tomelilla kommun', county: 'Skåne län' },
    });

    const result = await reverseGeocode(55.72, 14.08);
    expect(result).toBe('Brösarp');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('lat=55.72&lon=14.08'),
      expect.objectContaining({ headers: expect.objectContaining({ 'User-Agent': 'SkaneTrails/1.0' }) }),
    );
  });

  it('returns hamlet when available', async () => {
    mockFetchResponse({
      address: { hamlet: 'Ravlunda', village: 'Brösarp' },
    });

    const result = await reverseGeocode(55.75, 14.1);
    expect(result).toBe('Ravlunda');
  });

  it('falls back to town when no village', async () => {
    mockFetchResponse({ address: { town: 'Simrishamn', county: 'Skåne län' } });

    const result = await reverseGeocode(55.55, 14.35);
    expect(result).toBe('Simrishamn');
  });

  it('falls back to city when no town', async () => {
    mockFetchResponse({ address: { city: 'Malmö', county: 'Skåne län' } });

    const result = await reverseGeocode(55.6, 13.0);
    expect(result).toBe('Malmö');
  });

  it('falls back to municipality when no city', async () => {
    mockFetchResponse({ address: { municipality: 'Tomelilla kommun', county: 'Skåne län' } });

    const result = await reverseGeocode(55.5, 14.0);
    expect(result).toBe('Tomelilla kommun');
  });

  it('falls back to county when nothing else', async () => {
    mockFetchResponse({ address: { county: 'Skåne län' } });

    const result = await reverseGeocode(55.0, 14.0);
    expect(result).toBe('Skåne län');
  });

  it('returns null when response has no address', async () => {
    mockFetchResponse({});

    const result = await reverseGeocode(55.0, 14.0);
    expect(result).toBeNull();
  });

  it('returns null when fetch fails', async () => {
    mockFetchResponse({}, false);

    const result = await reverseGeocode(55.0, 14.0);
    expect(result).toBeNull();
  });

  it('returns null when address has no known fields', async () => {
    mockFetchResponse({ address: { country: 'Sweden' } });

    const result = await reverseGeocode(55.0, 14.0);
    expect(result).toBeNull();
  });
});
