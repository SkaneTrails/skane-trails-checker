import { fireEvent, render, screen } from '@testing-library/react';
import { Alert, Platform } from 'react-native';
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
      chip: {
        activeBg: '#2E7D32',
        activeText: '#fff',
        bg: '#f5f5f5',
        text: '#333',
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
  fontWeight: { medium: '500', semibold: '600', bold: '700' },
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
    const trail = { ...baseTrail, activity_date: '2026-03-01T09:16:00+00:00' };
    render(<TrailCard trail={trail} onClose={vi.fn()} />);

    const formatted = new Date('2026-03-01T09:16:00+00:00').toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    expect(screen.getByText(formatted)).toBeDefined();
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

  it('shows color picker and visibility toggle in edit mode', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));

    expect(screen.getByText('trailCard.lineColor')).toBeDefined();
    expect(screen.getByText('trailCard.visibility')).toBeDefined();
    expect(screen.getByText('trailCard.privateTrail')).toBeDefined();
    expect(screen.getByText('trailCard.publicTrail')).toBeDefined();
  });

  it('includes line_color in update when changed', () => {
    const onUpdate = vi.fn();
    const trail = { ...baseTrail, line_color: '#E53E3E' };
    render(<TrailCard trail={trail} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    fireEvent.click(screen.getByLabelText('#4169E1'));
    fireEvent.click(screen.getByText('common.save'));

    expect(onUpdate).toHaveBeenCalledWith(
      'trail-1',
      { line_color: '#4169E1' },
      expect.any(Function),
    );
  });

  it('includes is_public in update when toggled', () => {
    const onUpdate = vi.fn();
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    fireEvent.click(screen.getByText('trailCard.publicTrail'));
    fireEvent.click(screen.getByText('common.save'));

    expect(onUpdate).toHaveBeenCalledWith(
      'trail-1',
      { is_public: true },
      expect.any(Function),
    );
  });

  it('toggles back to private after setting public', () => {
    const onUpdate = vi.fn();
    const trail = { ...baseTrail, is_public: true };
    render(<TrailCard trail={trail} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    fireEvent.click(screen.getByText('trailCard.privateTrail'));
    fireEvent.click(screen.getByText('common.save'));

    expect(onUpdate).toHaveBeenCalledWith(
      'trail-1',
      { is_public: false },
      expect.any(Function),
    );
  });

  it('shows delete button in edit mode when onDelete provided', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    expect(screen.getByText('trail.deleteTrail')).toBeDefined();
  });

  it('hides delete button in edit mode when onDelete not provided', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    expect(screen.queryByText('trail.deleteTrail')).toBeNull();
  });

  it('does not show delete button in display mode', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('trail.deleteTrail')).toBeNull();
  });

  it('calls onDelete with trail id and onSuccess after web confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<TrailCard trail={baseTrail} onClose={onClose} onUpdate={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    fireEvent.click(screen.getByText('trail.deleteTrail'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith('trail-1', onClose);
    confirmSpy.mockRestore();
  });

  it('does not call onDelete when confirm is cancelled', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onDelete = vi.fn();
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    fireEvent.click(screen.getByText('trail.deleteTrail'));

    expect(onDelete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('shows deleting label when isDeleting is true', () => {
    render(<TrailCard trail={baseTrail} onClose={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} isDeleting />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    expect(screen.getByText('common.deleting')).toBeDefined();
  });

  it('uses Alert.alert on native platform', () => {
    const originalOS = Platform.OS;
    Platform.OS = 'ios' as typeof Platform.OS;
    const alertSpy = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onDelete = vi.fn();
    const onClose = vi.fn();

    render(<TrailCard trail={baseTrail} onClose={onClose} onUpdate={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText('trailCard.edit'));
    fireEvent.click(screen.getByText('trail.deleteTrail'));

    expect(alertSpy).toHaveBeenCalledWith(
      'trail.deleteTrail',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ style: 'cancel' }),
        expect.objectContaining({ style: 'destructive' }),
      ]),
    );

    // Simulate pressing the destructive button
    const destructiveButton = alertSpy.mock.calls[0][2]!.find((b: any) => b.style === 'destructive');
    destructiveButton!.onPress!();
    expect(onDelete).toHaveBeenCalledWith('trail-1', onClose);

    alertSpy.mockRestore();
    Platform.OS = originalOS;
  });
});
