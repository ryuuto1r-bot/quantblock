import type {
  AssetScanRow,
  AssetSymbol,
  PortfolioAnalysisResult,
  StrategySpec,
} from '../types/quant';
import { AVAILABLE_ASSETS, getMarketDataset } from './marketData';
import { runBacktest } from './backtester';
import { TIMEFRAME_PROFILES } from './timeframeConfig';

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom > 1e-12 ? cov / denom : 0;
}

export function runMultiAssetPortfolioAnalysis(
  strategy: StrategySpec,
  selectedSymbols: Exclude<AssetSymbol, 'CUSTOM'>[]
): PortfolioAnalysisResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const activeSymbols: Exclude<AssetSymbol, 'CUSTOM'>[] =
    selectedSymbols.length > 0 ? selectedSymbols : ['BTCUSDT', 'ETHUSDT', 'USDJPY', 'NVDA'];

  const rows: AssetScanRow[] = [];
  const curveBySymbol = new Map<
    Exclude<AssetSymbol, 'CUSTOM'>,
    { time: number; equity: number }[]
  >();
  const returnsBySymbol = new Map<Exclude<AssetSymbol, 'CUSTOM'>, number[]>();

  for (const asset of AVAILABLE_ASSETS) {
    const sym = asset.symbol as Exclude<AssetSymbol, 'CUSTOM'>;
    const ds = getMarketDataset(sym, strategy.timeframe);
    const cloned: StrategySpec = {
      ...strategy,
      symbol: sym,
    };
    const res = runBacktest(cloned, ds.bars);

    rows.push({
      symbol: sym,
      name: asset.name,
      category: asset.category,
      totalReturnPct: res.metrics.totalReturnPct,
      winRatePct: res.metrics.winRatePct,
      sharpeRatio: res.metrics.sharpeRatio,
      profitFactor: res.metrics.profitFactor,
      maxDrawdownPct: res.metrics.maxDrawdownPct,
      totalTrades: res.metrics.totalTrades,
      liveStatus: res.liveSignal.status,
      latestPrice: res.liveSignal.latestPrice,
    });

    curveBySymbol.set(
      sym,
      res.equityCurve.map((p) => ({ time: p.time, equity: p.equity }))
    );

    const rets: number[] = [];
    for (let i = 1; i < res.equityCurve.length; i++) {
      const prev = res.equityCurve[i - 1].equity;
      const curr = res.equityCurve[i].equity;
      rets.push(prev > 0 ? (curr - prev) / prev : 0);
    }
    returnsBySymbol.set(sym, rets);
  }

  // 均等ウェイト合成ポートフォリオの資産曲線とドローダウン算出
  const curves = activeSymbols
    .map((s) => curveBySymbol.get(s))
    .filter((c): c is { time: number; equity: number }[] => Boolean(c && c.length > 0));

  const minLen = curves.length > 0 ? Math.min(...curves.map((c) => c.length)) : 0;
  const portfolioEquity: { time: number; equity: number; drawdownPct: number }[] = [];

  let peak = 0;
  let maxDdPct = 0;

  for (let i = 0; i < minLen; i++) {
    let avgEq = 0;
    for (const c of curves) {
      avgEq += c[i].equity;
    }
    avgEq /= curves.length;

    if (avgEq > peak) peak = avgEq;
    const ddPct = peak > 0 ? ((avgEq - peak) / peak) * 100 : 0;
    if (Math.abs(ddPct) > maxDdPct) maxDdPct = Math.abs(ddPct);

    portfolioEquity.push({
      time: curves[0][i].time,
      equity: avgEq,
      drawdownPct: ddPct,
    });
  }

  const initCap = strategy.execution.initialCapital;
  const finalEq = portfolioEquity[portfolioEquity.length - 1]?.equity ?? initCap;
  const portfolioReturnPct = initCap > 0 ? ((finalEq - initCap) / initCap) * 100 : 0;

  // ポートフォリオ全体のシャープレシオ
  const pRets: number[] = [];
  for (let i = 1; i < portfolioEquity.length; i++) {
    const prev = portfolioEquity[i - 1].equity;
    const curr = portfolioEquity[i].equity;
    if (prev > 0) pRets.push((curr - prev) / prev);
  }
  const annualPeriods = TIMEFRAME_PROFILES[strategy.timeframe].annualBars;
  const mean = pRets.length > 0 ? pRets.reduce((a, b) => a + b, 0) / pRets.length : 0;
  const variance =
    pRets.length > 1
      ? pRets.reduce((s, r) => s + (r - mean) ** 2, 0) / (pRets.length - 1)
      : 0;
  const portfolioSharpe = variance > 1e-18 ? (mean / Math.sqrt(variance)) * Math.sqrt(annualPeriods) : 0;

  const selectedRows = rows.filter((r) => activeSymbols.includes(r.symbol));
  const avgSingleMaxDdPct =
    selectedRows.length > 0
      ? selectedRows.reduce((s, r) => s + r.maxDrawdownPct, 0) / selectedRows.length
      : 0;
  const ddReductionPct = Math.max(0, avgSingleMaxDdPct - maxDdPct);

  // 相関係数マトリクス（選択銘柄間）
  const matrix: number[][] = activeSymbols.map((symA) =>
    activeSymbols.map((symB) => {
      if (symA === symB) return 1;
      const rA = returnsBySymbol.get(symA) ?? [];
      const rB = returnsBySymbol.get(symB) ?? [];
      return pearsonCorrelation(rA, rB);
    })
  );

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    rows,
    selectedSymbols: activeSymbols,
    portfolioEquity,
    portfolioReturnPct,
    portfolioSharpe,
    portfolioMaxDdPct: maxDdPct,
    avgSingleMaxDdPct,
    ddReductionPct,
    correlations: {
      symbols: activeSymbols,
      matrix,
    },
    executionTimeMs: Math.max(1, t1 - t0),
  };
}
