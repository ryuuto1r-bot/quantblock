import { PRESET_STRATEGIES } from '../../data/presets';
import { getMarketDataset } from '../marketData';
import { runBacktest } from '../backtester';
import { runMonteCarlo, runOutOfSampleSplit, runParameterGridOptimization } from '../analytics';
import { runMultiAssetPortfolioAnalysis } from '../portfolio';
import { generatePineScript, generatePythonScript } from '../codeGenerator';

for (const strat of PRESET_STRATEGIES) {
  const ds = getMarketDataset(strat.symbol, strat.timeframe);
  const res = runBacktest(strat, ds.bars);
  const mc = runMonteCarlo(res.trades, strat.execution.initialCapital, 500);
  const opt = runParameterGridOptimization(strat, ds.bars);

  console.log(`\n=== ${strat.name} (${strat.symbol} ${strat.timeframe}) ===`);
  console.log(
    `Bars: ${ds.bars.length} | Trades: ${res.metrics.totalTrades} | WinRate: ${res.metrics.winRatePct.toFixed(1)}% | Return: ${res.metrics.totalReturnPct.toFixed(1)}% (B&H: ${res.metrics.buyHoldReturnPct.toFixed(1)}%)`
  );
  console.log(
    `Sharpe: ${res.metrics.sharpeRatio.toFixed(2)} | PF: ${res.metrics.profitFactor.toFixed(2)} | MaxDD: -${res.metrics.maxDrawdownPct.toFixed(1)}% | Exec: ${res.metrics.executionTimeMs.toFixed(1)}ms`
  );
  console.log(
    `MC ProfitProb: ${mc.profitProbabilityPct.toFixed(1)}% | RuinProb: ${mc.ruinProbabilityPct.toFixed(1)}% | Opt Best Sharpe: ${opt.bestCell?.sharpeRatio.toFixed(2) ?? 'N/A'} (${opt.executionTimeMs.toFixed(1)}ms)`
  );

  if (res.metrics.totalTrades === 0) {
    throw new Error(`Strategy ${strat.id} generated 0 trades!`);
  }
}

// ショート両建てモードの検証
const shortStrat = structuredClone(PRESET_STRATEGIES[0]);
shortStrat.execution.allowShort = true;
const shortRes = runBacktest(shortStrat, getMarketDataset('BTCUSDT', '1D').bars);
const shortCount = shortRes.trades.filter((t) => t.side === 'SHORT').length;
console.log(
  `\n=== LONG & SHORT Mode (BTCUSDT 1D) ===\nTotal Trades: ${shortRes.trades.length} (SHORT: ${shortCount}) | Return: ${shortRes.metrics.totalReturnPct.toFixed(1)}% | Sharpe: ${shortRes.metrics.sharpeRatio.toFixed(2)}`
);
if (shortCount === 0) {
  throw new Error('allowShort=true generated 0 SHORT trades!');
}

// マルチ銘柄ポートフォリオ分散分析の検証
const port = runMultiAssetPortfolioAnalysis(PRESET_STRATEGIES[0], [
  'BTCUSDT',
  'ETHUSDT',
  'USDJPY',
  'NVDA',
  'N225',
]);
console.log(
  `\n=== Multi-Asset Portfolio (5 Assets) ===\nPortfolio Return: ${port.portfolioReturnPct.toFixed(1)}% | Sharpe: ${port.portfolioSharpe.toFixed(2)} | MaxDD: -${port.portfolioMaxDdPct.toFixed(1)}% (Avg Single DD: -${port.avgSingleMaxDdPct.toFixed(1)}%, Reduction: -${port.ddReductionPct.toFixed(1)}pt) | Exec: ${port.executionTimeMs.toFixed(1)}ms`
);

// Out-of-Sample 分離検証 & VWAP/ADX 戦略チェック
const vwapStrat = PRESET_STRATEGIES.find((s) => s.id === 'preset-vwap-adx-15m')!;
const oos = runOutOfSampleSplit(vwapStrat, getMarketDataset('BTCUSDT', '15m').bars, 70);
console.log(
  `\n=== OOS Split Check (VWAP+ADX 15m) ===\nGrade: ${oos.robustnessGrade} | InSample: ${oos.inSample.totalReturnPct.toFixed(1)}% (${oos.inSample.totalTrades}t) | OutOfSample: ${oos.outOfSample.totalReturnPct.toFixed(1)}% (${oos.outOfSample.totalTrades}t) | Retention: ${oos.sharpeRetentionPct.toFixed(0)}%`
);

const pine = generatePineScript(PRESET_STRATEGIES[0]);
const py = generatePythonScript(PRESET_STRATEGIES[0]);
if (!pine.includes('//@version=5') || !py.includes('def build_signals')) {
  throw new Error('Code generator failed!');
}
console.log('\nALL ENGINE VERIFICATION CHECKS PASSED!');
