// components/ui/DataTable.js - Shared column-priority table with expandable rows.
//
// Design goals (replaces the 14-17 column horizontally-scrolling tables):
//  - Priority 1 columns are always visible; no horizontal scrolling needed
//    for the primary decision-making data.
//  - Priority 2 columns live in an expandable per-row detail panel, opened
//    with a chevron button (progressive disclosure).
//  - Optional row selection: tapping the row toggles selection (whole-row
//    touch target instead of a 20px checkbox).
//  - Built-in empty state.
//
// Column config: { key, title, flex?, width?, priority (1|2), render?(item) }
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '../../utils/theme';

const cellValue = (item, column) => {
  if (column.render) return column.render(item);
  const value = item[column.key];
  return value === null || value === undefined || value === '' ? '—' : String(value);
};

const DataTable = ({
  columns,
  data,
  keyExtractor,
  selectable = false,
  selectedKeys = [],
  onToggleSelect,
  emptyText = 'No records found',
  // 'grid' (default): priority-2 fields wrap in a 3-column grid — good for
  // a handful of fields per row. 'row': all priority-2 fields inline on one
  // horizontally-scrollable line — better when there are few, short fields
  // and a grid would leave awkward empty space (e.g. Vendor Payment Advice).
  detailLayout = 'grid',
  // Optional: renderExpanded(item) -> React node. When given, it fully
  // replaces the auto-generated priority-2 grid/row panel for the expanded
  // state — used by the Gate Pass Reports screen to show a pass's line
  // items instead of a flat label/value list. The row is still expandable
  // even with zero priority-2 columns as long as this is provided.
  renderExpanded,
}) => {
  const [expandedKeys, setExpandedKeys] = useState([]);

  const primaryColumns = columns.filter((c) => c.priority === 1);
  const detailColumns = columns.filter((c) => c.priority !== 1);
  const expandable = detailColumns.length > 0 || typeof renderExpanded === 'function';

  const toggleExpand = useCallback((key) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="inbox" size={32} color={colors.textMuted} />
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.tableContainer}>
      {/* Header */}
      <View style={styles.headerRow}>
        {selectable && <View style={styles.selectCell} />}
        {primaryColumns.map((column) => (
          <View key={`h-${column.key}`} style={[styles.cell, styles.headerCell, { flex: column.flex || 1 }]}>
            <Text style={styles.headerText} numberOfLines={2}>{column.title}</Text>
          </View>
        ))}
        {detailColumns.length > 0 && <View style={styles.expandCell} />}
      </View>

      {/* Rows */}
      {data.map((item, index) => {
        const key = keyExtractor(item, index);
        const isSelected = selectable && selectedKeys.includes(key);
        const isExpanded = expandedKeys.includes(key);

        return (
          <View key={key}>
            <TouchableOpacity
              style={[
                styles.dataRow,
                index % 2 === 0 ? styles.evenRow : styles.oddRow,
                isSelected && styles.selectedRow,
              ]}
              onPress={() => {
                if (selectable && onToggleSelect) {
                  onToggleSelect(key, item, !isSelected);
                } else if (expandable) {
                  toggleExpand(key);
                }
              }}
              accessibilityRole={selectable ? 'checkbox' : 'button'}
              accessibilityState={{ checked: isSelected, expanded: isExpanded }}
            >
              {selectable && (
                <View style={styles.selectCell}>
                  <MaterialIcons
                    name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                    size={24}
                    color={isSelected ? colors.primary : colors.textMuted}
                  />
                </View>
              )}

              {primaryColumns.map((column) => (
                <View key={`c-${key}-${column.key}`} style={[styles.cell, { flex: column.flex || 1 }]}>
                  {typeof cellValue(item, column) === 'string' ? (
                    <Text style={styles.cellText} numberOfLines={2}>
                      {cellValue(item, column)}
                    </Text>
                  ) : (
                    cellValue(item, column)
                  )}
                </View>
              ))}

              {expandable && (
                <TouchableOpacity
                  style={styles.expandCell}
                  onPress={() => toggleExpand(key)}
                  accessibilityRole="button"
                  accessibilityLabel={isExpanded ? 'Hide details' : 'Show details'}
                >
                  <MaterialIcons
                    name={isExpanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Expandable detail panel: a custom renderer (e.g. line items) takes
                priority over the auto-generated priority-2 label/value panel. */}
            {isExpanded && typeof renderExpanded === 'function' ? (
              renderExpanded(item)
            ) : isExpanded && (
              detailLayout === 'row' ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.detailPanelRow}>
                  {detailColumns.map((column) => (
                    <View key={`d-${key}-${column.key}`} style={styles.detailItemRow}>
                      <Text style={styles.detailLabel}>{column.title}</Text>
                      {typeof cellValue(item, column) === 'string' ? (
                        <Text style={styles.detailValue}>{cellValue(item, column)}</Text>
                      ) : (
                        cellValue(item, column)
                      )}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.detailPanel}>
                  {detailColumns.map((column) => (
                    <View key={`d-${key}-${column.key}`} style={styles.detailItem}>
                      <Text style={styles.detailLabel}>{column.title}</Text>
                      {typeof cellValue(item, column) === 'string' ? (
                        <Text style={styles.detailValue}>{cellValue(item, column)}</Text>
                      ) : (
                        cellValue(item, column)
                      )}
                    </View>
                  ))}
                </View>
              )
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tableContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
  },
  headerText: {
    color: colors.textInverse,
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Vertical separator on the header row's cells — a lighter line than the
  // data-row separator below, since it sits on the dark header background.
  headerCell: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.25)',
  },
  dataRow: {
    flexDirection: 'row',
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  evenRow: {
    backgroundColor: colors.surfaceMuted,
  },
  oddRow: {
    backgroundColor: colors.surface,
  },
  selectedRow: {
    backgroundColor: colors.infoBg,
  },
  cell: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    // Vertical column separator — the row border above already marks row
    // boundaries; this marks column boundaries so wrapped/aligned values
    // in adjacent columns don't read as one run-on line.
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
  },
  cellText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  selectCell: {
    width: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
  },
  expandCell: {
    width: TOUCH_TARGET,
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.infoBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailItem: {
    width: '33%',
    minWidth: 160,
    marginBottom: spacing.sm,
    paddingRight: spacing.sm,
  },
  detailPanelRow: {
    flexDirection: 'row',
    backgroundColor: colors.infoBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailItemRow: {
    minWidth: 140,
    marginRight: spacing.lg,
  },
  detailLabel: {
    ...typography.caption,
    fontWeight: 'bold',
  },
  detailValue: {
    ...typography.body,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default DataTable;
