import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import {
  canTransition,
  customerInput,
  proposalInput,
  trackingUrl,
} from "../src/lib/commerce-validation";
import { checkoutInput } from "../src/lib/validation";
import { verifyMercadoSignature } from "../src/lib/gateways";
import { authorize } from "../src/lib/access";
test("proposal transitions cannot skip approval or a required deposit", () => {
  assert.equal(canTransition("Draft", "Approved", 500), false);
  assert.equal(canTransition("Approved", "In_Progress", 500), false);
  assert.equal(canTransition("Approved", "In_Progress", 0), true);
  assert.equal(canTransition("Shipped", "Fulfilled", 500), true);
  assert.equal(canTransition("Fulfilled", "Draft", 0), false);
});
test("customer contacts and proposal amounts are validated", () => {
  assert.equal(
    customerInput.safeParse({
      full_name: "Player",
      email: "",
      phone_whatsapp: "+525512345678",
    }).success,
    true,
  );
  assert.equal(
    customerInput.safeParse({
      full_name: "Player",
      email: "",
      phone_whatsapp: "5555",
    }).success,
    false,
  );
  assert.equal(
    proposalInput.safeParse({
      customer_id: randomUUID(),
      title: "Package",
      description: "Drilling",
      total_amount: 100,
      deposit_amount: 101,
    }).success,
    false,
  );
});
test("checkout line must refer to exactly one product or service", () => {
  const request = { idempotency_key: randomUUID(), payment_method: "CASH" };
  assert.equal(
    checkoutInput.safeParse({ ...request, items: [{ quantity: 1 }] }).success,
    false,
  );
  assert.equal(
    checkoutInput.safeParse({
      ...request,
      items: [
        { quantity: 1, product_id: randomUUID(), service_id: randomUUID() },
      ],
    }).success,
    false,
  );
  assert.equal(
    checkoutInput.safeParse({
      ...request,
      items: [{ quantity: 1, service_id: randomUUID() }],
    }).success,
    true,
  );
});
test("MercadoPago webhook rejects a modified ID or signature", () => {
  const signature = createHmac("sha256", "test-secret")
    .update("id:123;request-id:req-1;ts:123456;")
    .digest("hex");
  assert.equal(
    verifyMercadoSignature(
      `ts=123456,v1=${signature}`,
      "req-1",
      "123",
      "test-secret",
    ),
    true,
  );
  assert.equal(
    verifyMercadoSignature(
      `ts=123456,v1=${signature}`,
      "req-1",
      "124",
      "test-secret",
    ),
    false,
  );
  assert.equal(
    verifyMercadoSignature("ts=123456,v1=bad", "req-1", "123", "test-secret"),
    false,
  );
});
test("tracking links use approved carrier origins and escape tracking values", () => {
  assert.equal(trackingUrl("javascript:alert(1)", "123"), null);
  assert.match(
    trackingUrl("UPS", "123&redirect=evil")!,
    /123%26redirect%3Devil$/,
  );
});
test("public access does not expose staff endpoints or allow cross-origin writes", async () => {
  process.env.APP_URL = "https://pos.prodrillos.com";
  process.env.POS_USERNAME = "test";
  process.env.POS_PASSWORD = "strong-test-password";
  const r = (path: string, options?: RequestInit) =>
    new Request(`https://pos.prodrillos.com${path}`, options);
  assert.equal(await authorize(r("/api/store/products")), null);
  assert.equal((await authorize(r("/api/customers")))?.status, 401);
  assert.equal(
    (
      await authorize(
        r("/api/public/proposal", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      )
    )?.status,
    403,
  );
  assert.equal(
    await authorize(
      r("/api/customers", {
        headers: {
          authorization: `Basic ${Buffer.from("test:strong-test-password").toString("base64")}`,
        },
      }),
    ),
    null,
  );
});
