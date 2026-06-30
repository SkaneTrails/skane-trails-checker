/**
 * Outdoor theme — nature-inspired palette with sage greens and glassmorphism.
 *
 * Softer, Apple-elegant aesthetic with translucent glass surfaces.
 * This is the default (and currently only) theme.
 */

import type { ThemeDefinition } from '../theme-context';

export const outdoorTheme: ThemeDefinition = {
  id: 'outdoor',
  name: 'Outdoor',

  colors: {
    primary: '#2D6A4F',
    primaryDark: '#1B4332',
    primaryLight: '#D8F3DC',

    explored: '#5B8DEF',
    toExplore: '#FF8000',

    background: '#FAFBFC',
    surface: '#FFFFFF',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',

    text: {
      primary: '#1A1D1E',
      secondary: '#5C6370',
      muted: '#9CA3AF',
      inverse: '#FFFFFF',
    },

    status: {
      exploredBg: '#D8F3DC',
      exploredText: '#1B4332',
      toExploreBg: '#FFF3E0',
      toExploreText: '#B45309',
    },

    error: '#B91C1C',
    errorBg: '#FEE2E2',
    success: '#16A34A',
    successBg: '#DCFCE7',

    chip: {
      bg: 'rgba(255,255,255,0.6)',
      text: '#5C6370',
      activeBg: '#2D6A4F',
      activeText: '#FFFFFF',
    },

    tag: {
      foragingBg: '#D8F3DC',
      foragingText: '#1B4332',
      placeBg: '#DBEAFE',
      placeText: '#1E40AF',
    },

    layer: {
      trails: '#6366F1',
      foraging: '#059669',
      places: '#D97706',
    },

    overlay: 'rgba(0,0,0,0.4)',
    overlayText: '#FFFFFF',

    backdrop: 'rgba(0,0,0,0.15)',

    webBackground:
      'linear-gradient(160deg, #E8F0E4 0%, #D6E8D0 25%, #C8DCC4 45%, #D4E4CE 65%, #E4EEE0 85%, #EDF5EA 100%)',

    glass: {
      background: 'rgba(255,255,255,0.72)',
      backgroundDark: 'rgba(30,30,30,0.6)',
      surface: 'rgba(240,242,244,0.62)',
      border: 'rgba(255,255,255,0.3)',
      borderSubtle: 'rgba(255,255,255,0.15)',
      activeHighlight: 'rgba(45,106,79,0.06)',
    },

    shadow: 'rgba(0,40,20,0.08)',
  },

  shadows: {
    card: {
      shadowColor: 'rgba(0,40,20,0.06)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 3,
    },
    subtle: {
      shadowColor: 'rgba(0,40,20,0.03)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
      elevation: 1,
    },
    elevated: {
      shadowColor: 'rgba(0,40,20,0.12)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 24,
      elevation: 6,
    },
  },
};
