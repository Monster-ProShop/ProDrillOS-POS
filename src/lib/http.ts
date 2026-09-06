import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function endpoint(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try { return await fn(request); }
    catch (error) {
      if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
      if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid input", details: error instanceof ZodError ? error.issues : undefined }, { status: 400 });
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2025", "P2034"].includes(error.code)) {
        return Response.json({ error: "Record conflict. Refresh and retry; SKU or invoice may already exist." }, { status: 409 });
      }
      console.error(error);
      return Response.json({ error: "Operation failed. Retry using the same request." }, { status: 500 });
    }
  };
}
