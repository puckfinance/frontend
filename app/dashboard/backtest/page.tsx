"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  runBacktest,
  type BacktestTrade,
  type BacktestSummary,
} from "@/lib/analysis-history";
import {
  Play,
  Trophy,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
} from "lucide-react";

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

function ResultBadge({ result }: { result: string }) {
  const config: Record<string, { icon: React.ReactNode; bg: string; text: string; label: string }> = {
    WIN: {
      icon: <Trophy className="h-3.5 w-3.5" />,
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
  const c = config[result];
  if (!c) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${c.bg} ${c.text}`}>
      {c.icon} {c.label}
    </span>
  );
}

export default function BacktestPage() {
  const { data: session } = useSession();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);

  const handleRunBacktest = async () => {
    if (!fromDate || !toDate) {
      setError("Please select both from and to dates");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await runBacktest({
        from: new Date(fromDate).toISOString(),
        to: new Date(toDate + "T23:59:59").toISOString(),
        symbol: symbol || undefined,
      });
      setSummary(result.summary);
      setTrades(result.trades);
    } catch (err: any) {
      setError(err.message || "Failed to run backtest");
    } finally {
      setLoading(false);
    }
  };

  const winRate = summary ? (summary.wins / (summary.wins + summary.losses || 1)) * 100 : 0;

  return (
    <AuthGuard>
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Backtest Trade Alerts
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Evaluate how AI trade alerts performed over a selected date range. Checks if price hit entry first, then evaluates TP/SL.
          </p>
        </div>

        <Card className="bg-background/60 backdrop-blur-sm border-primary/10">
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-1.5 flex-1 min-w-[180px]">
                <label className="text-sm font-medium text-muted-foreground">From Date</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5 flex-1 min-w-[180px]">
                <label className="text-sm font-medium text-muted-foreground">To Date</label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Symbol</label>
                <div className="flex flex-wrap gap-1.5">
                  {SYMBOLS.map((sym) => (
                    <button
                      key={sym.value}
                      onClick={() => setSymbol(sym.value)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                        symbol === sym.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background/60 text-muted-foreground border-primary/10 hover:border-primary/30"
                      }`}
                    >
                      {sym.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={handleRunBacktest}
                disabled={loading || !fromDate || !toDate}
                className="gap-2 min-w-[140px]"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {loading ? "Running..." : "Run Backtest"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {summary && (
          <>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              <Card className="bg-background/60 backdrop-blur-sm border-primary/10">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Total Alerts</p>
                  <p className="text-2xl font-bold">{summary.totalAnalyses}</p>
                </CardContent>
              </Card>
              <Card className="bg-background/60 backdrop-blur-sm border-green-500/20">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Wins (TP Hit)</p>
                  <p className="text-2xl font-bold text-green-500 flex items-center gap-1">
                    <Trophy className="h-5 w-5" />
                    {summary.wins}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-background/60 backdrop-blur-sm border-red-500/20">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Losses (SL Hit)</p>
                  <p className="text-2xl font-bold text-red-500 flex items-center gap-1">
                    <XCircle className="h-5 w-5" />
                    {summary.losses}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-background/60 backdrop-blur-sm border-yellow-500/20">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-500 flex items-center gap-1">
                    <Clock className="h-5 w-5" />
                    {summary.pending}
                  </p>
                </CardContent>
              </Card>
              <Card className={`bg-background/60 backdrop-blur-sm border-${winRate >= 50 ? "green" : "red"}-500/20`}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className={`text-2xl font-bold ${winRate >= 50 ? "text-green-500" : "text-red-500"}`}>
                    {winRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary.wins + summary.losses} resolved
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-background/60 backdrop-blur-sm border-primary/10">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Entry Not Hit</p>
                  <p className="text-2xl font-bold text-muted-foreground">
                    {summary.entryNotHit}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Avg RR: {summary.avgRiskReward.toFixed(2)}:1
                  </p>
                </CardContent>
              </Card>
            </div>

            {trades.length > 0 && (
              <Card className="bg-background/60 backdrop-blur-sm border-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Trade-by-Trade Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Date</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Symbol</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Direction</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Entry</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">SL</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">TP</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">RR</th>
                          <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Entry Hit</th>
                          <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Result</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Hit At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((t) => (
                          <tr key={t.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {formatDate(t.createdAt)}
                            </td>
                            <td className="px-3 py-2.5 font-semibold">{t.symbol}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                                t.direction === "LONG" ? "text-green-500" : "text-red-500"
                              }`}>
                                {t.direction === "LONG" ? (
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDownRight className="h-3.5 w-3.5" />
                                )}
                                {t.direction}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">${formatUSD(t.entryPrice)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-red-500">${formatUSD(t.stopLoss)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-green-500">${formatUSD(t.takeProfit)}</td>
                            <td className="px-3 py-2.5 text-right font-mono">
                              {t.riskReward != null ? `${t.riskReward}:1` : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {t.entryHit ? (
                                <span className="text-green-500 text-xs">Yes</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">No</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <ResultBadge result={t.result} />
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                              {t.hitAt ? formatDate(t.hitAt) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AuthGuard>
  );
}
