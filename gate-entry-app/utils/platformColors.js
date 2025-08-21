// utils/platformColors.js - Platform-specific color constants
import { Platform } from 'react-native';

// Function to darken a hex color by a percentage
const darkenColor = (hexColor, percentage) => {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Apply darkening
  const factor = (100 - percentage) / 100;
  const newR = Math.round(r * factor);
  const newG = Math.round(g * factor);
  const newB = Math.round(b * factor);
  
  // Convert back to hex
  const toHex = (n) => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

// Base colors
const BASE_COLORS = {
  BACKGROUND_PRIMARY: '#E0F7FA',
  BACKGROUND_SECONDARY: '#ffffff',
  PRIMARY_BLUE: '#007bff',
  SUCCESS_GREEN: '#28a745',
  DANGER_RED: '#dc3545',
  WARNING_YELLOW: '#ffc107',
  INFO_CYAN: '#17a2b8',
  DARK_GRAY: '#6c757d',
  LIGHT_GRAY: '#f8f9fa',
  BORDER_GRAY: '#dee2e6',
};

// Platform-specific colors
export const PLATFORM_COLORS = {
  // Main background color - 30% darker on web
  BACKGROUND_PRIMARY: Platform.OS === 'web' 
    ? darkenColor(BASE_COLORS.BACKGROUND_PRIMARY, 30) // #9DADAF
    : BASE_COLORS.BACKGROUND_PRIMARY, // #E0F7FA
  
  // Other colors remain the same across platforms
  BACKGROUND_SECONDARY: BASE_COLORS.BACKGROUND_SECONDARY,
  PRIMARY_BLUE: BASE_COLORS.PRIMARY_BLUE,
  SUCCESS_GREEN: BASE_COLORS.SUCCESS_GREEN,
  DANGER_RED: BASE_COLORS.DANGER_RED,
  WARNING_YELLOW: BASE_COLORS.WARNING_YELLOW,
  INFO_CYAN: BASE_COLORS.INFO_CYAN,
  DARK_GRAY: BASE_COLORS.DARK_GRAY,
  LIGHT_GRAY: BASE_COLORS.LIGHT_GRAY,
  BORDER_GRAY: BASE_COLORS.BORDER_GRAY,
  
  // Text colors
  TEXT_PRIMARY: '#333333',
  TEXT_SECONDARY: '#666666',
  TEXT_MUTED: '#999999',
  TEXT_WHITE: '#ffffff',
  
  // Button colors
  BUTTON_PRIMARY: BASE_COLORS.PRIMARY_BLUE,
  BUTTON_SUCCESS: BASE_COLORS.SUCCESS_GREEN,
  BUTTON_DANGER: BASE_COLORS.DANGER_RED,
  BUTTON_WARNING: BASE_COLORS.WARNING_YELLOW,
  BUTTON_INFO: BASE_COLORS.INFO_CYAN,
  BUTTON_SECONDARY: BASE_COLORS.DARK_GRAY,
  
  // Status colors
  STATUS_SUCCESS: '#d4edda',
  STATUS_ERROR: '#f8d7da',
  STATUS_WARNING: '#fff3cd',
  STATUS_INFO: '#d1ecf1',
  
  // Border colors
  BORDER_LIGHT: '#e9ecef',
  BORDER_MEDIUM: '#ced4da',
  BORDER_DARK: '#6c757d',
};

// Utility function to get platform-specific color
export const getPlatformColor = (colorKey) => {
  return PLATFORM_COLORS[colorKey] || '#000000';
};

// Export individual colors for convenience
export const {
  BACKGROUND_PRIMARY,
  BACKGROUND_SECONDARY,
  PRIMARY_BLUE,
  SUCCESS_GREEN,
  DANGER_RED,
  WARNING_YELLOW,
  INFO_CYAN,
  DARK_GRAY,
  LIGHT_GRAY,
  BORDER_GRAY,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_WHITE,
  BUTTON_PRIMARY,
  BUTTON_SUCCESS,
  BUTTON_DANGER,
  BUTTON_WARNING,
  BUTTON_INFO,
  BUTTON_SECONDARY,
  STATUS_SUCCESS,
  STATUS_ERROR,
  STATUS_WARNING,
  STATUS_INFO,
  BORDER_LIGHT,
  BORDER_MEDIUM,
  BORDER_DARK,
} = PLATFORM_COLORS;