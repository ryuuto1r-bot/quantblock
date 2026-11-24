import type { AssetSymbol, OHLCVBar, Timeframe } from '../types/quant';

export interface LiveFetchResult {
  provider: string;
  fetchedAt: string;
  bars: OHLCVBar[];
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 6000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDirectCrypto(
  symbol: AssetSymbol,
  timeframe: Timeframe
): Promise<LiveFetchResult> {
  // 1. Binance Spot Public API (CORS対応・日中足は最大3,000本連結取得)
  try {
    const binanceMap: Record<Timeframe, string> = {
      '15m': '15m',
      '30m': '30m',
      '1H': '1h',
      '4H': '4h',
      '1D': '1d',
    };
    const interval = binanceMap[timeframe];
    const pages = timeframe === '15m' || timeframe === '30m' || timeframe === '1H' ? 3 : 1;
    const allBars: OHLCVBar[] = [];
    let endTime: number | null = null;

    for (let p = 0; p < pages; p++) {
      const endParam = endTime ? `&endTime=${endTime}` : '';
      const rows = (await fetchJsonWithTimeout(
        `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=1000${endParam}`
      )) as unknown[][];
      if (!Array.isArray(rows) || rows.length === 0) break;

      for (const r of rows) {
        allBars.push({
          time: Math.floor(Number(r[0]) / 1000),
          open: Number(r[1]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
          volume: Number(r[5]),
        });
      }
      const oldestMs = Number(rows[0][0]);
      if (!Number.isFinite(oldestMs) || rows.length < 1000) break;
      endTime = oldestMs - 1;
    }

    allBars.sort((a, b) => a.time - b.time);
    const deduped: OHLCVBar[] = [];
    for (const b of allBars) {
      if (deduped.length === 0 || deduped[deduped.length - 1].time < b.time) {
        deduped.push(b);
      }
    }

    if (deduped.length >= 20) {
      return {
        provider: 'Binance Spot API (Direct)',
        fetchedAt: new Date().toISOString(),
        bars: deduped,
      };
    }
  } catch {
    // try next
  }

  // 2. Bybit v5 Spot Public API (CORS対応)
  try {
    const bybitMap: Record<Timeframe, string> = {
      '15m': '15',
      '30m': '30',
      '1H': '60',
      '4H': '240',
      '1D': 'D',
    };
    const interval = bybitMap[timeframe];
    const data = (await fetchJsonWithTimeout(
      `https://api.bybit.com/v5/market/kline?category=spot&symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=1000`
    )) as { result?: { list?: unknown[][] } };
    const list = data?.result?.list;
    if (Array.isArray(list) && list.length >= 20) {
      const bars = list
        .map((r) => ({
          time: Math.floor(Number(r[0]) / 1000),
          open: Number(r[1]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
          volume: Number(r[5]),
        }))
        .sort((a, b) => a.time - b.time);
      return {
        provider: 'Bybit v5 Spot API (Direct)',
        fetchedAt: new Date().toISOString(),
        bars,
      };
    }
  } catch {
    // try next
  }

  // 3. OKX Public API (CORS対応)
  const instId = symbol.replace('USDT', '-USDT');
  const okxMap: Record<Timeframe, string> = {
    '15m': '15m',
    '30m': '30m',
    '1H': '1H',
    '4H': '4H',
    '1D': '1D',
  };
  const bar = okxMap[timeframe];
  const okx = (await fetchJsonWithTimeout(
    `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=300`
  )) as { data?: unknown[][] };
  const list = okx?.data;
  if (Array.isArray(list) && list.length >= 20) {
    const bars = list
      .map((r) => ({
        time: Math.floor(Number(r[0]) / 1000),
        open: Number(r[1]),
        high: Number(r[2]),
        low: Number(r[3]),
        close: Number(r[4]),
        volume: Number(r[5]),
      }))
      .sort((a, b) => a.time - b.time);
    return {
      provider: 'OKX Market API (Direct)',
      fetchedAt: new Date().toISOString(),
      bars,
    };
  }

  throw new Error('取引所公開APIへの接続がタイムアウトしました');
}

export function isLocalApiAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

export async function fetchLiveMarketData(
  symbol: AssetSymbol,
  timeframe: Timeframe
): Promise<LiveFetchResult> {
  // 1. ローカル開発環境のみAPIサーバー (/api/market/live) を試行（FX/株式/仮想通貨すべて対応）
  if (isLocalApiAvailable()) {
    try {
      const data = (await fetchJsonWithTimeout(
        `/api/market/live?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`,
        8000
      )) as { ok?: boolean; provider?: string; fetchedAt?: string; bars?: OHLCVBar[]; error?: string };
      if (data?.ok && Array.isArray(data.bars) && data.bars.length >= 20) {
        return {
          provider: data.provider || 'Live Market API',
          fetchedAt: data.fetchedAt || new Date().toISOString(),
          bars: data.bars,
        };
      }
    } catch {
      // ブラウザ直接フェッチへフォールバック
    }
  }

  // 2. 静的ホスティング（GitHub Pages等）でも仮想通貨はブラウザから直接リアルタイム取得
  if (symbol === 'BTCUSDT' || symbol === 'ETHUSDT') {
    return await fetchDirectCrypto(symbol, timeframe);
  }

  throw new Error(`${symbol} は公開版では5年シミュレーションまたは独自CSVで検証できます`);
}
