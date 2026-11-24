import type { AssetSymbol, Timeframe } from '../types/quant';

export interface TimeframeRiskProfile {
  timeframe: Timeframe;
  label: string;
  styleTag: string;
  stopLossPct: number;
  takeProfitPct: number;
  trailingStopPct: number;
  recommendedLeverage: number;
  stepPct: number;
  maxSlPct: number;
  maxTpPct: number;
  annualBars: number;
  stepSeconds: number;
  simBarsCount: number;
  optSlGrid: number[];
  optTpGrid: number[];
}

export const TIMEFRAME_ORDER: Timeframe[] = ['15m', '30m', '1H', '4H', '1D'];

export const TIMEFRAME_PROFILES: Record<Timeframe, TimeframeRiskProfile> = {
  '15m': {
    timeframe: '15m',
    label: '15分足',
    styleTag: 'デイトレ主力',
    stopLossPct: 0.8,
    takeProfitPct: 1.8,
    trailingStopPct: 0.9,
    recommendedLeverage: 3,
    stepPct: 0.1,
    maxSlPct: 5,
    maxTpPct: 12,
    annualBars: 365 * 24 * 4,
    stepSeconds: 900,
    simBarsCount: 2400, // 約25日分の15分足
    optSlGrid: [0.3, 0.5, 0.8, 1.2, 1.8],
    optTpGrid: [0.6, 1.2, 1.8, 2.6, 3.8],
  },
  '30m': {
    timeframe: '30m',
    label: '30分足',
    styleTag: 'デイトレ標準',
    stopLossPct: 1.2,
    takeProfitPct: 2.8,
    trailingStopPct: 1.4,
    recommendedLeverage: 3,
    stepPct: 0.1,
    maxSlPct: 8,
    maxTpPct: 18,
    annualBars: 365 * 24 * 2,
    stepSeconds: 1800,
    simBarsCount: 2200, // 約45日分の30分足
    optSlGrid: [0.5, 0.8, 1.2, 1.8, 2.5],
    optTpGrid: [1.0, 1.8, 2.8, 4.0, 6.0],
  },
  '1H': {
    timeframe: '1H',
    label: '1時間足',
    styleTag: 'デイ〜短期',
    stopLossPct: 1.8,
    takeProfitPct: 4.5,
    trailingStopPct: 2.0,
    recommendedLeverage: 2,
    stepPct: 0.2,
    maxSlPct: 12,
    maxTpPct: 25,
    annualBars: 365 * 24,
    stepSeconds: 3600,
    simBarsCount: 2000,
    optSlGrid: [0.8, 1.2, 1.8, 2.8, 4.0],
    optTpGrid: [1.6, 3.0, 4.5, 6.5, 9.0],
  },
  '4H': {
    timeframe: '4H',
    label: '4時間足',
    styleTag: 'スイング',
    stopLossPct: 3.5,
    takeProfitPct: 10.0,
    trailingStopPct: 4.0,
    recommendedLeverage: 1.5,
    stepPct: 0.5,
    maxSlPct: 20,
    maxTpPct: 50,
    annualBars: 365 * 6,
    stepSeconds: 14400,
    simBarsCount: 1800,
    optSlGrid: [1.5, 2.5, 3.5, 5.0, 7.5],
    optTpGrid: [4.0, 7.0, 10.0, 15.0, 22.0],
  },
  '1D': {
    timeframe: '1D',
    label: '日足',
    styleTag: '中長期',
    stopLossPct: 7.0,
    takeProfitPct: 24.0,
    trailingStopPct: 9.0,
    recommendedLeverage: 1,
    stepPct: 0.5,
    maxSlPct: 40,
    maxTpPct: 150,
    annualBars: 365,
    stepSeconds: 86400,
    simBarsCount: 1800,
    optSlGrid: [2, 4, 6, 8, 12],
    optTpGrid: [6, 12, 18, 24, 36],
  },
};

/**
 * 銘柄ボラティリティ特性に応じた係数（FXは仮想通貨より値幅が小さいため自動調整）
 */
export function getAssetVolatilityMultiplier(symbol: AssetSymbol): number {
  switch (symbol) {
    case 'USDJPY':
      return 0.32;
    case 'N225':
      return 0.55;
    case 'NVDA':
      return 0.85;
    case 'ETHUSDT':
      return 1.15;
    case 'BTCUSDT':
    default:
      return 1.0;
  }
}

export function getRecommendedRiskForTimeframe(
  timeframe: Timeframe,
  symbol: AssetSymbol
): {
  stopLossPct: number;
  takeProfitPct: number;
  trailingStopPct: number;
  leverage: number;
} {
  const base = TIMEFRAME_PROFILES[timeframe];
  const mult = getAssetVolatilityMultiplier(symbol);
  const round2 = (v: number) => Math.max(0.1, Number((v * mult).toFixed(2)));

  return {
    stopLossPct: round2(base.stopLossPct),
    takeProfitPct: round2(base.takeProfitPct),
    trailingStopPct: round2(base.trailingStopPct),
    leverage: symbol === 'USDJPY' ? Math.min(10, Math.round(base.recommendedLeverage * 2)) : base.recommendedLeverage,
  };
}
