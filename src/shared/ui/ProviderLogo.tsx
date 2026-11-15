import { memo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { colors, radii, typography } from '../theme';

export interface ProviderLogoProps {
  /** Nombre del proveedor o servicio para calcular las iniciales del placeholder. */
  name: string;
  /** URL del logotipo si existe; si es nula o falla la carga se muestra el avatar neutro con iniciales. */
  logoUrl?: string | null;
  /** Tamaño en px del contenedor cuadrado/circular (por defecto 40). */
  size?: number;
}

function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const words = cleaned.split(/\s+/).filter(Boolean);
  const first = words[0];
  const second = words[1];
  if (!first) return '?';
  if (!second) {
    return first.slice(0, 2).toUpperCase();
  }
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
}

function ProviderLogoBase({ name, logoUrl, size = 40 }: ProviderLogoProps) {
  const [loading, setLoading] = useState(Boolean(logoUrl));
  const [failed, setFailed] = useState(false);

  const showImage = Boolean(logoUrl && logoUrl.trim().length > 0 && !failed);
  const initials = getInitials(name);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size / 2),
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={`Logo de ${name || 'proveedor'}`}
    >
      {showImage ? (
        <>
          <Image
            source={{ uri: logoUrl! }}
            style={{ width: size, height: size, borderRadius: Math.round(size / 2) }}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
          />
          {loading ? (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
        </>
      ) : (
        <Text style={[styles.initials, size < 36 && styles.initialsSmall]}>{initials}</Text>
      )}
    </View>
  );
}

export const ProviderLogo = memo(ProviderLogoBase);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  initials: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  initialsSmall: {
    fontSize: 11,
  },
});

