import React, { useMemo, useState } from 'react';
import { Layers, ShieldCheck, ArrowRight, CheckSquare, Square, Sparkles } from 'lucide-react';
import type { AssetSymbol, StrategySpec } from '../types/quant';
import { runMultiAssetPortfolioAnalysis } from '../engine/portfolio';
import { formatPct, formatPrice } from '../utils/format';

interface PortfolioPanelProps {
  strategy: StrategySpec;
  onSwitchSymbol: (symbol: Exclude<AssetSymbol, 'CUSTOM'>) => void;
}

export const PortfolioPanel: React.FC<PortfolioPanelProps> = ({
  strategy,
  onSwitchSymbol,
}) => {
  const [selected, setSelected] = useState<Exclude<AssetSymbol, 'CUSTOM'>[]>([
    'BTCUSDT',
    'ETHUSDT',
    'USDJPY',
    'NVDA',
    'N225',
  ]);

  const analysis = useMemo(
    () => runMultiAssetPortfolioAnalysis(strategy, selected),
    [strategy, selected]
  );

  const toggleSymbol = (sym: Exclude<AssetSymbol, 'CUSTOM'>) => {
    setSelected((prev) => {
      if (prev.includes(sym)) {
        if (prev.length <= 1) return prev;
        return prev.filter((s) => s !== sym);
      }
      return [...prev, sym];
    });
  };

  // 合成ポートフォリオ資産曲線SVGジオメトリ
  const curveSvg = useMemo(() => {
    const pts = analysis.portfolioEquity;
    const w = 720;
    const h = 165;
    const padL = 56;
    const padR = 14;
    const padT = 12;
    const padB = 14;

    const sampled =
      pts.length <= 220
        ? pts
        : Array.from({ length: 220 }, (_, i) => pts[Math.round((i / 219) * (pts.length - 1))]);

    const vals = sampled.map((p) => p.equity);
    const minV = Math.min(...vals) * 0.96;
    const maxV = Math.max(...vals) * 1.04;
    const range = Math.max(1, maxV - minV);

    const xOf = (i: number) =>
      padL + (sampled.length > 1 ? (i / (sampled.length - 1)) * (w - padL - padR) : 0);
    const yOf = (v: number) => padT + ((maxV - v) / range) * (h - padT - padB);

    const line = sampled
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.equity).toFixed(1)}`)
      .join(' ');
    const area = `${line} L${xOf(sampled.length - 1).toFixed(1)},${(h - padB).toFixed(
      1
    )} L${xOf(0).toFixed(1)},${(h - padB).toFixed(1)} Z`;

    return { w, h, padL, padR, padT, padB, line, area, minV, maxV };
  }, [analysis.portfolioEquity]);

  return (
    <div className="space-y-5">
      {/* サマリーKPI */}
      <div className="hud-panel rounded-2xl p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Layers className="h-4 w-4 text-indigo-400" />
              全5銘柄一括スクリーニング &amp; ポートフォリオ分散効果（金融工学）
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              現在のノーコード戦略を仮想通貨・FX・米国株・先物の全5銘柄へ{' '}
              <span className="font-mono text-emerald-400">
                {analysis.executionTimeMs.toFixed(1)} ms
              </span>{' '}
              で同時検証。選択銘柄への均等分散によるドローダウン低減効果と相関を可視化します。
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            分散採用: {selected.length} 銘柄（各 {(100 / selected.length).toFixed(0)}%）
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-[11px] text-slate-400">合成ポートフォリオ累積リターン</div>
            <div
              className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                analysis.portfolioReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatPct(analysis.portfolioReturnPct)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-[11px] text-slate-400">合成シャープレシオ</div>
            <div className="mt-1 font-mono text-lg font-bold text-sky-400 tabular-nums">
              {analysis.portfolioSharpe.toFixed(2)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-[11px] text-slate-400">合成最大ドローダウン</div>
            <div className="mt-1 font-mono text-lg font-bold text-rose-300 tabular-nums">
              -{analysis.portfolioMaxDdPct.toFixed(2)}%
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
            <div className="flex items-center gap-1 text-[11px] text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              分散によるDD削減効果
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-emerald-400 tabular-nums">
              -{analysis.ddReductionPct.toFixed(2)} pt
            </div>
            <div className="text-[10px] text-slate-400">
              単独平均 -{analysis.avgSingleMaxDdPct.toFixed(1)}% → 合成 -
              {analysis.portfolioMaxDdPct.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* 合成資産曲線 */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-[#070c17] p-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>マルチアセット合成資産曲線（均等リバランスモデル）</span>
            <span className="font-mono text-indigo-300">
              {selected.join(' + ')}
            </span>
          </div>
          <svg viewBox={`0 0 ${curveSvg.w} ${curveSvg.h}`} className="h-40 w-full">
            <defs>
              <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <text
              x={curveSvg.padL - 8}
              y={curveSvg.padT + 8}
              textAnchor="end"
              fill="#64748b"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {(curveSvg.maxV / 1000000).toFixed(1)}M
            </text>
            <text
              x={curveSvg.padL - 8}
              y={curveSvg.h - curveSvg.padB}
              textAnchor="end"
              fill="#64748b"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {(curveSvg.minV / 1000000).toFixed(1)}M
            </text>
            <path d={curveSvg.area} fill="url(#portGrad)" />
            <path d={curveSvg.line} fill="none" stroke="#818cf8" strokeWidth="2.4" />
          </svg>
        </div>
      </div>

      {/* 下段: 銘柄別スクリーニング一覧 & 相関係数マトリクス */}
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="hud-panel rounded-2xl p-4 xl:col-span-7">
          <h4 className="mb-3 text-sm font-bold text-white">
            銘柄別エッジ比較テーブル（クリックで分散ON/OFF・チャート切替）
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left font-mono text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="py-2 pr-2 font-sans">分散</th>
                  <th className="py-2 pr-3 font-sans">銘柄</th>
                  <th className="py-2 pr-3 text-right">リターン</th>
                  <th className="py-2 pr-3 text-right">勝率</th>
                  <th className="py-2 pr-3 text-right">Sharpe</th>
                  <th className="py-2 pr-3 text-right">MaxDD</th>
                  <th className="py-2 text-right font-sans">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {analysis.rows.map((row) => {
                  const isChecked = selected.includes(row.symbol);
                  return (
                    <tr key={row.symbol} className="hover:bg-slate-900/60">
                      <td className="py-2.5 pr-2">
                        <button
                          type="button"
                          onClick={() => toggleSymbol(row.symbol)}
                          className="text-indigo-400 hover:text-indigo-300"
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-600" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-bold text-white">{row.symbol}</div>
                        <div className="font-sans text-[10px] text-slate-400">
                          {row.category} · {formatPrice(row.latestPrice, row.symbol)}
                        </div>
                      </td>
                      <td
                        className={`py-2.5 pr-3 text-right font-bold ${
                          row.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatPct(row.totalReturnPct)}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-slate-200">
                        {row.winRatePct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-sky-400">
                        {row.sharpeRatio.toFixed(2)}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-rose-400">
                        -{row.maxDrawdownPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onSwitchSymbol(row.symbol)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 font-sans text-[10px] font-semibold text-slate-200 hover:border-indigo-400 hover:text-white"
                        >
                          検証へ
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 相関係数マトリクス */}
        <div className="hud-panel rounded-2xl p-4 xl:col-span-5">
          <h4 className="mb-1 text-sm font-bold text-white">戦略リターン相関係数マトリクス</h4>
          <p className="mb-3 text-[11px] text-slate-400">
            相関が低い（0に近い・マイナス）銘柄同士を組み合わせるほど、リターンを維持したまま最大ドローダウンを抑えられます。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-center font-mono text-[11px] tabular-nums">
              <thead>
                <tr className="text-slate-400">
                  <th className="p-1.5 text-left" />
                  {analysis.correlations.symbols.map((s) => (
                    <th key={s} className="p-1.5 font-semibold">
                      {s.replace('USDT', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.correlations.symbols.map((rowSym, rIdx) => (
                  <tr key={rowSym}>
                    <td className="p-1.5 text-left font-semibold text-slate-300">
                      {rowSym.replace('USDT', '')}
                    </td>
                    {analysis.correlations.matrix[rIdx].map((corr, cIdx) => {
                      const abs = Math.min(1, Math.abs(corr));
                      const bg =
                        rIdx === cIdx
                          ? 'rgba(99, 102, 241, 0.28)'
                          : corr > 0.25
                          ? `rgba(244, 63, 94, ${0.12 + abs * 0.35})`
                          : `rgba(16, 185, 129, ${0.12 + (1 - abs) * 0.22})`;
                      return (
                        <td
                          key={cIdx}
                          style={{ backgroundColor: bg }}
                          className="rounded-lg p-2 font-semibold text-slate-100"
                        >
                          {corr.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
