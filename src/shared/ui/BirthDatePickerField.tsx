import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, layout, radii, spacing, typography } from '../theme';

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseIso(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

export interface BirthDatePickerFieldProps {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  error?: string;
}

/**
 * Selector de fecha de nacimiento con calendario visual que bloquea automáticamente
 * cualquier fecha correspondiente a menores de 18 años.
 */
export function BirthDatePickerField({ label, value, onChange, error }: BirthDatePickerFieldProps) {
  const today = useMemo(() => new Date(), []);
  const maxYear = today.getFullYear() - 18;
  const maxMonth = today.getMonth();
  const maxDay = today.getDate();
  const minYear = today.getFullYear() - 100;

  const parsed = parseIso(value);
  const initialYear = parsed && parsed.year <= maxYear && parsed.year >= minYear ? parsed.year : 1995;
  const initialMonth = parsed ? parsed.month : 4;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [pickingYear, setPickingYear] = useState(false);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) {
      arr.push(y);
    }
    return arr;
  }, [maxYear, minYear]);

  const isDayDisabled = (y: number, m: number, d: number): boolean => {
    if (y > maxYear) return true;
    if (y === maxYear && m > maxMonth) return true;
    if (y === maxYear && m === maxMonth && d > maxDay) return true;
    if (y < minYear) return true;
    return false;
  };

  const canGoNextMonth = viewYear < maxYear || (viewYear === maxYear && viewMonth < maxMonth);
  const canGoPrevMonth = viewYear > minYear || (viewYear === minYear && viewMonth > 0);

  const goPrevMonth = () => {
    if (!canGoPrevMonth) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (!canGoNextMonth) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  const formattedDisplay = parsed
    ? `${pad2(parsed.day)} de ${MONTHS[parsed.month]} de ${parsed.year} (${value})`
    : 'Selecciona tu fecha de nacimiento';

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.trigger, Boolean(error) && styles.triggerError]}
        onPress={() => {
          const current = parseIso(value);
          if (current && current.year <= maxYear && current.year >= minYear) {
            setViewYear(current.year);
            setViewMonth(current.month);
          } else {
            setViewYear(Math.min(1995, maxYear));
            setViewMonth(0);
          }
          setPickingYear(false);
          setOpen(true);
        }}
      >
        <Text numberOfLines={1} style={[styles.triggerText, !parsed && styles.placeholderText]}>
          {formattedDisplay}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : (
        <Text style={styles.hint}>Solo mayores de 18 años (fechas menores bloqueadas).</Text>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Fecha de nacimiento</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar calendario"
                onPress={() => setOpen(false)}
                style={styles.iconBtn}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.controlsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mes anterior"
                disabled={!canGoPrevMonth || pickingYear}
                style={[styles.navBtn, (!canGoPrevMonth || pickingYear) && styles.navBtnDisabled]}
                onPress={goPrevMonth}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                style={styles.monthYearBtn}
                onPress={() => setPickingYear((p) => !p)}
              >
                <Text style={styles.monthYearText}>
                  {MONTHS[viewMonth]} {viewYear}
                </Text>
                <Ionicons
                  name={pickingYear ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.primary}
                />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mes siguiente"
                disabled={!canGoNextMonth || pickingYear}
                style={[styles.navBtn, (!canGoNextMonth || pickingYear) && styles.navBtnDisabled]}
                onPress={goNextMonth}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </Pressable>
            </View>

            {pickingYear ? (
              <ScrollView style={styles.yearList}>
                <View style={styles.yearGrid}>
                  {years.map((y) => {
                    const active = y === viewYear;
                    return (
                      <Pressable
                        key={y}
                        style={[styles.yearCell, active && styles.yearCellActive]}
                        onPress={() => {
                          setViewYear(y);
                          if (y === maxYear && viewMonth > maxMonth) {
                            setViewMonth(maxMonth);
                          }
                          setPickingYear(false);
                        }}
                      >
                        <Text style={[styles.yearText, active && styles.yearTextActive]}>{y}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.calendarBody}>
                <View style={styles.weekRow}>
                  {WEEKDAYS.map((wd) => (
                    <Text key={wd} style={styles.weekLabel}>
                      {wd}
                    </Text>
                  ))}
                </View>
                <View style={styles.daysGrid}>
                  {calendarCells.map((day, idx) => {
                    if (day === null) {
                      return <View key={`empty-${idx}`} style={styles.dayCell} />;
                    }
                    const disabled = isDayDisabled(viewYear, viewMonth, day);
                    const selected =
                      parsed?.year === viewYear && parsed?.month === viewMonth && parsed?.day === day;
                    return (
                      <Pressable
                        key={day}
                        disabled={disabled}
                        style={[
                          styles.dayCell,
                          selected && styles.dayCellSelected,
                          disabled && styles.dayCellDisabled,
                        ]}
                        onPress={() => {
                          onChange(toIso(viewYear, viewMonth, day));
                          setOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            selected && styles.dayTextSelected,
                            disabled && styles.dayTextDisabled,
                          ]}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <Text style={styles.footerNote}>
              Fecha máxima permitida (18 años): {toIso(maxYear, maxMonth, maxDay)}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.text, fontWeight: '600' },
  trigger: {
    minHeight: layout.minTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  triggerError: { borderColor: colors.danger },
  triggerText: { ...typography.body, color: colors.text, flex: 1 },
  placeholderText: { color: '#94A3B8' },
  error: { ...typography.caption, color: colors.danger },
  hint: { ...typography.caption, color: colors.textMuted },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.subheading, color: colors.text },
  iconBtn: { padding: spacing.xs },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navBtn: {
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  navBtnDisabled: { opacity: 0.35 },
  monthYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  monthYearText: { ...typography.body, color: colors.primary, fontWeight: '700' },
  yearList: { maxHeight: 280, paddingHorizontal: spacing.md },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  yearCell: {
    width: '23%',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  yearCellActive: { backgroundColor: colors.primary },
  yearText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  yearTextActive: { color: colors.textOnPrimary },
  calendarBody: { paddingHorizontal: spacing.md },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  weekLabel: {
    width: '14.28%',
    textAlign: 'center',
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  dayCellSelected: { backgroundColor: colors.primary },
  dayCellDisabled: { opacity: 0.28 },
  dayText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  dayTextSelected: { color: colors.textOnPrimary, fontWeight: '700' },
  dayTextDisabled: { color: colors.textMuted },
  footerNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
