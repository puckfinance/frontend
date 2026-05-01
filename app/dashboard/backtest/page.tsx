"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, zodSchema } from "ai";
import { z } from "zod";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { DayPicker } from "react-day-picker";
import { format, subDays, subMonths } from "date-fns";
import "react-day-picker/style.css";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity,
  BarChart3,
  Shield,
  Brain,
  Loader2,
  Calendar,
  CandlestickChart,
  Clock,
  XCircle,
  Trophy,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { TradeChart } from "@/components/analysis/trade-chart";

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
  eurusd: string;
  gbpusd: string;
  usdjpy: string;
  upcomingEvents: any[];
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
    rsi4h?: number;
    rsi1h?: number;
    rsi15m?: number;
    rsi5m?: number;
    macdHistogram: number;
    macdTrend: string;
    emaTrend: string;
    alignedTimeframes: number;
    totalCheckedTimeframes?: number;
    bollingerSqueeze: boolean;
    bollingerPercentB: number;
    atr: number;
    vwapRelation: string;
    marketStructure: string;
    fvgCount: number;
    obCount: number;
    conflictingSignals: string[];
  };
  isBacktest?: boolean;
  targetDate?: string;
  dailyKlines?: Array<{ time: number; open: number; high: number; low: number; close: number }>;
}

interface TradeAlert {
  active: boolean;
  direction: "LONG" | "SHORT" | "NONE";
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskRewardRatio: number | null;
  tradeSetup: string;
  reasoning: string;
}

interface TradeResult {
  result: "WIN" | "LOSS" | "PENDING";
  hitAt: string | null;
  currentPrice: number | null;
}

const formatUSD = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function TradeResultCard({ tradeResult, tradeAlert }: { tradeResult: TradeResult; tradeAlert: TradeAlert }) {
  const isWin = tradeResult.result === "WIN";
  const isLoss = tradeResult.result === "LOSS";

  return (
    <Card className={`border ${isWin ? "border-green-500/30 bg-green-500/5" : isLoss ? "border-red-500/30 bg-red-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {isWin ? (
            <><Trophy className="h-5 w-5 text-green-500" /> Trade Result: TP Hit</>
          ) : isLoss ? (
            <><XCircle className="h-5 w-5 text-red-500" /> Trade Result: SL Hit</>
          ) : (
            <><Clock className="h-5 w-5 text-yellow-500" /> Trade Result: Pending</>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Direction</p>
            <p className={`font-bold ${tradeAlert.direction === "LONG" ? "text-green-500" : "text-red-500"}`}>
              {tradeAlert.direction}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Entry</p>
            <p className="font-bold font-mono">${tradeAlert.entryPrice ? formatUSD(tradeAlert.entryPrice) : "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stop Loss</p>
            <p className="font-bold font-mono text-red-500">${tradeAlert.stopLoss ? formatUSD(tradeAlert.stopLoss) : "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Take Profit</p>
            <p className="font-bold font-mono text-green-500">${tradeAlert.takeProfit ? formatUSD(tradeAlert.takeProfit) : "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Result</p>
            <p className={`font-bold ${isWin ? "text-green-500" : isLoss ? "text-red-500" : "text-yellow-500"}`}>
              {isWin ? "WIN" : isLoss ? "LOSS" : "PENDING"}
            </p>
          </div>
        </div>
        {tradeResult.hitAt && (
          <p className="text-sm text-muted-foreground mt-3">
            {isWin ? "TP Hit" : "SL Hit"} at: {new Date(tradeResult.hitAt).toLocaleString()}
          </p>
        )}
        {tradeResult.currentPrice && (
          <p className="text-xs text-muted-foreground mt-1">
            Current price: ${formatUSD(tradeResult.currentPrice)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function BacktestPage() {
  const { data: session } = useSession();
  const [selectedSymbol, setSelectedSymbol] = useState("BTC");
  const [selectedTimeframeSet, setSelectedTimeframeSet] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("12:00");
  const [showCalendar, setShowCalendar] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tradeAlert, setTradeAlert] = useState<TradeAlert | undefined>(undefined);
  const [streamingDone, setStreamingDone] = useState(false);
  const [tradeResult, setTradeResult] = useState<TradeResult | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8083";

  const dataPartSchemas = useMemo(() => ({
    marketData: zodSchema(z.any()),
    tradeAlert: zodSchema(z.any()),
    tradeResult: zodSchema(z.any()),
    done: zodSchema(z.any()),
  }), []);

  const transport = useMemo(() => new DefaultChatTransport({
    api: `${apiUrl}/api/v1/ai/backtest/stream`,
  }), [apiUrl]);

  const { messages, sendMessage, status, stop, setMessages, error: chatError } = useChat({
    id: "backtest",
    dataPartSchemas,
    transport,
    onFinish: () => {
      setStreamingDone(true);
    },
    onError: (err) => {
      console.error("Backtest chat error:", err);
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
        setTradeAlert((part as any).data as TradeAlert);
      }
      if (part.type === "data-tradeResult") {
        if ((part as any).data) setTradeResult((part as any).data as TradeResult);
      }
      if (part.type === "tool-generateTradeAlert") {
        const toolPart = part as any;
        if (toolPart.args) {
          setTradeAlert(toolPart.args as TradeAlert);
        } else if (toolPart.result) {
          setTradeAlert(toolPart.result as TradeAlert);
        }
      }
    }
  }, [messages]);

  const [validationError, setValidationError] = useState<string | null>(null);
  const error = chatError?.message ?? validationError ?? null;

  const startAnalysis = useCallback(
    async (symbol?: string, tfSetOverride?: string) => {
      const sym = symbol || selectedSymbol;
      const tfSet = tfSetOverride || selectedTimeframeSet;

      if (!selectedDate) {
        setValidationError("Please select a date first");
        return;
      }

      const dateStr = `${format(selectedDate, "yyyy-MM-dd")}T${selectedTime}:00`;
      const targetDate = new Date(dateStr);
      if (isNaN(targetDate.getTime())) {
        setValidationError("Invalid date/time");
        return;
      }
      if (targetDate >= new Date()) {
        setValidationError("Date must be in the past");
        return;
      }

      setValidationError(null);
      setMarketData(null);
      setTradeAlert(undefined);
      setStreamingDone(false);
      setTradeResult(null);

      await sendMessage(
        { text: `Backtest ${sym} at ${targetDate.toISOString()} with timeframe ${tfSet}` },
        { body: { symbol: sym, date: targetDate.toISOString(), timeframe: tfSet } },
      );
    },
    [selectedSymbol, selectedTimeframeSet, selectedDate, selectedTime, sendMessage],
  );

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    if (isStreaming) {
      stop();
    }
    if (streamedText || isStreaming) {
      setTimeout(() => startAnalysis(symbol), 50);
    }
  };

  const handleTimeframeSetChange = (tfSet: string) => {
    setSelectedTimeframeSet(tfSet);
    if (isStreaming) {
      stop();
    }
    if (streamedText || isStreaming) {
      setTimeout(() => startAnalysis(undefined, tfSet), 50);
    }
  };

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const isPositive = marketData ? marketData.priceChangePercentage24h >= 0 : false;
  const isLoadingData = isStreaming && !marketData;

  const toolPart = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last) return null;
    return last.parts.find((p: any) => p.type === "tool-generateTradeAlert") as any ?? null;
  }, [messages]);

  return (
    <AuthGuard>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-8 w-8 text-primary" />
              Backtest Analysis
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Pick a past date to run AI analysis on historical data, then see how the trade would have played out
            </p>
          </div>
          <Button
            onClick={() => startAnalysis()}
            disabled={isStreaming || !selectedDate}
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
                {streamedText ? `Re-analyze ${selectedSymbol}` : `Analyze ${selectedSymbol}`}
              </>
            )}
          </Button>
        </div>

        {/* Date Picker */}
        <Card className="bg-background/60 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-4">
              {/* Quick presets */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider self-center">Quick Pick</span>
                {[
                  { label: "1 Week Ago", date: subDays(new Date(), 7) },
                  { label: "2 Weeks Ago", date: subDays(new Date(), 14) },
                  { label: "1 Month Ago", date: subMonths(new Date(), 1) },
                  { label: "3 Months Ago", date: subMonths(new Date(), 3) },
                  { label: "6 Months Ago", date: subMonths(new Date(), 6) },
                  { label: "1 Year Ago", date: subMonths(new Date(), 12) },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setSelectedDate(preset.date);
                      setShowCalendar(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      selectedDate && format(selectedDate, "yyyy-MM-dd") === format(preset.date, "yyyy-MM-dd")
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background/60 text-muted-foreground border-primary/10 hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                {/* Date display + calendar toggle */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setShowCalendar(!showCalendar)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                      selectedDate ? "border-primary/40 bg-primary/5" : "border-primary/10 bg-background/60 hover:border-primary/30"
                    }`}
                  >
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className={`text-sm font-medium ${selectedDate ? "text-foreground" : "text-muted-foreground"}`}>
                      {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Pick a date..."}
                    </span>
                  </button>

                  {showCalendar && (
                    <div className="border border-primary/20 rounded-xl bg-background p-3 shadow-lg">
                      <DayPicker
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => {
                          setSelectedDate(d);
                          setShowCalendar(false);
                        }}
                        disabled={{ after: new Date() }}
                        defaultMonth={selectedDate || subMonths(new Date(), 1)}
                      />
                    </div>
                  )}
                </div>

                {/* Time picker */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">Time (UTC)</label>
                  <Input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="bg-background w-[140px]"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                  <p className={`text-xs mt-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
                    {isPositive ? "+" : ""}
                    {marketData.priceChangePercentage24h.toFixed(2)}% (24h)
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
                    <span className="text-green-500">S: ${formatUSD(marketData.keySupport)}</span>
                  </div>
                  <div className="text-sm font-mono mt-1">
                    <span className="text-red-500">R: ${formatUSD(marketData.keyResistance)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Backtest Date</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingData || !marketData ? (
                <Skeleton className="h-7 w-[160px]" />
              ) : (
                <>
                  <div className="text-lg font-bold">
                    {marketData.targetDate ? new Date(marketData.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {marketData.targetDate ? new Date(marketData.targetDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""} UTC
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Market Structure</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingData || !marketData ? (
                <Skeleton className="h-7 w-[100px]" />
              ) : (
                <>
                  <div className={`text-sm font-bold ${
                    marketData.indicators.marketStructure === "bullish"
                      ? "text-green-500"
                      : marketData.indicators.marketStructure === "bearish"
                      ? "text-red-500"
                      : "text-yellow-500"
                  }`}>
                    {marketData.indicators.marketStructure?.toUpperCase()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    EMA: {marketData.indicators.emaTrend?.replace(/_/g, " ")}
                  </p>
                </>
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
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    marketData.indicators.rsiCondition === "overbought"
                      ? "bg-red-500/20 text-red-400"
                      : marketData.indicators.rsiCondition === "oversold"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {marketData.indicators.rsiCondition}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono">
                  {marketData.indicators.rsi?.toFixed(1)}
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div
                    className={`h-1.5 rounded-full ${
                      marketData.indicators.rsi > 70 ? "bg-red-500"
                        : marketData.indicators.rsi < 30 ? "bg-green-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, marketData.indicators.rsi)}%` }}
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
                  <span className={`text-xs font-medium ${
                    marketData.indicators.macdTrend === "bullish" ? "text-green-500" : "text-red-500"
                  }`}>
                    {marketData.indicators.macdTrend}
                  </span>
                </div>
                <div className={`text-xl font-bold font-mono ${
                  marketData.indicators.macdHistogram > 0 ? "text-green-500" : "text-red-500"
                }`}>
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
                <div className={`text-sm font-bold ${
                  marketData.indicators.emaTrend?.includes("bullish")
                    ? "text-green-500"
                    : marketData.indicators.emaTrend?.includes("bearish")
                    ? "text-red-500"
                    : "text-yellow-500"
                }`}>
                  {marketData.indicators.emaTrend?.replace(/_/g, " ").toUpperCase()}
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
                <div className={`text-sm font-bold ${
                  marketData.indicators.marketStructure === "bullish"
                    ? "text-green-500"
                    : marketData.indicators.marketStructure === "bearish"
                    ? "text-red-500"
                    : "text-yellow-500"
                }`}>
                  {marketData.indicators.marketStructure?.toUpperCase()}
                </div>
                <div className="flex gap-2 mt-1">
                  {marketData.indicators.fvgCount > 0 && (
                    <span className="text-xs text-muted-foreground">{marketData.indicators.fvgCount} FVG</span>
                  )}
                  {marketData.indicators.obCount > 0 && (
                    <span className="text-xs text-muted-foreground">{marketData.indicators.obCount} OB</span>
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

        {/* Price Chart - only renders after streaming completes */}
        {marketData && streamingDone && (
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
              <TradeChart marketData={{ ...marketData, tradeAlert }} selectedSymbol={selectedSymbol} historicalKlines={marketData.dailyKlines as any} />
            </CardContent>
          </Card>
        )}

        {/* Trade Result — shown after analysis completes with trade alert */}
        {streamingDone && tradeResult && tradeAlert?.active && tradeAlert.direction !== "NONE" && (
          <TradeResultCard tradeResult={tradeResult} tradeAlert={tradeAlert} />
        )}

        {/* AI Analysis Stream */}
        <Card className="bg-background/60 backdrop-blur-sm border-primary/10 hover:shadow-md hover:border-primary/20 transition-all max-w-5xl mx-auto w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Backtest Analysis
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
                <History className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  Ready to Backtest
                </h3>
                <p className="text-sm text-muted-foreground/70 max-w-md">
                  Select a past date and time, choose a coin, and click &quot;Analyze&quot; to run AI analysis on historical market data. After the analysis, the trade result will be automatically evaluated.
                </p>
              </div>
            )}

            {(streamedText || isStreaming) && (
              <div className="min-h-[400px]">
                {isLoadingData && !streamedText && (
                  <div className="flex items-center gap-3 text-muted-foreground mb-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">
                      Fetching {selectedSymbol} historical candle data from Binance...
                    </span>
                  </div>
                )}
                <MessageResponse>{streamedText}</MessageResponse>
                {isStreaming && !streamedText && (
                  <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                )}
              </div>
            )}

            {toolPart && (
              <div className="mt-4">
                <Tool defaultOpen={true}>
                  <ToolHeader
                    type="tool-generateTradeAlert"
                    state={toolPart.state ?? "output-available"}
                    title="Trade Signal"
                  />
                  <ToolContent>
                    <ToolOutput
                      output={toolPart.result ?? toolPart.args ?? tradeAlert}
                      errorText={toolPart.errorText}
                    />
                  </ToolContent>
                </Tool>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
