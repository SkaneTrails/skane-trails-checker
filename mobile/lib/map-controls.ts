import { spacing } from '@/lib/theme';

/** Top-right map controls form one row: menu, native compass, then the loading spinner. */
export const CONTROL_SIZE = 42;
export const CONTROL_GAP = spacing.sm;

/** Assumed size of the MapLibre Android compass ornament (it is not configurable). */
export const NATIVE_COMPASS_SIZE = 48;

/** Right offset of the compass: left of the menu button. */
export const COMPASS_RIGHT = spacing.lg + CONTROL_SIZE + CONTROL_GAP;

/** Right offset of the spinner: left of the compass (native only; web has no compass). */
export const SPINNER_RIGHT_WITH_COMPASS = COMPASS_RIGHT + NATIVE_COMPASS_SIZE + CONTROL_GAP;
export const SPINNER_RIGHT_WITHOUT_COMPASS = COMPASS_RIGHT;
