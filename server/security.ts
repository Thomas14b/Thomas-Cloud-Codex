export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function requireOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin)
    throw new HttpError(403, "來源驗證失敗，請重新開啟網站");
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "請使用 JSON");
}
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "缺少內容");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 24000) {
      await reader.cancel();
      throw new HttpError(413, "內容過長");
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    buffer.set(c, offset);
    offset += c.length;
  }
  try {
    const data = JSON.parse(new TextDecoder().decode(buffer));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error();
    return data;
  } catch {
    throw new HttpError(400, "內容格式無效");
  }
}
export function uuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new HttpError(400, "識別碼格式無效");
  return value;
}
export function respond(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie, Origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return respond({ error: error.message }, error.status);
  const e = error as { code?: string; message?: string; name?: string };
  if (e.code === "P0001") return respond({ error: e.message }, 400);
  if (e.code === "23514" || e.code === "22P02" || e.code === "22001")
    return respond({ error: "輸入不符合要求，請檢查後重試" }, 400);
  // Never leak SQL, connection strings, provider headers or raw credentials.
  return respond({ error: "服務暫時無法完成操作，請稍後重試" }, 503);
}
