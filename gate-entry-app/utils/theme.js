// utils/theme.js - Single source of truth for design tokens.
// All screens/components should import colors, spacing, radius and type
// from here instead of hardcoding hex values or magic numbers.
import { PLATFORM_COLORS } from './platformColors';

export const colors = {
  // Brand / semantic
  primary: PLATFORM_COLORS.PRIMARY_BLUE,        // #007bff
  success: PLATFORM_COLORS.SUCCESS_GREEN,       // #28a745
  danger: PLATFORM_COLORS.DANGER_RED,           // #dc3545
  warning: PLATFORM_COLORS.WARNING_YELLOW,      // #ffc107
  info: PLATFORM_COLORS.INFO_CYAN,              // #17a2b8
  secondary: PLATFORM_COLORS.DARK_GRAY,         // #6c757d

  // Surfaces
  background: PLATFORM_COLORS.BACKGROUND_PRIMARY,
  surface: PLATFORM_COLORS.BACKGROUND_SECONDARY, // white cards
  surfaceMuted: PLATFORM_COLORS.LIGHT_GRAY,      // #f8f9fa

  // Text
  textPrimary: PLATFORM_COLORS.TEXT_PRIMARY,     // #333
  textSecondary: PLATFORM_COLORS.TEXT_SECONDARY, // #666
  textMuted: PLATFORM_COLORS.TEXT_MUTED,         // #999
  textInverse: PLATFORM_COLORS.TEXT_WHITE,       // #fff
  heading: '#1a365d',

  // Borders
  border: PLATFORM_COLORS.BORDER_MEDIUM,         // #ced4da
  borderLight: PLATFORM_COLORS.BORDER_LIGHT,     // #e9ecef

  // Status backgrounds (banners, chips)
  successBg: PLATFORM_COLORS.STATUS_SUCCESS,     // #d4edda
  errorBg: PLATFORM_COLORS.STATUS_ERROR,         // #f8d7da
  warningBg: PLATFORM_COLORS.STATUS_WARNING,     // #fff3cd
  infoBg: PLATFORM_COLORS.STATUS_INFO,           // #d1ecf1

  disabled: '#cccccc',
};

// 8-point spacing scale
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
};

export const typography = {
  title: { fontSize: 18, fontWeight: 'bold', color: colors.heading },
  label: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textPrimary },
  caption: { fontSize: 12, color: colors.textSecondary },
};

// Minimum touch target (Android Material guidance: 48dp)
export const TOUCH_TARGET = 48;

export const elevation = {
  card: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  overlay: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
};

export default { colors, spacing, radius, typography, TOUCH_TARGET, elevation };
