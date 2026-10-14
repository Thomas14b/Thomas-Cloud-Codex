import type { Config } from "@netlify/functions";
import { authenticated, transaction } from "../../server/database";
import {
  requireOrigin,
  readBody,
  respond,
  failure,
  HttpError,
} from "../../server/security";
import { rpcQuery, readQuery } from "../../server/contracts";
export default async (req: Request) => {
  try {
    if (req.method !== "POST") throw new HttpError(405, "只接受 POST");
    requireOrigin(req);
    const user = await authenticated();
    const body = await readBody(req);
    if (body.kind === "rpc") {
      const query = rpcQuery(body.name, body.args);
      return respond(
        await transaction(
          user,
          async (client) =>
            (await client.query(query.sql, query.values)).rows[0].result,
        ),
      );
    }
    if (body.kind === "read") {
      const query = readQuery(body.table, user.id, body.page ?? 0);
      return respond(
        await transaction(
          user,
          async (client) => (await client.query(query.sql, query.values)).rows,
        ),
      );
    }
    throw new HttpError(400, "操作無效");
  } catch (e) {
    return failure(e);
  }
};
export const config: Config = { path: "/api/game" };
