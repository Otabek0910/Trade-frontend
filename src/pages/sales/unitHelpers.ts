// src/pages/sales/unitHelpers.ts

export function unitDisplay(unit: string, unit_value: number | null, qty: number): string {
  if (!unit || unit === 'шт') return `${qty} шт`
  if (unit_value && unit_value !== 1) {
    return `${qty} шт (${+(qty * unit_value).toFixed(2)} ${unit})`
  }
  return `${qty} ${unit}`
}

export function unitSubtitle(unit: string, unit_value: number | null, brand: string | null): string {
  const parts: string[] = []
  if (brand) parts.push(brand)
  if (unit && unit !== 'шт' && unit_value && unit_value !== 1) {
    parts.push(`${unit_value} ${unit}/шт`)
  } else if (unit && unit !== 'шт') {
    parts.push(unit)
  }
  return parts.join(' · ')
}