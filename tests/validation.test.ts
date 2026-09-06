import { test } from "node:test";
import assert from "node:assert/strict";
import { toCents, checkoutInput } from "../src/lib/validation";
import { parseInvoice } from "../src/lib/invoices";
test("money avoids floating point rounding and rejects excess precision", () => {
  assert.equal(toCents("19.99"),1999);
  assert.equal(toCents("0.29"),29);
  assert.throws(()=>toCents("1.001"));
  assert.throws(()=>toCents("-5"));
});
test("invoice parsing supports BOM, quoted SKUs and combines duplicates",()=>{
  assert.deepEqual(parseInvoice('\uFEFFsku,quantity\n" abc ",2\nABC,3\n'),[{sku:"ABC",quantity:5}]);
});
test("invoice rejects negative, fractional, empty, and oversized quantities",()=>{
  for(const q of ["-1","1.5","0","1000001"]) assert.throws(()=>parseInvoice(`sku,quantity\nABC,${q}`));
  assert.throws(()=>parseInvoice("sku,quantity\n"));
  assert.throws(()=>parseInvoice("product,count\nABC,3"));
});
test("checkout refuses duplicate lines and nonpositive quantities",()=>{
  const id="11111111-1111-4111-8111-111111111111";
  const base={idempotency_key:id,payment_method:"CASH"};
  assert.equal(checkoutInput.safeParse({...base,items:[{product_id:id,quantity:1},{product_id:id,quantity:1}]}).success,false);
  assert.equal(checkoutInput.safeParse({...base,items:[{product_id:id,quantity:0}]}).success,false);
});
