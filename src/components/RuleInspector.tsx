import React, { useRef } from 'react';
import {
  Database,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  GitMerge,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  Undo2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import type {
  AssetSymbol,
  BacktestMetrics,
  ComparatorOp,
  ConditionRule,
  ExecutionConfig,
  IndicatorKind,
  IndicatorOperand,
  MarketDataset,
  StrategySpec,
  Timeframe,
} from '../types/quant';
import { AVAILABLE_ASSETS, parseCsvToDataset } from '../engine/marketData';
import {
  getRecommendedRiskForTimeframe,
  TIMEFRAME_ORDER,
  TIMEFRAME_PROFILES,
} from '../engine/timeframeConfig';
import type { SelectedBlock } from './VisualFlowBuilder';
import { formatPct, OPERATOR_LABELS } from '../utils/format';

export interface ChangeImpactSnapshot {
  metrics: BacktestMetrics;
  label: string;
}

interface RuleInspectorProps {
  strategy: StrategySpec;
  selectedBlock: SelectedBlock;
  customDataset: MarketDataset | null;
  currentMetrics: BacktestMetrics;
  lastChangeImpact: ChangeImpactSnapshot | null;
  onUndoLastChange: () => void;
  latestPrice: number;
  latestAtr: number | null;
  autoAdjustRiskOnTf: boolean;
  onToggleAutoAdjustRisk: () => void;
  onChangeTimeframe: (tf: Timeframe) => void;
  onApplyAtrRisk: () => void;
  onChangeStrategy: (updater: (prev: StrategySpec) => StrategySpec, changeLabel?: string) => void;
  onUploadCustomCsv: (dataset: MarketDataset) => void;
  onSelectBlock: (block: SelectedBlock) => void;
}

const INDICATOR_OPTIONS: { kind: IndicatorKind; label: string; group: string }[] = [
  { kind: 'CLOSE', label: '終値 (Close)', group: '価格' },
  { kind: 'VWAP', label: 'VWAP (出来高加重平均)', group: 'デイトレ主力' },
  { kind: 'SMA', label: '単純移動平均 (SMA)', group: 'トレンド' },
  { kind: 'EMA', label: '指数移動平均 (EMA)', group: 'トレンド' },
  { kind: 'ADX', label: 'ADX (トレンド強度)', group: 'ダマシ回避' },
  { kind: 'BB_UPPER', label: 'ボリンジャー上限 (+σ)', group: 'ボラティリティ' },
  { kind: 'BB_MIDDLE', label: 'ボリンジャー中央線', group: 'ボラティリティ' },
  { kind: 'BB_LOWER', label: 'ボリンジャー下限 (-σ)', group: 'ボラティリティ' },
  { kind: 'RSI', label: 'RSI (相対力指数)', group: 'オシレーター' },
  { kind: 'STOCH_K', label: 'ストキャスティクス %K', group: 'オシレーター' },
  { kind: 'MACD_LINE', label: 'MACD ライン', group: 'モメンタム' },
  { kind: 'MACD_SIGNAL', label: 'MACD シグナル', group: 'モメンタム' },
  { kind: 'MACD_HIST', label: 'MACD ヒストグラム', group: 'モメンタム' },
  { kind: 'VOLUME', label: '出来高 (Volume)', group: '出来高' },
  { kind: 'VOLUME_SMA', label: '出来高移動平均', group: '出来高' },
  { kind: 'CONST', label: '固定数値 (定数)', group: '定数' },
];

function defaultOperandForKind(kind: IndicatorKind): IndicatorOperand {
  switch (kind) {
    case 'SMA':
    case 'EMA':
    case 'VOLUME_SMA':
      return { kind, period: 20 };
    case 'RSI':
    case 'ADX':
    case 'ATR':
    case 'STOCH_K':
      return { kind, period: 14 };
    case 'BB_UPPER':
    case 'BB_MIDDLE':
    case 'BB_LOWER':
      return { kind, period: 20, stdDev: 2 };
    case 'MACD_LINE':
    case 'MACD_SIGNAL':
    case 'MACD_HIST':
      return { kind, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 };
    case 'CONST':
      return { kind, value: 30 };
    default:
      return { kind };
  }
}

function OperandEditor({
  title,
  operand,
  onChange,
}: {
  title: string;
  operand: IndicatorOperand;
  onChange: (next: IndicatorOperand) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      <select
        value={operand.kind}
        onChange={(e) => onChange(defaultOperandForKind(e.target.value as IndicatorKind))}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-medium text-slate-100 outline-none focus:border-indigo-500"
      >
        {INDICATOR_OPTIONS.map((opt) => (
          <option key={opt.kind} value={opt.kind}>
            [{opt.group}] {opt.label}
          </option>
        ))}
      </select>

      {(operand.kind === 'SMA' ||
        operand.kind === 'EMA' ||
        operand.kind === 'RSI' ||
        operand.kind === 'ADX' ||
        operand.kind === 'ATR' ||
        operand.kind === 'STOCH_K' ||
        operand.kind === 'VOLUME_SMA') && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <label className="text-xs text-slate-400">期間 (Period)</label>
          <input
            type="number"
            min={2}
            max={250}
            value={operand.period ?? 14}
            onChange={(e) =>
              onChange({ ...operand, period: Math.max(2, Number(e.target.value) || 2) })
            }
            className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-right font-mono text-xs text-white outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {(operand.kind === 'BB_UPPER' ||
        operand.kind === 'BB_MIDDLE' ||
        operand.kind === 'BB_LOWER') && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="block text-[11px] text-slate-400">期間</label>
            <input
              type="number"
              min={5}
              max={100}
              value={operand.period ?? 20}
              onChange={(e) =>
                onChange({ ...operand, period: Math.max(5, Number(e.target.value) || 20) })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-right font-mono text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400">偏差 (σ)</label>
            <input
              type="number"
              step={0.1}
              min={0.5}
              max={4}
              value={operand.stdDev ?? 2}
              onChange={(e) =>
                onChange({ ...operand, stdDev: Math.max(0.5, Number(e.target.value) || 2) })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-right font-mono text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {(operand.kind === 'MACD_LINE' ||
        operand.kind === 'MACD_SIGNAL' ||
        operand.kind === 'MACD_HIST') && (
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <div>
            <label className="block text-[10px] text-slate-400">短期</label>
            <input
              type="number"
              min={2}
              max={50}
              value={operand.fastPeriod ?? 12}
              onChange={(e) =>
                onChange({ ...operand, fastPeriod: Math.max(2, Number(e.target.value) || 12) })
              }
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-right font-mono text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400">長期</label>
            <input
              type="number"
              min={5}
              max={100}
              value={operand.slowPeriod ?? 26}
              onChange={(e) =>
                onChange({ ...operand, slowPeriod: Math.max(5, Number(e.target.value) || 26) })
              }
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-right font-mono text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400">シグナル</label>
            <input
              type="number"
              min={2}
              max={50}
              value={operand.signalPeriod ?? 9}
              onChange={(e) =>
                onChange({ ...operand, signalPeriod: Math.max(2, Number(e.target.value) || 9) })
              }
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-right font-mono text-xs text-white"
            />
          </div>
        </div>
      )}

      {operand.kind === 'CONST' && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <label className="text-xs text-slate-400">数値 (閾値)</label>
          <input
            type="number"
            step={1}
            value={operand.value ?? 0}
            onChange={(e) => onChange({ ...operand, value: Number(e.target.value) })}
            className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-right font-mono text-xs text-white outline-none focus:border-indigo-500"
          />
        </div>
      )}
    </div>
  );
}

export const RuleInspector: React.FC<RuleInspectorProps> = ({
  strategy,
  selectedBlock,
  customDataset,
  currentMetrics,
  lastChangeImpact,
  onUndoLastChange,
  latestPrice,
  latestAtr,
  autoAdjustRiskOnTf,
  onToggleAutoAdjustRisk,
  onChangeTimeframe,
  onApplyAtrRisk,
  onChangeStrategy,
  onUploadCustomCsv,
  onSelectBlock,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tfProfile = TIMEFRAME_PROFILES[strategy.timeframe];
  const atrPct =
    latestAtr !== null && latestPrice > 0 ? (latestAtr / latestPrice) * 100 : null;

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const ds = parseCsvToDataset(String(reader.result || ''), file.name);
        onUploadCustomCsv(ds);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'CSVの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const updateExecution = (patch: Partial<ExecutionConfig>) => {
    onChangeStrategy((prev) => ({
      ...prev,
      execution: { ...prev.execution, ...patch },
    }));
  };

  const renderRuleEditor = (kind: 'entry' | 'exit', ruleId: string) => {
    const list = kind === 'entry' ? strategy.entryRules : strategy.exitRules;
    const rule = list.find((r) => r.id === ruleId);
    if (!rule) {
      return (
        <div className="text-xs text-slate-400">
          左のキャンバスから編集したいブロックを選択してください。
        </div>
      );
    }

    const updateRule = (patch: Partial<ConditionRule>) => {
      onChangeStrategy((prev) => ({
        ...prev,
        [kind === 'entry' ? 'entryRules' : 'exitRules']: (
          kind === 'entry' ? prev.entryRules : prev.exitRules
        ).map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
      }));
    };

    const deleteRule = () => {
      onChangeStrategy((prev) => ({
        ...prev,
        [kind === 'entry' ? 'entryRules' : 'exitRules']: (
          kind === 'entry' ? prev.entryRules : prev.exitRules
        ).filter((r) => r.id !== ruleId),
      }));
      onSelectBlock({ type: 'execution' });
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-lg p-1.5 ${
                kind === 'entry'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {kind === 'entry' ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                {kind === 'entry' ? '買い条件ブロック' : '売り条件ブロック'}
              </h3>
              <p className="text-[11px] text-slate-400">指標と条件を直感的に設定</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => updateRule({ enabled: !rule.enabled })}
              title={rule.enabled ? 'この条件を一時無効化' : 'この条件を有効化'}
              className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:border-slate-500 hover:text-white"
            >
              {rule.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            {list.length > 1 && (
              <button
                type="button"
                onClick={deleteRule}
                title="ブロック削除"
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] text-slate-400">ブロック名</label>
          <input
            type="text"
            value={rule.label}
            onChange={(e) => updateRule({ label: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
          />
        </div>

        <OperandEditor
          title="左辺インジケーター"
          operand={rule.left}
          onChange={(left) => updateRule({ left })}
        />

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-400">
            比較条件（演算子）
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(OPERATOR_LABELS) as ComparatorOp[]).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => updateRule({ operator: op })}
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                  rule.operator === op
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                    : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {OPERATOR_LABELS[op].short}
              </button>
            ))}
          </div>
        </div>

        <OperandEditor
          title="右辺インジケーター / 閾値"
          operand={rule.right}
          onChange={(right) => updateRule({ right })}
        />
      </div>
    );
  };

  return (
    <div className="flex h-[440px] flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0c1322]">
      {/* 編集結果の即時フィードバックバー（条件変更による変化をその場に表示） */}
      <div
        className={`shrink-0 border-b px-3.5 py-2.5 ${
          lastChangeImpact && currentMetrics.totalTrades === 0
            ? 'border-amber-500/40 bg-amber-950/35'
            : lastChangeImpact
            ? 'border-indigo-500/35 bg-indigo-950/30'
            : 'border-slate-800/90 bg-[#0a101d]'
        }`}
      >
        {lastChangeImpact ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-bold text-indigo-200">
                変更結果（{lastChangeImpact.label}）
              </span>
              <button
                type="button"
                onClick={onUndoLastChange}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                <Undo2 className="h-3 w-3" />
                元に戻す
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums">
              <span className="inline-flex items-center gap-1 text-slate-200">
                <span className="font-sans text-[10px] text-slate-400">取引回数</span>
                <span className="text-slate-400">{lastChangeImpact.metrics.totalTrades}回</span>
                <ArrowRight className="h-3 w-3 text-slate-500" />
                <span
                  className={`font-bold ${
                    currentMetrics.totalTrades === 0 ? 'text-amber-300' : 'text-white'
                  }`}
                >
                  {currentMetrics.totalTrades}回
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-sans text-[10px] text-slate-400">勝率</span>
                <span className="text-slate-400">
                  {lastChangeImpact.metrics.winRatePct.toFixed(1)}%
                </span>
                <ArrowRight className="h-3 w-3 text-slate-500" />
                <span
                  className={`font-bold ${
                    currentMetrics.winRatePct >= lastChangeImpact.metrics.winRatePct
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {currentMetrics.winRatePct.toFixed(1)}%
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-sans text-[10px] text-slate-400">リターン</span>
                <span className="text-slate-400">
                  {formatPct(lastChangeImpact.metrics.totalReturnPct)}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-500" />
                <span
                  className={`font-bold ${
                    currentMetrics.totalReturnPct >= lastChangeImpact.metrics.totalReturnPct
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {formatPct(currentMetrics.totalReturnPct)}
                </span>
              </span>
            </div>
            {currentMetrics.totalTrades === 0 && (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>条件が厳しすぎて取引が発生しません。閾値を緩めるか「元に戻す」を押してください。</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] tabular-nums">
            <span className="font-sans text-[11px] text-slate-400">
              条件を変更するとここに結果の変化を表示
            </span>
            <span className="text-slate-300">
              取引 <strong>{currentMetrics.totalTrades}回</strong> · 勝率{' '}
              <strong>{currentMetrics.winRatePct.toFixed(1)}%</strong>
            </span>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {selectedBlock.type === 'market' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-sky-500/15 p-1.5 text-sky-400">
              <Database className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">マーケットデータ設定</h3>
              <p className="text-[11px] text-slate-400">銘柄・時間足・カスタムCSV</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-slate-400">検証対象アセット</label>
            <div className="space-y-1.5">
              {AVAILABLE_ASSETS.map((a) => (
                <button
                  key={a.symbol}
                  type="button"
                  onClick={() => onChangeStrategy((prev) => ({ ...prev, symbol: a.symbol }))}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                    strategy.symbol === a.symbol
                      ? 'border-sky-400 bg-sky-500/15 text-white'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-mono text-xs font-bold">{a.symbol}</div>
                    <div className="text-[11px] text-slate-400">{a.name}</div>
                  </div>
                  <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                    {a.category}
                  </span>
                </button>
              ))}
              {customDataset && (
                <button
                  type="button"
                  onClick={() => onChangeStrategy((prev) => ({ ...prev, symbol: 'CUSTOM' }))}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                    strategy.symbol === 'CUSTOM'
                      ? 'border-indigo-400 bg-indigo-500/15 text-white'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-mono text-xs font-bold">CUSTOM</div>
                    <div className="text-[11px] text-slate-400">{customDataset.name}</div>
                  </div>
                  <span className="rounded-md bg-indigo-950 px-2 py-0.5 text-[10px] text-indigo-300">
                    CSV
                  </span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-slate-400">
              時間足 (15m / 30m デイトレ対応)
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {TIMEFRAME_ORDER.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => onChangeTimeframe(tf)}
                  className={`rounded-lg border py-1.5 font-mono text-xs font-semibold transition ${
                    strategy.timeframe === tf
                      ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={autoAdjustRiskOnTf}
                onChange={onToggleAutoAdjustRisk}
                className="accent-indigo-500"
              />
              時間足変更時に損切り・利確幅を自動調整する
            </label>
          </div>

          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              <Upload className="h-3.5 w-3.5 text-sky-400" />
              独自OHLCV CSVをインポート
            </button>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
              TradingViewや取引所から書き出した time, open, high, low, close, volume 形式のCSVを即検証できます。
            </p>
          </div>
        </div>
      )}

      {selectedBlock.type === 'entry_rule' && renderRuleEditor('entry', selectedBlock.ruleId)}
      {selectedBlock.type === 'exit_rule' && renderRuleEditor('exit', selectedBlock.ruleId)}

      {(selectedBlock.type === 'entry_gate' || selectedBlock.type === 'exit_gate') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-indigo-500/15 p-1.5 text-indigo-400">
              <GitMerge className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                {selectedBlock.type === 'entry_gate' ? '買い論理ゲート設定' : '売り論理ゲート設定'}
              </h3>
              <p className="text-[11px] text-slate-400">複数ブロックの結合方式</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {(['AND', 'OR'] as const).map((g) => {
              const current =
                selectedBlock.type === 'entry_gate' ? strategy.entryLogic : strategy.exitLogic;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() =>
                    onChangeStrategy((prev) =>
                      selectedBlock.type === 'entry_gate'
                        ? { ...prev, entryLogic: g }
                        : { ...prev, exitLogic: g }
                    )
                  }
                  className={`rounded-xl border p-3 text-left transition ${
                    current === g
                      ? 'border-indigo-400 bg-indigo-500/15'
                      : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                  }`}
                >
                  <div className="font-mono text-sm font-bold text-white">{g}</div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {g === 'AND'
                      ? '接続された有効ブロックをすべて同時に満たした時のみ発動（厳選エントリー向け）'
                      : 'いずれか1つのブロック条件を満たした時点で発動（素早い手仕舞い向け）'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedBlock.type === 'execution' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-amber-500/15 p-1.5 text-amber-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">執行 & リスク管理</h3>
              <p className="text-[11px] text-slate-400">資金配分・損切り・手数料を厳密反映</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-slate-400">売買方向モード</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => updateExecution({ allowShort: false })}
                className={`rounded-lg border py-1.5 text-xs font-semibold transition ${
                  !strategy.execution.allowShort
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                ロングのみ (買い)
              </button>
              <button
                type="button"
                onClick={() => updateExecution({ allowShort: true })}
                className={`rounded-lg border py-1.5 text-xs font-semibold transition ${
                  strategy.execution.allowShort
                    ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                ロング＆ショート (両方向)
              </button>
            </div>
          </div>

          {/* 時間足＆ATR基準の利確・損切りクイック自動設定 */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-indigo-300">
                {tfProfile.label}（{tfProfile.styleTag}）値幅フィット
              </span>
              {atrPct !== null && (
                <span className="font-mono text-slate-400">
                  現在ATR {atrPct.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const rec = getRecommendedRiskForTimeframe(
                    strategy.timeframe,
                    strategy.symbol
                  );
                  updateExecution(rec);
                }}
                className="rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-2 py-1.5 text-[11px] font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
              >
                {strategy.timeframe} 標準幅に合わせる
              </button>
              <button
                type="button"
                onClick={onApplyAtrRisk}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
              >
                ATR基準で自動算出
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] text-slate-400">初期資金 (¥)</label>
              <input
                type="number"
                step={100000}
                min={10000}
                value={strategy.execution.initialCapital}
                onChange={(e) =>
                  updateExecution({ initialCapital: Math.max(10000, Number(e.target.value) || 100000) })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400">投入比率 (%)</label>
              <input
                type="number"
                min={10}
                max={100}
                value={strategy.execution.positionSizePct}
                onChange={(e) =>
                  updateExecution({
                    positionSizePct: Math.min(100, Math.max(10, Number(e.target.value) || 50)),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] text-rose-300">
                <label>損切り SL (%)</label>
                <span className="font-mono text-[10px]">-{strategy.execution.stopLossPct}%</span>
              </div>
              <input
                type="number"
                step={tfProfile.stepPct}
                min={0}
                max={tfProfile.maxSlPct}
                value={strategy.execution.stopLossPct}
                onChange={(e) =>
                  updateExecution({ stopLossPct: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-rose-200"
              />
              <input
                type="range"
                min={0}
                max={tfProfile.maxSlPct}
                step={tfProfile.stepPct}
                value={Math.min(tfProfile.maxSlPct, strategy.execution.stopLossPct)}
                onChange={(e) => updateExecution({ stopLossPct: Number(e.target.value) })}
                className="mt-1 w-full accent-rose-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] text-emerald-300">
                <label>利確 TP (%)</label>
                <span className="font-mono text-[10px]">+{strategy.execution.takeProfitPct}%</span>
              </div>
              <input
                type="number"
                step={tfProfile.stepPct}
                min={0}
                max={tfProfile.maxTpPct}
                value={strategy.execution.takeProfitPct}
                onChange={(e) =>
                  updateExecution({ takeProfitPct: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-emerald-200"
              />
              <input
                type="range"
                min={0}
                max={tfProfile.maxTpPct}
                step={tfProfile.stepPct}
                value={Math.min(tfProfile.maxTpPct, strategy.execution.takeProfitPct)}
                onChange={(e) => updateExecution({ takeProfitPct: Number(e.target.value) })}
                className="mt-1 w-full accent-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-sky-300">トレーリング (%)</label>
              <input
                type="number"
                step={tfProfile.stepPct}
                min={0}
                max={tfProfile.maxSlPct}
                value={strategy.execution.trailingStopPct}
                onChange={(e) =>
                  updateExecution({ trailingStopPct: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-sky-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-amber-300">レバレッジ (倍)</label>
              <input
                type="number"
                step={0.5}
                min={1}
                max={10}
                value={strategy.execution.leverage}
                onChange={(e) =>
                  updateExecution({
                    leverage: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-amber-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400">手数料 (bps / 片道)</label>
              <input
                type="number"
                step={1}
                min={0}
                max={50}
                value={strategy.execution.feeBps}
                onChange={(e) =>
                  updateExecution({ feeBps: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400">スリッページ (bps)</label>
              <input
                type="number"
                step={1}
                min={0}
                max={50}
                value={strategy.execution.slippageBps}
                onChange={(e) =>
                  updateExecution({ slippageBps: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-200"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">約定タイミング（検証厳密性）</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => updateExecution({ executionTiming: 'next_open' })}
                className={`rounded-lg border py-1.5 text-[11px] font-semibold transition ${
                  (strategy.execution.executionTiming ?? 'next_open') === 'next_open'
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                次足始値 (厳密・推奨)
              </button>
              <button
                type="button"
                onClick={() => updateExecution({ executionTiming: 'same_close' })}
                className={`rounded-lg border py-1.5 text-[11px] font-semibold transition ${
                  strategy.execution.executionTiming === 'same_close'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                同足終値 (即時)
              </button>
            </div>
          </div>

          <p className="rounded-lg bg-slate-900/80 px-2.5 py-2 text-[10px] leading-relaxed text-slate-400">
            ※ 1 bps = 0.01%。次足始値約定は先読みバイアスを完全排除し、実Bot約定とのズレを最小化します。
          </p>
        </div>
      )}
      </div>
    </div>
  );
};
