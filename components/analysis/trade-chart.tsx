"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineStyle,
  ColorType,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  type CandlestickData,
  type Time,
  type DeepPartial,
  type ChartOptions,
} from "lightweight-charts";

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

interface MarketData {
  price: number;
  keySupport: number;
  keyResistance: number;
  tradeAlert?: TradeAlert;
}

interface TradeChartProps {
  marketData: MarketData;
  selectedSymbol: string;
  historicalKlines?: BinanceKline[];
}

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
  XRP: "XRPUSDT",
  ADA: "ADAUSDT",
  DOGE: "DOGEUSDT",
  AVAX: "AVAXUSDT",
  LINK: "LINKUSDT",
  DOT: "DOTUSDT",
};

interface BinanceKline {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

async function fetchKlines(symbol: string): Promise<BinanceKline[]> {
  const binanceSymbol = BINANCE_SYMBOL_MAP[symbol] || `${symbol}USDT`;
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1d&limit=90`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch klines: ${response.statusText}`);
  }

  const data: unknown[][] = await response.json();

  return data.map((k) => ({
    time: (Number(k[0]) / 1000) as Time,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
  }));
}

function isDarkMode(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("dark");
}

export function TradeChart({ marketData, selectedSymbol, historicalKlines }: TradeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Single useEffect: init chart, load klines, draw levels — all in sequence
  useEffect(() => {
    if (!containerRef.current) return;

    const dark = isDarkMode();
    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: dark ? "rgba(0,0,0,0)" : "#ffffff" },
        textColor: dark ? "#a1a1aa" : "#374151",
      },
      grid: {
        vertLines: { color: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)" },
        horzLines: { color: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)" },
      },
      crosshair: {
        vertLine: { color: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" },
        horzLine: { color: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" },
      },
      rightPriceScale: {
        borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
      },
      timeScale: {
        borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
        timeVisible: false,
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { vertTouchDrag: false },
    };

    const chart = createChart(containerRef.current, chartOptions);
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: dark ? "#22c55e" : "#16a34a",
      downColor: dark ? "#ef4444" : "#dc2626",
      borderUpColor: dark ? "#22c55e" : "#16a34a",
      borderDownColor: dark ? "#ef4444" : "#dc2626",
      wickUpColor: dark ? "#22c55e" : "#16a34a",
      wickDownColor: dark ? "#ef4444" : "#dc2626",
    });
    seriesRef.current = series;

    const markers = createSeriesMarkers(series, []);

    const fmt = (n: number) =>
      n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const lines: IPriceLine[] = [];

    const addLine = (price: number, color: string, width: 1 | 2 | 3, style: LineStyle, title: string) => {
      lines.push(series.createPriceLine({ price, color, lineWidth: width, lineStyle: style, axisLabelVisible: true, title }));
    };

    // Load klines then draw everything
    let cancelled = false;

    const loadKlines = historicalKlines && historicalKlines.length > 0
      ? Promise.resolve(historicalKlines)
      : fetchKlines(selectedSymbol);

    loadKlines.then((klines) => {
      if (cancelled) return;

      series.setData(klines as CandlestickData<Time>[]);
      chart.timeScale().fitContent();

      const alert = marketData.tradeAlert;
      const hasTrade = alert?.active && alert.direction !== "NONE" && alert.entryPrice != null && alert.entryPrice > 0;

      if (hasTrade) {
        // Entry - thick gold
        addLine(alert!.entryPrice!, "#f59e0b", 3, LineStyle.Solid, `Entry: $${fmt(alert!.entryPrice!)}`);

        // Stop Loss - red dashed
        if (alert!.stopLoss != null) {
          addLine(alert!.stopLoss, "#ef4444", 2, LineStyle.Dashed, `SL: $${fmt(alert!.stopLoss)}`);
        }

        // Take Profit - green dashed
        if (alert!.takeProfit != null) {
          addLine(alert!.takeProfit, "#22c55e", 2, LineStyle.Dashed, `TP: $${fmt(alert!.takeProfit)}`);
        }

        // Subtle support/resistance dotted
        if (marketData.keySupport > 0) {
          addLine(marketData.keySupport, "rgba(34,197,94,0.35)", 1, LineStyle.Dotted, "Support");
        }
        if (marketData.keyResistance > 0) {
          addLine(marketData.keyResistance, "rgba(239,68,68,0.35)", 1, LineStyle.Dotted, "Resistance");
        }

        // Arrow marker on last candle
        if (klines.length > 0) {
          const last = klines[klines.length - 1];
          markers.setMarkers([
            {
              time: last.time,
              position: alert!.direction === "LONG" ? "belowBar" : "aboveBar",
              shape: alert!.direction === "LONG" ? "arrowUp" : "arrowDown",
              color: alert!.direction === "LONG" ? "#22c55e" : "#ef4444",
              text: alert!.direction,
              size: 2,
            },
          ]);
        }
      } else {
        // Default: support / resistance / current
        if (marketData.keySupport > 0) {
          addLine(marketData.keySupport, "#22c55e", 2, LineStyle.Dashed, "Support");
        }
        if (marketData.keyResistance > 0) {
          addLine(marketData.keyResistance, "#ef4444", 2, LineStyle.Dashed, "Resistance");
        }
        if (marketData.price > 0) {
          addLine(marketData.price, "#3b82f6", 1, LineStyle.Solid, "Current");
        }
      }
    }).catch(() => {});

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      markers.setMarkers([]);
      for (const line of lines) {
        try { series.removePriceLine(line); } catch {}
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [marketData, selectedSymbol, historicalKlines]);

  return (
    <div ref={containerRef} className="w-full h-[400px] md:h-[480px]" />
  );
}
