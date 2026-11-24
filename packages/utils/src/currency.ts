import type { Currency, DeliveryZone, Market, MoneyMinor } from '@ridefood/types';

const FALLBACK: Currency = {
  code: 'USD',
  symbol: '$',
  decimalPlaces: 2,
  name: 'US Dollar',
};

export function resolveCurrency(input?: {
  zone?: Pick<DeliveryZone, 'currency'> | null;
  market?: Pick<Market, 'currency'> | null;
  explicit?: Currency | null;
  fallbackCode?: string;
}): Currency {
  if (input?.explicit) return input.explicit;
  if (input?.zone?.currency) return input.zone.currency;
  if (input?.market?.currency) return input.market.currency;
  if (input?.fallbackCode) {
    return { ...FALLBACK, code: input.fallbackCode };
  }
  return FALLBACK;
}

export function minorToMajor(amountMinor: MoneyMinor, currency: Currency): number {
  const factor = 10 ** currency.decimalPlaces;
  return amountMinor / factor;
}

export function majorToMinor(amountMajor: number, currency: Currency): MoneyMinor {
  const factor = 10 ** currency.decimalPlaces;
  return Math.round(amountMajor * factor);
}

export interface FormatMoneyOptions {
  currency: Currency;
  locale?: string;
  /** When true, always show sign for positive values (+$12.00) */
  signed?: boolean;
  /** Compact display without currency code trailing for known symbols */
  compact?: boolean;
}

export function formatMoney(amountMinor: MoneyMinor, options: FormatMoneyOptions): string {
  const { currency, locale = 'en', signed = false, compact = true } = options;
  const major = minorToMajor(amountMinor, currency);

  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.code,
      currencyDisplay: compact ? 'symbol' : 'code',
      minimumFractionDigits: currency.decimalPlaces,
      maximumFractionDigits: currency.decimalPlaces,
    }).format(major);

    if (signed && amountMinor > 0) {
      return `+${formatted}`;
    }
    return formatted;
  } catch {
    const fixed = major.toFixed(currency.decimalPlaces);
    const prefix = signed && amountMinor > 0 ? '+' : '';
    return `${prefix}${currency.symbol}${fixed}`;
  }
}

/** Runtime formatter bound to a market/zone — no rebuild required when currency changes. */
export function createMoneyFormatter(ctx: {
  zone?: Pick<DeliveryZone, 'currency'> | null;
  market?: Pick<Market, 'currency'> | null;
  explicit?: Currency | null;
  locale?: string;
}) {
  const currency = resolveCurrency(ctx);
  return {
    currency,
    format: (amountMinor: MoneyMinor, opts?: Omit<FormatMoneyOptions, 'currency' | 'locale'>) =>
      formatMoney(amountMinor, { currency, locale: ctx.locale, ...opts }),
    toMajor: (amountMinor: MoneyMinor) => minorToMajor(amountMinor, currency),
    toMinor: (amountMajor: number) => majorToMinor(amountMajor, currency),
  };
}
