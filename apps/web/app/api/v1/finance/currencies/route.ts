import { NextResponse } from 'next/server';
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_METADATA,
  IRR_PER_TOMAN,
} from '@v-gold/core';

export async function GET() {
  const currencies = SUPPORTED_CURRENCIES.map((code) => {
    const meta = CURRENCY_METADATA[code];
    return {
      code: meta.code,
      name: meta.name,
      symbol: meta.symbol,
      category: meta.category,
      standardMinorUnits: meta.standardMinorUnits,
      isAccountingCurrency: meta.isAccountingCurrency,
    };
  });

  return NextResponse.json({
    currencies,
    semantics: {
      canonicalRatio: {
        tomanToIrr: IRR_PER_TOMAN.toString(),
        description: '1 Toman is deterministically equal to 10 Iranian Rials (exact Decimal ratio)',
      },
    },
  });
}
