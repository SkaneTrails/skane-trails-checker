/**
 * Color token contract.
 *
 * Every theme palette must satisfy this interface.
 * Components import `ColorTokens` — never raw hex values.
 */
export interface ColorTokens {
  /** Brand / header / primary actions */
  primary: string;
  primaryDark: string;
  primaryLight: string;

  /** Explored trail color */
  explored: string;
  /** To-explore trail color */
  toExplore: string;

  /** Backgrounds */
  background: string;

  /** Card / elevated surfaces */
  surface: string;

  /** Borders / dividers */
  border: string;
  borderLight: string;

  /** Text hierarchy */
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };

  /** Status badges */
  status: {
    exploredBg: string;
    exploredText: string;
    toExploreBg: string;
    toExploreText: string;
  };

  /** Semantic */
  error: string;
  errorBg: string;
  success: string;
  successBg: string;

  /** Chips (filter toggles) */
  chip: {
    bg: string;
    text: string;
    activeBg: string;
    activeText: string;
  };

  /** Category / type tags */
  tag: {
    foragingBg: string;
    foragingText: string;
    placeBg: string;
    placeText: string;
  };

  /** Map layer indicator colors (distinct from data marker colors) */
  layer: {
    trails: string;
    foraging: string;
    places: string;
  };

  /** Overlay (map toasts, modals) */
  overlay: string;
  overlayText: string;

  /** Lightweight backdrop for sheets / modals */
  backdrop: string;

  /** Web-only full-page background (CSS gradient or solid) */
  webBackground: string;

  /** Glass / translucent surfaces */
  glass: {
    background: string;
    backgroundDark: string;
    surface: string;
    border: string;
    borderSubtle: string;
    activeHighlight: string;
  };

  /** Shadow base color */
  shadow: string;
}
