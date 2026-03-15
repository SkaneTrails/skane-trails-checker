import { fireEvent, render, screen } from '@testing-library/react';
import { HamburgerMenu } from '../HamburgerMenu';

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    colors: {
      text: { primary: '#000', secondary: '#666', muted: '#999' },
      glass: {
        background: 'rgba(255,255,255,0.8)',
        border: 'rgba(0,0,0,0.1)',
        borderSubtle: 'rgba(0,0,0,0.05)',
      },
    },
    shadows: {
      subtle: {},
      elevated: {},
    },
  }),
  borderRadius: { sm: 4, md: 8, lg: 12, '2xl': 16, full: 999 },
  fontSize: { xs: 10, sm: 12, md: 14, lg: 16 },
  fontWeight: { semibold: '600' },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
}));

describe('HamburgerMenu', () => {
  const defaultProps = {
    isOpen: false,
    onToggle: vi.fn(),
    onSettings: vi.fn(),
    onStartTracking: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders menu button with correct accessibility', () => {
    render(<HamburgerMenu {...defaultProps} />);

    const button = screen.getByLabelText('map.menu');
    expect(button).toBeDefined();
  });

  it('does not show dropdown when closed', () => {
    render(<HamburgerMenu {...defaultProps} />);

    expect(screen.queryByText('settings.title')).toBeNull();
    expect(screen.queryByText('tracking.startTracking')).toBeNull();
  });

  it('shows menu items when open', () => {
    render(<HamburgerMenu {...defaultProps} isOpen={true} />);

    expect(screen.getByText('settings.title')).toBeDefined();
    expect(screen.getByText('tracking.startTracking')).toBeDefined();
  });

  it('calls onToggle when menu button is pressed', () => {
    const onToggle = vi.fn();
    render(<HamburgerMenu {...defaultProps} onToggle={onToggle} />);

    fireEvent.click(screen.getByLabelText('map.menu'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('calls onSettings and closes menu when settings pressed', () => {
    const onToggle = vi.fn();
    const onSettings = vi.fn();
    render(
      <HamburgerMenu {...defaultProps} isOpen={true} onToggle={onToggle} onSettings={onSettings} />,
    );

    fireEvent.click(screen.getByLabelText('settings.title'));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onSettings).toHaveBeenCalledOnce();
  });

  it('shows web-not-supported subtitle for tracking on web', () => {
    render(<HamburgerMenu {...defaultProps} isOpen={true} />);

    expect(screen.getByText('tracking.webNotSupported')).toBeDefined();
  });

  it('does not call onStartTracking when disabled on web', () => {
    const onStartTracking = vi.fn();
    const onToggle = vi.fn();
    render(
      <HamburgerMenu
        {...defaultProps}
        isOpen={true}
        onToggle={onToggle}
        onStartTracking={onStartTracking}
      />,
    );

    fireEvent.click(screen.getByLabelText('tracking.startTracking'));
    expect(onStartTracking).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('closes menu when backdrop is pressed', () => {
    const onToggle = vi.fn();
    render(<HamburgerMenu {...defaultProps} isOpen={true} onToggle={onToggle} />);

    fireEvent.click(screen.getByLabelText('map.closeMenu'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders menu button when both open and closed', () => {
    const { rerender } = render(<HamburgerMenu {...defaultProps} isOpen={false} />);

    expect(screen.getByLabelText('map.menu')).toBeDefined();
    expect(screen.queryByText('settings.title')).toBeNull();

    rerender(<HamburgerMenu {...defaultProps} isOpen={true} />);
    expect(screen.getByLabelText('map.menu')).toBeDefined();
    expect(screen.getByText('settings.title')).toBeDefined();
  });
});
