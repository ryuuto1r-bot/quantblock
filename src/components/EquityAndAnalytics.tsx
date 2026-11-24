import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  Activity,
  ShieldAlert,
  Award,
  BarChart3,
  Clock,
  Zap,
  Target,
} from 'lucide-react';
import type { BacktestResult } from '../types/quant';
import { formatCurrency, formatDateTime, formatPct } from '../utils/format';

interface EquityAndAnalyticsProps {
  result: BacktestResult;
}

export const EquityAndAnalytics: React.FC<EquityAndAnalyticsProps> = ({ result }) => {
  const { metrics, equityCurve, monthlyReturns } = result;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // 描画負荷を抑えるため最大260ポイントに間引き
  const sampled = useMemo(() => {
    const n = equityCurve.length;
    if (n <= 260) return equityCurve;
    const step = (n - 1) / 259;
    const out = [];
    for (let i = 0; i < 260; i++) {
      out.push(equityCurve[Math.round(i * step)]);
    }
    return out;
  }, [equityCurve]);

  const chartGeometry = useMemo(() => {
    const w = 780;
    const hEq = 210;
    const hDd = 76;
    const padL = 62;
    const padR = 16;
    const padT = 14;
    const padB = 14;
    const innerW = w - padL - padR;

    const allEq = sampled.flatMap((p) => [p.equity, p.buyHoldEquity]);
    const minEq = Math.min(...allEq) * 0.96;
    const maxEq = Math.max(...allEq) * 1.04;
    const eqRange = Math.max(1, maxEq - minEq);

    const minDd = Math.min(-5, ...sampled.map((p) => p.drawdownPct));

    const xOf = (i: number) =>
      padL + (sampled.length > 1 ? (i / (sampled.length - 1)) * innerW : 0);
    const yEq = (v: number) => padT + ((maxEq - v) / eqRange) * (hEq - padT - padB);
    const yDd = (v: number) => 8 + ((0 - v) / Math.max(1, -minDd)) * (hDd - 18);

    const stratPath = sampled
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yEq(p.equity).toFixed(1)}`)
      .join(' ');
    const bhPath = sampled
      .map(
        (p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yEq(p.buyHoldEquity).toFixed(1)}`
      )
      .join(' ');
    const stratArea = `${stratPath} L${xOf(sampled.length - 1).toFixed(1)},${(hEq - padB).toFixed(
      1
    )} L${xOf(0).toFixed(1)},${(hEq - padB).toFixed(1)} Z`;

    const ddPath = sampled
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yDd(p.drawdownPct).toFixed(1)}`)
      .join(' ');
    const ddArea = `${ddPath} L${xOf(sampled.length - 1).toFixed(1)},8 L${xOf(0).toFixed(
      1
    )},8 Z`;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      val: minEq + t * eqRange,
      y: yEq(minEq + t * eqRange),
    }));

    return {
      w,
      hEq,
      hDd,
      padL,
      padR,
      stratPath,
      bhPath,
      stratArea,
      ddPath,
      ddArea,
      yTicks,
      minDd,
      xOf,
      yEq,
    };
  }, [sampled]);

  // 年×月のヒートマップデータ整形
  const years = useMemo(() => {
    const ys = Array.from(new Set(monthlyReturns.map((m) => m.year))).sort((a, b) => a - b);
    return ys;
  }, [monthlyReturns]);

  const monthLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of monthlyReturns) {
      map.set(`${m.year}-${m.month}`, m.returnPct);
    }
    return map;
  }, [monthlyReturns]);

  const hovered = hoverIdx !== null ? sampled[hoverIdx] : null;

  const kpiCards = [
    {
      label: '総リターン (累積)',
      value: formatPct(metrics.totalReturnPct),
      sub: `最終資産 ${formatCurrency(metrics.finalEquity)}`,
      tone: metrics.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400',
      icon: TrendingUp,
    },
    {
      label: '対 Buy & Hold アルファ',
      value: formatPct(metrics.alphaPct),
      sub: `単純保有 ${formatPct(metrics.buyHoldReturnPct)}`,
      tone: metrics.alphaPct >= 0 ? 'text-indigo-300' : 'text-amber-400',
      icon: Zap,
    },
    {
      label: '勝率 (Win Rate)',
      value: `${metrics.winRatePct.toFixed(1)}%`,
      sub: `${metrics.winningTrades}勝 / ${metrics.losingTrades}敗 (計${metrics.totalTrades}回)`,
      tone: metrics.winRatePct >= 50 ? 'text-emerald-400' : 'text-slate-200',
      icon: Target,
    },
    {
      label: 'プロフィットファクター',
      value: metrics.profitFactor.toFixed(2),
      sub: `ペイオフ比 ${metrics.payoffRatio.toFixed(2)}`,
      tone: metrics.profitFactor >= 1.5 ? 'text-emerald-400' : metrics.profitFactor >= 1 ? 'text-amber-300' : 'text-rose-400',
      icon: Award,
    },
    {
      label: 'シャープレシオ',
      value: metrics.sharpeRatio.toFixed(2),
      sub: `ソルティノ ${metrics.sortinoRatio.toFixed(2)}`,
      tone: metrics.sharpeRatio >= 1.5 ? 'text-sky-400' : metrics.sharpeRatio >= 0.8 ? 'text-slate-200' : 'text-rose-400',
      icon: Activity,
    },
    {
      label: '最大ドローダウン',
      value: `-${metrics.maxDrawdownPct.toFixed(2)}%`,
      sub: `最長回復 ${metrics.maxDrawdownDurationBars} 本`,
      tone: metrics.maxDrawdownPct <= 15 ? 'text-emerald-400' : metrics.maxDrawdownPct <= 30 ? 'text-amber-400' : 'text-rose-400',
      icon: ShieldAlert,
    },
    {
      label: '年率換算リターン (CAGR)',
      value: formatPct(metrics.cagrPct),
      sub: `カルマー比 ${metrics.calmarRatio.toFixed(2)}`,
      tone: metrics.cagrPct >= 0 ? 'text-emerald-300' : 'text-rose-400',
      icon: BarChart3,
    },
    {
      label: '1トレード期待値',
      value: formatPct(metrics.expectancyPct),
      sub: `平均保有 ${metrics.avgHoldingBars.toFixed(1)}本 · 手数料 ${formatCurrency(metrics.totalFees)}`,
      tone: metrics.expectancyPct >= 0 ? 'text-emerald-400' : 'text-rose-400',
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPIグリッド */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-800/90 bg-[#0c1322] p-3.5 transition hover:border-slate-700"
            >
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                <span>{kpi.label}</span>
                <Icon className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <div className={`mt-1.5 font-mono text-xl font-bold tabular-nums ${kpi.tone}`}>
                {kpi.value}
              </div>
              <div className="mt-1 text-[11px] text-slate-400 tabular-nums">{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {/* 資産曲線 & ドローダウン */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0b1220] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">資産推移（Equity Curve） & ドローダウン</h3>
            <p className="text-[11px] text-slate-400">
              バックテスト実行時間: <span className="font-mono text-emerald-400">{metrics.executionTimeMs.toFixed(1)} ms</span>
              {' · '}市場エクスポージャー: <span className="font-mono text-slate-200">{metrics.exposurePct.toFixed(1)}%</span>
              {' · '}最大連勝 {metrics.maxConsecutiveWins} / 最大連敗 {metrics.maxConsecutiveLosses}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> アルゴリズム資産
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <span className="h-0.5 w-4 bg-slate-400" /> Buy &amp; Hold
            </span>
          </div>
        </div>

        {/* ホバー中のスナップショットバー */}
        <div className="mb-2 flex min-h-[24px] flex-wrap items-center gap-4 rounded-lg bg-slate-950/70 px-3 py-1 font-mono text-[11px] tabular-nums">
          {hovered ? (
            <>
              <span className="text-slate-400">日時: {formatDateTime(hovered.time)}</span>
              <span className="text-emerald-400">
                戦略資産: {formatCurrency(hovered.equity)}
              </span>
              <span className="text-slate-300">
                Buy &amp; Hold: {formatCurrency(hovered.buyHoldEquity)}
              </span>
              <span className="text-rose-400">DD: {hovered.drawdownPct.toFixed(2)}%</span>
            </>
          ) : (
            <span className="text-slate-500">
              グラフ上にカーソルを合わせると各時点の資産評価額・ドローダウンを確認できます
            </span>
          )}
        </div>

        <svg
          viewBox={`0 0 ${chartGeometry.w} ${chartGeometry.hEq}`}
          className="h-52 w-full select-none"
          onMouseLeave={() => setHoverIdx(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * chartGeometry.w;
            const innerW = chartGeometry.w - chartGeometry.padL - chartGeometry.padR;
            const ratio = Math.min(1, Math.max(0, (relX - chartGeometry.padL) / innerW));
            setHoverIdx(Math.round(ratio * (sampled.length - 1)));
          }}
        >
          <defs>
            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {chartGeometry.yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={chartGeometry.padL}
                x2={chartGeometry.w - chartGeometry.padR}
                y1={t.y}
                y2={t.y}
                stroke="rgba(148,163,184,0.1)"
              />
              <text
                x={chartGeometry.padL - 8}
                y={t.y + 4}
                textAnchor="end"
                fill="#64748b"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {t.val >= 1000000
                  ? `${(t.val / 1000000).toFixed(1)}M`
                  : `${Math.round(t.val / 1000)}k`}
              </text>
            </g>
          ))}

          <path d={chartGeometry.stratArea} fill="url(#eqGrad)" />
          <path
            d={chartGeometry.bhPath}
            fill="none"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <path
            d={chartGeometry.stratPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.4"
          />

          {hoverIdx !== null && hovered && (
            <g>
              <line
                x1={chartGeometry.xOf(hoverIdx)}
                x2={chartGeometry.xOf(hoverIdx)}
                y1={10}
                y2={chartGeometry.hEq - 10}
                stroke="#6366f1"
                strokeDasharray="3 3"
              />
              <circle
                cx={chartGeometry.xOf(hoverIdx)}
                cy={chartGeometry.yEq(hovered.equity)}
                r={4.5}
                fill="#10b981"
                stroke="#070b14"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* ドローダウン水中グラフ */}
        <div className="mt-1 border-t border-slate-800/80 pt-2">
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>ドローダウン推移 (Underwater Curve)</span>
            <span className="font-mono text-rose-400">
              最大 {chartGeometry.minDd.toFixed(1)}%
            </span>
          </div>
          <svg
            viewBox={`0 0 ${chartGeometry.w} ${chartGeometry.hDd}`}
            className="h-20 w-full select-none"
          >
            <line
              x1={chartGeometry.padL}
              x2={chartGeometry.w - chartGeometry.padR}
              y1={8}
              y2={8}
              stroke="rgba(148,163,184,0.2)"
            />
            <path d={chartGeometry.ddArea} fill="rgba(244,63,94,0.22)" />
            <path d={chartGeometry.ddPath} fill="none" stroke="#f43f5e" strokeWidth="1.6" />
          </svg>
        </div>
      </div>

      {/* 月次リターンヒートマップ */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0b1220] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">月次リターン・ヒートマップ (%)</h3>
            <p className="text-[11px] text-slate-400">
              年・月ごとの収益安定性と季節性（ドローダウン局面）を一覧化
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center font-mono text-[11px] tabular-nums">
            <thead>
              <tr className="text-slate-400">
                <th className="py-1.5 pr-2 text-left font-sans font-semibold">年</th>
                {Array.from({ length: 12 }, (_, m) => (
                  <th key={m} className="px-1 py-1.5 font-medium">
                    {m + 1}月
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right font-sans font-semibold">年間計</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => {
                let annualComp = 1;
                return (
                  <tr key={year} className="border-t border-slate-800/70">
                    <td className="py-1.5 pr-2 text-left font-semibold text-slate-300">{year}</td>
                    {Array.from({ length: 12 }, (_, idx) => {
                      const val = monthLookup.get(`${year}-${idx + 1}`);
                      if (val === undefined) {
                        return (
                          <td key={idx} className="px-1 py-1 text-slate-600">
                            —
                          </td>
                        );
                      }
                      annualComp *= 1 + val / 100;
                      const intensity = Math.min(1, Math.abs(val) / 18);
                      const bg =
                        val > 0.05
                          ? `rgba(16, 185, 129, ${0.12 + intensity * 0.45})`
                          : val < -0.05
                          ? `rgba(244, 63, 94, ${0.12 + intensity * 0.45})`
                          : 'rgba(51, 65, 85, 0.25)';
                      return (
                        <td key={idx} className="p-0.5">
                          <div
                            style={{ backgroundColor: bg }}
                            className={`rounded py-1 font-medium ${
                              val > 0.05
                                ? 'text-emerald-200'
                                : val < -0.05
                                ? 'text-rose-200'
                                : 'text-slate-400'
                            }`}
                          >
                            {val >= 0 ? '+' : ''}
                            {val.toFixed(1)}
                          </div>
                        </td>
                      );
                    })}
                    <td
                      className={`px-2 py-1 text-right font-bold ${
                        annualComp >= 1 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {annualComp >= 1 ? '+' : ''}
                      {((annualComp - 1) * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
