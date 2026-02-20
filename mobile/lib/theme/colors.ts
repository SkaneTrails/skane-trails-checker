/**
 * Semantic color tokens for the application theme.
 *
 * Every color used in the app should be a token here — never hardcode
 * hex values in components. Tokens are semantic (describe purpose, not hue)
 * so that alternative themes can redefine them without renaming.
 */

/** Structural contract for color palettes. */
export interface ColorTokens {
  /** Primary brand color (headers, CTAs, active states). */
  readonly primary: string;
  /** Darker primary variant for pressed / hover states. */
  readonly primaryDark: string;

  /** Default screen background. */
  readonly background: string;
  /** Card / elevated-surface background. */
  readonly surface: string;
  /** Semi-transparent overlay (modals, map labels). */
  readonly overlay: string;

  /** Text color hierarchy — darkest to lightest. */
  readonly text: {
    /** Headings, names, important content. */
    readonly primary: string;
    /** Descriptions, notes, body content. */
    readonly secondary: string;
    /** Meta labels, coordinates, fine print. */
    readonly tertiary: string;
    /** Inactive / disabled content. */
    readonly muted: string;
    /** On colored / dark backgrounds. */
    readonly inverse: string;
    /** Interactive text (links, pressable labels). */
    readonly link: string;
  };

  /** Trail exploration-status indicator colors. */
  readonly status: {
    readonly explored: {
      /** Badge / chip background. */
      readonly bg: string;
      /** Map polyline stroke. */
      readonly line: string;
    };
    readonly toExplore: {
      readonly bg: string;
      readonly line: string;
    };
  };

  /** Destructive / failure feedback. */
  readonly error: string;

  /** Neutral border (dividers, inactive chips). */
  readonly border: string;
  /** Shadow base color (used with opacity in shadow presets). */
  readonly shadow: string;

  /** Tag / chip category colors. */
  readonly tag: {
    readonly foraging: { readonly bg: string; readonly text: string };
    readonly place: { readonly bg: string; readonly text: string };
    readonly inactive: { readonly bg: string; readonly text: string };
  };
}

/** Nature theme palette — forest greens with warm earth tones. */
export const natureColors: ColorTokens = {
  primary: '#1a5e2a',
  primaryDark: '#145221',

  background: '#f5f5f5',
  surface: '#ffffff',
  overlay: 'rgba(0, 0, 0, 0.6)',

  text: {
    primary: '#333333',
    secondary: '#666666',
    tertiary: '#999999',
    muted: '#888888',
    inverse: '#ffffff',
    link: '#1a5e2a',
  },

  status: {
    explored: { bg: '#d4edda', line: '#2d8a4e' },
    toExplore: { bg: '#f8d7da', line: '#dc3545' },
  },

  error: '#cc0000',

  border: '#eeeeee',
  shadow: '#000000',

  tag: {
    foraging: { bg: '#e8f5e9', text: '#1a5e2a' },
    place: { bg: '#e3f2fd', text: '#1565c0' },
    inactive: { bg: '#eeeeee', text: '#666666' },
  },
};
