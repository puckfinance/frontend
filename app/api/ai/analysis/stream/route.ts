import { NextRequest } from "next/server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") || "BTC";
  const timeframe = request.nextUrl.searchParams.get("timeframe") || "all";
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!backendUrl) {
    return new Response(JSON.stringify({ error: "API URL not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstreamUrl = `${backendUrl}/api/v1/ai/analysis/stream?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to connect to backend" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!upstreamResponse.ok) {
    const text = await upstreamResponse.text();
    return new Response(text, {
      status: upstreamResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reader = upstreamResponse.body?.getReader();
  if (!reader) {
    return new Response(
      JSON.stringify({ error: "No upstream response body" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (err: any) {
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
