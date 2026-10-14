import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(
  url && key && !url.includes("YOUR_PROJECT") && !key.includes("YOUR_PUBLIC"),
);
export const db = configured ? createClient(url, key) : null;
export async function rpc<T = void>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!db) throw new Error("尚未連接服務");
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data as T;
}
export async function rows<T>(
  table: string,
  filters: Record<string, string> = {},
  or?: string,
  order = "id",
): Promise<T[]> {
  if (!db) return [];
  // Page beyond Supabase's default 1000-row response limit.
  const all: T[] = [];
  for (let start = 0; ; start += 500) {
    let query = db.from(table).select("*");
    for (const [key, value] of Object.entries(filters))
      query = query.eq(key, value);
    if (or) query = query.or(or);
    const { data, error } = await query.order(order).range(start, start + 499);
    if (error) throw error;
    all.push(...(data as T[]));
    if (data.length < 500) return all;
  }
}
