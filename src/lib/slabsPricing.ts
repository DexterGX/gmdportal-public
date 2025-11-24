/**
 * Slab Pricing Helper
 *
 * Provides utilities for computing final slab prices based on provider prices
 * and brand configuration (profit factor, tax, delivery fees, discounts).
 */

import type { Slab, SlabBrandConfig } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Computes the final sale price for a slab based on provider price and brand config.
 *
 * Formula:
 *   1. base = providerPrice * profitFactor
 *   2. withTax = base * (1 + taxRate)
 *   3. withDelivery = withTax + deliveryFee
 *   4. final = withDelivery * (1 - discount)
 *
 * @param providerPrice - The raw price from the provider
 * @param brand - Brand configuration containing pricing factors
 * @returns The computed final price as a Decimal
 */
export function computeFinalPrice(
  providerPrice: Decimal | number,
  brand: Pick<
    SlabBrandConfig,
    "profitFactor" | "taxRate" | "deliveryFee" | "discount"
  >
): Decimal {
  const price = new Decimal(providerPrice);

  const profitFactor = brand.profitFactor ?? new Decimal(1);
  const taxRate = brand.taxRate ?? new Decimal(0);
  const deliveryFee = brand.deliveryFee ?? new Decimal(0);
  const discount = brand.discount ?? new Decimal(0);

  const base = price.mul(profitFactor);
  const withTax = base.mul(Decimal.add(1, taxRate));
  const withDelivery = withTax.add(deliveryFee);
  const final = withDelivery.mul(Decimal.sub(1, discount));

  return final;
}

/**
 * Formats slab dimensions for UI display.
 *
 * @param heightMm - Height in millimeters
 * @param widthMm - Width in millimeters
 * @returns Formatted string like "3000x1400mm"
 */
export function formatDimensions(heightMm: number, widthMm: number): string {
  return `${heightMm}x${widthMm}mm`;
}

/**
 * Formats slab dimensions with thickness for detailed display.
 *
 * @param heightMm - Height in millimeters
 * @param widthMm - Width in millimeters
 * @param thicknessMm - Thickness in millimeters
 * @returns Formatted string like "3000x1400x20mm"
 */
export function formatDimensionsWithThickness(
  heightMm: number,
  widthMm: number,
  thicknessMm: number
): string {
  return `${heightMm}x${widthMm}x${thicknessMm}mm`;
}

/**
 * Computes price breakdown for transparency/admin views.
 *
 * @param providerPrice - The raw price from the provider
 * @param brand - Brand configuration containing pricing factors
 * @returns Object with detailed price breakdown at each step
 */
export function computePriceBreakdown(
  providerPrice: Decimal | number,
  brand: Pick<
    SlabBrandConfig,
    "profitFactor" | "taxRate" | "deliveryFee" | "discount"
  >
) {
  const price = new Decimal(providerPrice);

  const profitFactor = brand.profitFactor ?? new Decimal(1);
  const taxRate = brand.taxRate ?? new Decimal(0);
  const deliveryFee = brand.deliveryFee ?? new Decimal(0);
  const discount = brand.discount ?? new Decimal(0);

  const base = price.mul(profitFactor);
  const withTax = base.mul(Decimal.add(1, taxRate));
  const withDelivery = withTax.add(deliveryFee);
  const final = withDelivery.mul(Decimal.sub(1, discount));

  return {
    providerPrice: price,
    basePrice: base,
    priceWithTax: withTax,
    priceWithDelivery: withDelivery,
    finalPrice: final,
    breakdown: {
      profitFactor: profitFactor.toNumber(),
      taxRate: taxRate.toNumber(),
      deliveryFee: deliveryFee.toNumber(),
      discount: discount.toNumber(),
    },
  };
}
