import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency } from '@/core/utils/format';
import { validateSearchQuery } from '@/core/validation/validators';
import { colors, radii, spacing, typography } from '@/shared/theme';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListItem,
  Loader,
  ProviderLogo,
  Screen,
} from '@/shared/ui';

import type { PaymentKind, Product } from '../domain/entities';
import { selectedProductStore, useProducts } from './hooks';

const PAGE_STEP = 20;

export function PaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; productId?: string; serviceId?: string }>();

  const [kind, setKind] = useState<PaymentKind>('RECARGA');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);

  const productsQuery = useProducts(true);

  useEffect(() => {
    if (params.tab === 'SERVICIO' || params.tab === 'RECARGA') {
      setKind(params.tab);
      setVisibleCount(PAGE_STEP);
    }
  }, [params.tab]);

  useEffect(() => {
    if (!params.productId || !productsQuery.data) return;
    const match = productsQuery.data.find(
      (p) =>
        String(p.idProducto) === String(params.productId) &&
        (!params.serviceId || String(p.idServicio) === String(params.serviceId)),
    );
    if (match) {
      selectedProductStore.set(match);
      router.push({
        pathname: '/payment/checkout',
        params: {
          tab: match.kind === 'RECARGA' ? 'RECARGA' : 'SERVICIO',
          productId: String(match.idProducto),
          serviceId: String(match.idServicio),
        },
      });
    }
  }, [params.productId, params.serviceId, productsQuery.data, router]);

  const searchError = validateSearchQuery(search, 60);

  const filteredProducts = useMemo(() => {
    const list = (productsQuery.data ?? []).filter((p) => p.kind === kind);
    if (searchError) return list;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.serviceName.toLowerCase().includes(q),
    );
  }, [productsQuery.data, kind, search, searchError]);

  const handleSelectProduct = (product: Product) => {
    selectedProductStore.set(product);
    router.push({
      pathname: '/payment/checkout',
      params: {
        tab: product.kind === 'RECARGA' ? 'RECARGA' : 'SERVICIO',
        productId: String(product.idProducto),
        serviceId: String(product.idServicio),
      },
    });
  };

  return (
    <Screen refreshing={productsQuery.isRefetching} onRefresh={() => void productsQuery.refetch()}>
      <Text style={styles.title}>Pagos y recargas</Text>
      <Text style={styles.subtitle}>
        Elige la compañía o servicio y te llevaremos directo al formulario de pago.
      </Text>

      <View style={styles.tabs}>
        {(['RECARGA', 'SERVICIO'] as const).map((k) => {
          const active = kind === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => {
                setKind(k);
                setVisibleCount(PAGE_STEP);
              }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {k === 'RECARGA' ? 'Recargas móviles' : 'Pago de servicios'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.card}>
        <Input
          label="Buscar compañía o producto"
          placeholder="Ej. Telcel, CFE, Izzi, Totalplay..."
          maxLength={60}
          value={search}
          onChangeText={(val) => {
            setSearch(val);
            setVisibleCount(PAGE_STEP);
          }}
          error={searchError}
        />

        {productsQuery.isLoading ? (
          <Loader message="Consultando catálogo GestoPago..." />
        ) : productsQuery.isError ? (
          <ErrorState
            message={toAppError(productsQuery.error).message}
            onRetry={() => void productsQuery.refetch()}
          />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            description="No encontramos servicios que coincidan con tu búsqueda."
          />
        ) : (
          <View style={styles.productList}>
            {filteredProducts.slice(0, visibleCount).map((p) => (
              <ListItem
                key={`${p.idServicio}-${p.idProducto}`}
                title={`${p.serviceName} · ${p.name}`}
                subtitle={`${p.category ?? (p.kind === 'RECARGA' ? 'Recargas' : 'Servicios')}${
                  p.description ? ` · ${p.description}` : ''
                } · ID ${p.idServicio}/${p.idProducto}`}
                trailing={p.price ? formatCurrency(p.price) : undefined}
                leading={<ProviderLogo name={p.serviceName} logoUrl={p.logoUrl} size={40} />}
                showChevron
                onPress={() => handleSelectProduct(p)}
              />
            ))}
            {filteredProducts.length > visibleCount ? (
              <Button
                title={`Mostrar más (${filteredProducts.length - visibleCount} restantes)`}
                variant="outline"
                onPress={() => setVisibleCount((prev) => prev + PAGE_STEP)}
              />
            ) : null}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  tabTextActive: { color: colors.textOnPrimary },
  card: { gap: spacing.md, marginBottom: spacing.lg },
  productList: { gap: spacing.xs },
});
