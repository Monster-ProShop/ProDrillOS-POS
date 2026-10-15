import { HttpError } from "@/lib/http";
export async function verifyCheckoutChallenge(token: unknown) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production")
      throw new HttpError(503, "Checkout protection is not configured");
    return;
  }
  if (typeof token !== "string" || !token || token.length > 2048)
    throw new HttpError(400, "Complete the checkout security check");
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new HttpError(503, "Checkout verification unavailable");
  const result = (await response.json()) as {
    success: boolean;
    hostname: string;
    action: string;
  };
  if (
    !result.success ||
    result.hostname !== new URL(process.env.APP_URL!).hostname ||
    result.action !== "checkout"
  )
    throw new HttpError(400, "Security check expired. Please try again.");
}
