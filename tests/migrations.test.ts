import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("PostgreSQL migrations upgrade an existing sale and enforce commerce constraints", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      await readFile(
        "prisma/migrations/20260906000000_init/migration.sql",
        "utf8",
      ),
    );
    await pg.exec(
      `INSERT INTO "Transaction" (id,total_amount,currency,payment_method,status,completed_at,idempotency_key,request_hash) VALUES ('11111111-1111-4111-8111-111111111111',100,'mxn','CASH','COMPLETE',now(),'22222222-2222-4222-8222-222222222222','legacy')`,
    );
    await pg.exec(
      await readFile(
        "prisma/migrations/20261014000000_commerce/migration.sql",
        "utf8",
      ),
    );
    const { rows } = await pg.query<{ receipt_token: string }>(
      `SELECT receipt_token FROM "Transaction"`,
    );
    assert.match(rows[0].receipt_token, /^[0-9a-f-]{36}$/);
    await assert.rejects(
      pg.exec(
        `INSERT INTO "Service" (id,name,price) VALUES (gen_random_uuid(),'Invalid',-1)`,
      ),
    );
    await assert.rejects(
      pg.exec(
        `INSERT INTO "TransactionItem" (id,transaction_id,quantity,price_at_sale,name_at_sale) VALUES (gen_random_uuid(),'11111111-1111-4111-8111-111111111111',1,100,'Missing catalog reference')`,
      ),
    );
    await pg.exec(
      `INSERT INTO "Service" (id,name,price) VALUES ('33333333-3333-4333-8333-333333333333','Drilling',10000); INSERT INTO "TransactionItem" (id,transaction_id,service_id,quantity,price_at_sale,name_at_sale) VALUES (gen_random_uuid(),'11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',1,100,'Drilling')`,
    );
  } finally {
    await pg.close();
  }
});
