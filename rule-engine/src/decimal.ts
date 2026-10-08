interface Decimal {
  readonly coefficient: bigint;
  readonly scale: number;
}

function decimal(value: number): Decimal {
  const [mantissa, exponentText = '0'] = value.toString().toLowerCase().split('e');
  const exponent = Number(exponentText);
  const negative = mantissa!.startsWith('-');
  const unsigned = negative ? mantissa!.slice(1) : mantissa!;
  const [whole, fraction = ''] = unsigned.split('.');
  let coefficient = BigInt(`${negative ? '-' : ''}${whole}${fraction}`);
  let scale = fraction.length - exponent;
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { coefficient, scale };
}

function atScale(value: Decimal, scale: number): bigint {
  return value.coefficient * 10n ** BigInt(scale - value.scale);
}

export function compareSumToCapacity(values: readonly number[], capacity: number): -1 | 0 | 1 {
  const decimals = values.map(decimal);
  const limit = decimal(capacity);
  const scale = Math.max(limit.scale, ...decimals.map((value) => value.scale));
  const total = decimals.reduce((sum, value) => sum + atScale(value, scale), 0n);
  const maximum = atScale(limit, scale);
  return total < maximum ? -1 : total > maximum ? 1 : 0;
}

export function isMarginBelowTwentyPercent(values: readonly number[], capacity: number): boolean {
  const decimals = values.map(decimal);
  const limit = decimal(capacity);
  const scale = Math.max(limit.scale, ...decimals.map((value) => value.scale));
  const total = decimals.reduce((sum, value) => sum + atScale(value, scale), 0n);
  return total * 5n > atScale(limit, scale) * 4n;
}
