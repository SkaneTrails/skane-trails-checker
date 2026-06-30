import { fireEvent, render, screen } from '@testing-library/react';
import { ImageLightbox } from '../ImageLightbox';

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    colors: {
      overlay: 'rgba(0,0,0,0.8)',
      overlayText: '#fff',
      glass: { background: 'rgba(255,255,255,0.8)' },
    },
  }),
  borderRadius: { md: 8, full: 999 },
  fontSize: { sm: 12 },
  fontWeight: { semibold: '600' },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
}));

const images = [
  { uri: 'data:image/jpeg;base64,AAAA', caption: 'First' },
  { uri: 'data:image/jpeg;base64,BBBB', caption: 'Second' },
];

describe('ImageLightbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when not visible', () => {
    render(<ImageLightbox images={images} visible={false} onClose={vi.fn()} />);
    expect(screen.queryByText('First')).toBeNull();
  });

  it('shows the initial image and counter', () => {
    render(<ImageLightbox images={images} visible onClose={vi.fn()} />);
    expect(screen.getByText('First')).toBeDefined();
    expect(screen.getByText('1 / 2')).toBeDefined();
  });

  it('advances to the next image when the image is pressed', () => {
    render(<ImageLightbox images={images} visible onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('trailImages.viewImage'));
    expect(screen.getByText('Second')).toBeDefined();
    expect(screen.getByText('2 / 2')).toBeDefined();
  });

  it('wraps to the first image after the last', () => {
    render(<ImageLightbox images={images} visible onClose={vi.fn()} />);
    const image = screen.getByLabelText('trailImages.viewImage');
    fireEvent.click(image);
    fireEvent.click(image);
    expect(screen.getByText('First')).toBeDefined();
    expect(screen.getByText('1 / 2')).toBeDefined();
  });

  it('does not show a counter for a single image', () => {
    render(<ImageLightbox images={[images[0]]} visible onClose={vi.fn()} />);
    expect(screen.queryByText('1 / 1')).toBeNull();
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = vi.fn();
    render(<ImageLightbox images={images} visible onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('trailImages.closeViewer'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('respects the initial index', () => {
    render(<ImageLightbox images={images} visible initialIndex={1} onClose={vi.fn()} />);
    expect(screen.getByText('Second')).toBeDefined();
    expect(screen.getByText('2 / 2')).toBeDefined();
  });
});
