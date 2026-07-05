// components/ui/AppButton.js - Shared button with semantic variants.
// Replaces per-screen TouchableOpacity + hardcoded colors. Guarantees a
// 48dp touch target, loading state, optional MaterialIcons icon, and
// consistent disabled treatment.
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing, TOUCH_TARGET } from '../../utils/theme';

const VARIANT_COLORS = {
  primary: colors.primary,
  success: colors.success,
  danger: colors.danger,
  info: colors.info,
  secondary: colors.secondary,
};

const AppButton = ({
  title,
  onPress,
  variant = 'primary',
  icon,               // MaterialIcons name, optional
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const backgroundColor = disabled ? colors.disabled : (VARIANT_COLORS[variant] || colors.primary);

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor }, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textInverse} />
      ) : (
        <>
          {icon ? (
            <MaterialIcons
              name={icon}
              size={18}
              color={colors.textInverse}
              style={styles.icon}
            />
          ) : null}
          <Text style={[styles.text, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    minWidth: 120,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  disabled: {
    opacity: 0.6,
    elevation: 0,
    shadowOpacity: 0,
  },
  icon: {
    marginRight: spacing.xs,
  },
  text: {
    color: colors.textInverse,
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default AppButton;
