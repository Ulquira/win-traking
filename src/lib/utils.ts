import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Mapeo visual descriptivo para tipos de servicio / operación sin alterar 
 * los valores internos de base de datos ni contratos de API backend.
 * INSTALACION    -> INSTA - LIMA
 * PROVINCIA      -> INSTA - PROV
 * AVERIAS        -> AVER - LIMA
 * AVERIAS PRV    -> AVER - PROV
 */
export function formatTipoServicioLabel(val: string | null | undefined): string {
  if (!val) return '-';
  const trimmed = String(val).trim();
  const upper = trimmed.toUpperCase();

  if (upper === 'INSTALACION') return 'INSTA - LIMA';
  if (upper === 'PROVINCIA') return 'INSTA - PROV';
  if (upper === 'AVERIAS') return 'AVER - LIMA';
  if (upper === 'AVERIAS PRV' || upper === 'AVERIAS PROVINCIA' || upper === 'AVERIAS - PROVINCIA') return 'AVER - PROV';

  return trimmed;
}
