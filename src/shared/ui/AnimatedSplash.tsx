import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const splashLogo = require('../../../assets/splash-icon.png');

export interface AnimatedSplashProps {
  /** Cuando pasa a `true` y termina la animación inicial, la splash se desvanece suavemente. */
  appReady: boolean;
}

const MIN_SPLASH_MS = 1400;

export function AnimatedSplash({ appReady }: AnimatedSplashProps) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [hidden, setHidden] = useState(false);

  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.85)).current;
  const ringOpacity = useRef(new Animated.Value(0.55)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(16)).current;
  const barProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);

    // Entrada del ícono + textos + barra de progreso
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(180),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.timing(barProgress, {
        toValue: 1,
        duration: MIN_SPLASH_MS - 150,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    // Flotación suave + pulso del anillo en bucle
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -7,
          duration: 750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.16,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 0.88, duration: 0, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.45, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      clearTimeout(timer);
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [
    barProgress,
    logoFloat,
    logoOpacity,
    logoScale,
    ringOpacity,
    ringScale,
    textOpacity,
    textTranslateY,
  ]);

  useEffect(() => {
    if (!appReady || !minElapsed || hidden) return;
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setHidden(true);
    });
  }, [appReady, minElapsed, hidden, containerOpacity]);

  if (hidden) return null;

  const progressWidth = barProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['8%', '100%'],
  });

  return (
    <Animated.View
      pointerEvents={appReady && minElapsed ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.overlay, { opacity: containerOpacity }]}
    >
      <View style={styles.logoStage}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }, { translateY: logoFloat }],
          }}
        >
          <Image source={splashLogo} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.textBlock,
          {
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          },
        ]}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>BANCA DIGITAL</Text>
        </View>
        <Text style={styles.title}>Banco Digital</Text>
        <Text style={styles.subtitle}>Tu alcancía y pagos al instante</Text>
      </Animated.View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 999,
  },
  logoStage: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  pulseRing: {
    position: 'absolute',
    width: 184,
    height: 184,
    borderRadius: 46,
    backgroundColor: colors.accentLight,
  },
  logoImage: {
    width: 184,
    height: 184,
  },
  textBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.2,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  progressTrack: {
    marginTop: spacing.xl,
    width: 180,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
});
