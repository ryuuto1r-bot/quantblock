const PLAN_PRICES = {
  pro: {
    name: 'QuantBlock Pro プラン',
    amountJpy: 9800,
    priceId: process.env.STRIPE_PRICE_PRO || '',
  },
  quant: {
    name: 'QuantBlock Quant プラン',
    amountJpy: 29800,
    priceId: process.env.STRIPE_PRICE_QUANT || '',
  },
};

const LIVE_CACHE = new Map();
const LIVE_CACHE_TTL_MS = 30_000;

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCryptoFromBinance(symbol, timeframe) {
  const map = { '15M': '15m', '30M': '30m', '1H': '1h', '4H': '4h', '1D': '1d' };
  const interval = map[timeframe] || '15m';
  const pages = timeframe === '15M' || timeframe === '30M' || timeframe === '1H' ? 3 : 1;

  const allBars = [];
  let endTime = null;

  for (let p = 0; p < pages; p++) {
    const endParam = endTime ? `&endTime=${endTime}` : '';
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=1000${endParam}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      if (p === 0) throw new Error(`Binance HTTP ${res.status}`);
      break;
    }
    const rows = await res.json();
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
  const deduped = [];
  for (const b of allBars) {
    if (deduped.length === 0 || deduped[deduped.length - 1].time < b.time) {
      deduped.push(b);
    }
  }

  if (deduped.length < 20) throw new Error('Binance empty');
  return { provider: 'Binance Spot API', bars: deduped };
}

async function fetchCryptoFromBybit(symbol, timeframe) {
  const map = { '15M': '15', '30M': '30', '1H': '60', '4H': '240', '1D': 'D' };
  const interval = map[timeframe] || '15';
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=1000`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
  const data = await res.json();
  const list = data?.result?.list;
  if (!Array.isArray(list) || list.length < 20) throw new Error('Bybit empty');
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
  return { provider: 'Bybit v5 Spot API', bars };
}

async function fetchCryptoFromOkx(symbol, timeframe) {
  const instId = symbol.replace('USDT', '-USDT');
  const map = { '15M': '15m', '30M': '30m', '1H': '1H', '4H': '4H', '1D': '1D' };
  const bar = map[timeframe] || '15m';
  const url = `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=300`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
  const data = await res.json();
  const list = data?.data;
  if (!Array.isArray(list) || list.length < 20) throw new Error('OKX empty');
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
  return { provider: 'OKX Market API', bars };
}

async function fetchTradFiFromYahoo(symbol, timeframe) {
  const yahooMap = {
    USDJPY: 'JPY=X',
    NVDA: 'NVDA',
    N225: '^N225',
  };
  const ticker = yahooMap[symbol];
  if (!ticker) throw new Error(`Unsupported symbol: ${symbol}`);

  const interval =
    timeframe === '15M'
      ? '15m'
      : timeframe === '30M'
      ? '30m'
      : timeframe === '1D'
      ? '1d'
      : '60m';
  const range =
    timeframe === '15M' || timeframe === '30M'
      ? '60d'
      : timeframe === '1D'
      ? '5y'
      : '6mo';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 QuantBlock/1.0' },
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0];
  if (!timestamps.length || !quote) throw new Error('Yahoo empty');

  const rawBars = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    const v = quote.volume?.[i] ?? 0;
    if (
      typeof o === 'number' &&
      typeof h === 'number' &&
      typeof l === 'number' &&
      typeof c === 'number' &&
      Number.isFinite(o) &&
      Number.isFinite(c)
    ) {
      rawBars.push({
        time: Number(timestamps[i]),
        open: Number(o.toFixed(4)),
        high: Number(h.toFixed(4)),
        low: Number(l.toFixed(4)),
        close: Number(c.toFixed(4)),
        volume: Number(v || 0),
      });
    }
  }

  // 4H指定時は1H足を4本ずつ集約
  let bars = rawBars;
  if (timeframe === '4H') {
    const aggregated = [];
    for (let i = 0; i < rawBars.length; i += 4) {
      const chunk = rawBars.slice(i, i + 4);
      if (chunk.length === 0) continue;
      aggregated.push({
        time: chunk[0].time,
        open: chunk[0].open,
        high: Math.max(...chunk.map((x) => x.high)),
        low: Math.min(...chunk.map((x) => x.low)),
        close: chunk[chunk.length - 1].close,
        volume: chunk.reduce((s, x) => s + x.volume, 0),
      });
    }
    bars = aggregated;
  }

  // タイムスタンプ昇順・重複除去
  bars.sort((a, b) => a.time - b.time);
  const deduped = [];
  for (const b of bars) {
    if (deduped.length === 0 || deduped[deduped.length - 1].time < b.time) {
      deduped.push(b);
    }
  }

  if (deduped.length < 20) throw new Error('Yahoo insufficient bars');
  return { provider: 'Yahoo Finance Live API', bars: deduped };
}

async function fetchLiveMarketBars(symbol, timeframe) {
  const cacheKey = `${symbol}_${timeframe}`;
  const cached = LIVE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < LIVE_CACHE_TTL_MS) {
    return cached.payload;
  }

  const errors = [];
  let result = null;

  if (symbol === 'BTCUSDT' || symbol === 'ETHUSDT') {
    for (const fn of [fetchCryptoFromBinance, fetchCryptoFromBybit, fetchCryptoFromOkx]) {
      try {
        result = await fn(symbol, timeframe);
        break;
      } catch (e) {
        errors.push(String(e));
      }
    }
  } else {
    try {
      result = await fetchTradFiFromYahoo(symbol, timeframe);
    } catch (e) {
      errors.push(String(e));
    }
  }

  if (!result) {
    throw new Error(`リアル相場データの取得に失敗しました (${errors.join(' / ')})`);
  }

  const payload = {
    ok: true,
    symbol,
    timeframe,
    provider: result.provider,
    fetchedAt: new Date().toISOString(),
    bars: result.bars,
  };
  LIVE_CACHE.set(cacheKey, { ts: Date.now(), payload });
  return payload;
}

export async function handleApiRequest(req, res) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
  const APP_URL = process.env.APP_URL || 'http://localhost:5173';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return true;
  }

  const url = new URL(req.url || '/', 'http://localhost');

  if (!url.pathname.startsWith('/api/')) {
    return false;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      stripeLiveMode: Boolean(STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.includes('your_stripe')),
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/market/live') {
    const symbol = (url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase();
    const timeframe = (url.searchParams.get('timeframe') || '1D').toUpperCase();
    try {
      const data = await fetchLiveMarketBars(symbol, timeframe);
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 502, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/stripe/create-checkout-session') {
    try {
      const body = await readBody(req);
      const plan = body.plan === 'quant' ? 'quant' : 'pro';
      const spec = PLAN_PRICES[plan];

      if (STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.includes('your_stripe')) {
        const params = new URLSearchParams();
        params.append('mode', 'subscription');
        params.append('success_url', `${APP_URL}/?checkout=success&plan=${plan}`);
        params.append('cancel_url', `${APP_URL}/?checkout=cancel`);

        if (spec.priceId) {
          params.append('line_items[0][price]', spec.priceId);
          params.append('line_items[0][quantity]', '1');
        } else {
          params.append('line_items[0][price_data][currency]', 'jpy');
          params.append('line_items[0][price_data][product_data][name]', spec.name);
          params.append('line_items[0][price_data][unit_amount]', String(spec.amountJpy));
          params.append('line_items[0][price_data][recurring][interval]', 'month');
          params.append('line_items[0][quantity]', '1');
        }

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        const stripeData = await stripeRes.json();
        if (!stripeRes.ok) {
          sendJson(res, 400, {
            error: stripeData.error?.message || 'Stripeセッション作成に失敗しました。',
          });
          return true;
        }

        sendJson(res, 200, {
          mode: 'stripe_live',
          sessionId: stripeData.id,
          checkoutUrl: stripeData.url,
          plan,
        });
        return true;
      }

      sendJson(res, 200, {
        mode: 'demo',
        sessionId: `cs_demo_${Date.now()}`,
        plan,
        amountJpy: spec.amountJpy,
        message: 'STRIPE_SECRET_KEY未設定のためデモ決済モードでプランを有効化しました。',
      });
      return true;
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
      return true;
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/webhook/test') {
    try {
      const body = await readBody(req);
      sendJson(res, 200, {
        ok: true,
        deliveredAt: new Date().toISOString(),
        target: body.endpoint || 'https://api.exchange.example/webhook',
        latencyMs: 38,
        echoPayload: body.payload,
      });
      return true;
    } catch (err) {
      sendJson(res, 400, { error: String(err) });
      return true;
    }
  }

  sendJson(res, 404, { error: 'Not Found' });
  return true;
}
