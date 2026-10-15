import { db } from "@/lib/db";
import { endpoint, HttpError } from "@/lib/http";
import { z } from "zod";
const select = {
  title: true,
  description: true,
  total_amount: true,
  deposit_amount: true,
  currency: true,
  status: true,
  carrier: true,
  tracking_number: true,
  updated_at: true,
  events: {
    select: { status: true, created_at: true },
    orderBy: { created_at: "asc" as const },
  },
};
export const GET = endpoint(async (r) => {
  const token = z.uuid().parse(new URL(r.url).searchParams.get("token"));
  const p = await db.proposal.findFirst({
    where: { approval_token: token, status: { not: "Draft" } },
    select,
  });
  if (!p) throw new HttpError(404, "Proposal unavailable");
  return Response.json(p, {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
});
export const POST = endpoint(async (r) => {
  const { token } = z.object({ token: z.uuid() }).parse(await r.json());
  return Response.json(
    await db.$transaction(async (tx) => {
      const p = await tx.proposal.findUnique({
        where: { approval_token: token },
      });
      if (!p || p.status === "Draft")
        throw new HttpError(404, "Proposal unavailable");
      if (p.status !== "Sent") return { status: p.status };
      const changed = await tx.proposal.updateMany({
        where: { id: p.id, status: "Sent" },
        data: { status: "Approved" },
      });
      if (changed.count)
        await tx.proposalEvent.create({
          data: { proposal_id: p.id, status: "Approved" },
        });
      return { status: "Approved" };
    }),
  );
});
