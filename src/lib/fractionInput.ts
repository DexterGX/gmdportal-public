// Parses architectural dimension text like `80 1/4`, `80-1/4`, `1/4`, or plain
// decimals like `80.25` into a number (inches). Used anywhere a user needs to
// enter a countertop/slab measurement that may include a fraction.

export function parseFraction(input: string | number | null | undefined): number {
  if (input == null) return 0;
  const trimmed = String(input).trim();
  if (!trimmed) return 0;

  // "80-1/4" -> "80 1/4"
  const normalized = trimmed.replace(/^(\d+(?:\.\d+)?)\s*-\s*(\d+\s*\/\s*\d+)$/, "$1 $2");

  // Mixed number: "80 1/4"
  const mixedMatch = normalized.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const numerator = parseFloat(mixedMatch[2]);
    const denominator = parseFloat(mixedMatch[3]);
    return denominator !== 0 ? whole + numerator / denominator : whole;
  }

  // Plain fraction: "1/4"
  const fracMatch = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const numerator = parseFloat(fracMatch[1]);
    const denominator = parseFloat(fracMatch[2]);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  const plain = parseFloat(normalized);
  return Number.isFinite(plain) ? plain : 0;
}

// Loosely validates while typing - allows partial entry like "80 1/" so the
// user isn't fighting the input, but rejects clearly invalid characters.
export function isLikelyDimensionInput(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return true;
  return /^[0-9./\-\s]*$/.test(trimmed);
}
