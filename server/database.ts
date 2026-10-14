import { getDatabase } from "@netlify/database";
import { getUser, type User } from "@netlify/identity";
interface DatabaseClient {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, any>[]; rowCount: number | null }>;
  release(): void;
}
import { HttpError } from "./security";
export async function authenticated(): Promise<User> {
  const user = await getUser();
  if (!user) throw new HttpError(401, "請先登入");
  return user;
}
export async function transaction<T>(
  user: User,
  work: (client: DatabaseClient) => Promise<T>,
): Promise<T> {
  const client =
    (await getDatabase().pool.connect()) as unknown as DatabaseClient;
  try {
    await client.query("BEGIN");
    await client.query("select set_config('app.user_id',$1,true)", [user.id]);
    // Only signed app_metadata.roles, never user-editable metadata, grants administration.
    // Role changes take effect at the next login/token refresh.
    const isAdmin = user.roles?.includes("admin") ?? false;
    await client.query(
      `insert into game.profiles(id,display_name,email,is_admin) values($1,$2,$3,$4)
 on conflict(id) do update set display_name=excluded.display_name,email=excluded.email,is_admin=excluded.is_admin`,
      [
        user.id,
        (user.name || "新同學").slice(0, 60),
        user.email || "",
        isAdmin,
      ],
    );
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
