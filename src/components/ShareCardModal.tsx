import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Link2, Share2, X } from 'lucide-react';
import type { BacktestResult, MarketDataset, StrategySpec } from '../types/quant';
import { formatPct, strategyToNaturalSummary } from '../utils/format';
import { encodeStrategyToShareUrl } from '../utils/shareUrl';

interface ShareCardModalProps {
  strategy: StrategySpec;
  dataset: MarketDataset;
  result: BacktestResult;
  onClose: () => void;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  strategy,
  dataset,
  result,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const { metrics } = result;
  const summary = strategyToNaturalSummary(strategy);
  const shareUrl = useMemo(() => encodeStrategyToShareUrl(strategy), [strategy]);

  const tweetText = [
    `【QuantBlock ノーコード検証レポート】`,
    `戦略: ${strategy.name} (${strategy.symbol} / ${strategy.timeframe})`,
    `・総リターン: ${formatPct(metrics.totalReturnPct)} (勝率 ${metrics.winRatePct.toFixed(1)}%)`,
    `・シャープレシオ: ${metrics.sharpeRatio.toFixed(2)} / PF: ${metrics.profitFactor.toFixed(2)}`,
    `・最大ドローダウン: -${metrics.maxDrawdownPct.toFixed(1)}%`,
    shareUrl,
    `#QuantBlock #システムトレード #バックテスト`,
  ].join('\n');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1200;
    const H = 630;
    canvas.width = W;
    canvas.height = H;

    // 背景グラデーション
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#090f1e');
    bg.addColorStop(0.55, '#0b1328');
    bg.addColorStop(1, '#070b14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 装飾グロー
    const g1 = ctx.createRadialGradient(1020, 80, 10, 1020, 80, 320);
    g1.addColorStop(0, 'rgba(99, 102, 241, 0.28)');
    g1.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    const g2 = ctx.createRadialGradient(180, 560, 10, 180, 560, 280);
    g2.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
    g2.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // 外枠
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    // ブランドロゴテキスト
    ctx.fillStyle = '#818cf8';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText('QuantBlock  |  NO-CODE ALGO BACKTEST REPORT', 60, 78);

    // 銘柄・ソースバッジ
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 18px JetBrains Mono, monospace';
    const sourceLabel =
      dataset.source === 'live'
        ? `LIVE: ${dataset.provider || 'Exchange API'}`
        : dataset.source === 'csv'
        ? `CSV: ${dataset.name}`
        : '5Y SIMULATION';
    ctx.fillText(
      `${strategy.symbol} · ${strategy.timeframe} · ${dataset.bars.length} bars · ${sourceLabel}`,
      60,
      112
    );

    // 戦略タイトル
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Noto Sans JP", Inter, sans-serif';
    ctx.fillText(strategy.name.slice(0, 32), 60, 168);

    // ルール要約
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 17px "Noto Sans JP", sans-serif';
    ctx.fillText(`BUY: ${summary.entryText.slice(0, 62)}`, 60, 206);

    // 4つの主要KPIカード
    const kpis = [
      {
        label: 'TOTAL RETURN',
        val: formatPct(metrics.totalReturnPct),
        color: metrics.totalReturnPct >= 0 ? '#34d399' : '#fb7185',
      },
      {
        label: 'WIN RATE',
        val: `${metrics.winRatePct.toFixed(1)}%`,
        color: '#f8fafc',
      },
      {
        label: 'SHARPE RATIO',
        val: metrics.sharpeRatio.toFixed(2),
        color: '#38bdf8',
      },
      {
        label: 'MAX DRAWDOWN',
        val: `-${metrics.maxDrawdownPct.toFixed(1)}%`,
        color: '#fb7185',
      },
    ];

    kpis.forEach((k, idx) => {
      const x = 60 + idx * 274;
      const y = 236;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(x, y, 254, 108);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, 254, 108);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px JetBrains Mono, monospace';
      ctx.fillText(k.label, x + 20, y + 32);

      ctx.fillStyle = k.color;
      ctx.font = 'bold 36px JetBrains Mono, monospace';
      ctx.fillText(k.val, x + 20, y + 84);
    });

    // 資産曲線エリア描画
    const chartX = 60;
    const chartY = 374;
    const chartW = 1080;
    const chartH = 186;

    ctx.fillStyle = 'rgba(7, 12, 23, 0.9)';
    ctx.fillRect(chartX, chartY, chartW, chartH);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.strokeRect(chartX, chartY, chartW, chartH);

    const curve = result.equityCurve;
    if (curve.length > 2) {
      const vals = curve.map((c) => c.equity);
      const minV = Math.min(...vals) * 0.96;
      const maxV = Math.max(...vals) * 1.04;
      const range = Math.max(1, maxV - minV);

      const xOf = (i: number) => chartX + 14 + (i / (curve.length - 1)) * (chartW - 28);
      const yOf = (v: number) =>
        chartY + 18 + ((maxV - v) / range) * (chartH - 36);

      // Buy & Hold 点線
      ctx.beginPath();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 2;
      curve.forEach((pt, i) => {
        const px = xOf(i);
        const py = Math.min(chartY + chartH - 12, Math.max(chartY + 12, yOf(pt.buyHoldEquity)));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // 戦略資産曲線
      ctx.beginPath();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3.5;
      curve.forEach((pt, i) => {
        const px = xOf(i);
        const py = yOf(pt.equity);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    // フッター
    ctx.fillStyle = '#64748b';
    ctx.font = '600 15px JetBrains Mono, monospace';
    ctx.fillText(
      `PF: ${metrics.profitFactor.toFixed(2)}  |  TRADES: ${metrics.totalTrades}  |  MODE: ${
        strategy.execution.allowShort ? 'LONG & SHORT' : 'LONG ONLY'
      }  |  SL -${strategy.execution.stopLossPct}% / TP +${strategy.execution.takeProfitPct}%`,
      60,
      588
    );
  }, [strategy, dataset, result, metrics, summary.entryText]);

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantblock_report_${strategy.symbol}_${strategy.timeframe}.png`;
    a.click();
  };

  const handleCopyTweet = async () => {
    await navigator.clipboard.writeText(tweetText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1800);
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1800);
  };

  const handleOpenX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700/80 bg-[#0b1120] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
            <Share2 className="h-3.5 w-3.5" />
            URL共有 &amp; OGP検証カード（1200×630 PNG）
          </div>
          <h3 className="mt-2 text-xl font-extrabold text-white">
            この戦略をURLや画像でシェア
          </h3>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
          <canvas ref={canvasRef} className="block h-auto w-full" />
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-sky-500"
          >
            {copiedUrl ? (
              <>
                <Check className="h-4 w-4" /> 共有URLをコピー済
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" /> この戦略のURLをコピー
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500"
          >
            <Download className="h-4 w-4" />
            PNG画像を保存
          </button>
          <button
            type="button"
            onClick={handleCopyTweet}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-800"
          >
            {copiedText ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" /> 投稿文をコピー済
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> 投稿文をコピー
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleOpenX}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-500"
          >
            <Share2 className="h-4 w-4" />
            X でシェア
          </button>
        </div>
      </div>
    </div>
  );
};
