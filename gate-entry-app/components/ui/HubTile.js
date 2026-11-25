// components/ui/HubTile.js - The one "application card" look (25 Nov 2026).
// Used by the Admin Hub tiles and the RPA domain tiles so both screens look
// identical: white rounded card, tinted rounded-square icon chip, bold title,
// grey subtitle, and an "Open →" footer (or a status pill when disabled).
// Lifts slightly on mouse hover (web).
import React from 'react';
import { View, Text, Pressable, Platform, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const HubTile = ({
  label,
  sublabel,
  icon,
  accentColor = '#0F6B46',
  iconBg = '#E6F1EC',
  onPress,
  disabled = false,
  statusText,            // e.g. 'COMING SOON' — shown instead of "Open →"
  accessibilityLabel,
}) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const narrow = width < 900;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${label}${sublabel ? `: ${sublabel}` : ''}`}
      accessibilityState={{ disabled }}
      style={({ pressed, hovered }) => [
        {
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          width: narrow ? '46%' : 200,
          minHeight: narrow ? 160 : 188,
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          padding: narrow ? 14 : 18,
          ...Platform.select({
            web: {
              boxShadow: '0px 4px 14px rgba(0,96,79,0.08)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'transform .15s ease, box-shadow .15s ease',
            },
            android: { elevation: 3 },
            ios: { shadowColor: '#00604F', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6 },
          }),
        },
        hovered && !disabled && {
          transform: [{ translateY: -3 }],
          borderColor: '#BFDCD2',
          ...Platform.select({ web: { boxShadow: '0px 10px 24px rgba(0,96,79,0.14)' } }),
        },
        pressed && !disabled && { opacity: 0.75, transform: [{ scale: 0.97 }] },
        disabled && { opacity: 0.6 },
      ]}
    >
      <View style={{
        width: 52, height: 52, borderRadius: 14, backgroundColor: iconBg,
        alignItems: 'center', justifyContent: 'center', marginBottom: 14,
      }}>
        <MaterialIcons name={icon} size={28} color={accentColor} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{label}</Text>
      {sublabel ? (
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{sublabel}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: 14 }}>
        {statusText ? (
          <View style={{ backgroundColor: '#F1EFE8', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#5F5E5A', letterSpacing: 0.4 }}>{statusText}</Text>
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 13, fontWeight: '700', color: accentColor }}>Open</Text>
            <MaterialIcons name="arrow-forward" size={16} color={accentColor} />
          </>
        )}
      </View>
    </Pressable>
  );
};

export default HubTile;
