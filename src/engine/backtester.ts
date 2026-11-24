import type {
  BacktestMetrics,
  BacktestResult,
  ConditionRule,
  EquityPoint,
  ExitReason,
  IndicatorOperand,
  IndicatorOverlaySeries,
  LiveSignalPlan,
  LiveSignalStatus,
  LogicGate,
  MonthlyReturnCell,
  OHLCVBar,
  RuleCheckStatus,
  StrategySpec,
  Timeframe,
  TradeRecord,
} from '../types/quant';
import {
  calcATR,
  computeOperandSeries,
  operandDisplayLabel,
  operandKey,
  type Series,
} from './indicators';
import { ruleToNaturalJapanese } from '../utils/format';
import { TIMEFRAME_PROFILES } from './timeframeConfig';

const OVERLAY_PALETTE = [
  '#38BDF8', // sky-400
  '#F59E0B', // amber-500
  '#A855F7', // purple-500
  '#EC4899', // pink-500
  '#2DD4BF', // teal-400
  '#FB923C', // orange-400
];

function evaluateRuleAt(
  rule: ConditionRule,
  left: Series,
  right: Series,
  i: number
): boolean {
  const lNow = left[i];
  const rNow = right[i];
  if (lNow === null || rNow === null) return false;

  switch (rule.operator) {
    case 'GREATER_THAN':
      return lNow > rNow;
    case 'LESS_THAN':
      return lNow < rNow;
    case 'CROSS_ABOVE': {
      if (i < 1) return false;
      const lPrev = left[i - 1];
      const rPrev = right[i - 1];
      if (lPrev === null || rPrev === null) return false;
      return lPrev <= rPrev && lNow > rNow;
    }
    case 'CROSS_BELOW': {
      if (i < 1) return false;
      const lPrev = left[i - 1];
      const rPrev = right[i - 1];
      if (lPrev === null || rPrev === null) return false;
      return lPrev >= rPrev && lNow < rNow;
    }
  }
}

function evaluateRuleGroup(
  rules: { rule: ConditionRule; left: Series; right: Series }[],
  gate: LogicGate,
  i: number
): boolean {
  if (rules.length === 0) return false;
  if (gate === 'AND') {
    for (const r of rules) {
      if (!evaluateRuleAt(r.rule, r.left, r.right, i)) return false;
    }
    return true;
  } else {
    for (const r of rules) {
      if (evaluateRuleAt(r.rule, r.left, r.right, i)) return true;
    }
    return false;
  }
}

function getAnnualPeriods(timeframe: Timeframe): number {
  return TIMEFRAME_PROFILES[timeframe].annualBars;
}

function classifyPane(op: IndicatorOperand): 'main' | 'oscillator' | null {
  switch (op.kind) {
    case 'SMA':
    case 'EMA':
    case 'VWAP':
    case 'BB_UPPER':
    case 'BB_MIDDLE':
    case 'BB_LOWER':
      return 'main';
    case 'RSI':
    case 'ADX':
    case 'MACD_LINE':
    case 'MACD_SIGNAL':
    case 'MACD_HIST':
    case 'STOCH_K':
    case 'ATR':
      return 'oscillator';
    default:
      return null;
  }
}

export function runBacktest(strategy: StrategySpec, bars: OHLCVBar[]): BacktestResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const seriesCache = new Map<string, Series>();

  const enabledEntryRules = strategy.entryRules
    .filter((r) => r.enabled)
    .map((rule) => ({
      rule,
      left: computeOperandSeries(bars, rule.left, seriesCache),
      right: computeOperandSeries(bars, rule.right, seriesCache),
    }));

  const enabledExitRules = strategy.exitRules
    .filter((r) => r.enabled)
    .map((rule) => ({
      rule,
      left: computeOperandSeries(bars, rule.left, seriesCache),
      right: computeOperandSeries(bars, rule.right, seriesCache),
    }));

  // オーバーレイ表示対象を収集
  const overlays: IndicatorOverlaySeries[] = [];
  const seenKeys = new Set<string>();
  const allOperands: IndicatorOperand[] = [];
  for (const r of [...strategy.entryRules, ...strategy.exitRules]) {
    if (!r.enabled) continue;
    allOperands.push(r.left, r.right);
  }

  let colorIdx = 0;
  for (const op of allOperands) {
    const pane = classifyPane(op);
    if (!pane) continue;
    const key = operandKey(op);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    overlays.push({
      id: key,
      label: operandDisplayLabel(op),
      color: OVERLAY_PALETTE[colorIdx % OVERLAY_PALETTE.length],
      pane,
      values: computeOperandSeries(bars, op, seriesCache),
    });
    colorIdx++;
  }

  const exec = strategy.execution;
  const initialCapital = Math.max(1000, exec.initialCapital);
  const posSizeRatio = Math.min(1, Math.max(0.05, exec.positionSizePct / 100));
  const leverage = Math.min(10, Math.max(1, exec.leverage));
  const feeRate = Math.max(0, exec.feeBps) / 10000;
  const slipRate = Math.max(0, exec.slippageBps) / 10000;
  const slRatio = exec.stopLossPct > 0 ? exec.stopLossPct / 100 : 0;
  const tpRatio = exec.takeProfitPct > 0 ? exec.takeProfitPct / 100 : 0;
  const tsRatio = exec.trailingStopPct > 0 ? exec.trailingStopPct / 100 : 0;
  const useNextOpen = (exec.executionTiming ?? 'next_open') === 'next_open';

  let cash = initialCapital;
  let totalFees = 0;
  let barsInMarket = 0;

  interface OpenPosition {
    side: 'LONG' | 'SHORT';
    entryIndex: number;
    entryTime: number;
    entryPrice: number;
    quantity: number;
    notional: number;
    entryFee: number;
    peakPrice: number;
    troughPrice: number;
  }

  let position: OpenPosition | null = null;
  let pendingEntry: 'LONG' | 'SHORT' | null = null;
  let pendingExit = false;
  const trades: TradeRecord[] = [];
  const equityCurve: EquityPoint[] = [];

  // 最新バー時点のライブシグナル判定用スナップショット
  let livePositionSnapshot: OpenPosition | null = null;
  let lastBarEnteredLong = false;
  let lastBarEnteredShort = false;
  let lastBarExitedBySignal = false;

  const openPositionAt = (
    barIndex: number,
    bar: OHLCVBar,
    side: 'LONG' | 'SHORT',
    rawPrice: number
  ): OpenPosition | null => {
    const entryPrice =
      side === 'LONG' ? rawPrice * (1 + slipRate) : rawPrice * (1 - slipRate);
    const margin = cash * posSizeRatio;
    const notional = margin * leverage;
    const entryFee = notional * feeRate;

    if (margin > entryFee && entryPrice > 0) {
      const quantity = notional / entryPrice;
      cash -= margin + entryFee;
      totalFees += entryFee;

      return {
        side,
        entryIndex: barIndex,
        entryTime: bar.time,
        entryPrice,
        quantity,
        notional,
        entryFee,
        peakPrice: Math.max(entryPrice, bar.high),
        troughPrice: Math.min(entryPrice, bar.low),
      };
    }
    return null;
  };

  const firstClose = bars[0]?.close ?? 1;
  let peakEquity = initialCapital;
  let maxDrawdownPct = 0;
  let currentDdBars = 0;
  let maxDdBars = 0;

  const closePosition = (
    barIndex: number,
    bar: OHLCVBar,
    rawExitPrice: number,
    reason: ExitReason
  ) => {
    if (!position) return;

    const exitPrice =
      position.side === 'LONG'
        ? rawExitPrice * (1 - slipRate)
        : rawExitPrice * (1 + slipRate);

    const exitNotional = exitPrice * position.quantity;
    const exitFee = exitNotional * feeRate;
    const grossPnl =
      position.side === 'LONG'
        ? (exitPrice - position.entryPrice) * position.quantity
        : (position.entryPrice - exitPrice) * position.quantity;

    const tradeFees = position.entryFee + exitFee;
    const netPnl = grossPnl - tradeFees;
    totalFees += exitFee;

    // 証拠金＋実現損益を現金口座へ戻す
    const marginUsed = position.notional / leverage;
    cash = Math.max(0, cash + marginUsed + grossPnl - exitFee);

    const returnPct = marginUsed > 0 ? (netPnl / marginUsed) * 100 : 0;

    trades.push({
      id: trades.length + 1,
      side: position.side,
      entryTime: position.entryTime,
      exitTime: bar.time,
      entryIndex: position.entryIndex,
      exitIndex: barIndex,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      notional: position.notional,
      grossPnl,
      fees: tradeFees,
      netPnl,
      returnPct,
      holdingBars: barIndex - position.entryIndex,
      exitReason: reason,
      equityAfter: cash,
    });

    position = null;
  };

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];

    // 0. 次足始値約定モード：前バー終値で確定したシグナルを今バーの始値(open)で厳密約定
    if (useNextOpen) {
      if (pendingExit && position) {
        closePosition(i, bar, bar.open, 'SIGNAL');
        pendingExit = false;
      }
      if (pendingEntry && !position && cash > 10) {
        position = openPositionAt(i, bar, pendingEntry, bar.open);
        pendingEntry = null;
      } else {
        pendingEntry = null;
      }
    }

    // 1. 保有中ポジションのSL/TP/トレーリングストップおよびエグジットシグナル判定
    if (position) {
      barsInMarket++;
      let exited = false;

      if (position.side === 'LONG') {
        position.peakPrice = Math.max(position.peakPrice, bar.high);

        const slPrice = slRatio > 0 ? position.entryPrice * (1 - slRatio) : -Infinity;
        const tpPrice = tpRatio > 0 ? position.entryPrice * (1 + tpRatio) : Infinity;
        const tsPrice = tsRatio > 0 ? position.peakPrice * (1 - tsRatio) : -Infinity;

        if (slRatio > 0 && bar.low <= slPrice) {
          closePosition(i, bar, slPrice, 'STOP_LOSS');
          exited = true;
        } else if (tsRatio > 0 && bar.low <= tsPrice && position.peakPrice > position.entryPrice) {
          closePosition(i, bar, tsPrice, 'TRAILING_STOP');
          exited = true;
        } else if (tpRatio > 0 && bar.high >= tpPrice) {
          closePosition(i, bar, tpPrice, 'TAKE_PROFIT');
          exited = true;
        }

        if (!exited && evaluateRuleGroup(enabledExitRules, strategy.exitLogic, i)) {
          if (i === bars.length - 1) {
            lastBarExitedBySignal = true;
            closePosition(i, bar, bar.close, 'SIGNAL');
          } else if (useNextOpen) {
            pendingExit = true;
          } else {
            closePosition(i, bar, bar.close, 'SIGNAL');
          }
          exited = true;
        }
      } else {
        // SHORT ポジションの判定（上昇で損切り、下落で利確）
        position.troughPrice = Math.min(position.troughPrice, bar.low);

        const slPrice = slRatio > 0 ? position.entryPrice * (1 + slRatio) : Infinity;
        const tpPrice = tpRatio > 0 ? position.entryPrice * (1 - tpRatio) : -Infinity;
        const tsPrice = tsRatio > 0 ? position.troughPrice * (1 + tsRatio) : Infinity;

        if (slRatio > 0 && bar.high >= slPrice) {
          closePosition(i, bar, slPrice, 'STOP_LOSS');
          exited = true;
        } else if (tsRatio > 0 && bar.high >= tsPrice && position.troughPrice < position.entryPrice) {
          closePosition(i, bar, tsPrice, 'TRAILING_STOP');
          exited = true;
        } else if (tpRatio > 0 && bar.low <= tpPrice) {
          closePosition(i, bar, tpPrice, 'TAKE_PROFIT');
          exited = true;
        }

        if (!exited && evaluateRuleGroup(enabledEntryRules, strategy.entryLogic, i)) {
          if (i === bars.length - 1) {
            lastBarExitedBySignal = true;
            closePosition(i, bar, bar.close, 'SIGNAL');
          } else if (useNextOpen) {
            pendingExit = true;
          } else {
            closePosition(i, bar, bar.close, 'SIGNAL');
          }
          exited = true;
        }
      }
    }

    // 2. ノーポジション時のエントリー判定（LONG / SHORT）
    if (!position && cash > 10) {
      const longSignal = evaluateRuleGroup(enabledEntryRules, strategy.entryLogic, i);
      const shortSignal =
        exec.allowShort && !longSignal
          ? evaluateRuleGroup(enabledExitRules, strategy.exitLogic, i)
          : false;

      if (longSignal) {
        if (i === bars.length - 1) {
          lastBarEnteredLong = true;
        } else if (useNextOpen) {
          pendingEntry = 'LONG';
        } else {
          position = openPositionAt(i, bar, 'LONG', bar.close);
        }
      } else if (shortSignal) {
        if (i === bars.length - 1) {
          lastBarEnteredShort = true;
        } else if (useNextOpen) {
          pendingEntry = 'SHORT';
        } else {
          position = openPositionAt(i, bar, 'SHORT', bar.close);
        }
      }
    }

    // 3. 最終バーでポジションが残っていればスナップショット取得後に時価決済
    if (i === bars.length - 1 && position) {
      livePositionSnapshot = { ...position };
      closePosition(i, bar, bar.close, 'END_OF_DATA');
    }

    // 4. 時価評価額とドローダウン計算
    let unrealized = 0;
    let lockedMargin = 0;
    if (position) {
      lockedMargin = position.notional / leverage;
      unrealized =
        position.side === 'LONG'
          ? (bar.close - position.entryPrice) * position.quantity
          : (position.entryPrice - bar.close) * position.quantity;
    }

    const equity = Math.max(0, cash + lockedMargin + unrealized);
    const buyHoldEquity = initialCapital * (bar.close / firstClose);

    if (equity >= peakEquity) {
      peakEquity = equity;
      currentDdBars = 0;
    } else {
      currentDdBars++;
      if (currentDdBars > maxDdBars) maxDdBars = currentDdBars;
    }

    const ddPct = peakEquity > 0 ? ((equity - peakEquity) / peakEquity) * 100 : 0;
    if (Math.abs(ddPct) > maxDrawdownPct) {
      maxDrawdownPct = Math.abs(ddPct);
    }

    equityCurve.push({
      time: bar.time,
      equity,
      buyHoldEquity,
      drawdownPct: ddPct,
    });
  }

  // パフォーマンス指標の算出
  const finalEquity = equityCurve[equityCurve.length - 1]?.equity ?? initialCapital;
  const netProfit = finalEquity - initialCapital;
  const totalReturnPct = (netProfit / initialCapital) * 100;

  const buyHoldFinal = equityCurve[equityCurve.length - 1]?.buyHoldEquity ?? initialCapital;
  const buyHoldReturnPct = ((buyHoldFinal - initialCapital) / initialCapital) * 100;
  const alphaPct = totalReturnPct - buyHoldReturnPct;

  const spanSeconds =
    bars.length > 1 ? Math.max(86400, bars[bars.length - 1].time - bars[0].time) : 86400;
  const years = spanSeconds / (365.25 * 86400);
  const cagrPct =
    years > 0 && finalEquity > 0
      ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100
      : 0;

  // バーごとのリターンからシャープレシオ＆ソルティノレシオ算出
  const barReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity;
    const curr = equityCurve[i].equity;
    if (prev > 0) barReturns.push((curr - prev) / prev);
  }

  const annualFactor = Math.sqrt(getAnnualPeriods(strategy.timeframe));
  const meanRet =
    barReturns.length > 0
      ? barReturns.reduce((a, b) => a + b, 0) / barReturns.length
      : 0;
  const variance =
    barReturns.length > 1
      ? barReturns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / (barReturns.length - 1)
      : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 1e-12 ? (meanRet / stdDev) * annualFactor : 0;

  const downsideSqSum = barReturns.reduce((s, r) => (r < 0 ? s + r * r : s), 0);
  const downsideDev =
    barReturns.length > 1 ? Math.sqrt(downsideSqSum / (barReturns.length - 1)) : 0;
  const sortinoRatio = downsideDev > 1e-12 ? (meanRet / downsideDev) * annualFactor : 0;

  const calmarRatio = maxDrawdownPct > 0.01 ? cagrPct / maxDrawdownPct : 0;

  // トレード統計
  const winners = trades.filter((t) => t.netPnl > 0);
  const losers = trades.filter((t) => t.netPnl <= 0);
  const winRatePct = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;

  const grossWins = winners.reduce((s, t) => s + t.netPnl, 0);
  const grossLosses = Math.abs(losers.reduce((s, t) => s + t.netPnl, 0));
  const profitFactor =
    grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? 9.99 : 0;

  const avgWinPct =
    winners.length > 0
      ? winners.reduce((s, t) => s + t.returnPct, 0) / winners.length
      : 0;
  const avgLossPct =
    losers.length > 0
      ? Math.abs(losers.reduce((s, t) => s + t.returnPct, 0) / losers.length)
      : 0;
  const payoffRatio = avgLossPct > 0 ? avgWinPct / avgLossPct : avgWinPct > 0 ? 9.99 : 0;

  const expectancyPct =
    trades.length > 0
      ? trades.reduce((s, t) => s + t.returnPct, 0) / trades.length
      : 0;

  const avgHoldingBars =
    trades.length > 0
      ? trades.reduce((s, t) => s + t.holdingBars, 0) / trades.length
      : 0;

  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let curW = 0;
  let curL = 0;
  for (const t of trades) {
    if (t.netPnl > 0) {
      curW++;
      curL = 0;
      if (curW > maxConsecutiveWins) maxConsecutiveWins = curW;
    } else {
      curL++;
      curW = 0;
      if (curL > maxConsecutiveLosses) maxConsecutiveLosses = curL;
    }
  }

  // 月次リターン算出
  const monthlyMap = new Map<string, { year: number; month: number; startEq: number; endEq: number }>();
  for (const pt of equityCurve) {
    const d = new Date(pt.time * 1000);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    const existing = monthlyMap.get(key);
    if (!existing) {
      monthlyMap.set(key, { year, month, startEq: pt.equity, endEq: pt.equity });
    } else {
      existing.endEq = pt.equity;
    }
  }

  const monthlyReturns: MonthlyReturnCell[] = Array.from(monthlyMap.values()).map((m) => ({
    year: m.year,
    month: m.month,
    returnPct: m.startEq > 0 ? ((m.endEq - m.startEq) / m.startEq) * 100 : 0,
  }));

  // 最新バー時点のライブシグナル & 具体的な注文価格プラン算出
  const lastIdx = Math.max(0, bars.length - 1);
  const lastBar = bars[lastIdx];
  const prevBar = bars[Math.max(0, lastIdx - 1)];
  const atrSeries = calcATR(bars, 14);
  const latestAtr = atrSeries[lastIdx] ?? null;

  const entryChecks: RuleCheckStatus[] = enabledEntryRules.map(({ rule, left, right }) => ({
    ruleId: rule.id,
    label: rule.label,
    summary: ruleToNaturalJapanese(rule),
    leftValue: left[lastIdx] ?? null,
    rightValue: right[lastIdx] ?? null,
    passed: evaluateRuleAt(rule, left, right, lastIdx),
  }));

  const exitChecks: RuleCheckStatus[] = enabledExitRules.map(({ rule, left, right }) => ({
    ruleId: rule.id,
    label: rule.label,
    summary: ruleToNaturalJapanese(rule),
    leftValue: left[lastIdx] ?? null,
    rightValue: right[lastIdx] ?? null,
    passed: evaluateRuleAt(rule, left, right, lastIdx),
  }));

  let liveStatus: LiveSignalStatus = 'WAIT';
  let liveSide: 'LONG' | 'SHORT' = 'LONG';
  if (lastBarEnteredLong) {
    liveStatus = 'BUY_NOW';
    liveSide = 'LONG';
  } else if (lastBarEnteredShort) {
    liveStatus = 'SHORT_NOW';
    liveSide = 'SHORT';
  } else if (lastBarExitedBySignal) {
    liveStatus = 'SELL_NOW';
    liveSide = 'LONG';
  } else if (livePositionSnapshot) {
    liveStatus = 'IN_POSITION';
    liveSide = livePositionSnapshot.side;
  }

  const refEntryPrice = livePositionSnapshot
    ? livePositionSnapshot.entryPrice
    : liveSide === 'SHORT'
    ? (lastBar?.close ?? 0) * (1 - slipRate)
    : (lastBar?.close ?? 0) * (1 + slipRate);

  const stopLossPrice =
    slRatio > 0
      ? liveSide === 'SHORT'
        ? refEntryPrice * (1 + slRatio)
        : refEntryPrice * (1 - slRatio)
      : null;
  const takeProfitPrice =
    tpRatio > 0
      ? liveSide === 'SHORT'
        ? refEntryPrice * (1 - tpRatio)
        : refEntryPrice * (1 + tpRatio)
      : null;

  const trailingStopPrice =
    tsRatio > 0
      ? liveSide === 'SHORT'
        ? (livePositionSnapshot
            ? Math.min(livePositionSnapshot.troughPrice, lastBar?.low ?? refEntryPrice)
            : refEntryPrice) *
          (1 + tsRatio)
        : (livePositionSnapshot
            ? Math.max(livePositionSnapshot.peakPrice, lastBar?.high ?? refEntryPrice)
            : refEntryPrice) *
          (1 - tsRatio)
      : null;

  const riskRewardRatio =
    stopLossPrice !== null && takeProfitPrice !== null
      ? Math.abs(takeProfitPrice - refEntryPrice) /
        Math.max(1e-9, Math.abs(refEntryPrice - stopLossPrice))
      : null;

  const allocatedCapital = initialCapital * posSizeRatio;
  const leveragedNotional = allocatedCapital * leverage;
  const estimatedUnits = refEntryPrice > 0 ? leveragedNotional / refEntryPrice : 0;
  const maxLossAmount = slRatio > 0 ? leveragedNotional * slRatio : null;

  const unrealizedPnlPct =
    livePositionSnapshot && livePositionSnapshot.entryPrice > 0
      ? (livePositionSnapshot.side === 'LONG'
          ? ((lastBar?.close ?? livePositionSnapshot.entryPrice) -
              livePositionSnapshot.entryPrice) /
            livePositionSnapshot.entryPrice
          : (livePositionSnapshot.entryPrice -
              (lastBar?.close ?? livePositionSnapshot.entryPrice)) /
            livePositionSnapshot.entryPrice) *
        100 *
        leverage
      : null;

  const liveSignal: LiveSignalPlan = {
    status: liveStatus,
    side: liveSide,
    latestTime: lastBar?.time ?? 0,
    latestPrice: lastBar?.close ?? 0,
    prevPrice: prevBar?.close ?? lastBar?.close ?? 0,
    changePct:
      prevBar && prevBar.close > 0
        ? (((lastBar?.close ?? prevBar.close) - prevBar.close) / prevBar.close) * 100
        : 0,
    atrValue: latestAtr,
    entryPrice: refEntryPrice,
    stopLossPrice,
    takeProfitPrice,
    trailingStopPrice,
    riskRewardRatio,
    activeEntryTime: livePositionSnapshot?.entryTime ?? null,
    activeHoldingBars: livePositionSnapshot ? lastIdx - livePositionSnapshot.entryIndex : 0,
    unrealizedPnlPct,
    allocatedCapital,
    leveragedNotional,
    estimatedUnits,
    maxLossAmount,
    entryChecks,
    exitChecks,
  };

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const metrics: BacktestMetrics = {
    totalReturnPct,
    cagrPct,
    buyHoldReturnPct,
    alphaPct,
    finalEquity,
    netProfit,
    totalFees,
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRatePct,
    profitFactor,
    payoffRatio,
    expectancyPct,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    maxDrawdownPct,
    maxDrawdownDurationBars: maxDdBars,
    avgHoldingBars,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    exposurePct: bars.length > 0 ? (barsInMarket / bars.length) * 100 : 0,
    executionTimeMs: Math.max(0.5, t1 - t0),
  };

  return {
    strategyId: strategy.id,
    symbol: strategy.symbol,
    timeframe: strategy.timeframe,
    bars,
    trades,
    equityCurve,
    monthlyReturns,
    metrics,
    overlays,
    liveSignal,
  };
}
