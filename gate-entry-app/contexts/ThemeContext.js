// contexts/ThemeContext.js - App-wide light/dark mode.
//
// New brand scheme (Aug 2026 redesign): dark-navy header/KPI surfaces, teal
// logo accent, maroon active-tab pill. The header/brand band keeps its navy
// colour in BOTH modes (that's the brand, not the theme) — what the toggle
// changes is the page background, card surfaces and text colours around it.
//
// Usage:
//   const { mode, isDark, colors, toggleTheme } = useTheme();
import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '../utils/storage';

const THEME_STORAGE_KEY = 'app_theme_mode';

// Brand constants — identical in both modes.
export const brand = {
  navy: '#122A45',        // header band / KPI card background
  navyDark: '#0B1D30',    // header band gradient end / deep KPI shade
  teal: '#0E8C82',        // Bisleri cursive-logo teal
  maroon: '#8C2A3A',      // active tab pill / primary accent
  maroonDark: '#6E2029',
};

const lightColors = {
  mode: 'light',
  background: '#F5F7F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2F3',
  border: '#E1E6E8',
  textPrimary: '#1A2430',
  textSecondary: '#5B6B78',
  textMuted: '#8B99A3',
  textInverse: '#FFFFFF',
  headerBg: brand.navy,
  headerBgEnd: brand.navyDark,
  headerText: '#FFFFFF',
  kpiBg: brand.navy,
  kpiText: '#FFFFFF',
  accent: brand.maroon,
  accentText: '#FFFFFF',
  ...brand,
};

const darkColors = {
  mode: 'dark',
  background: '#0F1620',
  surface: '#1A2430',
  surfaceMuted: '#212D3B',
  border: '#2C3A48',
  textPrimary: '#EDF1F4',
  textSecondary: '#AEBBC6',
  textMuted: '#7C8A96',
  textInverse: '#0F1620',
  headerBg: brand.navy,
  headerBgEnd: brand.navyDark,
  headerText: '#FFFFFF',
  kpiBg: brand.navyDark,
  kpiText: '#FFFFFF',
  accent: brand.maroon,
  accentText: '#FFFFFF',
  ...brand,
};

const ThemeContext = createContext({
  mode: 'light',
  isDark: false,
  colors: lightColors,
  toggleTheme: () => {},
  setMode: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [mode, setModeState] = useState('light');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          setModeState(saved);
        }
      } catch (e) {
        // best-effort — default to light
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setMode = (next) => {
    setModeState(next);
    storage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  };

  const toggleTheme = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const value = {
    mode,
    isDark: mode === 'dark',
    colors: mode === 'dark' ? darkColors : lightColors,
    toggleTheme,
    setMode,
    loaded,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
