import type { Product } from "./client";
export type CatalogProduct = Product & {
  barcode?: string | null;
  brand?: string | null;
  model?: string | null;
  supplier?: string | null;
  ball?: { weight: number; oil_category: string; rg_category: string } | null;
  shoe?: { size: string; style: string; tier: string } | null;
  bag?: { ball_capacity: number; bag_type: string } | null;
};
export type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone_whatsapp: string | null;
  notes: string;
  specs: { id: string; notes: string; created_at: string }[];
};
export type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  components: { service_id: string; quantity: number; service: Service }[];
};
export type Proposal = {
  id: string;
  title: string;
  description: string;
  customer_id: string;
  customer: Customer;
  approval_token: string;
  status: string;
  total_amount: number;
  deposit_amount: number;
  currency: string;
  carrier: string | null;
  tracking_number: string | null;
  events: { status: string; created_at: string }[];
};
export const categoryName = (c: string) =>
  ({
    BOWLING_BALLS: "Bowling balls",
    REACTIVE_RESIN: "Bowling balls",
    URETHANE: "Bowling balls",
    SHOES: "Shoes",
    BAGS: "Bags",
  })[c] ?? "Accessories";
