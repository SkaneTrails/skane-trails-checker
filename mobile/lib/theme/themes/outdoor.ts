/**
 * Outdoor theme — nature-inspired palette with forest greens and earth tones.
 *
 * This is the default (and currently only) theme.
 */

import type { ThemeDefinition } from '../theme-context';

export const outdoorTheme: ThemeDefinition = {
  id: 'outdoor',
  name: 'Outdoor',

  colors: {
    primary: '#1a5e2a',
    primaryDark: '#144a21',
    primaryLight: '#e8f5e9',

    explored: '#4169E1',
    toExplore: '#FF8000',

    background: '#f5f5f5',
    surface: '#ffffff',
    border: '#e0e0e0',
    borderLight: '#eeeeee',

    text: {
      primary: '#333333',
      secondary: '#666666',
      muted: '#999999',
      inverse: '#ffffff',
    },

    status: {
      exploredBg: '#d4edda',
      exploredText: '#155724',
      toExploreBg: '#fff3cd',
      toExploreText: '#856404',
    },

    error: '#cc0000',
    errorBg: '#f8d7da',
    success: '#28a745',
    successBg: '#d4edda',

    chip: {
      bg: '#eeeeee',
      text: '#333333',
      activeBg: '#1a5e2a',
      activeText: '#ffffff',
    },

    tag: {
      foragingBg: '#e8f5e9',
      foragingText: '#2e7d32',
      placeBg: '#e3f2fd',
      placeText: '#1565c0',
    },

    overlay: 'rgba(0,0,0,0.6)',
    overlayText: '#ffffff',

    shadow: '#000000',
  },

  shadows: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    subtle: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
  },
};
