import type { IndicatorOperand, OHLCVBar } from '../types/quant';

export type Series = (number | null)[];

export function calcSMA(values: number[], period: number): Series {
  const n = Math.max(1, Math.floor(period));
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function calcEMA(values: number[], period: number): Series {
  const n = Math.max(1, Math.floor(period));
  const out: Series = new Array(values.length).fill(null);
  if (values.length < n) return out;

  const k = 2 / (n + 1);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i];
  let ema = sum / n;
  out[n - 1] = ema;

  for (let i = n; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

/**
 * Wilder's Smoothing による標準RSI（TradingView / MT4 準拠）
 */
export function calcRSI(closes: number[], period: number): Series {
  const n = Math.max(2, Math.floor(period));
  const out: Series = new Array(closes.length).fill(null);
  if (closes.length <= n) return out;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= n; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= n;
  avgLoss /= n;

  out[n] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = n + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (n - 1) + gain) / n;
    avgLoss = (avgLoss * (n - 1) + loss) / n;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function calcMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { line: Series; signal: Series; hist: Series } {
  const fast = calcEMA(closes, fastPeriod);
  const slow = calcEMA(closes, slowPeriod);
  const line: Series = new Array(closes.length).fill(null);

  const validLineValues: number[] = [];
  const validIndices: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (fast[i] !== null && slow[i] !== null) {
      const v = (fast[i] as number) - (slow[i] as number);
      line[i] = v;
      validLineValues.push(v);
      validIndices.push(i);
    }
  }

  const signalRaw = calcEMA(validLineValues, signalPeriod);
  const signal: Series = new Array(closes.length).fill(null);
  const hist: Series = new Array(closes.length).fill(null);

  for (let j = 0; j < validIndices.length; j++) {
    const idx = validIndices[j];
    const sig = signalRaw[j];
    if (sig !== null && line[idx] !== null) {
      signal[idx] = sig;
      hist[idx] = (line[idx] as number) - sig;
    }
  }

  return { line, signal, hist };
}

export function calcBollingerBands(
  closes: number[],
  period = 20,
  stdDev = 2
): { upper: Series; middle: Series; lower: Series } {
  const n = Math.max(2, Math.floor(period));
  const middle = calcSMA(closes, n);
  const upper: Series = new Array(closes.length).fill(null);
  const lower: Series = new Array(closes.length).fill(null);

  for (let i = n - 1; i < closes.length; i++) {
    const mean = middle[i] as number;
    let sqSum = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const diff = closes[j] - mean;
      sqSum += diff * diff;
    }
    const sd = Math.sqrt(sqSum / n);
    upper[i] = mean + stdDev * sd;
    lower[i] = mean - stdDev * sd;
  }

  return { upper, middle, lower };
}

export function calcATR(bars: OHLCVBar[], period = 14): Series {
  const n = Math.max(1, Math.floor(period));
  const out: Series = new Array(bars.length).fill(null);
  if (bars.length <= n) return out;

  const tr: number[] = new Array(bars.length).fill(0);
  tr[0] = bars[0].high - bars[0].low;
  for (let i = 1; i < bars.length; i++) {
    const hl = bars[i].high - bars[i].low;
    const hc = Math.abs(bars[i].high - bars[i - 1].close);
    const lc = Math.abs(bars[i].low - bars[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);
  }

  let sum = 0;
  for (let i = 0; i < n; i++) sum += tr[i];
  let atr = sum / n;
  out[n - 1] = atr;

  for (let i = n; i < bars.length; i++) {
    atr = (atr * (n - 1) + tr[i]) / n;
    out[i] = atr;
  }
  return out;
}

export function calcStochK(bars: OHLCVBar[], period = 14): Series {
  const n = Math.max(2, Math.floor(period));
  const out: Series = new Array(bars.length).fill(null);

  for (let i = n - 1; i < bars.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - n + 1; j <= i; j++) {
      if (bars[j].high > highest) highest = bars[j].high;
      if (bars[j].low < lowest) lowest = bars[j].low;
    }
    const range = highest - lowest;
    out[i] = range === 0 ? 50 : ((bars[i].close - lowest) / range) * 100;
  }
  return out;
}

/**
 * 日次セッションリセット型 VWAP（デイトレード・機関投資家基準）
 * 日足など1日1本の場合はローリング20本VWAPへ自動切替
 */
export function calcVWAP(bars: OHLCVBar[]): Series {
  const out: Series = new Array(bars.length).fill(null);
  if (bars.length === 0) return out;

  const avgStep =
    bars.length > 2 ? (bars[bars.length - 1].time - bars[0].time) / (bars.length - 1) : 900;
  const isIntraday = avgStep < 43200; // 12時間未満ならセッションVWAP

  if (!isIntraday) {
    const win = 20;
    for (let i = 0; i < bars.length; i++) {
      const start = Math.max(0, i - win + 1);
      let pv = 0;
      let vol = 0;
      for (let j = start; j <= i; j++) {
        const tp = (bars[j].high + bars[j].low + bars[j].close) / 3;
        const v = Math.max(bars[j].volume, 1);
        pv += tp * v;
        vol += v;
      }
      out[i] = vol > 0 ? pv / vol : bars[i].close;
    }
    return out;
  }

  let currentDay = -1;
  let cumPV = 0;
  let cumVol = 0;

  for (let i = 0; i < bars.length; i++) {
    const dayKey = Math.floor(bars[i].time / 86400);
    if (dayKey !== currentDay) {
      currentDay = dayKey;
      cumPV = 0;
      cumVol = 0;
    }
    const tp = (bars[i].high + bars[i].low + bars[i].close) / 3;
    const v = Math.max(bars[i].volume, 1);
    cumPV += tp * v;
    cumVol += v;
    out[i] = cumVol > 0 ? cumPV / cumVol : bars[i].close;
  }
  return out;
}

/**
 * Wilder法 ADX (Average Directional Index)
 * トレンド強度を 0〜100 で測定（20以上=トレンド相場、20未満=レンジ相場）
 */
export function calcADX(bars: OHLCVBar[], period = 14): Series {
  const n = Math.max(2, Math.floor(period));
  const out: Series = new Array(bars.length).fill(null);
  if (bars.length < n * 2 + 1) return out;

  const tr: number[] = new Array(bars.length).fill(0);
  const plusDM: number[] = new Array(bars.length).fill(0);
  const minusDM: number[] = new Array(bars.length).fill(0);

  for (let i = 1; i < bars.length; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;

    const hl = bars[i].high - bars[i].low;
    const hc = Math.abs(bars[i].high - bars[i - 1].close);
    const lc = Math.abs(bars[i].low - bars[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);
  }

  let smoothTR = 0;
  let smoothPlus = 0;
  let smoothMinus = 0;
  for (let i = 1; i <= n; i++) {
    smoothTR += tr[i];
    smoothPlus += plusDM[i];
    smoothMinus += minusDM[i];
  }

  const dx: number[] = new Array(bars.length).fill(0);
  const calcDxAt = (sTR: number, sP: number, sM: number) => {
    if (sTR <= 1e-12) return 0;
    const pdi = (sP / sTR) * 100;
    const mdi = (sM / sTR) * 100;
    const sum = pdi + mdi;
    return sum > 1e-12 ? (Math.abs(pdi - mdi) / sum) * 100 : 0;
  };

  dx[n] = calcDxAt(smoothTR, smoothPlus, smoothMinus);
  for (let i = n + 1; i < bars.length; i++) {
    smoothTR = smoothTR - smoothTR / n + tr[i];
    smoothPlus = smoothPlus - smoothPlus / n + plusDM[i];
    smoothMinus = smoothMinus - smoothMinus / n + minusDM[i];
    dx[i] = calcDxAt(smoothTR, smoothPlus, smoothMinus);
  }

  let adxSum = 0;
  for (let i = n; i < n * 2; i++) adxSum += dx[i];
  let adx = adxSum / n;
  out[n * 2 - 1] = adx;

  for (let i = n * 2; i < bars.length; i++) {
    adx = (adx * (n - 1) + dx[i]) / n;
    out[i] = adx;
  }

  return out;
}

export function operandKey(op: IndicatorOperand): string {
  switch (op.kind) {
    case 'CLOSE':
      return 'CLOSE';
    case 'VOLUME':
      return 'VOLUME';
    case 'CONST':
      return `CONST(${op.value ?? 0})`;
    case 'SMA':
      return `SMA(${op.period ?? 20})`;
    case 'EMA':
      return `EMA(${op.period ?? 20})`;
    case 'VWAP':
      return 'VWAP';
    case 'RSI':
      return `RSI(${op.period ?? 14})`;
    case 'ADX':
      return `ADX(${op.period ?? 14})`;
    case 'ATR':
      return `ATR(${op.period ?? 14})`;
    case 'STOCH_K':
      return `STOCH(${op.period ?? 14})`;
    case 'VOLUME_SMA':
      return `VOL_SMA(${op.period ?? 20})`;
    case 'MACD_LINE':
      return `MACD(${op.fastPeriod ?? 12},${op.slowPeriod ?? 26},${op.signalPeriod ?? 9})`;
    case 'MACD_SIGNAL':
      return `MACD_SIG(${op.fastPeriod ?? 12},${op.slowPeriod ?? 26},${op.signalPeriod ?? 9})`;
    case 'MACD_HIST':
      return `MACD_HIST(${op.fastPeriod ?? 12},${op.slowPeriod ?? 26},${op.signalPeriod ?? 9})`;
    case 'BB_UPPER':
      return `BB_UP(${op.period ?? 20},${op.stdDev ?? 2})`;
    case 'BB_MIDDLE':
      return `BB_MID(${op.period ?? 20},${op.stdDev ?? 2})`;
    case 'BB_LOWER':
      return `BB_LOW(${op.period ?? 20},${op.stdDev ?? 2})`;
  }
}

export function operandDisplayLabel(op: IndicatorOperand): string {
  switch (op.kind) {
    case 'CLOSE':
      return '終値 (Close)';
    case 'VOLUME':
      return '出来高 (Volume)';
    case 'CONST':
      return `${op.value ?? 0}`;
    case 'SMA':
      return `SMA(${op.period ?? 20})`;
    case 'EMA':
      return `EMA(${op.period ?? 20})`;
    case 'VWAP':
      return 'VWAP';
    case 'RSI':
      return `RSI(${op.period ?? 14})`;
    case 'ADX':
      return `ADX(${op.period ?? 14})`;
    case 'ATR':
      return `ATR(${op.period ?? 14})`;
    case 'STOCH_K':
      return `Stoch %K(${op.period ?? 14})`;
    case 'VOLUME_SMA':
      return `出来高SMA(${op.period ?? 20})`;
    case 'MACD_LINE':
      return `MACD(${op.fastPeriod ?? 12},${op.slowPeriod ?? 26})`;
    case 'MACD_SIGNAL':
      return `MACD Signal(${op.signalPeriod ?? 9})`;
    case 'MACD_HIST':
      return `MACD Hist`;
    case 'BB_UPPER':
      return `BB上限(${op.period ?? 20}, ${op.stdDev ?? 2}σ)`;
    case 'BB_MIDDLE':
      return `BB中央(${op.period ?? 20})`;
    case 'BB_LOWER':
      return `BB下限(${op.period ?? 20}, ${op.stdDev ?? 2}σ)`;
  }
}

export function computeOperandSeries(
  bars: OHLCVBar[],
  op: IndicatorOperand,
  cache: Map<string, Series>
): Series {
  const key = operandKey(op);
  const existing = cache.get(key);
  if (existing) return existing;

  const closes = bars.map((b) => b.close);
  let series: Series;

  switch (op.kind) {
    case 'CLOSE':
      series = closes;
      break;
    case 'VOLUME':
      series = bars.map((b) => b.volume);
      break;
    case 'CONST':
      series = new Array(bars.length).fill(op.value ?? 0);
      break;
    case 'SMA':
      series = calcSMA(closes, op.period ?? 20);
      break;
    case 'EMA':
      series = calcEMA(closes, op.period ?? 20);
      break;
    case 'VWAP':
      series = calcVWAP(bars);
      break;
    case 'RSI':
      series = calcRSI(closes, op.period ?? 14);
      break;
    case 'ADX':
      series = calcADX(bars, op.period ?? 14);
      break;
    case 'ATR':
      series = calcATR(bars, op.period ?? 14);
      break;
    case 'STOCH_K':
      series = calcStochK(bars, op.period ?? 14);
      break;
    case 'VOLUME_SMA':
      series = calcSMA(bars.map((b) => b.volume), op.period ?? 20);
      break;
    case 'MACD_LINE':
    case 'MACD_SIGNAL':
    case 'MACD_HIST': {
      const m = calcMACD(
        closes,
        op.fastPeriod ?? 12,
        op.slowPeriod ?? 26,
        op.signalPeriod ?? 9
      );
      cache.set(operandKey({ ...op, kind: 'MACD_LINE' }), m.line);
      cache.set(operandKey({ ...op, kind: 'MACD_SIGNAL' }), m.signal);
      cache.set(operandKey({ ...op, kind: 'MACD_HIST' }), m.hist);
      series =
        op.kind === 'MACD_LINE'
          ? m.line
          : op.kind === 'MACD_SIGNAL'
          ? m.signal
          : m.hist;
      break;
    }
    case 'BB_UPPER':
    case 'BB_MIDDLE':
    case 'BB_LOWER': {
      const bb = calcBollingerBands(closes, op.period ?? 20, op.stdDev ?? 2);
      cache.set(operandKey({ ...op, kind: 'BB_UPPER' }), bb.upper);
      cache.set(operandKey({ ...op, kind: 'BB_MIDDLE' }), bb.middle);
      cache.set(operandKey({ ...op, kind: 'BB_LOWER' }), bb.lower);
      series =
        op.kind === 'BB_UPPER'
          ? bb.upper
          : op.kind === 'BB_MIDDLE'
          ? bb.middle
          : bb.lower;
      break;
    }
  }

  cache.set(key, series);
  return series;
}
