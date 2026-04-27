/**
 * Analysis History API client
 *
 * @author AI Assistant
 * @createdDate 2026-04-08
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8083";

export interface AnalysisListItem {
  id: string;
  createdAt: string;
  symbol: string;
  price: number;
  priceChangePercentage24h: number;
  marketCap: number;
  fearGreedIndex: number;
  fearGreedClassification: string;
  dxyPrice: number | null;
  emaTrend: string;
  marketStructure: string;
  overallVerdict: string | null;
  confidenceScore: number | null;
  tradeAlertActive: boolean | null;
  tradeAlertDirection: string | null;
}

export interface AnalysisDetail extends AnalysisListItem {
  updatedAt: string;
  userId: string | null;
  priceChange24h: number;
  volume24h: number;
  circulatingSupply: number;
  ath: number;
  athDate: string;
  distanceFromAth: number;
  dxyPrice: number | null;
  eurusd: string | null;
  gbpusd: string | null;
  usdjpy: string | null;
  macroEvents: any[] | null;
  keySupport: number;
  keyResistance: number;
  dailyHigh: number;
  dailyLow: number;
  fundingRate: number;
  longShortRatio: number;
  marketBias: string;
  whaleData: any;
  rsi: number;
  rsiCondition: string;
  macdHistogram: number;
  macdTrend: string;
  bollingerSqueeze: boolean;
  bollingerPercentB: number;
  atr: number;
  vwapRelation: string;
  indicators: any;
  defiTvl: number | null;
  defiProtocols: any[] | null;
  defiHealth: string | null;
  analysisText: string | null;
  aiInsights: any;
  shortTermOutlook: string | null;
  mediumTermOutlook: string | null;
  keyLevelToWatch: string | null;
  recommendedStrategy: string | null;
  tradeAlertEntryPrice: number | null;
  tradeAlertStopLoss: number | null;
  tradeAlertTakeProfit: number | null;
  tradeAlertRiskReward: number | null;
  tradeAlertSetup: string | null;
  tradeAlertReasoning: string | null;
}

export interface PaginatedResponse {
  success: boolean;
  data: AnalysisListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Fetch analysis history (paginated)
 */
export async function getAnalysisHistory(
  params: { symbol?: string; page?: number; limit?: number } = {}
): Promise<PaginatedResponse> {
  const searchParams = new URLSearchParams();
  if (params.symbol) searchParams.set("symbol", params.symbol);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));

  const res = await fetch(
    `${API_URL}/api/v1/analysis-history?${searchParams.toString()}`
  );
  if (!res.ok) throw new Error(`Failed to fetch analysis history: ${res.status}`);
  return res.json();
}

/**
 * Fetch a single analysis by ID (full detail)
 */
export async function getAnalysisById(
  id: string
): Promise<{ success: boolean; data: AnalysisDetail }> {
  const res = await fetch(`${API_URL}/api/v1/analysis-history/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch analysis: ${res.status}`);
  return res.json();
}

export interface TradeResult {
  success: boolean;
  result: "WIN" | "LOSS" | "PENDING" | "NO_TRADE";
  direction: string | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  hitAt: string | null;
  currentPrice: number | null;
}

export async function getTradeResult(
  id: string
): Promise<TradeResult> {
  const res = await fetch(`${API_URL}/api/v1/analysis-history/${id}/trade-result`);
  if (!res.ok) throw new Error(`Failed to check trade result: ${res.status}`);
  return res.json();
}

/**
 * Delete an analysis by ID
 */
export interface BacktestTrade {
  id: string;
  symbol: string;
  createdAt: string;
  direction: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number | null;
  result: "WIN" | "LOSS" | "PENDING" | "NO_TRADE";
  hitAt: string | null;
  entryHit: boolean;
  setup: string | null;
  verdict: string | null;
  confidence: number | null;
  error?: string;
}

export interface BacktestSummary {
  totalAnalyses: number;
  wins: number;
  losses: number;
  pending: number;
  entryNotHit: number;
  winRate: number;
  avgRiskReward: number;
  dateRange: { from: string; to: string };
}

export interface BacktestResponse {
  success: boolean;
  summary: BacktestSummary;
  trades: BacktestTrade[];
}

export async function runBacktest(params: {
  from: string;
  to: string;
  symbol?: string;
}): Promise<BacktestResponse> {
  const res = await fetch(`${API_URL}/api/v1/analysis-history/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to run backtest: ${res.status}`);
  return res.json();
}

export async function deleteAnalysis(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/analysis-history/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete analysis: ${res.status}`);
}
