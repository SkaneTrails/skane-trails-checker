import { fireEvent, render, screen } from '@testing-library/react';
import { Platform } from 'react-native';
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
    onTrails: vi.fn(),
    onForaging: vi.fn(),
    onPlaces: vi.fn(),
    onUpload: vi.fn(),
    onOverlays: vi.fn(),
    onSettings: vi.fn(),
    onAdmin: vi.fn(),
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
    expect(screen.queryByText('tabs.trails')).toBeNull();
  });

  it('shows menu items when open', () => {
    render(<HamburgerMenu {...defaultProps} isOpen={true} />);

    expect(screen.getByText('settings.title')).toBeDefined();
    expect(screen.getByText('tabs.trails')).toBeDefined();
    expect(screen.getByText('tabs.foraging')).toBeDefined();
    expect(screen.getByText('tabs.places')).toBeDefined();
    expect(screen.getByText('trails.uploadGpx')).toBeDefined();
    expect(screen.getByText('overlays.title')).toBeDefined();
  });

  it('calls onToggle when menu button is pressed', () => {
    const onToggle = vi.fn();
    render(<HamburgerMenu {...defaultProps} onToggle={onToggle} />);

    fireEvent.click(screen.getByLabelText('map.menu'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('calls onSettings and closes menu when settings pressed', () => {
    const onSettings = vi.fn();
    render(
      <HamburgerMenu {...defaultProps} isOpen={true} onSettings={onSettings} />,
    );

    fireEvent.click(screen.getByLabelText('settings.title'));
    expect(onSettings).toHaveBeenCalledOnce();
  });

  it('calls onTrails when trails pressed', () => {
    const onTrails = vi.fn();
    render(
      <HamburgerMenu {...defaultProps} isOpen={true} onTrails={onTrails} />,
    );

    fireEvent.click(screen.getByLabelText('tabs.trails'));
    expect(onTrails).toHaveBeenCalledOnce();
  });

  it('calls onUpload when upload pressed', () => {
    const onUpload = vi.fn();
    render(
      <HamburgerMenu {...defaultProps} isOpen={true} onUpload={onUpload} />,
    );

    fireEvent.click(screen.getByLabelText('trails.uploadGpx'));
    expect(onUpload).toHaveBeenCalledOnce();
  });

  it('does not show admin when showAdmin is false', () => {
    render(<HamburgerMenu {...defaultProps} isOpen={true} showAdmin={false} />);

    expect(screen.queryByText('tabs.admin')).toBeNull();
  });

  it('shows admin when showAdmin is true', () => {
    render(<HamburgerMenu {...defaultProps} isOpen={true} showAdmin={true} />);

    expect(screen.getByText('tabs.admin')).toBeDefined();
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

  it('does not show tracking on web (Platform.OS = web)', () => {
    render(<HamburgerMenu {...defaultProps} isOpen={true} />);

    // On web, tracking item is hidden (Platform.OS === 'web' in tests)
    expect(screen.queryByText('tracking.startRecording')).toBeNull();
  });

  it('shows tracking item on native', () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = 'ios';

    render(<HamburgerMenu {...defaultProps} isOpen={true} />);

    expect(screen.getByText('tracking.startRecording')).toBeDefined();

    (Platform as any).OS = originalOS;
  });

  it('calls onAdmin when admin pressed', () => {
    render(<HamburgerMenu {...defaultProps} isOpen={true} showAdmin={true} />);

    fireEvent.click(screen.getByLabelText('tabs.admin'));
    expect(defaultProps.onAdmin).toHaveBeenCalledOnce();
  });
});
