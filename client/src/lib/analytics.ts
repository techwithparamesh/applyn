export type AnalyticsEventName = string;

function safeName(name: string): string | null {
  const n = String(name || "").trim();
  if (!n) return null;
  if (n.length > 64) return null;
  return n;
}

function safeProps(props: unknown): Record<string, any> {
  if (!props || typeof props !== "object" || Array.isArray(props)) return {};
  return props as Record<string, any>;
}

/**
 * Best-effort product analytics.
 * - Never throws
 * - Uses same-origin POST to server
 * - Always runs outside render (call from handlers/effects)
 */
export async function track(name: AnalyticsEventName, properties?: Record<string, any>): Promise<void> {
  const safe = safeName(name);
  if (!safe) return;

  const payload = {
    name: safe,
    properties: {
      ...safeProps(properties),
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
      ts: Date.now(),
    },
  };

  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best-effort: ignore.
  }
}
