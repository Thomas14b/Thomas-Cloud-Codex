export async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "服務回應格式不正確，請重新開啟網站" }));
  if (!response.ok) throw new Error(data.error || "服務暫時無法使用");
  return data as T;
}
export async function rpc<T = void>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return request<T>("/api/game", { kind: "rpc", name, args });
}
// Ownership filters are enforced by the server from verified Identity, not supplied by the browser.
export async function rows<T>(table: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    const data = await request<T[]>("/api/game", { kind: "read", table, page });
    all.push(...data);
    if (data.length < 500) return all;
  }
}
