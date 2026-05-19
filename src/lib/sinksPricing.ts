import { Decimal } from "@prisma/client/runtime/library";

type SinkPricingInput = {
  listedPrice: number | Decimal;
  factor?: number | Decimal;
  taxFactor?: number | Decimal;
  freight?: number | Decimal;
  discount?: number | Decimal;
};

function toDecimal(value: number | Decimal | undefined, fallback: number) {
  if (value === undefined || value === null) {
    return new Decimal(fallback);
  }
  return new Decimal(value);
}

export function calculateSinkFinalPrice(input: SinkPricingInput): Decimal {
  const listedPrice = toDecimal(input.listedPrice, 0);
  const factor = toDecimal(input.factor, 1);
  const taxFactor = toDecimal(input.taxFactor, 1);
  const freight = toDecimal(input.freight, 0);
  const discount = toDecimal(input.discount, 0);

  const discountMultiplier = Decimal.max(
    new Decimal(0),
    new Decimal(1).sub(discount),
  );
  const discounted = listedPrice.mul(discountMultiplier);
  const factored = discounted.mul(factor);
  const taxed = factored.mul(taxFactor);

  return taxed.add(freight);
}
