import type { OrderStatus } from "@/lib/shop";

export interface OrderDetail {
  id: string;
  order_number: string;
  status: OrderStatus;
  customer_name: string;
  address: string;
  city: string;
  postal_code: string | null;
  shipping_method: string;
  shipping_cost: number;
  subtotal: number;
  total_amount: number;
  notes: string | null;
  tracking_number: string | null;
  created_at: string;
  items: { id: string; name: string; sku: string; quantity: number; unit_price: number; subtotal: number }[];
  events: { status: OrderStatus; created_at: string }[];
}

const KEY = "adzkia-last-order";

export function rememberOrder(no: string, phone: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ no, phone }));
  } catch {
    /* abaikan */
  }
}

export function recallOrder(no: string | null): string | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { no: string; phone: string } | null;
    return v && (!no || v.no === no) ? v.phone : null;
  } catch {
    return null;
  }
}

export const fmtDateTime = (s: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(s));
