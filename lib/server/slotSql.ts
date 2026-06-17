import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { AdminSlotListItem, SlotListItem } from "../../types/slots";
import { getEmailDomain, isValidEmail, normalizeEmail } from "../slots/validation";

type SlotRow = QueryResultRow & {
  id: string;
  slot_date: string;
  capacity: number;
  session_id: string | null;
  session_name: string;
  created_at: string;
};

type RegistrationRow = QueryResultRow & {
  id: string;
  slot_id: string;
  participant_name: string;
  participant_email: string;
  created_at: string;
};

type CalendarSlotRow = QueryResultRow & {
  id: string;
  slot_date: string;
  session_name: string;
};

type PgError = Error & { code?: string };

type ListSlotOptions = {
  start?: string | null;
  end?: string | null;
  admin?: boolean;
};

type RegisterSlotResult = {
  ok: boolean;
  code?: string;
  domain?: string;
  places_taken?: number;
  capacity?: number;
  participant_name?: string;
  registration?: {
    id: string;
    slot_id: string;
    participant_name: string;
    participant_email: string;
    created_at: string;
    token: string;
  };
};

type CancelSlotResult = {
  ok: boolean;
  code?: string;
  registration?: {
    id: string;
    slot_id: string;
    participant_name: string;
    participant_email: string;
    cancelled_at: string;
  };
};

let pool: Pool | null = null;

const getConnectionString = () => process.env.DIRECT_URL || process.env.DATABASE_URL || "";

export const hasSlotSqlConfig = () => Boolean(getConnectionString());

const getPool = () => {
  if (pool) return pool;
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required for local slot APIs.");
  }

  const needsSsl = /sslmode=require/i.test(connectionString) || /supabase\.(co|com)/i.test(connectionString);
  pool = new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 3,
  });
  return pool;
};

const asIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const transaction = async <T>(handler: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await handler(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

export const listSlotsFromSql = async (
  { start, end, admin = false }: ListSlotOptions = {}
): Promise<Array<SlotListItem | AdminSlotListItem>> => {
  const values: string[] = [];
  const conditions = ["deleted_at is null"];

  if (start) {
    values.push(start);
    conditions.push(`slot_date >= $${values.length}`);
  }
  if (end) {
    values.push(end);
    conditions.push(`slot_date <= $${values.length}`);
  }

  const { rows: slotRows } = await getPool().query<SlotRow>(
    `
      select id::text, slot_date::text, capacity, session_id, session_name, created_at::text
      from session_slots
      where ${conditions.join(" and ")}
      order by slot_date asc
    `,
    values
  );

  if (slotRows.length === 0) return [];

  const { rows: registrations } = await getPool().query<RegistrationRow>(
    `
      select id::text, slot_id::text, participant_name, participant_email, created_at::text
      from slot_registrations
      where status = 'active'
        and slot_id = any($1::uuid[])
      order by created_at asc
    `,
    [slotRows.map(slot => slot.id)]
  );

  const registrationsBySlot = new Map<string, RegistrationRow[]>();
  registrations.forEach(registration => {
    const list = registrationsBySlot.get(registration.slot_id) || [];
    list.push(registration);
    registrationsBySlot.set(registration.slot_id, list);
  });

  return slotRows.map(slot => {
    const participants = registrationsBySlot.get(slot.id) || [];
    const base = {
      id: slot.id,
      slotDate: slot.slot_date,
      capacity: slot.capacity,
      sessionId: slot.session_id,
      sessionName: slot.session_name,
      placesTaken: participants.length,
    };

    if (admin) {
      return {
        ...base,
        createdAt: asIsoString(slot.created_at),
        participants: participants.map(participant => ({
          id: participant.id,
          participantName: participant.participant_name,
          participantEmail: participant.participant_email,
          createdAt: asIsoString(participant.created_at),
        })),
      } satisfies AdminSlotListItem;
    }

    return {
      ...base,
      participants: participants.map(participant => ({
        id: participant.id,
        participantName: participant.participant_name,
      })),
    } satisfies SlotListItem;
  });
};

export const createSlotFromSql = async ({
  slotDate,
  sessionId,
  sessionName,
}: {
  slotDate: string;
  sessionId: string | null;
  sessionName: string;
}): Promise<{ id: string }> => {
  return transaction(async client => {
    let finalSessionName = sessionName.trim();

    if (sessionId) {
      const session = await client.query<{ id: string; name: string }>(
        "select id, name from sessions where id = $1",
        [sessionId]
      );
      if (session.rowCount === 0) {
        const error = new Error("Session not found.") as PgError;
        error.code = "slot_session_not_found";
        throw error;
      }
      if (!finalSessionName) finalSessionName = session.rows[0].name;
    }

    const { rows } = await client.query<{ id: string }>(
      `
        insert into session_slots (slot_date, session_id, session_name, created_by)
        values ($1, $2, $3, 'admin')
        returning id::text
      `,
      [slotDate, sessionId, finalSessionName]
    );

    return rows[0];
  });
};

export const deleteSlotFromSql = async (
  slotId: string
): Promise<{ ok: boolean; code?: string; cancelledCount: number }> => {
  return transaction(async client => {
    const slot = await client.query<{ id: string; deleted_at: string | null }>(
      "select id::text, deleted_at::text from session_slots where id = $1 for update",
      [slotId]
    );

    if (slot.rowCount === 0) return { ok: false, code: "slot_not_found", cancelledCount: 0 };
    if (slot.rows[0].deleted_at) return { ok: false, code: "slot_already_deleted", cancelledCount: 0 };

    await client.query(
      "update session_slots set deleted_at = now(), created_by = coalesce(created_by, 'admin') where id = $1",
      [slotId]
    );
    const cancelled = await client.query(
      `
        update slot_registrations
        set status = 'cancelled', cancelled_at = now()
        where slot_id = $1 and status = 'active'
        returning id
      `,
      [slotId]
    );

    return { ok: true, cancelledCount: cancelled.rowCount || 0 };
  });
};

export const registerSlotParticipantFromSql = async ({
  slotId,
  participantName,
  participantEmail,
}: {
  slotId: string;
  participantName: string;
  participantEmail: string;
}): Promise<RegisterSlotResult> => {
  const email = normalizeEmail(participantEmail);
  const name = participantName.trim();

  if (!name) return { ok: false, code: "invalid_name" };
  if (!isValidEmail(email)) return { ok: false, code: "invalid_email" };

  return transaction(async client => {
    const domain = getEmailDomain(email);
    const allowed = await client.query("select 1 from email_domain_whitelist where domain = $1 limit 1", [domain]);
    if (allowed.rowCount === 0) return { ok: false, code: "domain_not_allowed", domain };

    const slot = await client.query<{ id: string; capacity: number; deleted_at: string | null }>(
      "select id::text, capacity, deleted_at::text from session_slots where id = $1 for update",
      [slotId]
    );
    if (slot.rowCount === 0 || slot.rows[0].deleted_at) return { ok: false, code: "slot_not_found" };

    const existing = await client.query<{ participant_name: string }>(
      `
        select participant_name
        from slot_registrations
        where slot_id = $1 and participant_email = $2 and status = 'active'
        limit 1
      `,
      [slotId, email]
    );
    if ((existing.rowCount || 0) > 0) {
      return {
        ok: false,
        code: "already_registered",
        participant_name: existing.rows[0].participant_name,
      };
    }

    const count = await client.query<{ count: string }>(
      "select count(*)::text from slot_registrations where slot_id = $1 and status = 'active'",
      [slotId]
    );
    const placesTaken = Number.parseInt(count.rows[0]?.count || "0", 10);
    const capacity = slot.rows[0].capacity;
    if (placesTaken >= capacity) {
      return { ok: false, code: "slot_full", places_taken: placesTaken, capacity };
    }

    try {
      const registration = await client.query<{
        id: string;
        slot_id: string;
        participant_name: string;
        participant_email: string;
        created_at: string;
        token: string;
      }>(
        `
          insert into slot_registrations (slot_id, participant_name, participant_email)
          values ($1, $2, $3)
          returning id::text, slot_id::text, participant_name, participant_email, created_at::text, token
        `,
        [slotId, name, email]
      );

      return { ok: true, registration: registration.rows[0] };
    } catch (error) {
      if ((error as PgError).code === "23505") return { ok: false, code: "already_registered" };
      throw error;
    }
  });
};

export const cancelSlotRegistrationFromSql = async ({
  slotId,
  participantEmail,
}: {
  slotId: string;
  participantEmail: string;
}): Promise<CancelSlotResult> => {
  const email = normalizeEmail(participantEmail);
  if (!isValidEmail(email)) return { ok: false, code: "invalid_email" };

  return transaction(async client => {
    const registration = await client.query<{
      id: string;
      slot_id: string;
      participant_name: string;
      participant_email: string;
      cancelled_at: string;
    }>(
      `
        update slot_registrations
        set status = 'cancelled', cancelled_at = now()
        where slot_id = $1 and participant_email = $2 and status = 'active'
        returning id::text, slot_id::text, participant_name, participant_email, cancelled_at::text
      `,
      [slotId, email]
    );

    if (registration.rowCount === 0) return { ok: false, code: "not_registered" };
    return { ok: true, registration: registration.rows[0] };
  });
};

export const hasCancelledSlotRegistrationFromSql = async ({
  slotId,
  participantEmail,
}: {
  slotId: string;
  participantEmail: string;
}): Promise<boolean> => {
  const email = normalizeEmail(participantEmail);
  if (!isValidEmail(email)) return false;

  const { rowCount } = await getPool().query(
    `
      select 1
      from slot_registrations
      where slot_id = $1
        and participant_email = $2
        and status = 'cancelled'
      limit 1
    `,
    [slotId, email]
  );

  return (rowCount || 0) > 0;
};

export const getCalendarSlotFromSql = async (slotId: string) => {
  const { rows } = await getPool().query<CalendarSlotRow>(
    "select id::text, slot_date::text, session_name from session_slots where id = $1",
    [slotId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    slotDate: row.slot_date,
    sessionName: row.session_name,
  };
};
