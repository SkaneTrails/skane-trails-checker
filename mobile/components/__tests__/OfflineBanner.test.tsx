import { render, screen } from '@testing-library/react';
import { OfflineBanner } from '../OfflineBanner';

const mockIsOnline = vi.fn(() => true);

vi.mock('@/lib/hooks', () => ({
  useNetworkStatus: () => ({ isOnline: mockIsOnline() }),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    mockIsOnline.mockReturnValue(true);
    const { container } = render(<OfflineBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('renders banner when offline', () => {
    mockIsOnline.mockReturnValue(false);
    render(<OfflineBanner />);
    expect(screen.getByText('common.offline')).toBeTruthy();
  });
});
