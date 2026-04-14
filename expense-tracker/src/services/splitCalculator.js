import { SPLIT_TYPES } from '../constants/splitTypes';

/**
 * Calculate my share of a transaction amount.
 * Amount should always be positive (direction handled separately).
 *
 * @param {number} amount - always positive
 * @param {{ type: string, divisor?: number, customAmount?: number }} split
 * @returns {number}
 */
export function calcMyShare(amount, split) {
  if (!split || split.type === SPLIT_TYPES.FULL) return amount;
  if (split.type === SPLIT_TYPES.DIVIDE_N) {
    const n = split.divisor || 2;
    return Math.round((amount / n) * 100) / 100;
  }
  if (split.type === SPLIT_TYPES.CUSTOM_AMOUNT) {
    const custom = split.customAmount || 0;
    return Math.min(custom, amount);
  }
  return amount;
}

/**
 * Returns split savings: original amount - my share
 */
export function calcSplitSavings(amount, myShare) {
  return Math.max(0, Math.round((amount - myShare) * 100) / 100);
}
