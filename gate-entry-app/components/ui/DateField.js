// components/ui/DateField.js - Single cross-platform date picker, used both
// where a date is always required (e.g. Expected Inward Date on the New
// Gate Pass form) and where it's optional (e.g. From/To filter fields).
// Pass value={null} for an empty/optional field — it renders a placeholder
// and a "clear" (×) button appears once a date is picked.
// Web    -> native HTML5 <input type="date"> (blank when value is null)
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

const toISODate = (date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// value: Date | null (null only makes sense when the field is optional,
// e.g. a filter — required fields such as the create-pass form always pass
// a real Date and never see the placeholder/clear-button state).
const DateField = ({ label, value, onChange, placeholder = 'Select date', disabled = false }) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleNativeChange = (event, selectedDate) => {
    setShowPicker(Platform.OS === 'ios');
    if (event.type === 'dismissed') return;
    if (selectedDate) onChange(selectedDate);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {Platform.OS === 'web' ? (
        <input
          type="date"
          value={value ? toISODate(value) : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null)}
          style={{
            boxSizing: 'border-box',
            width: '100%',
            height: 44,
            border: '1px solid #BCE5CC',
            borderRadius: 8,
            padding: '0 12px',
            fontSize: 14,
            fontFamily: 'inherit',
            color: colors.textPrimary,
            backgroundColor: disabled ? colors.surfaceMuted : '#ffffff',
            outline: 'none',
            cursor: disabled ? 'default' : 'pointer',
          }}
        />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <TouchableOpacity
            style={[styles.pickerButton, disabled && styles.pickerDisabled]}
            onPress={() => !disabled && setShowPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`${label || 'Date'}: ${value ? formatDisplay(value) : placeholder}`}
          >
            <MaterialIcons name="calendar-today" size={16} color={colors.textSecondary} />
            <Text style={value ? styles.pickerText : styles.pickerPlaceholder}>
              {value ? formatDisplay(value) : placeholder}
            </Text>
          </TouchableOpacity>

          {value && !disabled && (
            <TouchableOpacity
              onPress={() => onChange(null)}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${label || 'date'}`}
              style={styles.clearButton}
            >
              <MaterialIcons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {showPicker && (
            <DateTimePicker
              value={value || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleNativeChange}
            />
          )}
        </View>
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
    flex: 1,
  },
  pickerDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  pickerText: {
    ...typography.body,
  },
  pickerPlaceholder: {
    ...typography.body,
    color: colors.textMuted,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
});

export default DateField;
