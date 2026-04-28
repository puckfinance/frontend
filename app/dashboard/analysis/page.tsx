"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, zodSchema } from "ai";
import { z } from "zod";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity,
  BarChart3,
  Shield,
  Brain,
  Loader2,
  DollarSign,
  Calendar,
  Anchor,
  CandlestickChart,
} from "lucide-react";
import { TradeChart } from "@/components/analysis/trade-chart";
import { TradeExecutor } from "@/components/analysis/trade-executor";

const TIMEFRAME_SETS = [
  { value: "higher", label: "Higher TF", short: "1D/4H/1H", description: "Swing analysis" },
  { value: "lower", label: "Lower TF", short: "15m/5m", description: "Scalping analysis" },
  { value: "all", label: "All TFs", short: "1D→5m", description: "Full multi-TF" },
] as const;

const SYMBOLS = [
  { value: "BTC", label: "Bitcoin", short: "BTC" },
  { value: "ETH", label: "Ethereum", short: "ETH" },
  { value: "SOL", label: "Solana", short: "SOL" },
  { value: "BNB", label: "BNB", short: "BNB" },
  { value: "XRP", label: "XRP", short: "XRP" },
  { value: "ADA", label: "Cardano", short: "ADA" },
  { value: "DOGE", label: "Dogecoin", short: "DOGE" },
  { value: "AVAX", label: "Avalanche", short: "AVAX" },
  { value: "LINK", label: "Chainlink", short: "LINK" },
  { value: "DOT", label: "Polkadot", short: "DOT" },
];

interface UpcomingEvent {
  event: string;
  time: string;
  impact: string;
  actual: number | null;
  estimate: number | null;
  previous: number | null;
}

interface MarketData {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  marketCap: number;
  volume24h: number;
  ath: number;
  fearGreedIndex: number;
  fearGreedClassification: string;
  keySupport: number;
  keyResistance: number;
  dxy: number;
  eurusd: number;
  gbpusd: number;
  usdjpy: number;
  upcomingEvents: UpcomingEvent[];
  whales: {
    takerRatio: number;
    takerTrend: string;
    topTraderLongPct: number;
    topTraderTrend: string;
    oiValue: number;
    oiChange24h: number;
    onChainLargeTxs: number;
    onChainVolumeBTC: number;
  };
  indicators: {
    rsi: number;
    rsiCondition: string;
    rsi4h: number;
    rsi1h: number;
    rsi15m?: number;
    rsi5m?: number;
    macdHistogram: number;
    macdTrend: string;
    emaTrend: string;
    alignedTimeframes: number;
    bollingerSqueeze: boolean;
    bollingerPercentB: number;
    atr: number;
    vwapRelation: string;
    marketStructure: string;
    fvgCount: number;
    obCount: number;
    conflictingSignals: string[];
    totalCheckedTimeframes?: number;
  };
  tradeAlert?: {
    active: boolean;
    direction: "LONG" | "SHORT" | "NONE";
    entryPrice: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    riskRewardRatio: number | null;
    tradeSetup: string;
    reasoning: string;
  };
}

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

function getFearGreedColor(value: number): string {
  if (value <= 25) return "text-red-500";
  if (value <= 45) return "text-orange-500";
  if (value <= 55) return "text-yellow-500";
  if (value <= 75) return "text-lime-500";
  return "text-green-500";
}

const mdComponents: Record<string, React.FC<React.PropsWithChildren<any>>> = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-foreground mt-8 mb-4 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-foreground mt-8 mb-3 pb-2 border-b border-border/40">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-muted-foreground leading-7 mb-4">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="my-3 ml-4 space-y-1.5 list-none">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 ml-4 space-y-1.5 list-decimal marker:text-muted-foreground/60">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-muted-foreground leading-7 relative pl-5 before:content-[''] before:absolute before:left-0 before:top-[13px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary/50">
      {children}
    </li>
  ),
  hr: () => <hr className="my-6 border-border/30" />,
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block bg-muted/50 rounded-lg p-4 text-sm font-mono text-foreground overflow-x-auto my-4 border border-border/20">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-0">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/30 pl-4 my-4 italic text-muted-foreground/80">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border/30">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/30 border-b border-border/30">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-muted-foreground border-t border-border/20">
      {children}
    </td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
    >
      {children}
    </a>
  ),
};

function StreamingMarkdown({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div ref={containerRef} className="max-w-none overflow-y-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function CryptoAnalysisPage() {
  const { data: session } = useSession();
  const [selectedSymbol, setSelectedSymbol] = useState("BTC");
  const [selectedTimeframeSet, setSelectedTimeframeSet] = useState<string>("all");
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tradeAlert, setTradeAlert] = useState<MarketData["tradeAlert"]>(undefined);
  const [streamingDone, setStreamingDone] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8083";

  const dataPartSchemas = useMemo(() => ({
    marketData: zodSchema(z.any()),
    tradeAlert: zodSchema(z.any()),
    done: zodSchema(z.any()),
  }), []);

  const transport = useMemo(() => new DefaultChatTransport({
    api: `${apiUrl}/api/v1/ai/analysis/stream`,
  }), [apiUrl]);

  const { messages, sendMessage, status, stop, setMessages, error: chatError } = useChat({
    id: "analysis",
    dataPartSchemas,
    transport,
    onFinish: () => {
      setStreamingDone(true);
    },
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";
  const streamedText = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last) return "";
    return last.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }, [messages]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    for (const part of last.parts) {
      if (part.type === "data-marketData") {
        setMarketData((part as any).data as MarketData);
      }
      if (part.type === "data-tradeAlert") {
        setTradeAlert((part as any).data);
      }
    }
  }, [messages]);

  const startAnalysis = useCallback(
    async (symbol?: string, tfSetOverride?: string) => {
      const sym = symbol || selectedSymbol;
      const tfSet = tfSetOverride || selectedTimeframeSet;

      setMarketData(null);
      setTradeAlert(undefined);
      setStreamingDone(false);

      await sendMessage(
        { text: `Analyze ${sym} with timeframe ${tfSet}` },
        { body: { symbol: sym, timeframe: tfSet } },
      );
    },
    [selectedSymbol, selectedTimeframeSet, sendMessage],
  );

  const handleTimeframeSetChange = (tfSet: string) => {
    setSelectedTimeframeSet(tfSet);
    if (isStreaming) {
      stop();
    }
    if (streamedText || isStreaming) {
      setTimeout(() => startAnalysis(undefined, tfSet), 50);
    }
  };

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    if (isStreaming) {
      stop();
    }
    if (streamedText || isStreaming) {
      setTimeout(() => startAnalysis(symbol), 50);
    }
  };

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const isPositive = marketData
    ? marketData.priceChangePercentage24h >= 0
    : false;

  const isLoadingData = isStreaming && !marketData;
  const error = chatError?.message ?? null;

  return (
    <AuthGuard>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              AI Analysis
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              AI-powered market analysis with real-time data
            </p>
          </div>
          <Button
            onClick={() => startAnalysis()}
            disabled={isStreaming}
            size="lg"
            className="gap-2"
          >
            {isStreaming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing {selectedSymbol}...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {streamedText
                  ? `Refresh ${selectedSymbol} Analysis`
                  : `Analyze ${selectedSymbol}`}
              </>
            )}
          </Button>
        </div>

        {/* Symbol Selector */}
        <div className="flex flex-wrap gap-2">
          {SYMBOLS.map((sym) => (
            <button
              key={sym.value}
              onClick={() => handleSymbolChange(sym.value)}
              disabled={isStreaming}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                selectedSymbol === sym.value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-primary/10 hover:border-primary/30 hover:text-foreground disabled:opacity-50"
              }`}
            >
              {sym.short}
            </button>
          ))}
        </div>

        {/* Timeframe Set Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Timeframe Focus</span>
          {TIMEFRAME_SETS.map((tf) => (
            <button
              key={tf.value}
              onClick={() => handleTimeframeSetChange(tf.value)}
              disabled={isStreaming}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                selectedTimeframeSet === tf.value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-primary/10 hover:border-primary/30 hover:text-foreground disabled:opacity-50"
              }`}
            >
              <span>{tf.label}</span>
              <span className="ml-1.5 text-xs opacity-70">({tf.short})</span>
            </button>
          ))}
        </div>

        {/* Market Data Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {selectedSymbol} Price
              </CardTitle>
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              {isLoadingData || !marketData ? (
                <Skeleton className="h-7 w-[140px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold font-mono">
                    ${formatUSD(marketData.price)}
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      isPositive ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {marketData.priceChangePercentage24h.toFixed(2)}% (24h)
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">DXY Index</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingData || !marketData ? (
                <Skeleton className="h-7 w-[100px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold font-mono">
                    {marketData.dxy > 0 ? marketData.dxy.toFixed(2) : "N/A"}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1 font-mono">
                    <span>EUR {marketData.eurusd}</span>
                    <span>JPY {marketData.usdjpy}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Market Cap</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingData || !marketData ? (
                <Skeleton className="h-7 w-[120px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCompact(marketData.marketCap)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vol: {formatCompact(marketData.volume24h)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Fear & Greed
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingData || !marketData ? (
                <Skeleton className="h-7 w-[100px]" />
              ) : (
                <>
                  <div
                    className={`text-2xl font-bold ${getFearGreedColor(
                      marketData.fearGreedIndex
                    )}`}
                  >
                    {marketData.fearGreedIndex}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {marketData.fearGreedClassification}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Key Levels</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingData || !marketData ? (
                <Skeleton className="h-7 w-[130px]" />
              ) : (
                <>
                  <div className="text-sm font-mono">
                    <span className="text-green-500">
                      S: ${formatUSD(marketData.keySupport)}
                    </span>
                  </div>
                  <div className="text-sm font-mono mt-1">
                    <span className="text-red-500">
                      R: ${formatUSD(marketData.keyResistance)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Macro Events
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingData || !marketData ? (
                <Skeleton className="h-7 w-[130px]" />
              ) : marketData.upcomingEvents?.length > 0 ? (
                <div className="space-y-1">
                  {marketData.upcomingEvents.slice(0, 2).map((evt, i) => (
                    <div key={i} className="text-xs">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 align-middle" />
                      <span className="text-foreground font-medium">
                        {evt.event.length > 25
                          ? evt.event.slice(0, 25) + "..."
                          : evt.event}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        {evt.time?.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                  {marketData.upcomingEvents.length > 2 && (
                    <p className="text-xs text-muted-foreground">
                      +{marketData.upcomingEvents.length - 2} more events
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No high-impact events
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Whale Activity
              </CardTitle>
              <Anchor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingData || !marketData ? (
                <Skeleton className="h-7 w-[130px]" />
              ) : (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Taker B/S</span>
                    <span
                      className={`font-mono font-medium ${
                        marketData.whales?.takerRatio > 1
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {marketData.whales?.takerRatio?.toFixed(3) || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Top Traders</span>
                    <span className="font-mono font-medium text-foreground">
                      {marketData.whales?.topTraderLongPct
                        ? `${(marketData.whales.topTraderLongPct * 100).toFixed(0)}% Long`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">OI 24h</span>
                    <span
                      className={`font-mono font-medium ${
                        (marketData.whales?.oiChange24h || 0) > 0
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {marketData.whales?.oiChange24h
                        ? `${marketData.whales.oiChange24h > 0 ? "+" : ""}${marketData.whales.oiChange24h}%`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Whale Txs</span>
                    <span className="font-mono font-medium text-foreground">
                      {marketData.whales?.onChainLargeTxs ?? "N/A"} ({marketData.whales?.onChainVolumeBTC?.toFixed(0) || 0} BTC)
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Technical Indicators Row */}
        {marketData?.indicators && (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <Card className="bg-background/60 backdrop-blur-sm border-primary/10 transition-all">
              <CardContent className="pt-4 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">RSI (14)</span>
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      marketData.indicators.rsiCondition === "overbought"
                        ? "bg-red-500/20 text-red-400"
                        : marketData.indicators.rsiCondition === "oversold"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {marketData.indicators.rsiCondition}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono">
                  {marketData.indicators.rsi?.toFixed(1)}
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div
                    className={`h-1.5 rounded-full ${
                      marketData.indicators.rsi > 70
                        ? "bg-red-500"
                        : marketData.indicators.rsi < 30
                        ? "bg-green-500"
                        : "bg-primary"
                    }`}
                    style={{
                      width: `${Math.min(100, marketData.indicators.rsi)}%`,
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground font-mono">
                  {marketData.indicators.rsi4h != null && <span>4h: {marketData.indicators.rsi4h.toFixed(0)}</span>}
                  {marketData.indicators.rsi1h != null && <span>1h: {marketData.indicators.rsi1h.toFixed(0)}</span>}
                  {marketData.indicators.rsi15m != null && <span>15m: {marketData.indicators.rsi15m.toFixed(0)}</span>}
                  {marketData.indicators.rsi5m != null && <span>5m: {marketData.indicators.rsi5m.toFixed(0)}</span>}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/60 backdrop-blur-sm border-primary/10 transition-all">
              <CardContent className="pt-4 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">MACD</span>
                  <span
                    className={`text-xs font-medium ${
                      marketData.indicators.macdTrend === "bullish"
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {marketData.indicators.macdTrend}
                  </span>
                </div>
                <div
                  className={`text-xl font-bold font-mono ${
                    marketData.indicators.macdHistogram > 0
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {marketData.indicators.macdHistogram > 0 ? "+" : ""}
                  {marketData.indicators.macdHistogram?.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Histogram</p>
              </CardContent>
            </Card>

            <Card className="bg-background/60 backdrop-blur-sm border-primary/10 transition-all">
              <CardContent className="pt-4 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">EMA Trend</span>
                </div>
                <div
                  className={`text-sm font-bold ${
                    marketData.indicators.emaTrend?.includes("bullish")
                      ? "text-green-500"
                      : marketData.indicators.emaTrend?.includes("bearish")
                      ? "text-red-500"
                      : "text-yellow-500"
                  }`}
                >
                  {marketData.indicators.emaTrend
                    ?.replace("_", " ")
                    .toUpperCase()}
                </div>
                <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{marketData.indicators.alignedTimeframes}/{marketData.indicators.totalCheckedTimeframes ?? 5} TF</span>
                  <span>VWAP: {marketData.indicators.vwapRelation}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/60 backdrop-blur-sm border-primary/10 transition-all">
              <CardContent className="pt-4 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">Structure</span>
                </div>
                <div
                  className={`text-sm font-bold ${
                    marketData.indicators.marketStructure === "bullish"
                      ? "text-green-500"
                      : marketData.indicators.marketStructure === "bearish"
                      ? "text-red-500"
                      : "text-yellow-500"
                  }`}
                >
                  {marketData.indicators.marketStructure?.toUpperCase()}
                </div>
                <div className="flex gap-2 mt-1">
                  {marketData.indicators.fvgCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {marketData.indicators.fvgCount} FVG
                    </span>
                  )}
                  {marketData.indicators.obCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {marketData.indicators.obCount} OB
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/60 backdrop-blur-sm border-primary/10 transition-all">
              <CardContent className="pt-4 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">BBands</span>
                  {marketData.indicators.bollingerSqueeze && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                      SQUEEZE
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold font-mono">
                  {(marketData.indicators.bollingerPercentB * 100)?.toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ATR: ${marketData.indicators.atr?.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Price Chart + Quick Trade - only renders after streaming completes */}
        {marketData && streamingDone && (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CandlestickChart className="h-5 w-5 text-primary" />
                    {selectedSymbol}/USDT Chart
                  </div>
                  {tradeAlert?.active && tradeAlert.direction !== "NONE" && (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        tradeAlert.direction === "LONG"
                          ? "bg-green-500/15 text-green-500 border border-green-500/20"
                          : "bg-red-500/15 text-red-500 border border-red-500/20"
                      }`}>
                        {tradeAlert.direction === "LONG" ? "\uD83D\uDFE2" : "\uD83D\uDD34"} {tradeAlert.direction}
                      </span>
                      {tradeAlert.riskRewardRatio && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                          R:R {tradeAlert.riskRewardRatio}:1
                        </span>
                      )}
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TradeChart marketData={{ ...marketData, tradeAlert }} selectedSymbol={selectedSymbol} />
              </CardContent>
            </Card>
            <TradeExecutor symbol={selectedSymbol} tradeAlert={tradeAlert} />
          </div>
        )}

        {/* AI Analysis Stream */}
        <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all max-w-5xl mx-auto w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Market Analysis
              {isStreaming && (
                <span className="inline-flex items-center gap-1.5 text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Streaming
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 mb-4">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            {!streamedText && !isStreaming && !error && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Brain className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  Ready to Analyze
                </h3>
                <p className="text-sm text-muted-foreground/70 max-w-md">
                  Select a coin above and click &quot;Analyze&quot; to generate
                  a comprehensive AI-powered market analysis with real-time data
                  from multiple sources.
                </p>
              </div>
            )}

            {(streamedText || isStreaming) && (
              <div className="min-h-[400px]">
                {isLoadingData && !streamedText && (
                  <div className="flex items-center gap-3 text-muted-foreground mb-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">
                      Fetching {selectedSymbol} market data from CoinGecko, DeFi
                      Llama, and sentiment APIs...
                    </span>
                  </div>
                )}
                <StreamingMarkdown content={streamedText} />
                {isStreaming && (
                  <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
