// components/ui/DateField.js - Single cross-platform date picker.
// Replaces the three divergent date-picker implementations that existed in
// SecurityInsightsTab, AdminInsightsScreen and free-text date inputs.
// Web  -> native HTML5 <input type="date">
// Mobile -> @react-native-community/datetimepicker behind a touch target
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '../../utils/theme';

const formatDisplay = (date) => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const DateField = ({ label, value, onChange, disabled = false }) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleNativeChange = (event, selectedDate) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {Platform.OS === 'web' ? (
        <input
          type="date"
          value={value.toISOString().split('T')[0]}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value) {
              onChange(new Date(e.target.value));
            }
          }}
          style={{
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: colors.border,
            padding: 10,
            borderRadius: radius.sm,
            backgroundColor: disabled ? colors.surfaceMuted : colors.surface,
            fontSize: 14,
            width: '100%',
            minHeight: 40,
          }}
        />
      ) : (
        <>
          <TouchableOpacity
            style={[styles.pickerButton, disabled && styles.pickerDisabled]}
            onPress={() => !disabled && setShowPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`${label || 'Date'}: ${formatDisplay(value)}`}
          >
            <MaterialIcons name="calendar-today" size={16} color={colors.textSecondary} />
            <Text style={styles.pickerText}>{formatDisplay(value)}</Text>
          </TouchableOpacity>

          {showPicker && (
            <DateTimePicker
              value={value}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleNativeChange}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    minHeight: Math.max(40, TOUCH_TARGET - 8),
    backgroundColor: colors.surface,
  },
  pickerDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  pickerText: {
    ...typography.body,
  },
});

export default DateField;
