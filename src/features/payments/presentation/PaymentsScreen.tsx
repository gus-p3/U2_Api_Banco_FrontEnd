import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { toAppError } from '@/core/errors/toAppError';
import { formatCurrency } from '@/core/utils/format';
import { validateSearchQuery } from '@/core/validation/validators';
import { colors, radii, spacing, typography } from '@/shared/theme';
import {
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
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);

  const productsQuery = useProducts(true);

  useEffect(() => {
    if (params.tab === 'SERVICIO' || params.tab === 'RECARGA') {
      setKind(params.tab);
      setSelectedCategory('Todas');
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

  const productsByKind = useMemo(
    () => (productsQuery.data ?? []).filter((p) => p.kind === kind),
    [productsQuery.data, kind],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of productsByKind) {
      if (p.category) set.add(p.category);
    }
    return ['Todas', ...Array.from(set)];
  }, [productsByKind]);

  const filteredProducts = useMemo(() => {
    const byCat =
      selectedCategory === 'Todas'
        ? productsByKind
        : productsByKind.filter((p) => (p.category ?? 'Otros servicios') === selectedCategory);
    if (searchError) return byCat;
    const q = search.trim().toLowerCase();
    if (!q) return byCat;
    return byCat.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.serviceName.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        String(p.idServicio).includes(q) ||
        String(p.idProducto).includes(q),
    );
  }, [productsByKind, selectedCategory, search, searchError]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );

  const hasMore = visibleCount < filteredProducts.length;

  const handleLoadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount((prev) => Math.min(prev + PAGE_STEP, filteredProducts.length));
    }
  }, [hasMore, filteredProducts.length]);

  const handleSelectProduct = useCallback(
    (product: Product) => {
      selectedProductStore.set(product);
      router.push({
        pathname: '/payment/checkout',
        params: {
          tab: product.kind === 'RECARGA' ? 'RECARGA' : 'SERVICIO',
          productId: String(product.idProducto),
          serviceId: String(product.idServicio),
        },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item: p }: { item: Product }) => (
      <View style={styles.itemWrap}>
        <ListItem
          title={`${p.serviceName} · ${p.name}`}
          subtitle={`${p.category ?? (p.kind === 'RECARGA' ? 'Recargas' : 'Servicios')}${
            p.description ? ` · ${p.description}` : ''
          } · ID ${p.idServicio}/${p.idProducto}`}
          trailing={p.price ? formatCurrency(p.price) : undefined}
          leading={<ProviderLogo name={p.serviceName} logoUrl={p.logoUrl} size={40} />}
          showChevron
          onPress={() => handleSelectProduct(p)}
        />
      </View>
    ),
    [handleSelectProduct],
  );

  const headerElement = (
    <View style={styles.headerContainer}>
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
                setSelectedCategory('Todas');
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

      <Card style={styles.searchCard}>
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
        {categories.length > 2 ? (
          <View style={styles.categoryChips}>
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setVisibleCount(PAGE_STEP);
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {!productsQuery.isLoading && !productsQuery.isError && filteredProducts.length > 0 ? (
          <Text style={styles.counterText}>
            Mostrando {visibleProducts.length} de {filteredProducts.length} opciones
          </Text>
        ) : null}
      </Card>
    </View>
  );

  return (
    <Screen scroll={false}>
      <FlatList
        data={productsQuery.isLoading || productsQuery.isError ? [] : visibleProducts}
        keyExtractor={(p) => `${p.idServicio}-${p.idProducto}-${p.id}`}
        renderItem={renderItem}
        ListHeaderComponent={headerElement}
        ListEmptyComponent={
          productsQuery.isLoading ? (
            <Loader message="Consultando catálogo GestoPago..." />
          ) : productsQuery.isError ? (
            <ErrorState
              message={toAppError(productsQuery.error).message}
              onRetry={() => void productsQuery.refetch()}
            />
          ) : (
            <EmptyState
              title="Sin resultados"
              description="No encontramos servicios que coincidan con tu búsqueda."
            />
          )
        }
        ListFooterComponent={
          hasMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.footerText}>Cargando más servicios al bajar...</Text>
            </View>
          ) : undefined
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        initialNumToRender={PAGE_STEP}
        maxToRenderPerBatch={PAGE_STEP}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={productsQuery.isRefetching}
            onRefresh={() => {
              setVisibleCount(PAGE_STEP);
              void productsQuery.refetch();
            }}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xl },
  headerContainer: { marginBottom: spacing.sm },
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
  searchCard: { gap: spacing.sm },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.textOnPrimary, fontWeight: '700' },
  counterText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  itemWrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  footerText: { ...typography.caption, color: colors.textMuted },
});
