import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Blocks,
  LineChart,
  BarChart2,
  FlaskConical,
  ListOrdered,
  Layers,
  Share2,
  Save,
  Sparkles,
  Crown,
  BookOpen,
  RotateCcw,
  CheckCircle2,
  Trash2,
  ChevronDown,
  Pencil,
  Check,
} from 'lucide-react';
import { PRESET_STRATEGIES } from './data/presets';
import { AVAILABLE_ASSETS, getMarketDataset } from './engine/marketData';
import { fetchLiveMarketData } from './engine/liveMarketClient';
import { runBacktest } from './engine/backtester';
import {
  getRecommendedRiskForTimeframe,
  TIMEFRAME_ORDER,
  TIMEFRAME_PROFILES,
} from './engine/timeframeConfig';
import type {
  AssetSymbol,
  BacktestMetrics,
  DataSourceMode,
  MarketDataset,
  OptimizationCell,
  PlanTier,
  StrategySpec,
  Timeframe,
} from './types/quant';
import { VisualFlowBuilder, type SelectedBlock } from './components/VisualFlowBuilder';
import { RuleInspector, type ChangeImpactSnapshot } from './components/RuleInspector';
import { LiveSignalCard } from './components/LiveSignalCard';
import { TradingChart } from './components/TradingChart';
import { EquityAndAnalytics } from './components/EquityAndAnalytics';
import { QuantLabPanel } from './components/QuantLabPanel';
import { PortfolioPanel } from './components/PortfolioPanel';
import { TradeLogTable } from './components/TradeLogTable';
import { PricingModal } from './components/PricingModal';
import { ShareCardModal } from './components/ShareCardModal';
import { LandingView } from './components/LandingView';
import {
  buildUnifiedStrategyHeading,
  formatPct,
  strategyToNaturalSummary,
} from './utils/format';
import { decodeStrategyFromUrlHash } from './utils/shareUrl';

const STORAGE_KEY_STRATEGIES = 'quantblock_saved_strategies_v1';
const STORAGE_KEY_PLAN = 'quantblock_plan_v1';

type AppPage = 'workspace' | 'landing';
type AnalysisTab = 'chart' | 'analytics' | 'portfolio' | 'quantlab' | 'trades';

export default function App() {
  const [page, setPage] = useState<AppPage>('workspace');
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>('chart');
  const [showPricing, setShowPricing] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);

  const [planTier, setPlanTier] = useState<PlanTier>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PLAN);
    if (saved === 'pro' || saved === 'quant' || saved === 'free') return saved;
    return 'free';
  });

  const [savedStrategies, setSavedStrategies] = useState<StrategySpec[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STRATEGIES);
      if (raw) return JSON.parse(raw) as StrategySpec[];
    } catch {
      // ignore
    }
    return [];
  });

  const [strategy, setStrategy] = useState<StrategySpec>(() => {
    const fromUrl = decodeStrategyFromUrlHash();
    if (fromUrl) return fromUrl;
    return structuredClone(PRESET_STRATEGIES[0]);
  });
  const [selectedBlock, setSelectedBlock] = useState<SelectedBlock>(() => {
    const fromUrl = decodeStrategyFromUrlHash();
    const firstId = fromUrl?.entryRules[0]?.id ?? PRESET_STRATEGIES[0].entryRules[0].id;
    return { type: 'entry_rule', ruleId: firstId };
  });
  const [customDataset, setCustomDataset] = useState<MarketDataset | null>(null);
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('live');
  const [autoAdjustRiskOnTf, setAutoAdjustRiskOnTf] = useState(true);
  const [liveDataset, setLiveDataset] = useState<MarketDataset | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 統一見出しのインライン名称編集 & テンプレート変更ドロップダウン
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  // 条件変更によるBefore→After結果差分の記録（連続入力デバウンス付き）
  const [lastChangeImpact, setLastChangeImpact] = useState<ChangeImpactSnapshot | null>(null);
  const undoStrategyRef = useRef<StrategySpec | null>(null);
  const lastEditTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        templateMenuRef.current &&
        !templateMenuRef.current.contains(e.target as Node)
      ) {
        setShowTemplateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const fetchLiveMarket = useCallback(async (symbol: AssetSymbol, timeframe: Timeframe) => {
    if (symbol === 'CUSTOM') return;
    setLiveLoading(true);
    setLiveError(null);
    try {
      const data = await fetchLiveMarketData(symbol, timeframe);
      const meta = AVAILABLE_ASSETS.find((a) => a.symbol === symbol);
      setLiveDataset({
        symbol,
        name: meta?.name ?? symbol,
        category: meta?.category ?? '仮想通貨',
        currency: meta?.currency ?? 'USD',
        timeframe,
        bars: data.bars,
        description: `${data.provider} よりリアルタイム取得`,
        source: 'live',
        provider: data.provider,
        fetchedAt: data.fetchedAt,
      });
    } catch (err) {
      setLiveDataset(null);
      setLiveError(
        err instanceof Error ? err.message : 'リアル相場データの取得に失敗しました'
      );
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dataSourceMode === 'live' && strategy.symbol !== 'CUSTOM') {
      fetchLiveMarket(strategy.symbol, strategy.timeframe);
    } else {
      setLiveError(null);
    }
  }, [dataSourceMode, strategy.symbol, strategy.timeframe, fetchLiveMarket]);

  // Stripeリダイレクト戻り検出
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      const p = params.get('plan');
      if (p === 'pro' || p === 'quant') {
        setPlanTier(p);
        localStorage.setItem(STORAGE_KEY_PLAN, p);
        showToast(`Stripe決済が完了し、${p.toUpperCase()}プランが有効化されました！`);
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSelectPlan = (next: PlanTier) => {
    setPlanTier(next);
    localStorage.setItem(STORAGE_KEY_PLAN, next);
  };

  // マーケットデータ取得 & リアルタイムバックテスト実行
  const dataset = useMemo(() => {
    if (strategy.symbol === 'CUSTOM' && customDataset) {
      return customDataset;
    }
    if (
      dataSourceMode === 'live' &&
      liveDataset &&
      liveDataset.symbol === strategy.symbol &&
      liveDataset.timeframe === strategy.timeframe
    ) {
      return liveDataset;
    }
    return getMarketDataset(strategy.symbol, strategy.timeframe, customDataset);
  }, [strategy.symbol, strategy.timeframe, customDataset, dataSourceMode, liveDataset]);

  const backtestResult = useMemo(
    () => runBacktest(strategy, dataset.bars),
    [strategy, dataset.bars]
  );

  const summary = useMemo(() => strategyToNaturalSummary(strategy), [strategy]);
  const unifiedHeading = useMemo(
    () => buildUnifiedStrategyHeading(strategy, customDataset?.name),
    [strategy, customDataset?.name]
  );

  // 戦略編集ラッパー：変更直前のメトリクスをスナップショットし、RuleInspectorに結果の変化を即表示
  const updateStrategyWithImpact = useCallback(
    (updater: (prev: StrategySpec) => StrategySpec, changeLabel = '条件変更') => {
      const now = Date.now();
      const isBurstEdit = now - lastEditTimeRef.current < 2400 && undoStrategyRef.current !== null;
      lastEditTimeRef.current = now;

      if (!isBurstEdit) {
        undoStrategyRef.current = structuredClone(strategy);
        setLastChangeImpact({
          metrics: backtestResult.metrics,
          label: changeLabel,
        });
      }
      setStrategy(updater);
    },
    [strategy, backtestResult.metrics]
  );

  const handleUndoLastChange = useCallback(() => {
    if (!undoStrategyRef.current) return;
    setStrategy(structuredClone(undoStrategyRef.current));
    undoStrategyRef.current = null;
    setLastChangeImpact(null);
    lastEditTimeRef.current = 0;
    showToast('直前の変更を元に戻しました');
  }, []);

  const handleChangeTimeframe = (nextTf: Timeframe) => {
    setLastChangeImpact(null);
    undoStrategyRef.current = null;
    setStrategy((prev) => {
      if (!autoAdjustRiskOnTf) {
        return { ...prev, timeframe: nextTf };
      }
      const rec = getRecommendedRiskForTimeframe(nextTf, prev.symbol);
      return {
        ...prev,
        timeframe: nextTf,
        execution: {
          ...prev.execution,
          ...rec,
        },
      };
    });
    if (autoAdjustRiskOnTf) {
      const rec = getRecommendedRiskForTimeframe(nextTf, strategy.symbol);
      showToast(
        `${TIMEFRAME_PROFILES[nextTf].label}（${TIMEFRAME_PROFILES[nextTf].styleTag}）向けに SL -${rec.stopLossPct}% / TP +${rec.takeProfitPct}% へ自動調整しました`
      );
    }
  };

  const handleChangeSymbol = (nextSymbol: AssetSymbol) => {
    setLastChangeImpact(null);
    undoStrategyRef.current = null;
    setStrategy((prev) => {
      if (!autoAdjustRiskOnTf || nextSymbol === 'CUSTOM') {
        return { ...prev, symbol: nextSymbol };
      }
      const rec = getRecommendedRiskForTimeframe(prev.timeframe, nextSymbol);
      return {
        ...prev,
        symbol: nextSymbol,
        execution: {
          ...prev.execution,
          ...rec,
        },
      };
    });
  };

  const handleApplyAtrRisk = () => {
    const { atrValue, latestPrice } = backtestResult.liveSignal;
    if (!atrValue || latestPrice <= 0) return;
    const atrPct = (atrValue / latestPrice) * 100;
    const sl = Math.max(0.15, Number((atrPct * 1.5).toFixed(2)));
    const tp = Math.max(0.35, Number((atrPct * 3.2).toFixed(2)));
    const ts = Math.max(0.2, Number((atrPct * 1.8).toFixed(2)));
    updateStrategyWithImpact(
      (prev) => ({
        ...prev,
        execution: {
          ...prev.execution,
          stopLossPct: sl,
          takeProfitPct: tp,
          trailingStopPct: ts,
        },
      }),
      'ATR基準SL/TP自動設定'
    );
    showToast(
      `現在ATR(${atrPct.toFixed(2)}%)に基づき SL -${sl}% / TP +${tp}% / TS -${ts}% へ自動設定しました`
    );
  };

  const handleLoadStrategy = (target: StrategySpec) => {
    const cloned = structuredClone(target);
    setLastChangeImpact(null);
    undoStrategyRef.current = null;
    setShowTemplateMenu(false);
    setStrategy(cloned);
    if (cloned.entryRules[0]) {
      setSelectedBlock({ type: 'entry_rule', ruleId: cloned.entryRules[0].id });
    } else {
      setSelectedBlock({ type: 'market' });
    }
    showToast(`テンプレート「${cloned.name}」を読み込みました`);
  };

  const handleSaveStrategy = () => {
    if (planTier === 'free' && savedStrategies.length >= 3) {
      showToast('Freeプランの保存上限（3戦略）に達しました。Proプランで無制限に保存できます。');
      setShowPricing(true);
      return;
    }

    const id = strategy.id.startsWith('preset-')
      ? `custom-${Date.now()}`
      : strategy.id;
    const toSave: StrategySpec = {
      ...structuredClone(strategy),
      id,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    const nextList = [toSave, ...savedStrategies.filter((s) => s.id !== id)];
    setSavedStrategies(nextList);
    setStrategy(toSave);
    localStorage.setItem(STORAGE_KEY_STRATEGIES, JSON.stringify(nextList));
    showToast(`戦略「${toSave.name}」を保存しました`);
  };

  const handleDeleteSaved = (id: string) => {
    const nextList = savedStrategies.filter((s) => s.id !== id);
    setSavedStrategies(nextList);
    localStorage.setItem(STORAGE_KEY_STRATEGIES, JSON.stringify(nextList));
    showToast('保存済み戦略を削除しました');
  };

  const handleAddEntryRule = () => {
    const newId = `e-${Date.now()}`;
    updateStrategyWithImpact(
      (prev) => ({
        ...prev,
        entryRules: [
          ...prev.entryRules,
          {
            id: newId,
            label: `新規買い条件 ${prev.entryRules.length + 1}`,
            left: { kind: 'RSI', period: 14 },
            operator: 'LESS_THAN',
            right: { kind: 'CONST', value: 55 },
            enabled: true,
          },
        ],
      }),
      '買いブロック追加'
    );
    setSelectedBlock({ type: 'entry_rule', ruleId: newId });
  };

  const handleAddExitRule = () => {
    const newId = `x-${Date.now()}`;
    updateStrategyWithImpact(
      (prev) => ({
        ...prev,
        exitRules: [
          ...prev.exitRules,
          {
            id: newId,
            label: `新規売り条件 ${prev.exitRules.length + 1}`,
            left: { kind: 'RSI', period: 14 },
            operator: 'GREATER_THAN',
            right: { kind: 'CONST', value: 78 },
            enabled: true,
          },
        ],
      }),
      '売りブロック追加'
    );
    setSelectedBlock({ type: 'exit_rule', ruleId: newId });
  };

  const handleApplyOptimizedCell = (
    mode: 'risk_reward' | 'indicator_period',
    cell: OptimizationCell
  ) => {
    setStrategy((prev) => {
      const next = structuredClone(prev);
      const firstRule = next.entryRules.find((r) => r.enabled);
      if (mode === 'indicator_period' && firstRule) {
        if (firstRule.left.period !== undefined && firstRule.right.period !== undefined) {
          firstRule.left.period = cell.paramA;
          firstRule.right.period = cell.paramB;
        } else if (firstRule.left.period !== undefined && firstRule.right.kind === 'CONST') {
          firstRule.left.period = cell.paramA;
          firstRule.right.value = cell.paramB;
        } else if (firstRule.left.period !== undefined) {
          firstRule.left.period = cell.paramA;
          next.execution.stopLossPct = cell.paramB;
        }
      } else {
        next.execution.stopLossPct = cell.paramA;
        next.execution.takeProfitPct = cell.paramB;
      }
      return next;
    });
    showToast(
      `最適パラメータ (${cell.paramA} / ${cell.paramB}) を適用し再検証しました！`
    );
  };

  const { metrics } = backtestResult;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-[#070b14]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage('workspace')}
              className="flex items-center gap-2.5 text-left"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 shadow-lg shadow-indigo-950/60">
                <Blocks className="h-5 w-5 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold tracking-tight text-white">
                    QuantBlock
                  </span>
                  <span className="rounded-md bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-300">
                    BETA
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  ノーコード・アルゴリズム検証＆トレードSaaS
                </div>
              </div>
            </button>

            <nav className="ml-4 hidden items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1 sm:flex">
              <button
                type="button"
                onClick={() => setPage('workspace')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  page === 'workspace'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                戦略ビルダー & 検証
              </button>
              <button
                type="button"
                onClick={() => setPage('landing')}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  page === 'landing'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                プロダクト紹介 (LP)
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {page === 'workspace' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowShareCard(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
                >
                  <Share2 className="h-3.5 w-3.5 text-sky-400" />
                  結果をシェア
                </button>
                <button
                  type="button"
                  onClick={handleSaveStrategy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  <Save className="h-3.5 w-3.5 text-emerald-400" />
                  戦略を保存
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowPricing(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-950/60 transition hover:brightness-110"
            >
              <Crown className="h-3.5 w-3.5 text-amber-300" />
              {planTier === 'free'
                ? 'Proへアップグレード'
                : `${planTier.toUpperCase()} プラン利用中`}
            </button>
          </div>
        </div>
      </header>

      {/* トースト通知 */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-[#0d1829] px-4 py-3 text-xs font-semibold text-emerald-200 shadow-2xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {page === 'landing' ? (
        <LandingView
          onLaunchApp={() => setPage('workspace')}
          onOpenPricing={() => setShowPricing(true)}
        />
      ) : (
        <main className="mx-auto max-w-[1480px] space-y-3.5 px-4 py-3.5">
          {/* 統一見出しバー（銘柄・時間足・戦略名を矛盾なく1つの見出しに統合） */}
          <section className="rounded-2xl border border-slate-800/90 bg-[#0b1220] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* 左: 統一見出し + テンプレートを変更ドロップダウン */}
              <div className="flex flex-wrap items-center gap-2.5">
                {editingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={strategy.name}
                      onChange={(e) =>
                        setStrategy((prev) => ({ ...prev, name: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false);
                      }}
                      className="w-56 rounded-lg border border-indigo-400 bg-slate-950 px-2.5 py-1 text-sm font-bold text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingName(false)}
                      className="rounded-lg bg-indigo-600 p-1.5 text-white hover:bg-indigo-500"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-base font-extrabold tracking-tight text-white sm:text-lg">
                      {unifiedHeading}
                    </h1>
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      title="戦略名を編集"
                      className="rounded-md p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* テンプレートを変更ドロップダウン */}
                <div ref={templateMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplateMenu((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-indigo-400/70 hover:text-white"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    テンプレートを変更
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>

                  {showTemplateMenu && (
                    <div className="absolute left-0 top-full z-40 mt-1.5 w-80 rounded-2xl border border-slate-700/90 bg-[#0d1527] p-2 shadow-2xl">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        公式デイトレ・テンプレート
                      </div>
                      <div className="space-y-1">
                        {PRESET_STRATEGIES.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleLoadStrategy(p)}
                            className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition ${
                              strategy.id === p.id
                                ? 'bg-indigo-500/20 text-indigo-200'
                                : 'text-slate-200 hover:bg-slate-800/80'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold">{p.name}</div>
                              <div className="text-[10px] text-slate-400">
                                {p.symbol} · {p.timeframe} · {p.category}
                              </div>
                            </div>
                            {strategy.id === p.id && (
                              <Check className="h-3.5 w-3.5 text-indigo-400" />
                            )}
                          </button>
                        ))}
                      </div>

                      {savedStrategies.length > 0 && (
                        <>
                          <div className="mt-2 border-t border-slate-800 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            保存済みのマイ戦略 ({savedStrategies.length})
                          </div>
                          <div className="max-h-40 space-y-1 overflow-y-auto">
                            {savedStrategies.map((s) => (
                              <div
                                key={s.id}
                                className="flex items-center justify-between rounded-xl px-2.5 py-1.5 hover:bg-slate-800/80"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleLoadStrategy(s)}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <div className="truncate text-xs font-semibold text-emerald-200">
                                    ★ {s.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {s.symbol} · {s.timeframe}
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSaved(s.id)}
                                  title="削除"
                                  className="ml-2 rounded p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <div className="mt-2 border-t border-slate-800 pt-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoadStrategy(PRESET_STRATEGIES[0])}
                          className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          初期テンプレートに戻す
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 右: 銘柄・時間足・連動スイッチ */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={strategy.symbol}
                  onChange={(e) => handleChangeSymbol(e.target.value as AssetSymbol)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs font-semibold text-sky-300 outline-none focus:border-sky-500"
                >
                  {AVAILABLE_ASSETS.map((a) => (
                    <option key={a.symbol} value={a.symbol}>
                      {a.symbol} ({a.category})
                    </option>
                  ))}
                  {customDataset && (
                    <option value="CUSTOM">CUSTOM ({customDataset.name})</option>
                  )}
                </select>
                <div className="inline-flex items-center rounded-xl border border-slate-800 bg-slate-950 p-0.5 font-mono text-xs">
                  {TIMEFRAME_ORDER.map((tf) => {
                    const isDayMain = tf === '15m' || tf === '30m';
                    return (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => handleChangeTimeframe(tf)}
                        title={`${TIMEFRAME_PROFILES[tf].label} (${TIMEFRAME_PROFILES[tf].styleTag})`}
                        className={`rounded-lg px-2 py-1 font-semibold transition ${
                          strategy.timeframe === tf
                            ? isDayMain
                              ? 'bg-emerald-600 text-white shadow'
                              : 'bg-sky-600 text-white'
                            : isDayMain
                            ? 'text-emerald-300/80 hover:text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tf}
                      </button>
                    );
                  })}
                </div>
                <label className="hidden cursor-pointer items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 text-[11px] text-slate-300 xl:inline-flex">
                  <input
                    type="checkbox"
                    checked={autoAdjustRiskOnTf}
                    onChange={() => setAutoAdjustRiskOnTf((v) => !v)}
                    className="accent-emerald-500"
                  />
                  時間足連動SL/TP
                </label>
              </div>
            </div>

            {/* 2行目: コンパクトな自然言語ルール + ミニ成績KPI */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-slate-200">
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                    買い
                  </span>
                  {summary.entryText.replace('のときに買いエントリー', '')}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-300">
                    売り
                  </span>
                  {summary.exitText}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums">
                <span>
                  <span className="text-slate-500">取引 </span>
                  <strong className="text-white">{metrics.totalTrades}回</strong>
                </span>
                <span>
                  <span className="text-slate-500">勝率 </span>
                  <strong className="text-white">{metrics.winRatePct.toFixed(1)}%</strong>
                </span>
                <span>
                  <span className="text-slate-500">リターン </span>
                  <strong
                    className={
                      metrics.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    {formatPct(metrics.totalReturnPct)}
                  </strong>
                </span>
                <span>
                  <span className="text-slate-500">MaxDD </span>
                  <strong className="text-rose-400">
                    -{metrics.maxDrawdownPct.toFixed(1)}%
                  </strong>
                </span>
              </div>
            </div>
          </section>

          {/* 待機中は1行バー / クリックで想定注文を展開 */}
          <LiveSignalCard
            strategy={strategy}
            dataset={dataset}
            result={backtestResult}
            dataSourceMode={dataSourceMode}
            liveLoading={liveLoading}
            liveError={liveError}
            onChangeDataSource={(mode) => {
              setDataSourceMode(mode);
              if (mode === 'live') {
                showToast('実取引所API（LIVE相場）モードへ切り替えました');
              } else {
                showToast('5年シミュレーションデータへ切り替えました');
              }
            }}
            onRefreshLive={() => fetchLiveMarket(strategy.symbol, strategy.timeframe)}
            onApplyAtrRisk={handleApplyAtrRisk}
          />

          {/* ノーコード・ブロックビルダー & 右側インスペクタ（ファーストビュー内に配置） */}
          <section className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <VisualFlowBuilder
                strategy={strategy}
                barCount={dataset.bars.length}
                selectedBlock={selectedBlock}
                onSelectBlock={setSelectedBlock}
                onToggleEntryLogic={() =>
                  updateStrategyWithImpact(
                    (prev) => ({
                      ...prev,
                      entryLogic: prev.entryLogic === 'AND' ? 'OR' : 'AND',
                    }),
                    '買い論理ゲート切替'
                  )
                }
                onToggleExitLogic={() =>
                  updateStrategyWithImpact(
                    (prev) => ({
                      ...prev,
                      exitLogic: prev.exitLogic === 'AND' ? 'OR' : 'AND',
                    }),
                    '売り論理ゲート切替'
                  )
                }
                onAddEntryRule={handleAddEntryRule}
                onAddExitRule={handleAddExitRule}
              />
            </div>
            <div className="lg:col-span-4">
              <RuleInspector
                strategy={strategy}
                selectedBlock={selectedBlock}
                customDataset={customDataset}
                currentMetrics={metrics}
                lastChangeImpact={lastChangeImpact}
                onUndoLastChange={handleUndoLastChange}
                latestPrice={backtestResult.liveSignal.latestPrice}
                latestAtr={backtestResult.liveSignal.atrValue}
                autoAdjustRiskOnTf={autoAdjustRiskOnTf}
                onToggleAutoAdjustRisk={() => setAutoAdjustRiskOnTf((v) => !v)}
                onChangeTimeframe={handleChangeTimeframe}
                onApplyAtrRisk={handleApplyAtrRisk}
                onChangeStrategy={updateStrategyWithImpact}
                onSelectBlock={setSelectedBlock}
                onUploadCustomCsv={(ds) => {
                  setCustomDataset(ds);
                  setLastChangeImpact(null);
                  setStrategy((prev) => ({ ...prev, symbol: 'CUSTOM', timeframe: '1D' }));
                  showToast(`独自CSV「${ds.name}」(${ds.bars.length}本) を読み込みました！`);
                }}
              />
            </div>
          </section>

          {/* バックテスト結果分析セクション */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-800 bg-[#0b1220] p-1.5">
                {[
                  { id: 'chart', label: 'チャート & シグナル', icon: LineChart },
                  { id: 'analytics', label: '資産曲線 & 月次分析', icon: BarChart2 },
                  { id: 'portfolio', label: '全銘柄スキャン & ポートフォリオ分散', icon: Layers },
                  { id: 'quantlab', label: 'クオンツラボ（最適化 / モンテカルロ / 出力）', icon: FlaskConical },
                  { id: 'trades', label: `トレード履歴 (${backtestResult.trades.length})`, icon: ListOrdered },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = analysisTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAnalysisTab(tab.id as AnalysisTab)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                        active
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/60'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-400">
                データ期間: <span className="font-mono text-slate-200">{dataset.name}</span> ({dataset.bars.length.toLocaleString()}本)
              </div>
            </div>

            {analysisTab === 'chart' && <TradingChart result={backtestResult} />}
            {analysisTab === 'analytics' && <EquityAndAnalytics result={backtestResult} />}
            {analysisTab === 'portfolio' && (
              <PortfolioPanel
                strategy={strategy}
                onSwitchSymbol={(sym) => {
                  setStrategy((prev) => ({ ...prev, symbol: sym }));
                  setAnalysisTab('chart');
                  showToast(`${sym} のチャート＆検証画面へ切り替えました`);
                }}
              />
            )}
            {analysisTab === 'quantlab' && (
              <QuantLabPanel
                strategy={strategy}
                bars={dataset.bars}
                result={backtestResult}
                planTier={planTier}
                onApplyOptimizedCell={handleApplyOptimizedCell}
                onOpenPricing={() => setShowPricing(true)}
              />
            )}
            {analysisTab === 'trades' && <TradeLogTable result={backtestResult} />}
          </section>
        </main>
      )}

      {showPricing && (
        <PricingModal
          currentPlan={planTier}
          onSelectPlan={handleSelectPlan}
          onClose={() => setShowPricing(false)}
        />
      )}

      {showShareCard && (
        <ShareCardModal
          strategy={strategy}
          dataset={dataset}
          result={backtestResult}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </div>
  );
}
