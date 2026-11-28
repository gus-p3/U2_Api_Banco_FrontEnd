import { type ComponentRef, type ReactNode, useContext, useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
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
  const scrollViewRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (!scroll || Platform.OS === 'web') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = Keyboard.addListener('keyboardDidShow', (event) => {
      const keyboardTop = event.endCoordinates?.screenY;
      if (typeof keyboardTop !== 'number' || keyboardTop <= 0) return;
      timer = setTimeout(() => {
        try {
          const focused = TextInput.State?.currentlyFocusedInput?.() as
            | {
                measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
              }
            | null
            | undefined;
          focused?.measureInWindow?.((_x, y, _w, h) => {
            const inputBottom = y + h;
            const visibleLimit = keyboardTop - 28;
            if (inputBottom > visibleLimit) {
              const delta = inputBottom - visibleLimit;
              scrollViewRef.current?.scrollTo({
                y: Math.max(0, scrollYRef.current + delta),
                animated: true,
              });
            }
          });
        } catch {
          // Si el input ya se desmontó, ignorar silenciosamente
        }
      }, 60);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [scroll]);

  const topInsetStyle = hasHeader ? undefined : { paddingTop: insets.top };
  const scrollPadding = {
    paddingTop: spacing.md,
    paddingBottom: insets.bottom + spacing.xl,
  };
  const fixedPadding = {
    paddingTop: spacing.md,
    paddingBottom: 0,
  };

  const keyboardBehavior = Platform.OS === 'web' ? undefined : 'padding';
  const keyboardVerticalOffset = hasHeader ? insets.top + 60 : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, topInsetStyle]}
      behavior={keyboardBehavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {scroll ? (
        <ScrollView
          ref={scrollViewRef}
          style={styles.flex}
          contentContainerStyle={[styles.content, scrollPadding, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
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
