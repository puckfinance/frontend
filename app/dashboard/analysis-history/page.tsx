"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getAnalysisHistory,
  getAnalysisById,
  deleteAnalysis,
  getTradeResult,
  type AnalysisListItem,
  type AnalysisDetail,
  type TradeResult as TradeResultType,
} from "@/lib/analysis-history";
import {
  History,
  TrendingUp,
  TrendingDown,
  Brain,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  DollarSign,
  Activity,
  Shield,
  ArrowLeft,
  Loader2,
  Anchor,
  Calendar,
  X,
  CandlestickChart,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { TradeChart } from "@/components/analysis/trade-chart";
import { TradeExecutor } from "@/components/analysis/trade-executor";

const SYMBOLS = [
  { value: "", label: "All" },
  { value: "BTC", label: "BTC" },
  { value: "ETH", label: "ETH" },
  { value: "SOL", label: "SOL" },
  { value: "BNB", label: "BNB" },
  { value: "XRP", label: "XRP" },
  { value: "ADA", label: "ADA" },
  { value: "DOGE", label: "DOGE" },
  { value: "AVAX", label: "AVAX" },
  { value: "LINK", label: "LINK" },
  { value: "DOT", label: "DOT" },
];

const formatUSD = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatCompact = (value: number) => {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${formatUSD(value)}`;
};

function getVerdictColor(verdict: string | null): string {
  if (!verdict) return "text-muted-foreground";
  switch (verdict) {
    case "STRONG_BUY": return "text-green-500";
    case "BUY": return "text-lime-500";
    case "NEUTRAL": return "text-yellow-500";
    case "SELL": return "text-orange-500";
    case "STRONG_SELL": return "text-red-500";
    default: return "text-muted-foreground";
  }
}

function getVerdictBg(verdict: string | null): string {
  if (!verdict) return "bg-muted/50";
  switch (verdict) {
    case "STRONG_BUY": return "bg-green-500/10 border-green-500/20";
    case "BUY": return "bg-lime-500/10 border-lime-500/20";
    case "NEUTRAL": return "bg-yellow-500/10 border-yellow-500/20";
    case "SELL": return "bg-orange-500/10 border-orange-500/20";
    case "STRONG_SELL": return "bg-red-500/10 border-red-500/20";
    default: return "bg-muted/50";
  }
}

function getFearGreedColor(value: number): string {
  if (value <= 25) return "text-red-500";
  if (value <= 45) return "text-orange-500";
  if (value <= 55) return "text-yellow-500";
  if (value <= 75) return "text-lime-500";
  return "text-green-500";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TradeResultBadge({ result }: { result: TradeResultType | null }) {
  if (!result || result.result === "NO_TRADE") return null;

  const config: Record<string, { icon: React.ReactNode; bg: string; text: string; label: string }> = {
    WIN: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      bg: "bg-green-500/10 border-green-500/20",
      text: "text-green-500",
      label: "TP Hit",
    },
    LOSS: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      bg: "bg-red-500/10 border-red-500/20",
      text: "text-red-500",
      label: "SL Hit",
    },
    PENDING: {
      icon: <Clock className="h-3.5 w-3.5" />,
      bg: "bg-yellow-500/10 border-yellow-500/20",
      text: "text-yellow-500",
      label: "Pending",
    },
  };

  const c = config[result.result];
  if (!c) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${c.bg} ${c.text}`}>
      {c.icon} {c.label}
    </span>
  );
}

const mdComponents: Record<string, React.FC<React.PropsWithChildren<any>>> = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-foreground mt-8 mb-4 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-foreground mt-8 mb-3 pb-2 border-b border-border/40">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-muted-foreground leading-7 mb-4">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul className="my-3 ml-4 space-y-1.5 list-none">{children}</ul>
  ),
  li: ({ children }) => (
    <li className="text-muted-foreground leading-7 relative pl-5 before:content-[''] before:absolute before:left-0 before:top-[13px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary/50">{children}</li>
  ),
  hr: () => <hr className="my-6 border-border/30" />,
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return <code className="block bg-muted/50 rounded-lg p-4 text-sm font-mono text-foreground overflow-x-auto my-4 border border-border/20">{children}</code>;
    }
    return <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
  },
  pre: ({ children }) => <pre className="my-0">{children}</pre>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border/30">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-muted-foreground border-t border-border/20">{children}</td>
  ),
};

export default function AnalysisHistoryPage() {
  const { data: session } = useSession();
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [tradeResults, setTradeResults] = useState<Record<string, TradeResultType>>({});
  const [checkingTrades, setCheckingTrades] = useState<Record<string, boolean>>({});

  const fetchHistory = useCallback(async (p: number, sym: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await getAnalysisHistory({
        page: p,
        limit: 12,
        symbol: sym || undefined,
      });
      setAnalyses(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (err: any) {
      setError(err.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(page, symbolFilter);
  }, [page, symbolFilter, fetchHistory]);

  const handleViewDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      const result = await getAnalysisById(id);
      setSelectedAnalysis(result.data);
    } catch (err: any) {
      setError(err.message || "Failed to load analysis");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this analysis?")) return;
    try {
      setDeleting(id);
      await deleteAnalysis(id);
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err: any) {
      setError(err.message || "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  const handleSymbolChange = (sym: string) => {
    setSymbolFilter(sym);
    setPage(1);
  };

  const handleCheckTrade = async (id: string) => {
    try {
      setCheckingTrades((prev) => ({ ...prev, [id]: true }));
      const result = await getTradeResult(id);
      setTradeResults((prev) => ({ ...prev, [id]: result }));
    } catch {
    } finally {
      setCheckingTrades((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Detail modal
  if (selectedAnalysis) {
    const d = selectedAnalysis;
    return (
      <AuthGuard>
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedAnalysis(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to History
            </Button>
          </div>

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Brain className="h-8 w-8 text-primary" />
                {d.symbol} Analysis
              </h2>
              <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatDate(d.createdAt)}
              </p>
            </div>
            <div className={`px-4 py-2 rounded-lg border ${getVerdictBg(d.overallVerdict)}`}>
              <span className={`text-lg font-bold ${getVerdictColor(d.overallVerdict)}`}>
                {d.overallVerdict?.replace("_", " ") || "N/A"}
              </span>
              {d.confidenceScore != null && (
                <span className="text-sm text-muted-foreground ml-2">
                  {d.confidenceScore}% confidence
                </span>
              )}
            </div>
          </div>

          {/* Data cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="bg-background/60 backdrop-blur-sm border-primary/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Price</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${formatUSD(d.price)}</div>
                <p className={`text-xs ${d.priceChangePercentage24h >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {d.priceChangePercentage24h >= 0 ? "+" : ""}{d.priceChangePercentage24h.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
            <Card className="bg-background/60 backdrop-blur-sm border-primary/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Market Cap</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCompact(d.marketCap)}</div>
                <p className="text-xs text-muted-foreground">Volume: {formatCompact(d.volume24h)}</p>
              </CardContent>
            </Card>
            <Card className="bg-background/60 backdrop-blur-sm border-primary/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Fear & Greed</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getFearGreedColor(d.fearGreedIndex)}`}>
                  {d.fearGreedIndex}
                </div>
                <p className="text-xs text-muted-foreground">{d.fearGreedClassification}</p>
              </CardContent>
            </Card>
            <Card className="bg-background/60 backdrop-blur-sm border-primary/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">DXY Index</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {d.dxyPrice ? d.dxyPrice.toFixed(2) : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {d.eurusd ? `EUR/USD: ${d.eurusd}` : "N/A"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Technical indicators row */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            <Card className="bg-background/60 border-primary/10">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">RSI (1D)</p>
                <p className="text-lg font-bold">{d.rsi}</p>
                <p className="text-xs text-muted-foreground capitalize">{d.rsiCondition}</p>
              </CardContent>
            </Card>
            <Card className="bg-background/60 border-primary/10">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">MACD</p>
                <p className="text-lg font-bold">{d.macdHistogram}</p>
                <p className="text-xs text-muted-foreground capitalize">{d.macdTrend}</p>
              </CardContent>
            </Card>
            <Card className="bg-background/60 border-primary/10">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">EMA Trend</p>
                <p className="text-lg font-bold capitalize">{(d.emaTrend || "").replace(/_/g, " ")}</p>
              </CardContent>
            </Card>
            <Card className="bg-background/60 border-primary/10">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Structure</p>
                <p className="text-lg font-bold capitalize">{d.marketStructure}</p>
              </CardContent>
            </Card>
            <Card className="bg-background/60 border-primary/10">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Key Support</p>
                <p className="text-lg font-bold">${formatUSD(d.keySupport)}</p>
              </CardContent>
            </Card>
            <Card className="bg-background/60 border-primary/10">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Key Resistance</p>
                <p className="text-lg font-bold">${formatUSD(d.keyResistance)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Trade Alert */}
          {d.tradeAlertActive && (
            <Card className={`border ${getVerdictBg(d.tradeAlertDirection === "LONG" ? "BUY" : "SELL")}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Anchor className="h-5 w-5" />
                  Trade Alert — {d.tradeAlertDirection}
                  <div className="ml-auto">
                    {tradeResults[d.id] ? (
                      <TradeResultBadge result={tradeResults[d.id]} />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCheckTrade(d.id)}
                        disabled={checkingTrades[d.id]}
                        className="gap-1.5"
                      >
                        {checkingTrades[d.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                        Check Trade Result
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {d.tradeAlertEntryPrice != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Entry</p>
                      <p className="font-bold">${formatUSD(d.tradeAlertEntryPrice)}</p>
                    </div>
                  )}
                  {d.tradeAlertStopLoss != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Stop Loss</p>
                      <p className="font-bold text-red-500">${formatUSD(d.tradeAlertStopLoss)}</p>
                    </div>
                  )}
                  {d.tradeAlertTakeProfit != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Take Profit</p>
                      <p className="font-bold text-green-500">${formatUSD(d.tradeAlertTakeProfit)}</p>
                    </div>
                  )}
                  {d.tradeAlertRiskReward != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Risk/Reward</p>
                      <p className="font-bold">{d.tradeAlertRiskReward}:1</p>
                    </div>
                  )}
                </div>
                {tradeResults[d.id] && tradeResults[d.id].result !== "NO_TRADE" && tradeResults[d.id].hitAt && (
                  <div className={`mt-3 p-3 rounded-lg border ${
                    tradeResults[d.id].result === "WIN"
                      ? "bg-green-500/5 border-green-500/20"
                      : tradeResults[d.id].result === "LOSS"
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-yellow-500/5 border-yellow-500/20"
                  }`}>
                    <p className={`text-sm font-medium ${
                      tradeResults[d.id].result === "WIN" ? "text-green-500" : tradeResults[d.id].result === "LOSS" ? "text-red-500" : "text-yellow-500"
                    }`}>
                      {tradeResults[d.id].result === "WIN" && "Take Profit was hit"}
                      {tradeResults[d.id].result === "LOSS" && "Stop Loss was hit"}
                      {tradeResults[d.id].result === "PENDING" && "Neither TP nor SL hit yet"}
                      {tradeResults[d.id].hitAt && ` — ${formatDate(tradeResults[d.id].hitAt!)}`}
                    </p>
                    {tradeResults[d.id].currentPrice && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Current price: ${formatUSD(tradeResults[d.id].currentPrice!)}
                      </p>
                    )}
                  </div>
                )}
                {d.tradeAlertSetup && (
                  <p className="mt-3 text-sm text-muted-foreground"><strong>Setup:</strong> {d.tradeAlertSetup}</p>
                )}
                {d.tradeAlertReasoning && (
                  <p className="mt-1 text-sm text-muted-foreground"><strong>Reasoning:</strong> {d.tradeAlertReasoning}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Price Chart + Quick Trade */}
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card className="bg-background/60 backdrop-blur-sm border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CandlestickChart className="h-5 w-5 text-primary" />
                  {d.symbol}/USDT Chart
                  {d.tradeAlertActive && d.tradeAlertDirection && d.tradeAlertDirection !== "NONE" && (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      d.tradeAlertDirection === "LONG"
                        ? "bg-green-500/15 text-green-500 border border-green-500/20"
                        : "bg-red-500/15 text-red-500 border border-red-500/20"
                    }`}>
                      {d.tradeAlertDirection === "LONG" ? "\uD83D\uDFE2" : "\uD83D\uDD34"} {d.tradeAlertDirection}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TradeChart
                  marketData={{
                    price: d.price,
                    keySupport: d.keySupport,
                    keyResistance: d.keyResistance,
                    tradeAlert: d.tradeAlertActive && d.tradeAlertEntryPrice && d.tradeAlertEntryPrice > 0
                      ? {
                          active: true,
                          direction: (d.tradeAlertDirection || "NONE") as "LONG" | "SHORT" | "NONE",
                          entryPrice: d.tradeAlertEntryPrice,
                          stopLoss: d.tradeAlertStopLoss,
                          takeProfit: d.tradeAlertTakeProfit,
                          riskRewardRatio: d.tradeAlertRiskReward,
                          tradeSetup: d.tradeAlertSetup || "",
                          reasoning: d.tradeAlertReasoning || "",
                        }
                      : undefined,
                  }}
                  selectedSymbol={d.symbol}
                />
              </CardContent>
            </Card>
            <TradeExecutor
              symbol={d.symbol}
              tradeAlert={
                d.tradeAlertActive && d.tradeAlertEntryPrice && d.tradeAlertStopLoss && d.tradeAlertTakeProfit
                  ? {
                      active: true,
                      direction: (d.tradeAlertDirection || "NONE") as "LONG" | "SHORT" | "NONE",
                      entryPrice: d.tradeAlertEntryPrice,
                      stopLoss: d.tradeAlertStopLoss,
                      takeProfit: d.tradeAlertTakeProfit,
                      riskRewardRatio: d.tradeAlertRiskReward,
                    }
                  : undefined
              }
            />
          </div>

          {/* AI Analysis Text */}
          {d.analysisText && !d.analysisText.includes('undefinedundefined') && (
            <Card className="bg-background/60 backdrop-blur-sm border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AI Market Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-w-none prose-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {d.analysisText}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-8 w-8 text-primary" />
              Analysis History
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {total} saved AI market analyses
            </p>
          </div>
        </div>

        {/* Symbol Filter */}
        <div className="flex flex-wrap gap-2">
          {SYMBOLS.map((sym) => (
            <button
              key={sym.value}
              onClick={() => handleSymbolChange(sym.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                symbolFilter === sym.value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-primary/10 hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {sym.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <Card className="bg-background/60 border-dashed">
            <CardContent className="py-16 text-center">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No analyses yet</h3>
              <p className="text-muted-foreground text-sm">
                Run an AI analysis from the Analysis page to start building history.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {analyses.map((a) => (
              <Card
                key={a.id}
                className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-lg hover:border-primary/25 transition-all cursor-pointer group"
                onClick={() => handleViewDetail(a.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{a.symbol}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getVerdictBg(a.overallVerdict)}`}>
                        <span className={getVerdictColor(a.overallVerdict)}>
                          {a.overallVerdict?.replace("_", " ") || "N/A"}
                        </span>
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(a.id);
                      }}
                      disabled={deleting === a.id}
                    >
                      {deleting === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="font-semibold">${formatUSD(a.price)}</p>
                      <p className={`text-xs ${a.priceChangePercentage24h >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {a.priceChangePercentage24h >= 0 ? "+" : ""}{a.priceChangePercentage24h.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Market Cap</p>
                      <p className="font-semibold">{formatCompact(a.marketCap)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fear & Greed</p>
                      <p className={`font-semibold ${getFearGreedColor(a.fearGreedIndex)}`}>
                        {a.fearGreedIndex} ({a.fearGreedClassification})
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Trend</p>
                      <p className="font-semibold capitalize">{(a.emaTrend || "").replace(/_/g, " ")}</p>
                    </div>
                  </div>
                  {/* Trade Alert indicator + Result */}
                  {a.tradeAlertActive && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`text-xs px-2 py-1 rounded-md border ${getVerdictBg(a.tradeAlertDirection === "LONG" ? "BUY" : "SELL")}`}>
                        <span className="font-medium">Trade Alert:</span>{" "}
                        <span className={getVerdictColor(a.tradeAlertDirection === "LONG" ? "BUY" : "SELL")}>
                          {a.tradeAlertDirection}
                        </span>
                      </div>
                      {tradeResults[a.id] ? (
                        <TradeResultBadge result={tradeResults[a.id]} />
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCheckTrade(a.id); }}
                          disabled={checkingTrades[a.id]}
                          className="text-xs px-2 py-1 rounded-md border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          {checkingTrades[a.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Target className="h-3 w-3" />}
                          Check Result
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="text-primary gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      View Full Analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
