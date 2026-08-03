import { Pool } from "pg";
import type { SessionAccessMode, SessionConfig, SessionListItem } from "../../types";

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
  ownerId: string;
  ownerName: string;
  accessMode: SessionAccessMode;
  cfg: SessionConfig;
  meta: Partial<SessionListItem>;
  expectedRevision?: number;
};

export const findDuplicateSessionFromSql = async ({
  id,
  ownerId,
  name,
  date,
}: {
  id: string;
  ownerId: string;
  name: string;
  date: string;
}) => {
  const { rows } = await getSessionSqlPool().query<{ id: string }>(
    `
      select id::text
      from sessions
      where id <> $1
        and owner_id = $2
        and date = $3
        and lower(btrim(name)) = lower(btrim($4))
      limit 1
    `,
    [id, ownerId, date, name]
  );

  return rows[0] || null;
};

export const upsertSessionFromSql = async ({
  id,
  ownerId,
  ownerName,
  accessMode,
  cfg,
  meta,
  expectedRevision,
}: UpsertSessionInput) => {
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
        where id = $1 and owner_id = $5 and revision = $6
        returning id::text, revision
      `,
      [id, name, date, JSON.stringify(cfg), ownerId, expectedRevision]
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
      insert into sessions (
        id, owner_id, owner_name, access_mode,
        name, date, active, juror_count, config, results_visible
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
      on conflict (id) do update set
        name = excluded.name,
        date = excluded.date,
        active = excluded.active,
        juror_count = excluded.juror_count,
        config = excluded.config,
        results_visible = excluded.results_visible
      where sessions.owner_id = excluded.owner_id
      returning id::text, revision
    `,
    [
      id,
      ownerId,
      ownerName,
      accessMode,
      name,
      date,
      active,
      jurorCount,
      JSON.stringify(cfg),
      resultsVisible,
    ]
  );

  if (!rows[0]) {
    const error = new Error("Session owner mismatch.") as Error & { code?: string };
    error.code = "session_not_found";
    throw error;
  }
  return rows[0];
};
