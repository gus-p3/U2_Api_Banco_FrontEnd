/** Utilidades de formato (es-MX). Sin dependencias de UI. */

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

export function formatCurrency(value: number | string | undefined | null): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return currencyFormatter.format(Number.isFinite(n as number) ? (n as number) : 0);
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Enmascara un número de cuenta: 9876543210 → •••• 3210. */
export function maskAccount(accountNumber: string | undefined): string {
  if (!accountNumber) return '';
  return `•••• ${accountNumber.slice(-4)}`;
}

export function initials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
