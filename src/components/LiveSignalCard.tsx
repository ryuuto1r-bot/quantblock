import React, { useState } from 'react';
import {
  Radio,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Target,
  CheckCircle2,
  CircleDashed,
  Copy,
  Check,
  TrendingUp,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { BacktestResult, DataSourceMode, MarketDataset, StrategySpec } from '../types/quant';
import { TIMEFRAME_PROFILES } from '../engine/timeframeConfig';
import {
  buildWaitingOneLiner,
  formatCurrency,
  formatDateTime,
  formatPct,
  formatPrice,
} from '../utils/format';

interface LiveSignalCardProps {
  strategy: StrategySpec;
  dataset: MarketDataset;
  result: BacktestResult;
  dataSourceMode: DataSourceMode;
  liveLoading: boolean;
  liveError: string | null;
  onChangeDataSource: (mode: DataSourceMode) => void;
  onRefreshLive: () => void;
  onApplyAtrRisk: () => void;
}

export const LiveSignalCard: React.FC<LiveSignalCardProps> = ({
  strategy,
  dataset,
  result,
  dataSourceMode,
  liveLoading,
  liveError,
  onChangeDataSource,
  onRefreshLive,
  onApplyAtrRisk,
}) => {
  const [riskPct, setRiskPct] = useState<number>(2);
  const [copied, setCopied] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(false);

  const { liveSignal } = result;
  const ex = strategy.execution;
  const isShort = liveSignal.side === 'SHORT';
  const isWaiting = liveSignal.status === 'WAIT';
  const tfProfile = TIMEFRAME_PROFILES[strategy.timeframe];

  // 待機中はデフォルトで1行表示（ユーザーが「想定注文を見る」で開閉）。シグナル点灯・保有中は自動展開。
  const isExpanded = !isWaiting || manualExpanded;

  const effectiveSlPrice =
    liveSignal.stopLossPrice ??
    (liveSignal.atrValue
      ? isShort
        ? liveSignal.entryPrice + liveSignal.atrValue * 2
        : Math.max(0.0001, liveSignal.entryPrice - liveSignal.atrValue * 2)
      : null);
  const isAtrSuggestedSl = liveSignal.stopLossPrice === null && effectiveSlPrice !== null;

  const riskBudget = ex.initialCapital * (riskPct / 100);
  const slDistancePct =
    effectiveSlPrice !== null && liveSignal.entryPrice > 0
      ? Math.max(0.001, Math.abs(liveSignal.entryPrice - effectiveSlPrice) / liveSignal.entryPrice)
      : null;
  const riskBasedNotional = slDistancePct ? riskBudget / slDistancePct : null;

  const waitingSummary = buildWaitingOneLiner(strategy, liveSignal);

  const statusMeta = {
    BUY_NOW: {
      label: 'BUY 点灯',
      summary: '最新確定足で買い条件をすべて満たしました',
      badge: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200',
      dot: 'bg-emerald-400',
    },
    SHORT_NOW: {
      label: 'SHORT 点灯',
      summary: '最新確定足で売りエントリー条件を満たしました',
      badge: 'border-purple-400/50 bg-purple-500/20 text-purple-200',
      dot: 'bg-purple-400',
    },
    IN_POSITION: {
      label: isShort ? 'ショート保有中' : '保有中 (LONG)',
      summary: liveSignal.activeEntryTime
        ? `${formatDateTime(liveSignal.activeEntryTime, strategy.timeframe !== '1D')} 建 · ${liveSignal.activeHoldingBars}本保有`
        : '現在ポジションを保有中です',
      badge: isShort
        ? 'border-purple-400/50 bg-purple-500/20 text-purple-200'
        : 'border-sky-400/50 bg-sky-500/20 text-sky-200',
      dot: isShort ? 'bg-purple-400' : 'bg-sky-400',
    },
    SELL_NOW: {
      label: 'SELL 決済点灯',
      summary: '最新確定足で手仕舞い条件を満たしました',
      badge: 'border-rose-400/50 bg-rose-500/20 text-rose-200',
      dot: 'bg-rose-400',
    },
    WAIT: {
      label: '待機中',
      summary: waitingSummary,
      badge: 'border-slate-700 bg-slate-800/90 text-slate-200',
      dot: 'bg-slate-400',
    },
  }[liveSignal.status];

  const handleCopyOrderPlan = async () => {
    const lines = [
      `【QuantBlock 注文プラン】${strategy.symbol} (${strategy.timeframe})`,
      `ステータス: ${statusMeta.label}`,
      `最新価格: ${formatPrice(liveSignal.latestPrice, strategy.symbol)} (${formatDateTime(liveSignal.latestTime, true)} UTC)`,
      `${isShort ? 'SHORT' : 'BUY'} 想定価格: ${formatPrice(liveSignal.entryPrice, strategy.symbol)}`,
      `損切り (SL): ${
        effectiveSlPrice
          ? `${formatPrice(effectiveSlPrice, strategy.symbol)}${isAtrSuggestedSl ? ' (ATR×2参考)' : ` (-${ex.stopLossPct}%)`}`
          : '未設定'
      }`,
      `利確 (TP): ${
        liveSignal.takeProfitPrice
          ? `${formatPrice(liveSignal.takeProfitPrice, strategy.symbol)} (+${ex.takeProfitPct}%)`
          : 'シグナル決済'
      }`,
      liveSignal.trailingStopPrice
        ? `トレーリング目安: ${formatPrice(liveSignal.trailingStopPrice, strategy.symbol)} (-${ex.trailingStopPct}%)`
        : null,
      liveSignal.riskRewardRatio
        ? `リスクリワード比: 1 : ${liveSignal.riskRewardRatio.toFixed(2)}`
        : null,
      `想定ポジション額: ${formatCurrency(liveSignal.leveragedNotional)} (レバレッジ ${ex.leverage}x)`,
    ].filter(Boolean);

    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const fmtVal = (v: number | null) => {
    if (v === null || !Number.isFinite(v)) return '—';
    if (Math.abs(v) >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return v.toFixed(2);
  };

  return (
    <section
      className={`rounded-2xl border transition-all ${
        isWaiting
          ? 'border-slate-800/90 bg-[#0b1220]'
          : 'border-indigo-500/40 bg-gradient-to-br from-[#0e172a] via-[#0b1220] to-[#0a101d] shadow-lg shadow-indigo-950/30'
      }`}
    >
      {/* 常時表示のコンパクト1行ステータスバー */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${statusMeta.badge}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </span>

          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-sm font-extrabold text-white tabular-nums">
              {formatPrice(liveSignal.latestPrice, strategy.symbol)}
            </span>
            <span
              className={`inline-flex items-center text-[11px] font-bold tabular-nums ${
                liveSignal.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {liveSignal.changePct >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {formatPct(liveSignal.changePct)}
            </span>
            {liveSignal.unrealizedPnlPct !== null && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  liveSignal.unrealizedPnlPct >= 0
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-rose-500/15 text-rose-300'
                }`}
              >
                含み {formatPct(liveSignal.unrealizedPnlPct)}
              </span>
            )}
          </div>

          <span className="hidden text-slate-700 sm:inline">|</span>

          <span className="text-xs font-medium text-slate-200">{statusMeta.summary}</span>

          {dataset.source === 'live' && (
            <span className="hidden items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300 lg:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              LIVE ({dataset.provider?.split(' ')[0]})
            </span>
          )}
        </div>

        {/* 右側コンパクト操作 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => onChangeDataSource('live')}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition ${
                dataSourceMode === 'live'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="h-3 w-3" />
              LIVE
            </button>
            <button
              type="button"
              onClick={() => onChangeDataSource('simulation')}
              className={`rounded-md px-2 py-1 font-semibold transition ${
                dataSourceMode === 'simulation'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              シミュ
            </button>
          </div>

          {dataSourceMode === 'live' && strategy.symbol !== 'CUSTOM' && (
            <button
              type="button"
              disabled={liveLoading}
              onClick={onRefreshLive}
              title="取引所APIから最新価格を再取得"
              className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 transition hover:border-emerald-500/50 hover:text-white disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-emerald-400 ${liveLoading ? 'animate-spin' : ''}`}
              />
            </button>
          )}

          {isWaiting && (
            <button
              type="button"
              onClick={() => setManualExpanded((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
            >
              {manualExpanded ? '想定注文を閉じる' : '想定注文を見る'}
              {manualExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {liveError && (
        <div className="mx-4 mb-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>{liveError}（シミュレーションデータで表示中）</span>
        </div>
      )}

      {/* 展開時のみ表示される「想定注文価格 & 条件チェックリスト」 */}
      {isExpanded && (
        <div className="space-y-3 border-t border-slate-800/80 px-4 pb-4 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-2 text-slate-400">
              <span className="font-mono text-slate-300">
                最新足: {formatDateTime(liveSignal.latestTime, strategy.timeframe !== '1D')} UTC
              </span>
              {liveSignal.atrValue !== null && (
                <span className="font-mono text-slate-400">
                  · {tfProfile.label} ATR(14):{' '}
                  {formatPrice(liveSignal.atrValue, strategy.symbol)} (
                  {((liveSignal.atrValue / Math.max(1e-9, liveSignal.latestPrice)) * 100).toFixed(2)}%)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onApplyAtrRisk}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
              >
                ATRからSL/TP自動設定
              </button>
              <button
                type="button"
                onClick={handleCopyOrderPlan}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" /> コピー済
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> 注文価格をコピー
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4枚の具体注文価格カード */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300">
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {liveSignal.status === 'IN_POSITION'
                    ? '保有エントリー価格'
                    : isShort
                    ? 'SHORT 想定価格'
                    : 'BUY 想定価格'}
                </span>
                <span className="font-mono text-[10px]">{liveSignal.side}</span>
              </div>
              <div className="mt-1 font-mono text-lg font-extrabold text-white tabular-nums">
                {formatPrice(liveSignal.entryPrice, strategy.symbol)}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">
                スリッページ {ex.slippageBps}bps / 手数料 {ex.feeBps}bps 反映
              </div>
            </div>

            <div className="rounded-xl border border-rose-500/35 bg-rose-950/20 p-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-rose-300">
                <span className="inline-flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  損切り価格 (SL)
                </span>
                <span className="font-mono text-[10px]">
                  {isAtrSuggestedSl ? 'ATR×2' : ex.stopLossPct > 0 ? `-${ex.stopLossPct}%` : '無効'}
                </span>
              </div>
              <div className="mt-1 font-mono text-lg font-extrabold text-rose-300 tabular-nums">
                {effectiveSlPrice ? formatPrice(effectiveSlPrice, strategy.symbol) : '未設定'}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400 tabular-nums">
                {liveSignal.maxLossAmount !== null
                  ? `想定最大損失: -${formatCurrency(liveSignal.maxLossAmount)}`
                  : '執行ブロックでSL%を設定'}
              </div>
            </div>

            <div className="rounded-xl border border-sky-500/35 bg-sky-950/20 p-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-sky-300">
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  利確目標 (TP)
                </span>
                <span className="font-mono text-[10px]">
                  {ex.takeProfitPct > 0 ? `+${ex.takeProfitPct}%` : 'シグナル決済'}
                </span>
              </div>
              <div className="mt-1 font-mono text-lg font-extrabold text-sky-300 tabular-nums">
                {liveSignal.takeProfitPrice
                  ? formatPrice(liveSignal.takeProfitPrice, strategy.symbol)
                  : 'SELLシグナル時'}
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                <span>
                  {liveSignal.trailingStopPrice
                    ? `TS: ${formatPrice(liveSignal.trailingStopPrice, strategy.symbol)}`
                    : 'TSなし'}
                </span>
                {liveSignal.riskRewardRatio && (
                  <span className="font-mono font-bold text-emerald-300">
                    R:R 1:{liveSignal.riskRewardRatio.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-amber-300">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  推奨注文額
                </span>
                <label className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-200">
                  許容損
                  <select
                    value={riskPct}
                    onChange={(e) => setRiskPct(Number(e.target.value))}
                    className="rounded border border-amber-500/40 bg-slate-900 px-1 py-0.5 text-[10px] text-amber-200 outline-none"
                  >
                    <option value={1}>1%</option>
                    <option value={2}>2%</option>
                    <option value={3}>3%</option>
                    <option value={5}>5%</option>
                  </select>
                </label>
              </div>
              <div className="mt-1 font-mono text-lg font-extrabold text-amber-200 tabular-nums">
                {riskBasedNotional
                  ? formatCurrency(Math.min(riskBasedNotional, ex.initialCapital * ex.leverage))
                  : formatCurrency(liveSignal.leveragedNotional)}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400 tabular-nums">
                許容損 {formatCurrency(riskBudget)} / 口座 {formatCurrency(ex.initialCapital)}
              </div>
            </div>
          </div>

          {/* 条件チェックリスト */}
          <div className="grid gap-2.5 md:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-emerald-300">
                <span>買い条件（{strategy.entryLogic}）</span>
                <span className="font-mono text-slate-400">
                  {liveSignal.entryChecks.filter((c) => c.passed).length}/
                  {liveSignal.entryChecks.length} 成立
                </span>
              </div>
              <div className="space-y-1">
                {liveSignal.entryChecks.map((c) => (
                  <div
                    key={c.ruleId}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1 text-[11px] ${
                      c.passed
                        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 truncate">
                      {c.passed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <CircleDashed className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      )}
                      <span className="truncate font-medium">{c.summary}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-300">
                      {fmtVal(c.leftValue)} vs {fmtVal(c.rightValue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-rose-300">
                <span>売り条件（{strategy.exitLogic}）</span>
                <span className="font-mono text-slate-400">
                  {liveSignal.exitChecks.filter((c) => c.passed).length}/
                  {liveSignal.exitChecks.length} 成立
                </span>
              </div>
              <div className="space-y-1">
                {liveSignal.exitChecks.map((c) => (
                  <div
                    key={c.ruleId}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1 text-[11px] ${
                      c.passed
                        ? 'border-rose-500/35 bg-rose-500/10 text-rose-200'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 truncate">
                      {c.passed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                      ) : (
                        <CircleDashed className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      )}
                      <span className="truncate font-medium">{c.summary}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-300">
                      {fmtVal(c.leftValue)} vs {fmtVal(c.rightValue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
