import { fireEvent, render, screen } from '@testing-library/react';
import { AddSpotForm } from '../AddSpotForm';

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      text: { primary: '#000', secondary: '#666', muted: '#999', inverse: '#fff' },
      primary: '#2E7D32',
      error: '#D32F2F',
      border: '#E0E0E0',
      chip: { bg: '#eee', text: '#333', activeBg: '#1a5e2a', activeText: '#fff' },
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
  borderRadius: { sm: 4, md: 8, lg: 12 },
  fontSize: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20 },
  fontWeight: { normal: '400', semibold: '600', bold: '700' },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
}));

const mockTypes = [
  { name: 'Mushrooms', icon: '🍄', color: '#8B4513' },
  { name: 'Berries', icon: '🫐', color: '#4A148C' },
];

const defaultProps = {
  types: mockTypes,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
  onUseCurrentLocation: vi.fn(),
};

describe('AddSpotForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders type and month selectors', () => {
    render(<AddSpotForm {...defaultProps} />);

    expect(screen.getByText('Mushrooms')).toBeDefined();
    expect(screen.getByText('Berries')).toBeDefined();
    expect(screen.getByText('months.jan')).toBeDefined();
    expect(screen.getByText('months.dec')).toBeDefined();
  });

  it('submit button is disabled when fields are empty', () => {
    render(<AddSpotForm {...defaultProps} />);

    const addButton = screen.getByText('addSpot.addSpot');
    expect(addButton.closest('[aria-disabled="true"]') ?? addButton).toBeDefined();
  });

  it('submit button is disabled with invalid coordinates', () => {
    render(<AddSpotForm {...defaultProps} />);

    // Select type and month
    fireEvent.click(screen.getByText('Mushrooms'));
    fireEvent.click(screen.getByText('months.sep'));

    // Enter invalid lat
    const latInput = screen.getByPlaceholderText('55.95');
    fireEvent.change(latInput, { target: { value: 'abc' } });

    const lngInput = screen.getByPlaceholderText('13.40');
    fireEvent.change(lngInput, { target: { value: '13.5' } });

    // Button should still be disabled
    const addButton = screen.getByText('addSpot.addSpot');
    expect(addButton.closest('[aria-disabled="true"]') ?? addButton).toBeDefined();
    fireEvent.click(addButton);
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('submit button is disabled with out-of-bounds coordinates', () => {
    render(<AddSpotForm {...defaultProps} />);

    fireEvent.click(screen.getByText('Mushrooms'));
    fireEvent.click(screen.getByText('months.sep'));

    const latInput = screen.getByPlaceholderText('55.95');
    fireEvent.change(latInput, { target: { value: '91' } });

    const lngInput = screen.getByPlaceholderText('13.40');
    fireEvent.change(lngInput, { target: { value: '13.5' } });

    const addButton = screen.getByText('addSpot.addSpot');
    fireEvent.click(addButton);
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with correct payload when all fields are valid', () => {
    render(<AddSpotForm {...defaultProps} />);

    fireEvent.click(screen.getByText('Mushrooms'));
    fireEvent.click(screen.getByText('months.sep'));

    const latInput = screen.getByPlaceholderText('55.95');
    fireEvent.change(latInput, { target: { value: '55.95' } });

    const lngInput = screen.getByPlaceholderText('13.40');
    fireEvent.change(lngInput, { target: { value: '13.40' } });

    fireEvent.click(screen.getByText('addSpot.addSpot'));

    expect(defaultProps.onSubmit).toHaveBeenCalledWith({
      type: 'Mushrooms',
      lat: 55.95,
      lng: 13.4,
      notes: '',
      month: 'sep',
    });
  });

  it('syncs coordinates from initialLat/initialLng props', () => {
    const { rerender } = render(<AddSpotForm {...defaultProps} />);

    rerender(<AddSpotForm {...defaultProps} initialLat={56.0} initialLng={13.5} />);

    const latInput = screen.getByPlaceholderText('55.95') as HTMLInputElement;
    const lngInput = screen.getByPlaceholderText('13.40') as HTMLInputElement;

    expect(latInput.value).toBe('56');
    expect(lngInput.value).toBe('13.5');
  });

  it('calls onCancel when cancel button is pressed', () => {
    render(<AddSpotForm {...defaultProps} />);

    fireEvent.click(screen.getByText('common.cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls onUseCurrentLocation when location button pressed', () => {
    render(<AddSpotForm {...defaultProps} />);

    fireEvent.click(screen.getByText('addSpot.useCurrentLocation'));
    expect(defaultProps.onUseCurrentLocation).toHaveBeenCalled();
  });

  it('shows Saving... text when submitting', () => {
    render(<AddSpotForm {...defaultProps} isSubmitting />);

    expect(screen.getByText('common.saving')).toBeDefined();
  });
});
