import { type ReactNode, useContext } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '../theme';
import { HeaderPresentContext } from './AppHeader';

export interface ScreenProps {
  children: ReactNode;
  /** Desactiva el scroll (listas con FlatList propia). */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Contenedor de pantalla: safe area, teclado, scroll opcional y ancho máximo en web. */
export function Screen({ children, scroll = true, refreshing, onRefresh, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const hasHeader = useContext(HeaderPresentContext);
  const topInsetStyle = hasHeader ? undefined : { paddingTop: insets.top };
  const scrollPadding = {
    paddingTop: spacing.md,
    paddingBottom: insets.bottom + spacing.xl,
  };
  const fixedPadding = {
    paddingTop: spacing.md,
    paddingBottom: 0,
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, topInsetStyle]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, scrollPadding, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, fixedPadding, contentStyle]}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
});
