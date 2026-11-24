import React from 'react';
import { Download } from 'lucide-react';
import type { BacktestResult, ExitReason } from '../types/quant';
import { formatCurrency, formatDateTime, formatPct, formatPrice } from '../utils/format';

interface TradeLogTableProps {
  result: BacktestResult;
}

const REASON_BADGE: Record<ExitReason, { label: string; cls: string }> = {
  SIGNAL: { label: '売りシグナル', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  TAKE_PROFIT: { label: '利確 TP', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  STOP_LOSS: { label: '損切り SL', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  TRAILING_STOP: { label: 'トレーリング', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  END_OF_DATA: { label: '期間終了', cls: 'bg-slate-700/40 text-slate-300 border-slate-600' },
};

export const TradeLogTable: React.FC<TradeLogTableProps> = ({ result }) => {
  const handleExportCsv = () => {
    const header = [
      'id',
      'side',
      'entry_time',
      'exit_time',
      'entry_price',
      'exit_price',
      'holding_bars',
      'exit_reason',
      'net_pnl',
      'return_pct',
      'equity_after',
    ];
    const rows = result.trades.map((t) => [
      t.id,
      t.side,
      formatDateTime(t.entryTime, true),
      formatDateTime(t.exitTime, true),
      t.entryPrice.toFixed(4),
      t.exitPrice.toFixed(4),
      t.holdingBars,
      t.exitReason,
      t.netPnl.toFixed(2),
      t.returnPct.toFixed(2),
      t.equityAfter.toFixed(2),
    ]);

    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantblock_trades_${result.symbol}_${result.timeframe}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="hud-panel rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">
            トレード履歴ログ（全 {result.trades.length} 件）
          </h3>
          <p className="text-[11px] text-slate-400">
            手数料・スリッページ控除後の約定ごとの純損益明細
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={result.trades.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          CSVエクスポート
        </button>
      </div>

      {result.trades.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 py-10 text-center text-xs text-slate-400">
          現在の条件ではトレードが発生しませんでした。ブロックの閾値や期間を緩めてみてください。
        </div>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full border-collapse text-left font-mono text-xs tabular-nums">
            <thead className="sticky top-0 bg-[#0b1220] text-[11px] text-slate-400">
              <tr className="border-b border-slate-800">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">方向</th>
                <th className="py-2 pr-3">エントリー</th>
                <th className="py-2 pr-3">決済日時</th>
                <th className="py-2 pr-3 text-right">建値</th>
                <th className="py-2 pr-3 text-right">決済値</th>
                <th className="py-2 pr-3 text-right">保有</th>
                <th className="py-2 pr-3">決済理由</th>
                <th className="py-2 pr-3 text-right">純損益</th>
                <th className="py-2 text-right">リターン</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {result.trades
                .slice()
                .reverse()
                .map((t) => {
                  const badge = REASON_BADGE[t.exitReason];
                  const isWin = t.netPnl >= 0;
                  return (
                    <tr key={t.id} className="hover:bg-slate-900/60">
                      <td className="py-2 pr-3 text-slate-500">{t.id}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            t.side === 'LONG'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-purple-500/20 text-purple-300'
                          }`}
                        >
                          {t.side}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {formatDateTime(t.entryTime, result.timeframe !== '1D')}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {formatDateTime(t.exitTime, result.timeframe !== '1D')}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-200">
                        {formatPrice(t.entryPrice, result.symbol)}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-200">
                        {formatPrice(t.exitPrice, result.symbol)}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-400">{t.holdingBars}本</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 font-sans text-[10px] font-semibold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td
                        className={`py-2 pr-3 text-right font-semibold ${
                          isWin ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isWin ? '+' : ''}
                        {formatCurrency(t.netPnl)}
                      </td>
                      <td
                        className={`py-2 text-right font-bold ${
                          isWin ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {formatPct(t.returnPct)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
