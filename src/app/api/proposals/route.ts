import { db } from "@/lib/db";
import { endpoint, HttpError } from "@/lib/http";
import {
  proposalInput,
  proposalStatuses,
  canTransition,
} from "@/lib/commerce-validation";
import { z } from "zod";
export const GET = endpoint(async () =>
  Response.json(
    await db.proposal.findMany({
      orderBy: { created_at: "desc" },
      include: { customer: true, events: { orderBy: { created_at: "asc" } } },
    }),
  ),
);
export const POST = endpoint(async (r) =>
  Response.json(
    await db.proposal.create({
      data: {
        ...proposalInput.parse(await r.json()),
        currency: (process.env.SHOP_CURRENCY ?? "mxn").toLowerCase(),
        events: { create: { status: "Draft" } },
      },
    }),
    { status: 201 },
  ),
);
export const PATCH = endpoint(async (r) => {
  const input = z
    .object({
      id: z.uuid(),
      expected_status: z.enum(proposalStatuses),
      status: z.enum(proposalStatuses),
      carrier: z.enum(["DHL", "FedEx", "UPS", "USPS", "Other"]).optional(),
      tracking_number: z.string().trim().max(100).optional(),
      deposit_reference: z.string().trim().max(200).optional(),
    })
    .parse(await r.json());
  return Response.json(
    await db.$transaction(async (tx) => {
      const p = await tx.proposal.findUniqueOrThrow({
        where: { id: input.id },
      });
      if (!canTransition(p.status, input.status, p.deposit_amount))
        throw new HttpError(409, "Invalid proposal transition");
      if (input.status === "Deposit_Paid" && !input.deposit_reference)
        throw new HttpError(
          400,
          "A verified deposit receipt/reference is required",
        );
      if (
        input.status === "Shipped" &&
        (!input.carrier || !input.tracking_number)
      )
        throw new HttpError(400, "Carrier and tracking number required");
      const result = await tx.proposal.updateMany({
        where: { id: p.id, status: input.expected_status },
        data: {
          status: input.status,
          carrier: input.carrier,
          tracking_number: input.tracking_number,
          deposit_reference: input.deposit_reference,
        },
      });
      if (!result.count)
        throw new HttpError(409, "Proposal changed; refresh and retry");
      await tx.proposalEvent.create({
        data: { proposal_id: p.id, status: input.status },
      });
      return tx.proposal.findUniqueOrThrow({ where: { id: p.id } });
    }),
  );
});
