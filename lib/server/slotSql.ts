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
  registration_status: "confirmed" | "waitlist";
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
    registration_status?: "confirmed" | "waitlist";
    created_at: string;
    token: string;
    outlook_event_id?: string | null;
  };
};

type RegistrationPayload = {
  id: string;
  slot_id: string;
  participant_name: string;
  participant_email: string;
  registration_status?: "confirmed" | "waitlist";
  outlook_event_id: string | null;
};

type CancelSlotResult = {
  ok: boolean;
  code?: string;
  registration?: RegistrationPayload & { cancelled_at: string };
  promoted_registration?: RegistrationPayload;
};

type CancelledRegistration = {
  id: string;
  outlookEventId: string | null;
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
      select id::text, slot_id::text, participant_name, participant_email, registration_status, created_at::text
      from slot_registrations
      where status = 'active'
        and slot_id = any($1::uuid[])
      order by registration_status asc, created_at asc
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
    const confirmedParticipants = participants.filter(participant => (
      (participant.registration_status || "confirmed") === "confirmed"
    ));
    const waitlistCount = participants.filter(participant => participant.registration_status === "waitlist").length;
    const base = {
      id: slot.id,
      slotDate: slot.slot_date,
      capacity: slot.capacity,
      sessionId: slot.session_id,
      sessionName: slot.session_name,
      placesTaken: confirmedParticipants.length,
      waitlistCount,
    };

    if (admin) {
      return {
        ...base,
        createdAt: asIsoString(slot.created_at),
        participants: participants.map(participant => ({
          id: participant.id,
          participantName: participant.participant_name,
          participantEmail: participant.participant_email,
          registrationStatus: participant.registration_status || "confirmed",
          createdAt: asIsoString(participant.created_at),
        })),
      } satisfies AdminSlotListItem;
    }

    return {
      ...base,
      participants: participants.map(participant => ({
        id: participant.id,
        participantName: participant.participant_name,
        registrationStatus: participant.registration_status || "confirmed",
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
}): Promise<{ id: string; attached: boolean }> => {
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

    const existing = await client.query<{ id: string; session_id: string | null }>(
      "select id::text, session_id from session_slots where slot_date = $1 and deleted_at is null for update",
      [slotDate]
    );

    if ((existing.rowCount || 0) > 0) {
      if (existing.rows[0].session_id && existing.rows[0].session_id !== sessionId) {
        const error = new Error("Slot already attached to another session.") as PgError;
        error.code = "slot_already_attached";
        throw error;
      }

      const { rows } = await client.query<{ id: string }>(
        `
          update session_slots
          set session_id = $2,
              session_name = $3,
              created_by = coalesce(created_by, 'admin')
          where id = $1
          returning id::text
        `,
        [existing.rows[0].id, sessionId, finalSessionName]
      );
      return { id: rows[0].id, attached: true };
    }

    const { rows } = await client.query<{ id: string }>(
      `
        insert into session_slots (slot_date, session_id, session_name, created_by)
        values ($1, $2, $3, 'admin')
        returning id::text
      `,
      [slotDate, sessionId, finalSessionName]
    );

    return { id: rows[0].id, attached: false };
  });
};

export const deleteSlotFromSql = async (
  slotId: string
): Promise<{ ok: boolean; code?: string; cancelledCount: number; registrations: CancelledRegistration[] }> => {
  return transaction(async client => {
    const slot = await client.query<{ id: string; deleted_at: string | null }>(
      "select id::text, deleted_at::text from session_slots where id = $1 for update",
      [slotId]
    );

    if (slot.rowCount === 0) return { ok: false, code: "slot_not_found", cancelledCount: 0, registrations: [] };
    if (slot.rows[0].deleted_at) return { ok: false, code: "slot_already_deleted", cancelledCount: 0, registrations: [] };

    await client.query(
      "update session_slots set deleted_at = now(), created_by = coalesce(created_by, 'admin') where id = $1",
      [slotId]
    );
    const cancelled = await client.query<{ id: string; outlook_event_id: string | null }>(
      `
        update slot_registrations
        set status = 'cancelled',
            cancelled_at = now(),
            outlook_invite_status = case
              when outlook_event_id is not null then 'cancel_pending'
              else 'cancelled'
            end,
            outlook_invite_due_at = null
        where slot_id = $1 and status = 'active'
        returning id::text, outlook_event_id
      `,
      [slotId]
    );

    return {
      ok: true,
      cancelledCount: cancelled.rowCount || 0,
      registrations: cancelled.rows.map(row => ({
        id: row.id,
        outlookEventId: row.outlook_event_id || null,
      })),
    };
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
      `
        select count(*)::text
        from slot_registrations
        where slot_id = $1
          and status = 'active'
          and registration_status = 'confirmed'
      `,
      [slotId]
    );
    const placesTaken = Number.parseInt(count.rows[0]?.count || "0", 10);
    const capacity = slot.rows[0].capacity;
    const registrationStatus = placesTaken >= capacity ? "waitlist" : "confirmed";

    try {
      const registration = await client.query<{
        id: string;
        slot_id: string;
        participant_name: string;
        participant_email: string;
        registration_status: "confirmed" | "waitlist";
        created_at: string;
        token: string;
      }>(
        `
          insert into slot_registrations (slot_id, participant_name, participant_email, registration_status)
          values ($1, $2, $3, $4)
          returning id::text, slot_id::text, participant_name, participant_email, registration_status, created_at::text, token
        `,
        [slotId, name, email, registrationStatus]
      );

      return {
        ok: true,
        places_taken: placesTaken,
        capacity,
        registration: registration.rows[0],
      };
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
    await client.query("select id from session_slots where id = $1 for update", [slotId]);

    const registration = await client.query<RegistrationPayload & { cancelled_at: string }>(
      `
        update slot_registrations
        set status = 'cancelled',
            cancelled_at = now(),
            outlook_invite_status = case
              when outlook_event_id is not null then 'cancel_pending'
              else 'cancelled'
            end,
            outlook_invite_due_at = null
        where slot_id = $1 and participant_email = $2 and status = 'active'
        returning id::text, slot_id::text, participant_name, participant_email, registration_status, cancelled_at::text, outlook_event_id
      `,
      [slotId, email]
    );

    if (registration.rowCount === 0) return { ok: false, code: "not_registered" };

    let promotedRegistration: RegistrationPayload | undefined;
    if (registration.rows[0].registration_status === "confirmed") {
      const promoted = await client.query<RegistrationPayload>(
        `
          with next_waitlist as (
            select id
            from slot_registrations
            where slot_id = $1
              and status = 'active'
              and registration_status = 'waitlist'
            order by created_at asc
            for update skip locked
            limit 1
          )
          update slot_registrations r
          set registration_status = 'confirmed',
              outlook_invite_last_error = null
          from next_waitlist
          where r.id = next_waitlist.id
          returning
            r.id::text,
            r.slot_id::text,
            r.participant_name,
            r.participant_email,
            r.registration_status,
            r.outlook_event_id
        `,
        [slotId]
      );
      promotedRegistration = promoted.rows[0];
    }

    return {
      ok: true,
      registration: registration.rows[0],
      promoted_registration: promotedRegistration,
    };
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

export const markOutlookInvitationSentFromSql = async ({
  registrationId,
  eventId,
}: {
  registrationId: string;
  eventId: string;
}) => {
  await getPool().query(
    `
      update slot_registrations
      set outlook_invite_status = 'sent',
          outlook_event_id = $2,
          outlook_invite_sent_at = now(),
          outlook_invite_due_at = null,
          outlook_invite_last_error = null
      where id = $1
    `,
    [registrationId, eventId]
  );
};

export const markOutlookInvitationFailedFromSql = async (registrationId: string, message: string) => {
  await getPool().query(
    `
      update slot_registrations
      set outlook_invite_status = 'failed',
          outlook_invite_due_at = null,
          outlook_invite_last_error = left($2, 500)
      where id = $1
    `,
    [registrationId, message]
  );
};

export const markOutlookCancellationDoneFromSql = async (registrationId: string) => {
  await getPool().query(
    `
      update slot_registrations
      set outlook_invite_status = 'cancelled',
          outlook_invite_due_at = null,
          outlook_invite_last_error = null
      where id = $1
    `,
    [registrationId]
  );
};

export const markOutlookCancellationFailedFromSql = async (registrationId: string, message: string) => {
  await getPool().query(
    `
      update slot_registrations
      set outlook_invite_status = 'cancel_failed',
          outlook_invite_due_at = null,
          outlook_invite_last_error = left($2, 500)
      where id = $1
    `,
    [registrationId, message]
  );
};
