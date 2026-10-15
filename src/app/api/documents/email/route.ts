import { z } from "zod";
import { db } from "@/lib/db";
import { endpoint, HttpError } from "@/lib/http";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const POST = endpoint(async (r) => {
  const { kind, id } = z
    .object({ kind: z.enum(["receipt", "proposal"]), id: z.uuid() })
    .parse(await r.json());
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new HttpError(
      503,
      "Configure RESEND_API_KEY and EMAIL_FROM to send emails",
    );
  const base = new URL(process.env.APP_URL!).origin;
  let email: string | null | undefined, title: string, url: string;
  if (kind === "proposal") {
    const p = await db.proposal.findUniqueOrThrow({
      where: { id },
      include: { customer: true },
    });
    if (p.status === "Draft")
      throw new HttpError(409, "Publish the approval link first");
    email = p.customer.email;
    title = p.title;
    url = `${base}/proposal/${p.approval_token}`;
  } else {
    const s = await db.transaction.findUniqueOrThrow({
      where: { id },
      include: { customer: true },
    });
    if (s.status !== "COMPLETE")
      throw new HttpError(409, "Only completed sales have a paid receipt");
    email = s.customer?.email;
    title = `Purchase receipt ${s.id.slice(0, 8)}`;
    url = `${base}/receipt/${s.receipt_token}`;
  }
  if (!email)
    throw new HttpError(
      400,
      "Add an email address to the assigned customer first",
    );
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `${kind}/${id}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: `ProDrillOS · ${title}`,
      text: `ProDrillOS POS\n${title}\nView your secure document: ${url}`,
      html: `<div style="background:#0b0f19;color:#e5e7eb;padding:32px;font-family:Arial,sans-serif"><img src="${escape(base)}/brand/prodrillos-logo.png" alt="ProDrillOS" width="64"/><h1>ProDrillOS POS</h1><h2>${escape(title)}</h2><p>Your document is ready.</p><a style="display:inline-block;background:#38bdf8;color:#0b0f19;padding:14px 20px;border-radius:8px" href="${escape(url)}">View ${kind === "proposal" ? "proposal & tracking" : "receipt"}</a></div>`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!result.ok)
    throw new HttpError(
      502,
      "Email provider did not confirm delivery acceptance. Retry the same document.",
    );
  return Response.json({ sent: true });
});
