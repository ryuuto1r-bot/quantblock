import type {
  MonteCarloResult,
  OHLCVBar,
  OptimizationCell,
  OptimizationResult,
  OutOfSampleSplitResult,
  StrategySpec,
  TradeRecord,
} from '../types/quant';
import { runBacktest } from './backtester';
import { getAssetVolatilityMultiplier, TIMEFRAME_PROFILES } from './timeframeConfig';

/**
 * モンテカルロ・ブートストラップシミュレーション
 * 実際のトレードリターン分布から復元抽出して N パスの将来資産曲線を生成し、
 * 信頼区間 (5% / 25% / 50% / 75% / 95%) と破産確率（DD30%超確率）を算出する。
 */
export function runMonteCarlo(
  trades: TradeRecord[],
  initialCapital: number,
  simulations = 1000,
  horizonTrades?: number
): MonteCarloResult {
  const steps = Math.max(10, Math.min(120, horizonTrades ?? Math.max(trades.length, 40)));

  if (trades.length < 3) {
    const flat = new Array(steps + 1).fill(initialCapital);
    return {
      simulations,
      steps,
      percentile5: flat,
      percentile25: flat,
      median: flat,
      percentile75: flat,
      percentile95: flat,
      samplePaths: [flat],
      ruinProbabilityPct: 0,
      profitProbabilityPct: 0,
      medianFinalEquity: initialCapital,
      p5FinalEquity: initialCapital,
      p95FinalEquity: initialCapital,
    };
  }

  const returns = trades.map((t) => t.returnPct / 100);

  // 決定論的シード乱数（再現性確保）
  let seed = 133742 + trades.length * 997;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // stepごとに全シミュレーションの資産を保存
  const stepValues: number[][] = Array.from({ length: steps + 1 }, () => new Array(simulations));
  const samplePaths: number[][] = [];
  let ruinCount = 0;
  let profitCount = 0;

  for (let s = 0; s < simulations; s++) {
    let eq = initialCapital;
    let peak = initialCapital;
    let ruined = false;
    stepValues[0][s] = eq;

    const recordSample = s < 18;
    const path: number[] = recordSample ? [eq] : [];

    for (let step = 1; step <= steps; step++) {
      const r = returns[Math.floor(rand() * returns.length)];
      eq = Math.max(initialCapital * 0.05, eq * (1 + r));
      if (eq > peak) peak = eq;
      if ((peak - eq) / peak >= 0.3) ruined = true;
      stepValues[step][s] = eq;
      if (recordSample) path.push(eq);
    }

    if (ruined) ruinCount++;
    if (eq > initialCapital) profitCount++;
    if (recordSample) samplePaths.push(path);
  }

  const quantile = (sorted: number[], q: number) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
    return sorted[idx];
  };

  const percentile5: number[] = [];
  const percentile25: number[] = [];
  const median: number[] = [];
  const percentile75: number[] = [];
  const percentile95: number[] = [];

  for (let step = 0; step <= steps; step++) {
    const sorted = stepValues[step].slice().sort((a, b) => a - b);
    percentile5.push(quantile(sorted, 0.05));
    percentile25.push(quantile(sorted, 0.25));
    median.push(quantile(sorted, 0.5));
    percentile75.push(quantile(sorted, 0.75));
    percentile95.push(quantile(sorted, 0.95));
  }

  return {
    simulations,
    steps,
    percentile5,
    percentile25,
    median,
    percentile75,
    percentile95,
    samplePaths,
    ruinProbabilityPct: (ruinCount / simulations) * 100,
    profitProbabilityPct: (profitCount / simulations) * 100,
    medianFinalEquity: median[steps],
    p5FinalEquity: percentile5[steps],
    p95FinalEquity: percentile95[steps],
  };
}

/**
 * 2次元グリッドサーチ・パラメータ最適化
 * 選択中戦略の「損切り幅 (SL%) × 利確幅 (TP%)」または「主ルール期間 × 副パラメータ」を一括検証する。
 */
export function runParameterGridOptimization(
  strategy: StrategySpec,
  bars: OHLCVBar[],
  mode: 'risk_reward' | 'indicator_period' = 'indicator_period'
): OptimizationResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const cells: OptimizationCell[] = [];

  const tfProfile = TIMEFRAME_PROFILES[strategy.timeframe];
  const assetMult = getAssetVolatilityMultiplier(strategy.symbol);
  const scaleRisk = (arr: number[]) =>
    arr.map((v) => Math.max(0.1, Number((v * assetMult).toFixed(2))));

  let paramALabel = `損切り SL (% · ${strategy.timeframe})`;
  let paramBLabel = `利確 TP (% · ${strategy.timeframe})`;
  let paramAValues: number[] = scaleRisk(tfProfile.optSlGrid);
  let paramBValues: number[] = scaleRisk(tfProfile.optTpGrid);

  const firstRule = strategy.entryRules.find((r) => r.enabled);
  const canOptimizeIndicator =
    mode === 'indicator_period' &&
    firstRule &&
    (firstRule.left.period !== undefined || firstRule.right.period !== undefined);

  if (canOptimizeIndicator && firstRule) {
    const baseLeft = firstRule.left.period ?? 14;
    const baseRight = firstRule.right.period ?? firstRule.right.value ?? 50;

    if (firstRule.left.period !== undefined && firstRule.right.period !== undefined) {
      paramALabel = `${firstRule.left.kind} 短期期間`;
      paramBLabel = `${firstRule.right.kind} 長期期間`;
      paramAValues = [5, 10, 15, 20, 30];
      paramBValues = [25, 40, 50, 75, 100];
    } else if (firstRule.left.period !== undefined && firstRule.right.kind === 'CONST') {
      paramALabel = `${firstRule.left.kind} 期間`;
      paramBLabel = `閾値 (${firstRule.operator === 'LESS_THAN' ? '<' : '>'})`;
      paramAValues = [7, 10, 14, 21, 28];
      const step = baseRight >= 50 ? 5 : 5;
      paramBValues = [
        Math.max(5, Math.round(baseRight - step * 2)),
        Math.max(10, Math.round(baseRight - step)),
        Math.round(baseRight),
        Math.round(baseRight + step),
        Math.round(baseRight + step * 2),
      ];
    } else {
      paramALabel = `${firstRule.left.kind} 期間`;
      paramBLabel = '損切り SL (%)';
      paramAValues = [Math.max(5, baseLeft - 8), Math.max(8, baseLeft - 4), baseLeft, baseLeft + 6, baseLeft + 12];
      paramBValues = [2, 4, 6, 8, 12];
    }
  }

  let bestCell: OptimizationCell | null = null;

  for (const a of paramAValues) {
    for (const b of paramBValues) {
      if (canOptimizeIndicator && firstRule?.left.period !== undefined && firstRule?.right.period !== undefined && a >= b) {
        cells.push({
          paramA: a,
          paramB: b,
          totalReturnPct: 0,
          sharpeRatio: 0,
          winRatePct: 0,
          maxDrawdownPct: 0,
          totalTrades: 0,
        });
        continue;
      }

      const cloned: StrategySpec = structuredClone(strategy);

      if (canOptimizeIndicator && firstRule) {
        const target = cloned.entryRules.find((r) => r.id === firstRule.id);
        if (target) {
          if (target.left.period !== undefined && target.right.period !== undefined) {
            target.left.period = a;
            target.right.period = b;
          } else if (target.left.period !== undefined && target.right.kind === 'CONST') {
            target.left.period = a;
            target.right.value = b;
          } else if (target.left.period !== undefined) {
            target.left.period = a;
            cloned.execution.stopLossPct = b;
          }
        }
      } else {
        cloned.execution.stopLossPct = a;
        cloned.execution.takeProfitPct = b;
      }

      const res = runBacktest(cloned, bars);
      const cell: OptimizationCell = {
        paramA: a,
        paramB: b,
        totalReturnPct: res.metrics.totalReturnPct,
        sharpeRatio: res.metrics.sharpeRatio,
        winRatePct: res.metrics.winRatePct,
        maxDrawdownPct: res.metrics.maxDrawdownPct,
        totalTrades: res.metrics.totalTrades,
      };
      cells.push(cell);

      if (
        cell.totalTrades >= 5 &&
        (!bestCell || cell.sharpeRatio > bestCell.sharpeRatio)
      ) {
        bestCell = cell;
      }
    }
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    paramALabel,
    paramBLabel,
    paramAValues,
    paramBValues,
    cells,
    bestCell,
    executionTimeMs: Math.max(1, t1 - t0),
  };
}

/**
 * 過学習チェック（In-Sample 70% vs Out-of-Sample 30% 分離検証）
 * 前半の学習期間で機能した戦略が、後半の未知相場でも再現性を維持できるかを定量評価する。
 */
export function runOutOfSampleSplit(
  strategy: StrategySpec,
  bars: OHLCVBar[],
  splitRatioPct = 70
): OutOfSampleSplitResult {
  const splitIdx = Math.max(
    40,
    Math.min(bars.length - 40, Math.floor((bars.length * splitRatioPct) / 100))
  );
  const inBars = bars.slice(0, splitIdx);
  const outBars = bars.slice(splitIdx);

  const inRes = runBacktest(strategy, inBars);
  const outRes = runBacktest(strategy, outBars);

  const inM = inRes.metrics;
  const outM = outRes.metrics;

  const sharpeRetentionPct =
    inM.sharpeRatio > 0.1
      ? Math.max(-100, Math.min(200, (outM.sharpeRatio / inM.sharpeRatio) * 100))
      : outM.sharpeRatio > 0
      ? 100
      : 0;

  let robustnessGrade: 'A' | 'B' | 'C' | 'D' = 'C';
  let verdictTitle = '中程度の再現性（さらなるフィルター調整を推奨）';
  let verdictSummary =
    '未知期間でも一定のパフォーマンスを維持していますが、相場レジーム変化への耐性を高めるためADXやVWAPフィルターの追加を検討してください。';

  if (outM.totalTrades < 3) {
    robustnessGrade = 'D';
    verdictTitle = '未知期間の取引回数が不足（統計的有意性なし）';
    verdictSummary =
      '後半30%の未知期間で3回未満しか取引が発生していません。条件を少し緩めるか、より長いデータ期間で検証してください。';
  } else if (outM.totalReturnPct > 0 && outM.profitFactor >= 1.3 && sharpeRetentionPct >= 65) {
    robustnessGrade = 'A';
    verdictTitle = '高い頑健性（未知相場でも優位性を維持）';
    verdictSummary =
      '学習期間だけでなく後半30%の未知相場でもプラス期待値と高いプロフィットファクターを再現できており、過学習リスクは低い状態です。';
  } else if (outM.totalReturnPct > 0 && outM.profitFactor >= 1.05) {
    robustnessGrade = 'B';
    verdictTitle = '良好な再現性（実戦候補）';
    verdictSummary =
      '未知期間でもプラス収益を維持しています。SL/TP幅やトレンドフィルターを微調整することでさらに安定性を高められます。';
  } else if (inM.totalReturnPct > 0 && outM.totalReturnPct <= 0) {
    robustnessGrade = 'D';
    verdictTitle = '過学習（オーバーフィッティング）の警告';
    verdictSummary =
      '前半の過去データでは勝てているものの、後半の未知相場ではマイナスに転落しています。パラメータが過去相場に過剰適合している可能性が高いです。';
  } else {
    robustnessGrade = 'C';
    verdictTitle = '優位性不足（ロジックの見直しが必要）';
    verdictSummary =
      '前後半ともに期待値が伸び悩んでいます。ADX > 20 のトレンド強度フィルターや、VWAP順張りフィルターを組み合わせてダマシを減らしてみてください。';
  }

  return {
    splitRatioPct,
    inSampleBars: inBars.length,
    outOfSampleBars: outBars.length,
    inSampleRange: [inBars[0]?.time ?? 0, inBars[inBars.length - 1]?.time ?? 0],
    outOfSampleRange: [outBars[0]?.time ?? 0, outBars[outBars.length - 1]?.time ?? 0],
    inSample: inM,
    outOfSample: outM,
    robustnessGrade,
    verdictTitle,
    verdictSummary,
    sharpeRetentionPct,
  };
}
