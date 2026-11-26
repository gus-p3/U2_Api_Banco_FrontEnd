import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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
  Loader,
  ProviderLogo,
  Screen,
} from '@/shared/ui';

import type { Product } from '../domain/entities';
import { isPaymentsSupported, selectedProductStore, useProducts } from './hooks';

const PAGE_SIZE = 20;

export function CatalogScreen() {
  const router = useRouter();
  const productsQuery = useProducts();
  const paymentsAllowed = isPaymentsSupported();

  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const searchError = validateSearchQuery(search, 60);
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return ['Todas', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const byCat =
      selectedCategory === 'Todas'
        ? products
        : products.filter((p) => (p.category ?? 'Otros servicios') === selectedCategory);
    if (searchError) return byCat;
    const q = search.trim().toLowerCase();
    if (!q) return byCat;
    return byCat.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.serviceName.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q) ||
        String(p.idServicio).includes(q) ||
        String(p.idProducto).includes(q),
    );
  }, [products, selectedCategory, search, searchError]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, safePage]);

  const handleSelectProduct = (product: Product) => {
    if (!paymentsAllowed) return;
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
      <Text style={styles.title}>Catálogo de servicios y recargas</Text>
      <Text style={styles.subtitle}>
        Consulta todos los proveedores y productos sincronizados desde GestoPago.
      </Text>

      {!paymentsAllowed ? (
        <View style={styles.webNotice}>
          <Ionicons name="finger-print" size={18} color={colors.primary} />
          <Text style={styles.webNoticeText}>
            Modo consulta en Web: para pagar o recargar abre la app móvil y autoriza con tu huella
            digital.
          </Text>
        </View>
      ) : null}

      <Card style={styles.filterCard}>
        <Input
          label="Buscar por servicio, producto, descripción o ID"
          placeholder="Ej. Telcel, CFE, agua, 133, 582..."
          maxLength={60}
          value={search}
          onChangeText={(val) => {
            setSearch(val);
            setPage(1);
          }}
          error={searchError}
        />

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
                  setPage(1);
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {productsQuery.isLoading ? (
        <Loader message="Consultando catálogo oficial de GestoPago..." />
      ) : productsQuery.isError ? (
        <ErrorState
          message={toAppError(productsQuery.error).message}
          onRetry={() => void productsQuery.refetch()}
        />
      ) : products.length === 0 ? (
        <EmptyState
          title="Catálogo vacío"
          description="El servidor no devolvió productos en este momento."
          actionLabel="Reintentar"
          onAction={() => void productsQuery.refetch()}
        />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="Sin coincidencias"
          description="No encontramos productos con los filtros seleccionados."
        />
      ) : (
        <View style={styles.listContainer}>
          <Text style={styles.counterText}>
            Mostrando {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filteredProducts.length)} de {filteredProducts.length}{' '}
            productos
          </Text>

          {paginatedProducts.map((p) => (
            <Card key={`${p.idServicio}-${p.idProducto}-${p.id}`} style={styles.productCard}>
              <View style={styles.headerRow}>
                <ProviderLogo name={p.serviceName} logoUrl={p.logoUrl} size={44} />
                <View style={styles.headerTexts}>
                  <View style={styles.titleRow}>
                    <Text style={styles.serviceName}>{p.serviceName}</Text>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>
                        {p.category ?? 'Otros servicios'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.productName}>{p.name}</Text>
                </View>
                <Text style={styles.priceText}>
                  {p.price ? formatCurrency(p.price) : 'Monto abierto'}
                </Text>
              </View>

              <Text style={styles.descriptionText}>
                {p.description
                  ? p.description
                  : p.referenceType
                    ? `Referencia requerida: ${p.referenceType}`
                    : 'Sin descripción adicional reportada por el proveedor.'}
              </Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  ID Servicio: {p.idServicio} · ID Producto: {p.idProducto}
                </Text>
                {p.referenceType ? (
                  <Text style={styles.metaText}>Ref: {p.referenceType}</Text>
                ) : null}
              </View>

              {paymentsAllowed ? (
                <Button
                  title={p.kind === 'RECARGA' ? 'Recargar este producto' : 'Pagar este servicio'}
                  variant="secondary"
                  onPress={() => handleSelectProduct(p)}
                />
              ) : (
                <View style={styles.mobileOnlyTag}>
                  <Ionicons name="phone-portrait-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.mobileOnlyTagText}>
                    Pago exclusivo en app móvil con huella digital
                  </Text>
                </View>
              )}
            </Card>
          ))}

          {totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <Button
                title="Anterior"
                variant="secondary"
                disabled={safePage <= 1}
                onPress={() => setPage((curr) => Math.max(1, curr - 1))}
              />
              <Text style={styles.pageIndicator}>
                Página {safePage} de {totalPages}
              </Text>
              <Button
                title="Siguiente"
                variant="secondary"
                disabled={safePage >= totalPages}
                onPress={() => setPage((curr) => Math.min(totalPages, curr + 1))}
              />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  webNoticeText: { ...typography.caption, color: colors.primary, fontWeight: '600', flex: 1 },
  filterCard: { gap: spacing.md },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.textOnPrimary, fontWeight: '700' },
  listContainer: { gap: spacing.md },
  counterText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  productCard: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTexts: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  serviceName: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  categoryBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  productName: { ...typography.subheading, color: colors.text, fontWeight: '700' },
  priceText: { ...typography.subheading, color: colors.primary, fontWeight: '800' },
  descriptionText: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaText: { ...typography.caption, fontSize: 12, color: colors.textMuted },
  mobileOnlyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mobileOnlyTagText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pageIndicator: { ...typography.caption, color: colors.text, fontWeight: '700' },
});
