import { fireEvent, render, screen } from '@testing-library/react';
import type { Trail } from '@/lib/types';
import { TrailCard } from '../TrailCard';

vi.mock('react-native-svg', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: any) => React.createElement('svg', props),
    Path: (props: any) => React.createElement('path', props),
    Text: (props: any) => React.createElement('text', props),
  };
});

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      border: '#ccc',
      text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff' },
      primary: '#2E7D32',
      status: {
        exploredBg: '#E8F5E9',
        exploredText: '#2E7D32',
        toExploreBg: '#FFF3E0',
        toExploreText: '#E65100',
      },
      glass: {
        background: 'rgba(255,255,255,0.8)',
        backgroundDark: 'rgba(0,0,0,0.6)',
        surface: 'rgba(255,255,255,0.9)',
        border: 'rgba(0,0,0,0.1)',
        borderSubtle: 'rgba(0,0,0,0.05)',
        activeHighlight: 'rgba(0,0,0,0.03)',
      },
    },
    shadows: {
      card: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
      subtle: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
      elevated: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
    },
  }),
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  fontSize: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24 },
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
  coordinates_map: [
    { lat: 56.0, lng: 13.0, elevation: 100 },
    { lat: 56.01, lng: 13.01, elevation: 150 },
    { lat: 56.02, lng: 13.02, elevation: 120 },
  ],
  bounds: { north: 56, south: 55, east: 14, west: 13 },
  center: { lat: 55.5, lng: 13.5 },
  last_updated: '2026-01-01T00:00:00Z',
  elevation_gain: 320,
  elevation_loss: 310,
  duration_minutes: 195,
  avg_inclination_deg: 3.2,
  max_inclination_deg: 12.5,
};

describe('TrailCard', () => {
  it('renders trail name via MapInfoCard title', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} />);

    expect(screen.getByText('Söderåsen Loop')).toBeDefined();
  });

  it('renders distance', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} />);

    expect(screen.getByText('12.5 km')).toBeDefined();
  });

  it('renders formatted duration', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} />);

    expect(screen.getByText('3h 15m')).toBeDefined();
  });

  it('formats duration as minutes only when under 1 hour', () => {
    const trail = { ...baseTrail, duration_minutes: 45 };
    render(<TrailCard trail={trail} onClose={vi.fn()} />);

    expect(screen.getByText('45m')).toBeDefined();
  });

  it('formats duration as hours only when no remaining minutes', () => {
    const trail = { ...baseTrail, duration_minutes: 120 };
    render(<TrailCard trail={trail} onClose={vi.fn()} />);

    expect(screen.getByText('2h')).toBeDefined();
  });

  it('renders activity date', () => {
    const trail = { ...baseTrail, activity_date: '2026-03-01' };
    render(<TrailCard trail={trail} onClose={vi.fn()} />);

    expect(screen.getByText('2026-03-01')).toBeDefined();
  });

  it('renders elevation gain and loss', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} />);

    expect(screen.getByText('↑ 320 m')).toBeDefined();
    expect(screen.getByText('↓ 310 m')).toBeDefined();
  });

  it('hides duration when not provided', () => {
    const trail = { ...baseTrail, duration_minutes: null };
    render(<TrailCard trail={trail} onClose={vi.fn()} />);

    expect(screen.queryByText(/\dh/)).toBeNull();
  });

  it('hides elevation when not provided', () => {
    const trail = { ...baseTrail, elevation_gain: null, elevation_loss: null };
    render(<TrailCard trail={trail} onClose={vi.fn()} />);

    expect(screen.queryByText(/↑/)).toBeNull();
    expect(screen.queryByText(/↓/)).toBeNull();
  });

  it('enters edit mode when edit button pressed', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    // In edit mode, the title changes to the edit label
    expect(screen.getByText('trailCard.edit')).toBeDefined();
  });

  it('calls onClose when close button pressed', () => {
    const onClose = vi.fn();
    render(<TrailCard trail={baseTrail} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides activity date when not provided', () => {
    const trail = { ...baseTrail, activity_date: null };
    render(<TrailCard trail={trail} onClose={vi.fn()} />);

    // No date text should render
    expect(screen.queryByText(/\d{4}/)).toBeNull();
  });

  it('exits edit mode without calling onUpdate when no changes made', () => {
    const onUpdate = vi.fn();
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    fireEvent.click(screen.getByText('common.save'));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Söderåsen Loop')).toBeDefined();
  });

  it('shows saving state when isUpdating is true', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={vi.fn()} isUpdating />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    expect(screen.getByText('common.saving')).toBeDefined();
  });

  it('hides edit button when onUpdate is not provided', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('trailCard.edit')).toBeNull();
  });

  it('calls onUpdate with changed name when saving', () => {
    const onUpdate = vi.fn();
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));

    const nameInput = screen.getByDisplayValue('Söderåsen Loop');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByText('common.save'));

    expect(onUpdate).toHaveBeenCalledWith(
      'trail-1',
      { name: 'New Name' },
      expect.any(Function),
    );
  });

  it('exits edit mode without calling onUpdate when no changes', () => {
    const onUpdate = vi.fn();
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    expect(screen.getByText('trailCard.edit')).toBeDefined();

    fireEvent.click(screen.getByText('common.save'));

    expect(onUpdate).not.toHaveBeenCalled();
    // Back in view mode — title shows trail name
    expect(screen.getByText('Söderåsen Loop')).toBeDefined();
  });

  it('cancels edit mode via cancel button', () => {
    const onUpdate = vi.fn();
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    const nameInput = screen.getByDisplayValue('Söderåsen Loop');
    fireEvent.change(nameInput, { target: { value: 'Changed' } });
    fireEvent.click(screen.getByText('common.cancel'));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Söderåsen Loop')).toBeDefined();
  });
});
