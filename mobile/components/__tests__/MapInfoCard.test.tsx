import { fireEvent, render, screen } from '@testing-library/react';
import { MapInfoCard } from '../MapInfoCard';

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff' },
      primary: '#2E7D32',
    },
    shadows: { card: {} },
  }),
  borderRadius: { sm: 4, md: 8, lg: 12 },
  fontSize: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20 },
  fontWeight: { semibold: '600', bold: '700' },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
}));

describe('MapInfoCard', () => {
  it('renders title and children', () => {
    render(
      <MapInfoCard title="Test Card" onClose={vi.fn()}>
        <span>Card content</span>
      </MapInfoCard>,
    );

    expect(screen.getByText('Test Card')).toBeDefined();
    expect(screen.getByText('Card content')).toBeDefined();
  });

  it('calls onClose when close button pressed', () => {
    const onClose = vi.fn();
    render(
      <MapInfoCard title="Test" onClose={onClose}>
        <span>Content</span>
      </MapInfoCard>,
    );

    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders action button when provided', () => {
    const onPress = vi.fn();
    render(
      <MapInfoCard title="Test" onClose={vi.fn()} action={{ label: 'Do Something', onPress }}>
        <span>Content</span>
      </MapInfoCard>,
    );

    const button = screen.getByText('Do Something');
    expect(button).toBeDefined();
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalled();
  });

  it('does not render action button when omitted', () => {
    render(
      <MapInfoCard title="Test" onClose={vi.fn()}>
        <span>Content</span>
      </MapInfoCard>,
    );

    expect(screen.queryByText('Do Something')).toBeNull();
  });
});
