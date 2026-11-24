import type { AssetSymbol, MarketDataset, OHLCVBar, Timeframe } from '../types/quant';
import { TIMEFRAME_PROFILES } from './timeframeConfig';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

interface RegimeSpec {
  drift: number; // annualized drift
  vol: number;   // annualized volatility
  durationBars: number;
}

interface AssetProfile {
  symbol: AssetSymbol;
  name: string;
  category: MarketDataset['category'];
  currency: 'USD' | 'JPY';
  startPrice: number;
  baseVolume: number;
  seed: number;
  description: string;
  regimes: RegimeSpec[];
}

const ASSET_PROFILES: Record<Exclude<AssetSymbol, 'CUSTOM'>, AssetProfile> = {
  BTCUSDT: {
    symbol: 'BTCUSDT',
    name: 'Bitcoin / USDT',
    category: '仮想通貨',
    currency: 'USD',
    startPrice: 32400,
    baseVolume: 42000,
    seed: 20210101,
    description: '高ボラティリティ・明確なトレンドと押し目が形成されやすい主要暗号資産ペア（2021-2026）',
    regimes: [
      { drift: 0.95, vol: 0.68, durationBars: 140 },
      { drift: -0.75, vol: 0.85, durationBars: 95 },
      { drift: 0.65, vol: 0.58, durationBars: 130 },
      { drift: -0.95, vol: 0.78, durationBars: 220 },
      { drift: 0.12, vol: 0.36, durationBars: 170 },
      { drift: 0.88, vol: 0.54, durationBars: 240 },
      { drift: -0.25, vol: 0.48, durationBars: 110 },
      { drift: 0.72, vol: 0.52, durationBars: 260 },
      { drift: 0.05, vol: 0.42, durationBars: 150 },
      { drift: 0.55, vol: 0.50, durationBars: 290 },
    ],
  },
  ETHUSDT: {
    symbol: 'ETHUSDT',
    name: 'Ethereum / USDT',
    category: '仮想通貨',
    currency: 'USD',
    startPrice: 1280,
    baseVolume: 310000,
    seed: 20210202,
    description: 'アルトコインの代表格。BTCよりβ値が高くモメンタム戦略と好相性（2021-2026）',
    regimes: [
      { drift: 1.25, vol: 0.82, durationBars: 150 },
      { drift: -0.85, vol: 0.92, durationBars: 90 },
      { drift: 0.75, vol: 0.68, durationBars: 130 },
      { drift: -1.05, vol: 0.88, durationBars: 210 },
      { drift: 0.15, vol: 0.46, durationBars: 190 },
      { drift: 0.72, vol: 0.62, durationBars: 230 },
      { drift: -0.35, vol: 0.58, durationBars: 140 },
      { drift: 0.64, vol: 0.60, durationBars: 280 },
      { drift: -0.10, vol: 0.48, durationBars: 160 },
      { drift: 0.58, vol: 0.56, durationBars: 225 },
    ],
  },
  USDJPY: {
    symbol: 'USDJPY',
    name: 'USD / JPY（ドル円）',
    category: 'FX',
    currency: 'JPY',
    startPrice: 103.8,
    baseVolume: 185000,
    seed: 20210303,
    description: '日米金利差トレンドと介入による急反落を含む主要FX通貨ペア（2021-2026）',
    regimes: [
      { drift: 0.12, vol: 0.065, durationBars: 240 },
      { drift: 0.34, vol: 0.115, durationBars: 210 },
      { drift: -0.18, vol: 0.125, durationBars: 110 },
      { drift: 0.22, vol: 0.095, durationBars: 260 },
      { drift: -0.05, vol: 0.080, durationBars: 160 },
      { drift: 0.18, vol: 0.105, durationBars: 220 },
      { drift: -0.22, vol: 0.135, durationBars: 120 },
      { drift: 0.09, vol: 0.088, durationBars: 260 },
      { drift: -0.04, vol: 0.075, durationBars: 225 },
    ],
  },
  NVDA: {
    symbol: 'NVDA',
    name: 'NVIDIA Corp. (NVDA)',
    category: '米国株',
    currency: 'USD',
    startPrice: 14.2,
    baseVolume: 48000000,
    seed: 20210404,
    description: 'AI半導体ブームを牽引する高成長米国グロース株。押し目買い・トレンドフォロー向け',
    regimes: [
      { drift: 0.78, vol: 0.42, durationBars: 220 },
      { drift: -0.72, vol: 0.58, durationBars: 200 },
      { drift: 1.15, vol: 0.48, durationBars: 270 },
      { drift: 0.08, vol: 0.36, durationBars: 130 },
      { drift: 0.92, vol: 0.46, durationBars: 260 },
      { drift: -0.28, vol: 0.50, durationBars: 110 },
      { drift: 0.55, vol: 0.38, durationBars: 310 },
      { drift: 0.18, vol: 0.32, durationBars: 305 },
    ],
  },
  N225: {
    symbol: 'N225',
    name: '日経225先物 (NK225)',
    category: '先物',
    currency: 'JPY',
    startPrice: 27450,
    baseVolume: 64000,
    seed: 20210505,
    description: 'レンジ相場とブレイクアウトが交互に現れる日本株指数先物（2021-2026）',
    regimes: [
      { drift: 0.14, vol: 0.19, durationBars: 180 },
      { drift: -0.10, vol: 0.22, durationBars: 210 },
      { drift: 0.04, vol: 0.16, durationBars: 190 },
      { drift: 0.36, vol: 0.18, durationBars: 280 },
      { drift: -0.28, vol: 0.34, durationBars: 85 },
      { drift: 0.26, vol: 0.21, durationBars: 260 },
      { drift: 0.05, vol: 0.17, durationBars: 240 },
      { drift: 0.20, vol: 0.19, durationBars: 360 },
    ],
  },
};

const CACHE = new Map<string, MarketDataset>();

function getStepSeconds(timeframe: Timeframe): number {
  return TIMEFRAME_PROFILES[timeframe].stepSeconds;
}

function getBarsCount(timeframe: Timeframe): number {
  return TIMEFRAME_PROFILES[timeframe].simBarsCount;
}

function getAnnualBars(timeframe: Timeframe): number {
  return TIMEFRAME_PROFILES[timeframe].annualBars;
}

export function getMarketDataset(
  symbol: AssetSymbol,
  timeframe: Timeframe,
  customDataset?: MarketDataset | null
): MarketDataset {
  if (symbol === 'CUSTOM' && customDataset) {
    return customDataset;
  }

  const targetSymbol: Exclude<AssetSymbol, 'CUSTOM'> =
    symbol === 'CUSTOM' ? 'BTCUSDT' : symbol;
  const cacheKey = `${targetSymbol}_${timeframe}`;
  const cached = CACHE.get(cacheKey);
  if (cached) return cached;

  const profile = ASSET_PROFILES[targetSymbol];
  const stepSec = getStepSeconds(timeframe);
  const totalBars = getBarsCount(timeframe);
  const annualBars = getAnnualBars(timeframe);
  const dt = 1 / annualBars;

  // 2026-11-20 00:00:00 UTC を終点として逆算
  const endTs = Math.floor(Date.UTC(2026, 10, 20, 0, 0, 0) / 1000);
  const startTs = endTs - (totalBars - 1) * stepSec;

  const rand = mulberry32(profile.seed + stepSec);
  const bars: OHLCVBar[] = [];

  let price = profile.startPrice;
  let garchVar = Math.pow(profile.regimes[0].vol, 2) * dt;
  let prevRet = 0;

  // 合計レジーム長に対してバー位置を正規化
  const totalRegimeLen = profile.regimes.reduce((s, r) => s + r.durationBars, 0);

  for (let i = 0; i < totalBars; i++) {
    // 現在のレジームを特定
    const scaledPos = (i / totalBars) * totalRegimeLen;
    let acc = 0;
    let regime = profile.regimes[profile.regimes.length - 1];
    for (const r of profile.regimes) {
      acc += r.durationBars;
      if (scaledPos <= acc) {
        regime = r;
        break;
      }
    }

    // 周期的なスイング波動（トレンドの押し目・戻りと明確なレジーム転換を再現）
    const cycleWave =
      Math.sin((i / 65) * Math.PI * 2) * 0.34 * regime.vol * Math.sqrt(dt) +
      Math.sin((i / 24) * Math.PI * 2) * 0.18 * regime.vol * Math.sqrt(dt);

    // GARCH(1,1) 風のボラティリティクラスタリング（日次ノイズ過多を抑えトレンド構造を保持）
    const baseVol = regime.vol * 0.58;
    const targetVar = Math.pow(baseVol, 2) * dt;
    garchVar = 0.12 * targetVar + 0.10 * prevRet * prevRet + 0.78 * garchVar;
    const sigma = Math.sqrt(Math.max(garchVar, targetVar * 0.3));

    // ファットテール（まれに急騰・急落スパイクが発生）
    let z = gaussian(rand);
    if (rand() < 0.012) {
      z *= 1.9;
    }

    // AR(1) 弱いモメンタム自己相関 + ドリフト
    const momentumCarry = prevRet * 0.16;
    const ret =
      (regime.drift - 0.35 * baseVol * baseVol) * dt +
      cycleWave +
      momentumCarry +
      sigma * z;
    prevRet = ret;

    const open = price;
    const close = Math.max(open * Math.exp(ret), profile.startPrice * 0.15);

    const intrabarRange = Math.abs(close - open) + open * sigma * (0.25 + Math.abs(gaussian(rand)) * 0.35);
    const upperWick = intrabarRange * (0.15 + rand() * 0.35);
    const lowerWick = intrabarRange * (0.15 + rand() * 0.35);

    const high = Math.max(open, close) + upperWick;
    const low = Math.max(Math.min(open, close) - lowerWick, close * 0.5);

    // 値動きが大きいバーでは出来高が増加
    const volMultiplier = 0.55 + Math.min(Math.abs(ret) / Math.max(sigma, 1e-6), 3.5) * 0.65 + rand() * 0.5;
    const volume = Math.round(profile.baseVolume * volMultiplier);

    const decimals = targetSymbol === 'USDJPY' ? 3 : targetSymbol === 'NVDA' ? 2 : 2;
    const round = (v: number) => Number(v.toFixed(decimals));

    bars.push({
      time: startTs + i * stepSec,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume,
    });

    price = close;
  }

  const dataset: MarketDataset = {
    symbol: profile.symbol,
    name: profile.name,
    category: profile.category,
    currency: profile.currency,
    timeframe,
    bars,
    description: profile.description,
    source: 'simulation',
  };

  CACHE.set(cacheKey, dataset);
  return dataset;
}

export const AVAILABLE_ASSETS = Object.values(ASSET_PROFILES).map((p) => ({
  symbol: p.symbol,
  name: p.name,
  category: p.category,
  currency: p.currency,
  description: p.description,
}));

/**
 * ユーザーがアップロードしたOHLCV CSVをパースしてMarketDatasetに変換する。
 * 対応列: time/date/timestamp, open, high, low, close, volume(任意)
 */
export function parseCsvToDataset(csvText: string, fileName: string): MarketDataset {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 30) {
    throw new Error('CSVデータには最低30行以上のOHLCVレコードが必要です。');
  }

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const findCol = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));

  const timeIdx = findCol(['time', 'date', 'timestamp']);
  const openIdx = findCol(['open']);
  const highIdx = findCol(['high']);
  const lowIdx = findCol(['low']);
  const closeIdx = findCol(['close']);
  const volIdx = findCol(['vol']);

  if (openIdx === -1 || highIdx === -1 || lowIdx === -1 || closeIdx === -1) {
    throw new Error('CSVヘッダーに open, high, low, close 列が見つかりませんでした。');
  }

  const bars: OHLCVBar[] = [];
  const baseTs = Math.floor(Date.UTC(2023, 0, 1) / 1000);

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const open = Number(cols[openIdx]);
    const high = Number(cols[highIdx]);
    const low = Number(cols[lowIdx]);
    const close = Number(cols[closeIdx]);
    const volume = volIdx >= 0 ? Number(cols[volIdx]) || 1000 : 1000;

    if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
      continue;
    }

    let ts = baseTs + i * 86400;
    if (timeIdx >= 0 && cols[timeIdx]) {
      const raw = cols[timeIdx];
      const num = Number(raw);
      if (Number.isFinite(num) && num > 100000000) {
        ts = num > 1e12 ? Math.floor(num / 1000) : Math.floor(num);
      } else {
        const parsed = Date.parse(raw);
        if (!Number.isNaN(parsed)) {
          ts = Math.floor(parsed / 1000);
        }
      }
    }

    bars.push({ time: ts, open, high, low, close, volume });
  }

  bars.sort((a, b) => a.time - b.time);

  // 重複タイムスタンプ除去
  const deduped: OHLCVBar[] = [];
  for (const bar of bars) {
    if (deduped.length === 0 || deduped[deduped.length - 1].time < bar.time) {
      deduped.push(bar);
    }
  }

  if (deduped.length < 25) {
    throw new Error('有効なOHLCVレコードが25本未満のためバックテストできません。');
  }

  return {
    symbol: 'CUSTOM',
    name: fileName.replace(/\.csv$/i, ''),
    category: 'カスタムCSV',
    currency: 'USD',
    timeframe: '1D',
    bars: deduped,
    description: `アップロードされた実データ（${deduped.length.toLocaleString()}本）`,
    source: 'csv',
  };
}
