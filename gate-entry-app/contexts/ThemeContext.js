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
// 25 Nov 2026 UI overhaul: palette taken from the Inventory portal wireframe
// (teal-green gradient). Key NAMES are unchanged so existing screens keep
// working — `navy*` now means the deep teal band, `maroon*` the primary
// action green.
export const brand = {
  navy: '#00836F',        // header band / KPI card background (wireframe --g2)
  navyDark: '#00604F',    // header band gradient end / deep KPI shade (--g3)
  teal: '#00A68B',        // wireframe --g1 (gradient start)
  maroon: '#0F6B46',      // primary action / buttons (wireframe --btn)
  maroonDark: '#0B5236',
  active: '#2FB164',      // active menu item (wireframe --active)
  headerGradient: 'linear-gradient(90deg, #00A68B 0%, #00B79C 60%, #00C4A7 100%)',
  sidebarGradient: 'linear-gradient(180deg, #00A68B 0%, #00836F 55%, #00604F 100%)',
};

const lightColors = {
  mode: 'light',
  background: '#EEF5F2',
  surface: '#FFFFFF',
  surfaceMuted: '#E6F1EC',
  border: '#E0E9E5',
  textPrimary: '#12202A',
  textSecondary: '#5B6B75',
  textMuted: '#8B99A3',
  textInverse: '#FFFFFF',
  headerBg: brand.teal,
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
        // Dark mode switched off for the 25 Nov 2026 UI overhaul (wireframe is
        // light only) — a previously saved 'dark' is ignored, never applied.
        if (saved === 'light') {
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

  const toggleTheme = () => {};   // dark mode disabled (see above)

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
