import { fireEvent, render, screen } from '@testing-library/react';
import { TRAIL_COLORS } from '@/lib/trail-colors';
import { ColorPicker } from '../ColorPicker';

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    colors: {
      border: '#ccc',
      primary: '#2E7D32',
    },
  }),
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
}));

describe('ColorPicker', () => {
  it('renders all trail color swatches', () => {
    render(<ColorPicker selected={null} onSelect={vi.fn()} />);

    for (const hex of TRAIL_COLORS) {
      expect(screen.getByLabelText(hex)).toBeDefined();
    }
  });

  it('renders the selected swatch and allows changing selection', () => {
    const onSelect = vi.fn();
    render(<ColorPicker selected="#E53E3E" onSelect={onSelect} />);

    // Selected swatch exists
    expect(screen.getByLabelText('#E53E3E')).toBeDefined();
    // Other swatches exist too
    expect(screen.getByLabelText('#4169E1')).toBeDefined();

    // Clicking another color calls onSelect
    fireEvent.click(screen.getByLabelText('#4169E1'));
    expect(onSelect).toHaveBeenCalledWith('#4169E1');
  });

  it('calls onSelect when a swatch is pressed', () => {
    const onSelect = vi.fn();
    render(<ColorPicker selected={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByLabelText('#38A169'));
    expect(onSelect).toHaveBeenCalledWith('#38A169');
  });
});
