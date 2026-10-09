// Price lock for saved Cabinet Estimates.
//
// Every saved estimate stores its own line prices, so updating the price list
// never changes an estimate that already exists. While an estimate is younger
// than PRICE_LOCK_DAYS, editing it keeps those prices. Once it is older (or
// when it is remeasured) the form refreshes the prices from the current price
// list. `pricedAt` is the moment the prices were last taken from the price
// list - it carries over when a young estimate is revised, so revising does
// not restart the clock.

export const PRICE_LOCK_DAYS = 15;

export function isPriceLockExpired(
  pricedAt: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!pricedAt) return false;
  const t = new Date(pricedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t >= PRICE_LOCK_DAYS * 24 * 60 * 60 * 1000;
}
