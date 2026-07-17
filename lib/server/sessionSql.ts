import { Pool } from "pg";
import type { SessionConfig, SessionListItem } from "../../types";

let pool: Pool | null = null;

const getConnectionString = () => process.env.DIRECT_URL || process.env.DATABASE_URL || "";

export const hasSessionSqlConfig = () => Boolean(getConnectionString());

export const getSessionSqlPool = () => {
  if (pool) return pool;
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required for server session APIs.");
  }

  const needsSsl = /sslmode=require/i.test(connectionString) || /supabase\.(co|com)/i.test(connectionString);
  pool = new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
    max: 3,
  });
  return pool;
};

type UpsertSessionInput = {
  id: string;
  cfg: SessionConfig;
  meta: Partial<SessionListItem>;
  expectedRevision?: number;
};

export const findDuplicateSessionFromSql = async ({
  id,
  name,
  date,
}: {
  id: string;
  name: string;
  date: string;
}) => {
  const { rows } = await getSessionSqlPool().query<{ id: string }>(
    `
      select id::text
      from sessions
      where id <> $1
        and date = $2
        and lower(btrim(name)) = lower(btrim($3))
      limit 1
    `,
    [id, date, name]
  );

  return rows[0] || null;
};

export const upsertSessionFromSql = async ({ id, cfg, meta, expectedRevision }: UpsertSessionInput) => {
  const name = (meta.name ?? cfg.name).trim();
  const date = meta.date ?? cfg.date;
  const active = meta.active ?? false;
  const jurorCount = meta.jurorCount ?? 0;
  const resultsVisible = meta.resultsVisible ?? false;

  if (typeof expectedRevision === "number") {
    const { rows } = await getSessionSqlPool().query<{ id: string; revision: number }>(
      `
        update sessions
        set name = $2, date = $3, config = $4::jsonb
        where id = $1 and revision = $5
        returning id::text, revision
      `,
      [id, name, date, JSON.stringify(cfg), expectedRevision]
    );
    if (!rows[0]) {
      const error = new Error("Session revision conflict.") as Error & { code?: string };
      error.code = "revision_conflict";
      throw error;
    }
    return rows[0];
  }

  const { rows } = await getSessionSqlPool().query<{ id: string; revision: number }>(
    `
      insert into sessions (id, name, date, active, juror_count, config, results_visible)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7)
      on conflict (id) do update set
        name = excluded.name,
        date = excluded.date,
        active = excluded.active,
        juror_count = excluded.juror_count,
        config = excluded.config,
        results_visible = excluded.results_visible
      returning id::text, revision
    `,
    [id, name, date, active, jurorCount, JSON.stringify(cfg), resultsVisible]
  );

  return rows[0];
};
