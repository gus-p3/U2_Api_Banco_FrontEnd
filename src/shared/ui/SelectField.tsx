import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const SELECT_PAGE_SIZE = 20;

import { colors, layout, radii, spacing, typography } from '../theme';

export interface SelectOption<T extends string | number = string | number> {
  value: T;
  label: string;
  subtitle?: string;
}

export interface SelectFieldProps<T extends string | number = string | number> {
  label: string;
  placeholder?: string;
  value: T | null | undefined;
  options: Array<SelectOption<T>>;
  onSelect: (value: T) => void;
  error?: string;
  hint?: string;
  loading?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  emptyText?: string;
}

export function SelectField<T extends string | number = string | number>({
  label,
  placeholder = 'Selecciona una opción',
  value,
  options,
  onSelect,
  error,
  hint,
  loading = false,
  disabled = false,
  searchable,
  emptyText = 'Sin opciones disponibles',
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(SELECT_PAGE_SIZE);

  const selectedOption = useMemo(() => options.find((opt) => opt.value === value), [options, value]);

  const showSearch = searchable ?? options.length > 6;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(q) || (opt.subtitle ?? '').toLowerCase().includes(q),
    );
  }, [options, query]);

  const visibleOptions = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const hasMore = visibleCount < filtered.length;

  const handleLoadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount((prev) => Math.min(prev + SELECT_PAGE_SIZE, filtered.length));
    }
  }, [hasMore, filtered.length]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled || loading}
        style={[
          styles.trigger,
          Boolean(error) && styles.triggerError,
          (disabled || loading) && styles.triggerDisabled,
        ]}
        onPress={() => {
          setQuery('');
          setVisibleCount(SELECT_PAGE_SIZE);
          setOpen(true);
        }}
      >
        <Text numberOfLines={1} style={[styles.triggerText, !selectedOption && styles.placeholderText]}>
          {loading ? 'Cargando opciones...' : (selectedOption?.label ?? placeholder)}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        )}
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalAvoid}
          behavior={Platform.OS === 'web' ? undefined : 'padding'}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => undefined}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar lista"
                  onPress={() => setOpen(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>

              {showSearch ? (
                <View style={styles.searchWrap}>
                  <Ionicons name="search" size={18} color={colors.textMuted} />
                  <TextInput
                    placeholder="Buscar..."
                    placeholderTextColor="#94A3B8"
                    autoComplete="off"
                    importantForAutofill="no"
                    textContentType="none"
                    value={query}
                    onChangeText={(txt) => {
                      setQuery(txt);
                      setVisibleCount(SELECT_PAGE_SIZE);
                    }}
                    style={styles.searchInput}
                  />
                </View>
              ) : null}

              <FlatList
                style={styles.list}
                data={visibleOptions}
                keyExtractor={(opt) => String(opt.value)}
                keyboardShouldPersistTaps="handled"
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
                initialNumToRender={SELECT_PAGE_SIZE}
                ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
                ListFooterComponent={
                  hasMore ? (
                    <View style={styles.footerLoader}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  ) : undefined
                }
                renderItem={({ item: opt }) => {
                  const active = opt.value === value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() => {
                        onSelect(opt.value);
                        setOpen(false);
                      }}
                    >
                      <View style={styles.optionTexts}>
                        <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                          {opt.label}
                        </Text>
                        {opt.subtitle ? (
                          <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
                        ) : undefined}
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      ) : undefined}
                    </Pressable>
                  );
                }}
              />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
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
  triggerDisabled: { opacity: 0.6, backgroundColor: colors.surfaceMuted },
  triggerText: { ...typography.body, color: colors.text, flex: 1 },
  placeholderText: { color: '#94A3B8' },
  error: { ...typography.caption, color: colors.danger },
  hint: { ...typography.caption, color: colors.textMuted },
  modalAvoid: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { ...typography.subheading, color: colors.text, flex: 1 },
  closeBtn: { padding: spacing.xs },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    ...typography.body,
    color: colors.text,
  },
  list: { maxHeight: 360 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  optionRowActive: { backgroundColor: colors.primarySoft },
  optionTexts: { flex: 1, gap: 2 },
  optionLabel: { ...typography.body, color: colors.text },
  optionLabelActive: { color: colors.primary, fontWeight: '700' },
  optionSubtitle: { ...typography.caption, color: colors.textMuted },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.xl,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
