export type AssetSymbol = 'BTCUSDT' | 'ETHUSDT' | 'USDJPY' | 'NVDA' | 'N225' | 'CUSTOM';

export type Timeframe = '15m' | '30m' | '1H' | '4H' | '1D';

export interface OHLCVBar {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type DataSourceMode = 'live' | 'simulation';

export interface MarketDataset {
  symbol: AssetSymbol;
  name: string;
  category: '仮想通貨' | 'FX' | '米国株' | '先物' | 'カスタムCSV';
  currency: 'USD' | 'JPY';
  timeframe: Timeframe;
  bars: OHLCVBar[];
  description: string;
  source?: 'live' | 'simulation' | 'csv';
  provider?: string;
  fetchedAt?: string;
}

export type IndicatorKind =
  | 'CLOSE'
  | 'SMA'
  | 'EMA'
  | 'VWAP'
  | 'RSI'
  | 'ADX'
  | 'MACD_LINE'
  | 'MACD_SIGNAL'
  | 'MACD_HIST'
  | 'BB_UPPER'
  | 'BB_MIDDLE'
  | 'BB_LOWER'
  | 'ATR'
  | 'STOCH_K'
  | 'VOLUME'
  | 'VOLUME_SMA'
  | 'CONST';

export interface IndicatorOperand {
  kind: IndicatorKind;
  period?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  stdDev?: number;
  value?: number; // CONST用
}

export type ComparatorOp =
  | 'CROSS_ABOVE'
  | 'CROSS_BELOW'
  | 'GREATER_THAN'
  | 'LESS_THAN';

export interface ConditionRule {
  id: string;
  label: string;
  left: IndicatorOperand;
  operator: ComparatorOp;
  right: IndicatorOperand;
  enabled: boolean;
}

export type LogicGate = 'AND' | 'OR';

export interface ExecutionConfig {
  initialCapital: number;
  positionSizePct: number; // 10 ~ 100
  leverage: number; // 1 ~ 10
  stopLossPct: number; // 0 = disabled
  takeProfitPct: number; // 0 = disabled
  trailingStopPct: number; // 0 = disabled
  feeBps: number; // basis points per side (10 bps = 0.1%)
  slippageBps: number; // basis points per side
  allowShort: boolean;
  executionTiming?: 'next_open' | 'same_close';
}

export interface StrategySpec {
  id: string;
  name: string;
  description: string;
  category: string;
  symbol: AssetSymbol;
  timeframe: Timeframe;
  entryLogic: LogicGate;
  entryRules: ConditionRule[];
  exitLogic: LogicGate;
  exitRules: ConditionRule[];
  execution: ExecutionConfig;
  updatedAt: string;
}

export type ExitReason = 'SIGNAL' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'END_OF_DATA';

export interface TradeRecord {
  id: number;
  side: 'LONG' | 'SHORT';
  entryTime: number;
  exitTime: number;
  entryIndex: number;
  exitIndex: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  notional: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
  returnPct: number;
  holdingBars: number;
  exitReason: ExitReason;
  equityAfter: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
  buyHoldEquity: number;
  drawdownPct: number;
}

export interface MonthlyReturnCell {
  year: number;
  month: number; // 1..12
  returnPct: number;
}

export interface BacktestMetrics {
  totalReturnPct: number;
  cagrPct: number;
  buyHoldReturnPct: number;
  alphaPct: number;
  finalEquity: number;
  netProfit: number;
  totalFees: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  profitFactor: number;
  payoffRatio: number;
  expectancyPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdownPct: number;
  maxDrawdownDurationBars: number;
  avgHoldingBars: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  exposurePct: number;
  executionTimeMs: number;
}

export interface IndicatorOverlaySeries {
  id: string;
  label: string;
  color: string;
  pane: 'main' | 'oscillator';
  values: (number | null)[];
}

export interface RuleCheckStatus {
  ruleId: string;
  label: string;
  summary: string;
  leftValue: number | null;
  rightValue: number | null;
  passed: boolean;
}

export type LiveSignalStatus = 'BUY_NOW' | 'SHORT_NOW' | 'IN_POSITION' | 'SELL_NOW' | 'WAIT';

export interface LiveSignalPlan {
  status: LiveSignalStatus;
  side: 'LONG' | 'SHORT';
  latestTime: number;
  latestPrice: number;
  prevPrice: number;
  changePct: number;
  atrValue: number | null;
  // ポジションまたは次回エントリーの具体価格
  entryPrice: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  trailingStopPrice: number | null;
  riskRewardRatio: number | null;
  // ポジション保有中の場合の詳細
  activeEntryTime: number | null;
  activeHoldingBars: number;
  unrealizedPnlPct: number | null;
  // 資金管理ベース推奨ロット
  allocatedCapital: number;
  leveragedNotional: number;
  estimatedUnits: number;
  maxLossAmount: number | null;
  // 各条件の最新バー判定チェックリスト
  entryChecks: RuleCheckStatus[];
  exitChecks: RuleCheckStatus[];
}

export interface AssetScanRow {
  symbol: Exclude<AssetSymbol, 'CUSTOM'>;
  name: string;
  category: string;
  totalReturnPct: number;
  winRatePct: number;
  sharpeRatio: number;
  profitFactor: number;
  maxDrawdownPct: number;
  totalTrades: number;
  liveStatus: LiveSignalStatus;
  latestPrice: number;
}

export interface PortfolioAnalysisResult {
  rows: AssetScanRow[];
  selectedSymbols: Exclude<AssetSymbol, 'CUSTOM'>[];
  portfolioEquity: { time: number; equity: number; drawdownPct: number }[];
  portfolioReturnPct: number;
  portfolioSharpe: number;
  portfolioMaxDdPct: number;
  avgSingleMaxDdPct: number;
  ddReductionPct: number;
  correlations: {
    symbols: Exclude<AssetSymbol, 'CUSTOM'>[];
    matrix: number[][];
  };
  executionTimeMs: number;
}

export interface BacktestResult {
  strategyId: string;
  symbol: AssetSymbol;
  timeframe: Timeframe;
  bars: OHLCVBar[];
  trades: TradeRecord[];
  equityCurve: EquityPoint[];
  monthlyReturns: MonthlyReturnCell[];
  metrics: BacktestMetrics;
  overlays: IndicatorOverlaySeries[];
  liveSignal: LiveSignalPlan;
}

export interface OptimizationCell {
  paramA: number;
  paramB: number;
  totalReturnPct: number;
  sharpeRatio: number;
  winRatePct: number;
  maxDrawdownPct: number;
  totalTrades: number;
}

export interface OptimizationResult {
  paramALabel: string;
  paramBLabel: string;
  paramAValues: number[];
  paramBValues: number[];
  cells: OptimizationCell[];
  bestCell: OptimizationCell | null;
  executionTimeMs: number;
}

export interface MonteCarloResult {
  simulations: number;
  steps: number;
  percentile5: number[];
  percentile25: number[];
  median: number[];
  percentile75: number[];
  percentile95: number[];
  samplePaths: number[][];
  ruinProbabilityPct: number; // 資産が初期資金の70%以下（DD30%超）になる確率
  profitProbabilityPct: number; // 最終資産が初期資金を上回る確率
  medianFinalEquity: number;
  p5FinalEquity: number;
  p95FinalEquity: number;
}

export interface OutOfSampleSplitResult {
  splitRatioPct: number; // 例: 70
  inSampleBars: number;
  outOfSampleBars: number;
  inSampleRange: [number, number];
  outOfSampleRange: [number, number];
  inSample: BacktestMetrics;
  outOfSample: BacktestMetrics;
  robustnessGrade: 'A' | 'B' | 'C' | 'D';
  verdictTitle: string;
  verdictSummary: string;
  sharpeRetentionPct: number;
}

export type PlanTier = 'free' | 'pro' | 'quant';
