import { fireEvent, render, screen } from '@testing-library/react';
import type { Trail } from '@/lib/types';
import { TrailCard } from '../TrailCard';

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff' },
      primary: '#2E7D32',
      status: {
        exploredBg: '#E8F5E9',
        exploredText: '#2E7D32',
        toExploreBg: '#FFF3E0',
        toExploreText: '#E65100',
      },
    },
    shadows: { card: {} },
  }),
  borderRadius: { sm: 4, md: 8, lg: 12 },
  fontSize: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20 },
  fontWeight: { semibold: '600', bold: '700' },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
}));

const baseTrail: Trail = {
  trail_id: 'trail-1',
  name: 'Söderåsen Loop',
  status: 'Explored!',
  source: 'planned_hikes',
  length_km: 12.5,
  difficulty: 'Medium',
  coordinates_map: [],
  bounds: { north: 56, south: 55, east: 14, west: 13 },
  center: { lat: 55.5, lng: 13.5 },
  last_updated: '2026-01-01T00:00:00Z',
  elevation_gain: 320,
  elevation_loss: 310,
};

describe('TrailCard', () => {
  it('renders trail name and status', () => {
    render(<TrailCard trail={baseTrail} onViewDetails={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('Söderåsen Loop')).toBeDefined();
    expect(screen.getByText('Explored!')).toBeDefined();
  });

  it('renders distance and difficulty', () => {
    render(<TrailCard trail={baseTrail} onViewDetails={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('📏 12.5 km')).toBeDefined();
    expect(screen.getByText('⛰️ Medium')).toBeDefined();
  });

  it('renders source with underscores replaced', () => {
    render(<TrailCard trail={baseTrail} onViewDetails={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('📂 planned hikes')).toBeDefined();
  });

  it('renders elevation gain and loss', () => {
    render(<TrailCard trail={baseTrail} onViewDetails={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('↗ 320 m')).toBeDefined();
    expect(screen.getByText('↘ 310 m')).toBeDefined();
  });

  it('hides elevation when not provided', () => {
    const trail = { ...baseTrail, elevation_gain: null, elevation_loss: null };
    render(<TrailCard trail={trail} onViewDetails={vi.fn()} onClose={vi.fn()} />);

    expect(screen.queryByText(/↗/)).toBeNull();
    expect(screen.queryByText(/↘/)).toBeNull();
  });

  it('hides difficulty when not provided', () => {
    const trail = { ...baseTrail, difficulty: '' };
    render(<TrailCard trail={trail} onViewDetails={vi.fn()} onClose={vi.fn()} />);

    expect(screen.queryByText(/⛰️/)).toBeNull();
  });

  it('calls onViewDetails with trail when button pressed', () => {
    const onViewDetails = vi.fn();
    render(<TrailCard trail={baseTrail} onViewDetails={onViewDetails} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('View Details'));
    expect(onViewDetails).toHaveBeenCalledWith(baseTrail);
  });

  it('calls onClose when close button pressed', () => {
    const onClose = vi.fn();
    render(<TrailCard trail={baseTrail} onViewDetails={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalled();
  });
});
