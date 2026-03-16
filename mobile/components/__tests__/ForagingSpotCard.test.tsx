import { fireEvent, render, screen } from '@testing-library/react';
import type { ForagingSpot } from '@/lib/types';
import { ForagingSpotCard } from '../ForagingSpotCard';

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      border: '#ccc',
      text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff' },
      primary: '#2E7D32',
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

const baseSpot: ForagingSpot = {
  id: 'spot-1',
  type: 'Chanterelle',
  lat: 56.1234,
  lng: 13.5678,
  notes: 'Near the old oak tree',
  month: 'Aug',
};

describe('ForagingSpotCard', () => {
  it('renders spot type as title', () => {
    render(<ForagingSpotCard spot={baseSpot} onClose={vi.fn()} />);

    expect(screen.getByText('Chanterelle')).toBeDefined();
  });

  it('renders month and notes', () => {
    render(<ForagingSpotCard spot={baseSpot} onClose={vi.fn()} />);

    expect(screen.getByText('Aug')).toBeDefined();
    expect(screen.getByText('Near the old oak tree')).toBeDefined();
  });

  it('renders coordinates', () => {
    render(<ForagingSpotCard spot={baseSpot} onClose={vi.fn()} />);

    expect(screen.getByText('56.1234, 13.5678')).toBeDefined();
  });

  it('hides notes when empty', () => {
    const spot = { ...baseSpot, notes: '' };
    render(<ForagingSpotCard spot={spot} onClose={vi.fn()} />);

    expect(screen.queryByText('Near the old oak tree')).toBeNull();
  });

  it('enters edit mode when edit button pressed', () => {
    render(<ForagingSpotCard spot={baseSpot} onClose={vi.fn()} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('foraging.editSpot'));
    expect(screen.getByText('foraging.editSpot')).toBeDefined();
  });

  it('calls onClose when close button pressed', () => {
    const onClose = vi.fn();
    render(<ForagingSpotCard spot={baseSpot} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onUpdate with changed fields when saving', () => {
    const onUpdate = vi.fn();
    render(<ForagingSpotCard spot={baseSpot} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText('foraging.editSpot'));
    const typeInput = screen.getByDisplayValue('Chanterelle');
    fireEvent.change(typeInput, { target: { value: 'Porcini' } });
    fireEvent.click(screen.getByText('common.save'));

    expect(onUpdate).toHaveBeenCalledWith('spot-1', { type: 'Porcini' }, expect.any(Function));
  });

  it('calls onUpdate with changed month and notes', () => {
    const onUpdate = vi.fn();
    render(<ForagingSpotCard spot={baseSpot} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText('foraging.editSpot'));
    const monthInput = screen.getByDisplayValue('Aug');
    fireEvent.change(monthInput, { target: { value: 'Sep' } });
    const notesInput = screen.getByDisplayValue('Near the old oak tree');
    fireEvent.change(notesInput, { target: { value: 'Under the birch' } });
    fireEvent.click(screen.getByText('common.save'));

    expect(onUpdate).toHaveBeenCalledWith('spot-1', { month: 'Sep', notes: 'Under the birch' }, expect.any(Function));
  });

  it('shows saving state when isUpdating is true', () => {
    render(<ForagingSpotCard spot={baseSpot} onClose={vi.fn()} onUpdate={vi.fn()} isUpdating />);

    fireEvent.click(screen.getByLabelText('foraging.editSpot'));
    expect(screen.getByText('common.saving')).toBeDefined();
  });

  it('exits edit mode without calling onUpdate when no changes', () => {
    const onUpdate = vi.fn();
    render(<ForagingSpotCard spot={baseSpot} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText('foraging.editSpot'));
    fireEvent.click(screen.getByText('common.save'));

    expect(onUpdate).not.toHaveBeenCalled();
    // Should be back in view mode showing the type as title
    expect(screen.getByText('Chanterelle')).toBeDefined();
  });
});
