import type {
  AssetSymbol,
  ComparatorOp,
  ConditionRule,
  LiveSignalPlan,
  StrategySpec,
} from '../types/quant';
import { operandDisplayLabel } from '../engine/indicators';
import { TIMEFRAME_PROFILES } from '../engine/timeframeConfig';

export function formatCurrency(value: number, currency: 'JPY' | 'USD' = 'JPY'): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (currency === 'JPY') {
    return `${sign}¥${Math.round(abs).toLocaleString('ja-JP')}`;
  }
  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPrice(value: number, symbol: string): string {
  if (symbol === 'USDJPY') return value.toFixed(3);
  if (symbol === 'NVDA') return `$${value.toFixed(2)}`;
  if (symbol === 'N225') return `¥${Math.round(value).toLocaleString('ja-JP')}`;
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPct(value: number, showPlus = true): string {
  const sign = showPlus && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDateTime(unixSec: number, includeTime = false): string {
  const d = new Date(unixSec * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  if (!includeTime) return `${y}/${m}/${day}`;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export const OPERATOR_LABELS: Record<ComparatorOp, { short: string; ja: string }> = {
  CROSS_ABOVE: { short: '↗ 上抜け', ja: 'を上抜け（ゴールデンクロス）' },
  CROSS_BELOW: { short: '↘ 下抜け', ja: 'を下抜け（デッドクロス）' },
  GREATER_THAN: { short: '> より大きい', ja: 'より大きい' },
  LESS_THAN: { short: '< より小さい', ja: 'より小さい' },
};

export function ruleToNaturalJapanese(rule: ConditionRule): string {
  const l = operandDisplayLabel(rule.left);
  const r = operandDisplayLabel(rule.right);
  switch (rule.operator) {
    case 'CROSS_ABOVE':
      return `${l} が ${r} を上抜け`;
    case 'CROSS_BELOW':
      return `${l} が ${r} を下抜け`;
    case 'GREATER_THAN':
      return `${l} > ${r}`;
    case 'LESS_THAN':
      return `${l} < ${r}`;
  }
}

export function strategyToNaturalSummary(strategy: StrategySpec): {
  entryText: string;
  exitText: string;
} {
  const activeEntries = strategy.entryRules.filter((r) => r.enabled);
  const activeExits = strategy.exitRules.filter((r) => r.enabled);
  const entryConnector = strategy.entryLogic === 'AND' ? ' かつ ' : ' または ';
  const exitConnector = strategy.exitLogic === 'AND' ? ' かつ ' : ' または ';

  const entryText =
    activeEntries.length > 0
      ? `「${activeEntries.map(ruleToNaturalJapanese).join(entryConnector)}」のときに買いエントリー`
      : '買い条件が設定されていません';

  const riskParts: string[] = [];
  if (strategy.execution.stopLossPct > 0) riskParts.push(`損切り -${strategy.execution.stopLossPct}%`);
  if (strategy.execution.takeProfitPct > 0) riskParts.push(`利確 +${strategy.execution.takeProfitPct}%`);
  if (strategy.execution.trailingStopPct > 0)
    riskParts.push(`トレーリング -${strategy.execution.trailingStopPct}%`);

  const exitCore =
    activeExits.length > 0
      ? `「${activeExits.map(ruleToNaturalJapanese).join(exitConnector)}」`
      : '';

  const exitText = [exitCore, riskParts.length > 0 ? `(${riskParts.join(' / ')})` : '']
    .filter(Boolean)
    .join(' ');

  return {
    entryText,
    exitText: exitText ? `${exitText} で決済` : '決済条件なし（最終足で決済）',
  };
}

export function getAssetShortName(symbol: AssetSymbol, customName?: string): string {
  switch (symbol) {
    case 'BTCUSDT':
      return 'BTC';
    case 'ETHUSDT':
      return 'ETH';
    case 'USDJPY':
      return 'ドル円';
    case 'NVDA':
      return 'NVDA';
    case 'N225':
      return '日経225';
    case 'CUSTOM':
      return customName || 'CSV';
  }
}

export function buildUnifiedStrategyHeading(
  strategy: StrategySpec,
  customName?: string
): string {
  const asset = getAssetShortName(strategy.symbol, customName);
  const tfLabel = TIMEFRAME_PROFILES[strategy.timeframe].label;
  return `${asset}・${tfLabel}｜${strategy.name}`;
}

export function buildWaitingOneLiner(
  strategy: StrategySpec,
  liveSignal: LiveSignalPlan
): string {
  const total = liveSignal.entryChecks.length;
  if (total === 0) return '買い条件が設定されていません';

  const passedCount = liveSignal.entryChecks.filter((c) => c.passed).length;
  const unmet = liveSignal.entryChecks.filter((c) => !c.passed);

  const unmetHints = unmet.slice(0, 2).map((c) => {
    const rule = strategy.entryRules.find((r) => r.id === c.ruleId);
    if (!rule) return c.label;
    const leftName = operandDisplayLabel(rule.left).replace(/\s*\(.*?\)/g, '');
    if (rule.operator === 'CROSS_ABOVE') return `${leftName}の上抜け`;
    if (rule.operator === 'CROSS_BELOW') return `${leftName}の下抜け`;
    return c.summary;
  });

  if (unmetHints.length === 0) {
    return `買い条件は${total}つ中${passedCount}つ成立（シグナル確定待ち）`;
  }

  return `買い条件は${total}つ中${passedCount}つ成立。${unmetHints.join('・')}待ち`;
}
