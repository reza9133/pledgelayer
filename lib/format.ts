import { BPS_DENOMINATOR, NATIVE_SYMBOL, TOKEN_DECIMALS } from './contract';

/** Coerce a value that may arrive as bigint | number | string into a bigint. */
export function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value.length > 0) return BigInt(value);
  return 0n;
}

/** Coerce a value that may arrive as bigint | number | string into a number. */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && value.length > 0) return Number(value);
  return 0;
}

/** Format a base-unit bigint amount (18 decimals) as a trimmed decimal string. */
export function formatTokenAmount(amount: bigint, maxFractionDigits = 4): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const base = 10n ** BigInt(TOKEN_DECIMALS);
  const whole = abs / base;
  const frac = abs % base;

  let fracStr = frac.toString().padStart(TOKEN_DECIMALS, '0').slice(0, maxFractionDigits);
  fracStr = fracStr.replace(/0+$/, '');

  const wholeStr = whole.toLocaleString('en-US');
  const sign = negative ? '-' : '';
  return fracStr.length > 0 ? `${sign}${wholeStr}.${fracStr}` : `${sign}${wholeStr}`;
}

export function formatTokenWithSymbol(amount: bigint, maxFractionDigits = 4): string {
  return `${formatTokenAmount(amount, maxFractionDigits)} ${NATIVE_SYMBOL}`;
}

/** Parse a whole-number token string (e.g. "10") into the u32 the contract expects. */
export function parseWholeTokenAmount(input: string): number {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error('Enter a whole number of tokens (decimals are not supported here).');
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Enter a positive whole number.');
  }
  return value;
}

/** Parse a possibly-decimal token string (e.g. "12.5") into base units (bigint, 18 decimals). */
export function parseTokenAmountToBaseUnits(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Enter a valid amount, e.g. 12.5');
  }
  const [wholePart, fracPart = ''] = trimmed.split('.');
  const paddedFrac = (fracPart + '0'.repeat(TOKEN_DECIMALS)).slice(0, TOKEN_DECIMALS);
  const base = BigInt(wholePart || '0') * 10n ** BigInt(TOKEN_DECIMALS) + BigInt(paddedFrac || '0');
  if (base <= 0n) throw new Error('Amount must be greater than zero.');
  return base;
}

export function bpsToPercentLabel(bps: number): string {
  return `${(bps / (BPS_DENOMINATOR / 100)).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}%`;
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function fundingProgressPct(totalFunded: bigint, fundingGoal: bigint): number {
  if (fundingGoal <= 0n) return 0;
  const pct = Number((totalFunded * 10000n) / fundingGoal) / 100;
  return Math.max(0, Math.min(100, pct));
}
