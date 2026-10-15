import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
test(
  "HTTP receiving, service checkout, receipt and customer approval flow",
  { skip: !process.env.TEST_API_BASE },
  async () => {
    const base = process.env.TEST_API_BASE!;
    const { db } = await import("../src/lib/db");
    const auth = `Basic ${Buffer.from(`${process.env.POS_USERNAME}:${process.env.POS_PASSWORD}`).toString("base64")}`;
    const created: {
      product?: string;
      customer?: string;
      service?: string;
      proposal?: string;
      sale?: string;
    } = {};
    async function request(
      path: string,
      method = "GET",
      body?: unknown,
      staff = true,
    ) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(staff ? { Authorization: auth } : {}),
          Origin: base,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      assert.equal(response.ok, true, JSON.stringify(data));
      return data;
    }
    try {
      assert.equal((await fetch(`${base}/api/customers`)).status, 401);
      const product = await request("/api/products", "POST", {
        name: "QA bowling ball",
        sku: `QA-${randomUUID()}`,
        category: "BOWLING_BALLS",
        price: 450000,
        cost: 300000,
        stock_quantity: 2,
        low_stock_threshold: 2,
      });
      created.product = product.id;
      await request("/api/catalog", "PATCH", {
        id: product.id,
        version: 0,
        barcode: `QA-${product.id}`,
        brand: "QA",
        model: "Test",
        ball: { weight: 15, oil_category: "Heavy", rg_category: "Low" },
      });
      const receive = {
        code: `QA-${product.id}`,
        quantity: 3,
        reference: "QA receiving",
        request_id: randomUUID(),
      };
      const received = await request("/api/receiving", "POST", receive);
      assert.equal(received.stock_quantity, 5);
      assert.equal(
        (await request("/api/receiving", "POST", receive)).stock_quantity,
        5,
      );
      const customer = await request("/api/customers", "POST", {
        full_name: "QA Customer",
        email: "qa@example.com",
        phone_whatsapp: "+525512345678",
        notes: "Disposable integration test",
      });
      created.customer = customer.id;
      await request("/api/customers", "PATCH", {
        id: customer.id,
        full_name: customer.full_name,
        email: customer.email,
        phone_whatsapp: customer.phone_whatsapp,
        notes: customer.notes,
        spec: "Test span and pitch",
      });
      const service = await request("/api/services", "POST", {
        name: "QA drilling",
        price: 100000,
      });
      created.service = service.id;
      const checkout = {
        idempotency_key: randomUUID(),
        payment_method: "CASH",
        customer_id: customer.id,
        items: [
          { product_id: product.id, quantity: 1 },
          { service_id: service.id, quantity: 1 },
        ],
      };
      const sale = await request("/api/checkout", "POST", checkout);
      created.sale = sale.id;
      assert.equal(sale.status, "COMPLETE");
      assert.equal(sale.total_amount, 550000);
      assert.equal(sale.currency, "mxn");
      assert.equal(
        (await request("/api/checkout", "POST", checkout)).id,
        sale.id,
      );
      const receipt = await request(
        `/api/public/receipt?token=${sale.receipt_token}`,
        "GET",
        undefined,
        false,
      );
      assert.equal(receipt.items.length, 2);
      assert.equal(receipt.customer, undefined);
      const proposal = await request("/api/proposals", "POST", {
        customer_id: customer.id,
        title: "QA proposal",
        description: "Disposable QA proposal",
        total_amount: 550000,
        deposit_amount: 100000,
      });
      created.proposal = proposal.id;
      assert.equal(
        (
          await fetch(
            `${base}/api/public/proposal?token=${proposal.approval_token}`,
          )
        ).status,
        404,
      );
      await request("/api/proposals", "PATCH", {
        id: proposal.id,
        expected_status: "Draft",
        status: "Sent",
      });
      await request(
        "/api/public/proposal",
        "POST",
        { token: proposal.approval_token },
        false,
      );
      await request(
        "/api/public/proposal",
        "POST",
        { token: proposal.approval_token },
        false,
      );
      const approved = await request(
        `/api/public/proposal?token=${proposal.approval_token}`,
        "GET",
        undefined,
        false,
      );
      assert.equal(approved.status, "Approved");
      assert.equal(
        approved.events.filter(
          (e: { status: string }) => e.status === "Approved",
        ).length,
        1,
      );
      assert.equal(approved.customer, undefined);
      assert.equal(
        (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
          .stock_quantity,
        4,
      );
    } finally {
      if (created.proposal) {
        await db.proposalEvent.deleteMany({
          where: { proposal_id: created.proposal },
        });
        await db.proposal.delete({ where: { id: created.proposal } });
      }
      if (created.sale) {
        await db.transactionItem.deleteMany({
          where: { transaction_id: created.sale },
        });
        await db.transaction.delete({ where: { id: created.sale } });
      }
      if (created.product) {
        await db.stockMovement.deleteMany({
          where: { product_id: created.product },
        });
        await db.product.delete({ where: { id: created.product } });
      }
      if (created.service)
        await db.service.delete({ where: { id: created.service } });
      if (created.customer) {
        await db.customerSpec.deleteMany({
          where: { customer_id: created.customer },
        });
        await db.customer.delete({ where: { id: created.customer } });
      }
      await db.$disconnect();
    }
  },
);
