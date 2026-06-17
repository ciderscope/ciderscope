import { Pool } from "pg";
import type { SessionConfig, SessionListItem } from "../../types";

let pool: Pool | null = null;

const getConnectionString = () => process.env.DIRECT_URL || process.env.DATABASE_URL || "";

export const hasSessionSqlConfig = () => Boolean(getConnectionString());

const getPool = () => {
  if (pool) return pool;
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required for server session APIs.");
  }

  const needsSsl = /sslmode=require/i.test(connectionString) || /supabase\.(co|com)/i.test(connectionString);
  pool = new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 3,
  });
  return pool;
};

type UpsertSessionInput = {
  id: string;
  cfg: SessionConfig;
  meta: Partial<SessionListItem>;
};

export const upsertSessionFromSql = async ({ id, cfg, meta }: UpsertSessionInput) => {
  const name = (meta.name ?? cfg.name).trim();
  const date = meta.date ?? cfg.date;
  const active = meta.active ?? false;
  const jurorCount = meta.jurorCount ?? 0;
  const resultsVisible = meta.resultsVisible ?? false;

  const { rows } = await getPool().query<{ id: string }>(
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
      returning id::text
    `,
    [id, name, date, active, jurorCount, JSON.stringify(cfg), resultsVisible]
  );

  return rows[0];
};
