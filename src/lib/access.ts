const publicPaths = ["/", "/store", "/payment-return"];
const publicPrefixes = [
  "/api/store/",
  "/api/public/",
  "/proposal/",
  "/receipt/",
];
export async function authorize(request: Request): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const webhook =
    path === "/api/stripe/webhook" || path.startsWith("/api/webhooks/");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !webhook) {
    const origin = request.headers.get("origin");
    if (
      !origin ||
      origin !== new URL(process.env.APP_URL ?? request.url).origin
    )
      return new Response("Invalid origin", { status: 403 });
  }
  if (
    webhook ||
    publicPaths.includes(path) ||
    publicPrefixes.some((p) => path.startsWith(p))
  )
    return null;
  const user = process.env.POS_USERNAME,
    password = process.env.POS_PASSWORD;
  if (!user || !password || password === "replace-with-a-long-random-password")
    return new Response("Staff access is not configured.", { status: 503 });
  let credentials = "";
  try {
    const header = request.headers.get("authorization") ?? "";
    if (header.startsWith("Basic ")) credentials = atob(header.slice(6));
  } catch {
    /* Invalid authorization is rejected below. */
  }
  const encode = new TextEncoder();
  const [actual, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encode.encode(credentials)),
    crypto.subtle.digest("SHA-256", encode.encode(`${user}:${password}`)),
  ]);
  const a = new Uint8Array(actual),
    b = new Uint8Array(expected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff)
    return new Response("Staff sign-in required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="ProDrillOS POS", charset="UTF-8"',
      },
    });
  return null;
}
