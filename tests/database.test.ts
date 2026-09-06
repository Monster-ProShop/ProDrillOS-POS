import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";

test("PostgreSQL checkout and payment invariants", { skip: !process.env.TEST_DATABASE_URL }, async t => {
  // This suite inserts and deletes only its own IDs; use a disposable test database.
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.SHOP_CURRENCY = "usd";
  const { db } = await import("../src/lib/db");
  const { createSale } = await import("../src/lib/checkout");
  const { settleSession } = await import("../src/lib/stripe");
  const productIds: string[] = [], keys: string[] = [];
  async function product(stock = 1) {
    const p = await db.product.create({ data: { name: "Integration test", sku: `TEST-${randomUUID().toUpperCase()}`,
      category: "TAPE", price: 1999, cost: 1000, stock_quantity: stock } });
    productIds.push(p.id); return p;
  }
  function request(productId: string, method: "CASH"|"STRIPE" = "CASH") {
    const key = randomUUID(); keys.push(key);
    return { idempotency_key: key, payment_method: method, items: [{product_id: productId, quantity: 1}] };
  }
  try {
    await t.test("competing checkouts cannot oversell", async () => {
      const p = await product();
      const outcomes = await Promise.allSettled([createSale(request(p.id)), createSale(request(p.id))]);
      assert.equal(outcomes.filter(o=>o.status==="fulfilled").length,1);
      assert.equal(outcomes.filter(o=>o.status==="rejected").length,1);
      assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock_quantity,0);
    });
    await t.test("concurrent retries create one sale and deduct once",async()=>{
      const p = await product(3), input = request(p.id);
      const [a,b]=await Promise.all([createSale(input),createSale(input)]);
      assert.equal(a.id,b.id);
      assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock_quantity,2);
      await assert.rejects(createSale({...input,items:[{product_id:p.id,quantity:2}]}));
    });
    await t.test("a later stock failure rolls back an earlier deduction",async()=>{
      const a=await product(2),b=await product(2);
      const [first,last]=[a,b].sort((x,y)=>x.id.localeCompare(y.id));
      await db.product.update({where:{id:last.id},data:{stock_quantity:0}});
      const input=request(first.id);
      input.items.push({product_id:last.id,quantity:1});
      await assert.rejects(createSale(input));
      assert.equal((await db.product.findUniqueOrThrow({where:{id:first.id}})).stock_quantity,2);
      assert.equal(await db.transaction.count({where:{idempotency_key:input.idempotency_key}}),0);
    });
    await t.test("database rejects negative stock independently of request validation",async()=>{
      const p=await product();
      await assert.rejects(db.product.update({where:{id:p.id},data:{stock_quantity:-1}}));
    });
    await t.test("expired webhook restores stock exactly once",async()=>{
      const p=await product(),sale=await createSale(request(p.id,"STRIPE"));
      const session={id:`cs_test_${randomUUID()}`,metadata:{transaction_id:sale.id},client_reference_id:sale.id,
        amount_total: sale.total_amount,currency:sale.currency,status:"expired",payment_status:"unpaid"} as unknown as Stripe.Checkout.Session;
      await Promise.all([settleSession(session),settleSession(session)]);
      assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock_quantity,1);
      assert.equal((await db.transaction.findUniqueOrThrow({where:{id:sale.id}})).status,"EXPIRED");
    });
    await t.test("paid webhook validates amount and completes only once",async()=>{
      const p=await product(),sale=await createSale(request(p.id,"STRIPE"));
      const session={id:`cs_test_${randomUUID()}`,metadata:{transaction_id:sale.id},client_reference_id:sale.id,
        amount_total:sale.total_amount,currency:sale.currency,status:"complete",payment_status:"paid"} as unknown as Stripe.Checkout.Session;
      await assert.rejects(settleSession({...session,amount_total:1}));
      const paidAt=new Date("2026-09-06T05:59:00Z");
      await settleSession(session,paidAt); await settleSession(session,new Date());
      const result=await db.transaction.findUniqueOrThrow({where:{id:sale.id}});
      assert.equal(result.completed_at?.toISOString(),paidAt.toISOString());
      assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock_quantity,0);
    });
  } finally {
    const where={idempotency_key:{in:keys}};
    await db.transactionItem.deleteMany({where:{transaction:where}});
    await db.transaction.deleteMany({where});
    await db.product.deleteMany({where:{id:{in:productIds}}});
    await db.$disconnect();
  }
});
