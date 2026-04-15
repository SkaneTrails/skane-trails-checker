import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Platform } from 'react-native';

// Mock tracking-service
vi.mock('@/lib/tracking-service', () => ({
  startTracking: vi.fn(() => Promise.resolve()),
  resumeTracking: vi.fn(() => Promise.resolve()),
  pauseTracking: vi.fn(() => Promise.resolve()),
  stopTracking: vi.fn(() => Promise.resolve([])),
  clearBuffer: vi.fn(() => Promise.resolve()),
  isTracking: vi.fn(() => Promise.resolve(false)),
  recoverPoints: vi.fn(() => Promise.resolve([])),
}));

// Mock location-permissions
vi.mock('@/lib/location-permissions', () => ({
  requestTrackingPermissions: vi.fn(() => Promise.resolve(true)),
}));

// Mock tracking context
const mockContext = {
  status: 'idle' as string,
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
  addPoint: vi.fn(),
  points: [],
  stats: null,
  elapsedMs: 0,
};

vi.mock('@/lib/tracking-context', () => ({
  useTracking: () => mockContext,
}));

// Mock settings context
vi.mock('@/lib/settings-context', () => ({
  useSettings: () => ({ gpsMode: 'balanced' }),
}));

// Mock theme
vi.mock('@/lib/theme', () => ({
  useTheme: () => ({
    colors: { primary: '#1a5e2a', text: { primary: '#000' } },
    shadows: { elevated: {} },
  }),
  borderRadius: { full: 999 },
  fontSize: { sm: 12, md: 14 },
  fontWeight: { semibold: '600' },
  spacing: { sm: 8, md: 12, lg: 16, xl: 20 },
}));

import * as TrackingService from '@/lib/tracking-service';
import { requestTrackingPermissions } from '@/lib/location-permissions';
import { TrackingControls } from '../TrackingControls.native';

describe('TrackingControls.native', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.status = 'idle';
    // Ensure Platform is android for tests
    Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
  });

  it('returns null on non-android platforms', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    const { container } = render(<TrackingControls />);
    expect(container.innerHTML).toBe('');
  });

  it('shows start recording button when idle', () => {
    render(<TrackingControls />);
    expect(screen.getByLabelText('tracking.startTracking')).toBeDefined();
  });

  it('handleStart requests permissions and starts tracking', async () => {
    render(<TrackingControls />);
    fireEvent.click(screen.getByLabelText('tracking.startTracking'));

    await waitFor(() => {
      expect(requestTrackingPermissions).toHaveBeenCalled();
      expect(mockContext.start).toHaveBeenCalled();
      expect(TrackingService.startTracking).toHaveBeenCalledWith(mockContext.addPoint, 'balanced');
    });
  });

  it('handleStart does not start if permissions denied', async () => {
    vi.mocked(requestTrackingPermissions).mockResolvedValueOnce(false);

    render(<TrackingControls />);
    fireEvent.click(screen.getByLabelText('tracking.startTracking'));

    await waitFor(() => {
      expect(requestTrackingPermissions).toHaveBeenCalled();
    });
    expect(mockContext.start).not.toHaveBeenCalled();
    expect(TrackingService.startTracking).not.toHaveBeenCalled();
  });

  it('handleStart rolls back on GPS failure', async () => {
    vi.mocked(TrackingService.startTracking).mockRejectedValueOnce(new Error('GPS failed'));

    render(<TrackingControls />);
    fireEvent.click(screen.getByLabelText('tracking.startTracking'));

    await waitFor(() => {
      expect(mockContext.start).toHaveBeenCalled();
      expect(mockContext.reset).toHaveBeenCalled();
    });
  });

  it('shows pause and stop buttons when tracking', () => {
    mockContext.status = 'tracking';
    render(<TrackingControls />);
    expect(screen.getByLabelText('tracking.pauseTracking')).toBeDefined();
    expect(screen.getByLabelText('tracking.stopTracking')).toBeDefined();
  });

  it('handlePause calls service then context', async () => {
    mockContext.status = 'tracking';
    render(<TrackingControls />);
    fireEvent.click(screen.getByLabelText('tracking.pauseTracking'));

    await waitFor(() => {
      expect(TrackingService.pauseTracking).toHaveBeenCalled();
      expect(mockContext.pause).toHaveBeenCalled();
    });
  });

  it('handlePause does not change state on service failure', async () => {
    vi.mocked(TrackingService.pauseTracking).mockRejectedValueOnce(new Error('fail'));
    mockContext.status = 'tracking';
    render(<TrackingControls />);
    fireEvent.click(screen.getByLabelText('tracking.pauseTracking'));

    await waitFor(() => {
      expect(TrackingService.pauseTracking).toHaveBeenCalled();
    });
    expect(mockContext.pause).not.toHaveBeenCalled();
  });

  it('shows resume and stop buttons when paused', () => {
    mockContext.status = 'paused';
    render(<TrackingControls />);
    expect(screen.getByLabelText('tracking.resumeTracking')).toBeDefined();
    expect(screen.getByLabelText('tracking.stopTracking')).toBeDefined();
  });

  it('handleResume calls service then context', async () => {
    mockContext.status = 'paused';
    render(<TrackingControls />);
    fireEvent.click(screen.getByLabelText('tracking.resumeTracking'));

    await waitFor(() => {
      expect(TrackingService.resumeTracking).toHaveBeenCalledWith(mockContext.addPoint, 'balanced');
      expect(mockContext.resume).toHaveBeenCalled();
    });
  });

  it('handleStop calls pauseTracking then context stop', async () => {
    mockContext.status = 'tracking';
    render(<TrackingControls />);
    fireEvent.click(screen.getByLabelText('tracking.stopTracking'));

    await waitFor(() => {
      expect(TrackingService.pauseTracking).toHaveBeenCalled();
      expect(mockContext.stop).toHaveBeenCalled();
    });
  });

  it('returns null when stopped (TrackingOverlay handles save form)', () => {
    mockContext.status = 'stopped';
    const { container } = render(<TrackingControls />);
    expect(container.innerHTML).toBe('');
  });
});
