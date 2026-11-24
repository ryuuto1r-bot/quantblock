import React, { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { BacktestResult } from '../types/quant';

interface TradingChartProps {
  result: BacktestResult;
}

export const TradingChart: React.FC<TradingChartProps> = ({ result }) => {
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const oscContainerRef = useRef<HTMLDivElement>(null);

  const mainOverlays = result.overlays.filter((o) => o.pane === 'main');
  const oscOverlays = result.overlays.filter((o) => o.pane === 'oscillator');

  useEffect(() => {
    const mainEl = mainContainerRef.current;
    if (!mainEl) return;

    const chart: IChartApi = createChart(mainEl, {
      layout: {
        background: { type: ColorType.Solid, color: '#040916' },
        textColor: '#94a3b8',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(34, 211, 238, 0.06)' },
        horzLines: { color: 'rgba(34, 211, 238, 0.06)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#22d3ee', labelBackgroundColor: '#0891b2' },
        horzLine: { color: '#22d3ee', labelBackgroundColor: '#0891b2' },
      },
      rightPriceScale: {
        borderColor: 'rgba(34, 211, 238, 0.16)',
      },
      timeScale: {
        borderColor: 'rgba(34, 211, 238, 0.16)',
        timeVisible: result.timeframe !== '1D',
      },
      width: mainEl.clientWidth,
      height: oscOverlays.length > 0 ? 330 : 410,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00e5a8',
      downColor: '#ff3b6b',
      borderVisible: false,
      wickUpColor: '#00e5a8',
      wickDownColor: '#ff3b6b',
    });

    candleSeries.setData(
      result.bars.map((b) => ({
        time: b.time as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );

    // 売買シグナルマーカー（LONG / SHORT 両対応）
    const markers: SeriesMarker<Time>[] = [];
    for (const t of result.trades) {
      const isShort = t.side === 'SHORT';
      markers.push({
        time: t.entryTime as UTCTimestamp,
        position: isShort ? 'aboveBar' : 'belowBar',
        color: isShort ? '#a855f7' : '#10b981',
        shape: isShort ? 'arrowDown' : 'arrowUp',
        text: isShort ? 'SHORT' : 'BUY',
      });
      const exitTag =
        t.exitReason === 'TAKE_PROFIT'
          ? 'TP'
          : t.exitReason === 'STOP_LOSS'
          ? 'SL'
          : t.exitReason === 'TRAILING_STOP'
          ? 'TS'
          : 'EXIT';
      markers.push({
        time: t.exitTime as UTCTimestamp,
        position: isShort ? 'belowBar' : 'aboveBar',
        color: t.netPnl >= 0 ? '#38bdf8' : '#f43f5e',
        shape: isShort ? 'arrowUp' : 'arrowDown',
        text: `${exitTag} ${t.returnPct >= 0 ? '+' : ''}${t.returnPct.toFixed(1)}%`,
      });
    }
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    candleSeries.setMarkers(markers);

    // 最新シグナル基準の BUY / 損切り(SL) / 利確(TP) 水平プライスライン描画
    const { liveSignal } = result;
    if (liveSignal && liveSignal.entryPrice > 0) {
      candleSeries.createPriceLine({
        price: liveSignal.entryPrice,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: liveSignal.status === 'IN_POSITION' ? '建値 ENTRY' : '想定 BUY',
      });
      if (liveSignal.stopLossPrice !== null) {
        candleSeries.createPriceLine({
          price: liveSignal.stopLossPrice,
          color: '#f43f5e',
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: '損切り SL',
        });
      }
      if (liveSignal.takeProfitPrice !== null) {
        candleSeries.createPriceLine({
          price: liveSignal.takeProfitPrice,
          color: '#38bdf8',
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: '利確 TP',
        });
      }
    }

    // メインオーバーレイ指標（SMA / EMA / BB）
    for (const ov of mainOverlays) {
      const lineSeries = chart.addLineSeries({
        color: ov.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: ov.label,
      });
      const pts = [];
      for (let i = 0; i < result.bars.length; i++) {
        const v = ov.values[i];
        if (v !== null) {
          pts.push({ time: result.bars[i].time as UTCTimestamp, value: v });
        }
      }
      lineSeries.setData(pts);
    }

    // 直近約260本をデフォルトズーム表示（全体へズームアウトも可能）
    const total = result.bars.length;
    if (total > 260) {
      chart.timeScale().setVisibleLogicalRange({ from: total - 260, to: total + 8 });
    } else {
      chart.timeScale().fitContent();
    }

    let oscChart: IChartApi | null = null;
    if (oscOverlays.length > 0 && oscContainerRef.current) {
      const oscEl = oscContainerRef.current;
      oscChart = createChart(oscEl, {
        layout: {
          background: { type: ColorType.Solid, color: '#040916' },
          textColor: '#94a3b8',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: 'rgba(34, 211, 238, 0.05)' },
          horzLines: { color: 'rgba(34, 211, 238, 0.05)' },
        },
        rightPriceScale: {
          borderColor: 'rgba(34, 211, 238, 0.16)',
        },
        timeScale: {
          borderColor: 'rgba(34, 211, 238, 0.16)',
          visible: false,
        },
        width: oscEl.clientWidth,
        height: 110,
      });

      for (const ov of oscOverlays) {
        const s = oscChart.addLineSeries({
          color: ov.color,
          lineWidth: 2,
          priceLineVisible: false,
          title: ov.label,
        });
        const pts = [];
        for (let i = 0; i < result.bars.length; i++) {
          const v = ov.values[i];
          if (v !== null) {
            pts.push({ time: result.bars[i].time as UTCTimestamp, value: v });
          }
        }
        s.setData(pts);
      }

      if (total > 260) {
        oscChart.timeScale().setVisibleLogicalRange({ from: total - 260, to: total + 8 });
      } else {
        oscChart.timeScale().fitContent();
      }

      // メインチャートと時間軸ズーム同期
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && oscChart) {
          oscChart.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

    const observer = new ResizeObserver(() => {
      if (mainEl) chart.applyOptions({ width: mainEl.clientWidth });
      if (oscChart && oscContainerRef.current) {
        oscChart.applyOptions({ width: oscContainerRef.current.clientWidth });
      }
    });
    observer.observe(mainEl);

    return () => {
      observer.disconnect();
      chart.remove();
      oscChart?.remove();
    };
  }, [result, mainOverlays, oscOverlays]);

  return (
    <div className="hud-panel overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 bg-[#050b18]/80 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-display font-bold tracking-wider text-cyan-200">
            {result.symbol} · {result.timeframe}
          </span>
          <span className="text-slate-700">|</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /> BUY
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" /> 利確/勝決済
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-rose-300">
            <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185]" /> 損切り/負決済
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {result.overlays.map((ov) => (
            <span
              key={ov.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-800/80 bg-slate-950/70 px-2 py-0.5 font-mono text-[10px] text-slate-200"
            >
              <span
                className="h-2 w-2.5 rounded-sm"
                style={{ backgroundColor: ov.color, boxShadow: `0 0 8px ${ov.color}` }}
              />
              {ov.label}
            </span>
          ))}
        </div>
      </div>

      <div ref={mainContainerRef} className="w-full" />

      {oscOverlays.length > 0 && (
        <div className="border-t border-cyan-500/15">
          <div className="flex items-center gap-2 bg-[#040814] px-4 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-cyan-300/75">
            OSCILLATOR TELEMETRY ({oscOverlays.map((o) => o.label).join(' / ')})
          </div>
          <div ref={oscContainerRef} className="w-full" />
        </div>
      )}
    </div>
  );
};
