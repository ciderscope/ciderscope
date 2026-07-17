import type { PoolClient } from "pg";
import type { AllAnswers, JurorAnswers, Poste, SessionConfig, SessionListItem } from "../../types";
import { acknowledgeHelpRequest } from "../helpRequests";
import { isPosteDay, isValidPosteNumber } from "../postes";
import { chooseSessionSlotDate, getTodayInSlotTimezone } from "../slots/dates";
import { listSlots } from "./slotData";
import { getSessionSqlPool, hasSessionSqlConfig } from "./sessionSql";
import { listSlotsFromSql } from "./slotSql";
import { getSupabaseAdminIfConfigured } from "./supabaseAdmin";

type SessionRow = {
  id: string;
  name: string;
  date: string;
  active?: boolean | null;
  juror_count: number | null;
  config: SessionConfig;
  analysis_settings?: Record<string, unknown> | null;
  results_visible: boolean | null;
  revision: number | string | null;
  created_at?: string;
};

type AnswerRow = {
  session_id: string;
  juror_name: string;
  data: JurorAnswers | null;
  revision?: number | string | null;
  access_token_hash?: string | null;
};

type CatalogSessionRow = {
  id: string;
  name: string;
  date: string;
  juror_count: number | null;
  results_visible: boolean | null;
  product_count: number | null;
  question_count: number | null;
  answer_count: number | string | null;
  created_at?: string;
};

export type ParticipantMutationResult = {
  ok: boolean;
  code?: string;
  data?: JurorAnswers;
  revision?: number;
};

const asRevision = (value: number | string | null | undefined) => {
  const parsed = Number(value || 0);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const requireStore = () => {
  const supabase = getSupabaseAdminIfConfigured();
  if (!supabase && !hasSessionSqlConfig()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY or DIRECT_URL/DATABASE_URL is required for session APIs.");
  }
  return supabase;
};

const withSqlTransaction = async <T>(handler: (client: PoolClient) => Promise<T>) => {
  const client = await getSessionSqlPool().connect();
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

const listCatalogSessionRows = async (): Promise<CatalogSessionRow[]> => {
  const supabase = requireStore();
  if (supabase) {
    const { data, error } = await supabase.rpc("list_session_catalog");
    if (error) throw error;
    return (data || []) as CatalogSessionRow[];
  }

  const { rows } = await getSessionSqlPool().query<CatalogSessionRow>(`
    select s.id, s.name, s.date, s.juror_count, s.results_visible,
           coalesce(jsonb_array_length(s.config -> 'products'), 0)::integer as product_count,
           coalesce(jsonb_array_length(s.config -> 'questions'), 0)::integer as question_count,
           count(a.session_id) as answer_count,
           s.created_at::text
    from sessions s
    left join answers a on a.session_id = s.id
    group by s.id
    order by s.created_at desc
  `);
  return rows;
};

export const listSessionCatalog = async ({ currentDayOnly = false } = {}): Promise<SessionListItem[]> => {
  const supabase = requireStore();
  const today = getTodayInSlotTimezone();
  const slotOptions = currentDayOnly ? { admin: false, start: today, end: today } : { admin: false };
  const [sessionRows, slots] = await Promise.all([
    listCatalogSessionRows(),
    supabase ? listSlots(supabase, slotOptions) : listSlotsFromSql(slotOptions),
  ]);

  const slotsBySession = new Map<string, typeof slots>();
  slots.forEach(slot => {
    if (!slot.sessionId) return;
    const bucket = slotsBySession.get(slot.sessionId) || [];
    bucket.push(slot);
    slotsBySession.set(slot.sessionId, bucket);
  });

  return sessionRows.map(row => {
    const sessionSlots = slotsBySession.get(row.id) || [];
    const slotDates = sessionSlots.map(slot => slot.slotDate).sort();
    const activeSlot = sessionSlots.find(slot => slot.slotDate === today);
    const displayDate = chooseSessionSlotDate(slotDates, activeSlot?.slotDate || null, today);
    const registrationCount = sessionSlots.find(slot => slot.slotDate === displayDate)?.placesTaken || 0;
    return {
      id: row.id,
      name: row.name,
      date: displayDate || "",
      active: Boolean(activeSlot),
      hasSlotSchedule: slotDates.length > 0,
      slotDate: activeSlot?.slotDate || displayDate || null,
      slotDates,
      jurorCount: Math.max(row.juror_count || 0, registrationCount, Number(row.answer_count || 0)),
      productCount: row.product_count || 0,
      questionCount: row.question_count || 0,
      resultsVisible: Boolean(row.results_visible),
    };
  });
};

export const getSessionDetails = async (sessionId: string): Promise<SessionRow | null> => {
  const supabase = requireStore();
  if (supabase) {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, name, date, active, juror_count, config, analysis_settings, results_visible, revision, created_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data as SessionRow | null;
  }
  const { rows } = await getSessionSqlPool().query<SessionRow>(`
    select id, name, date, active, juror_count, config, analysis_settings,
           results_visible, revision, created_at::text
    from sessions where id = $1
  `, [sessionId]);
  return rows[0] || null;
};

export const isSessionJoinable = async (sessionId: string) => {
  const today = getTodayInSlotTimezone();
  const supabase = requireStore();
  if (supabase) {
    const { data, error } = await supabase
      .from("session_slots")
      .select("id")
      .eq("session_id", sessionId)
      .eq("slot_date", today)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
  const { rowCount } = await getSessionSqlPool().query(
    "select 1 from session_slots where session_id = $1 and slot_date = $2 and deleted_at is null limit 1",
    [sessionId, today]
  );
  return Boolean(rowCount);
};

const listAnswerRows = async (sessionId: string): Promise<AnswerRow[]> => {
  const supabase = requireStore();
  if (supabase) {
    const { data, error } = await supabase
      .from("answers")
      .select("session_id, juror_name, data, revision")
      .eq("session_id", sessionId);
    if (error) throw error;
    return (data || []) as AnswerRow[];
  }
  const { rows } = await getSessionSqlPool().query<AnswerRow>(`
    select session_id, juror_name, data, revision
    from answers where session_id = $1
    order by juror_name
  `, [sessionId]);
  return rows;
};

export const listOccupiedPostes = async (sessionId: string, ownJurorName?: string) => {
  const supabase = requireStore();
  let rows: Array<{ juror_name: string; day: string; num: number }>;
  if (supabase) {
    const { data, error } = await supabase.rpc("list_occupied_postes", { p_session_id: sessionId });
    if (error) throw error;
    rows = (data || []) as typeof rows;
  } else {
    const result = await getSessionSqlPool().query<{ juror_name: string; day: string; num: number }>(`
      select a.juror_name, a.data #>> '{_poste,day}' as day, p.poste_num as num
      from answers a
      cross join lateral (
        select case
          when (a.data #>> '{_poste,num}') ~ '^[0-9]+$'
          then (a.data #>> '{_poste,num}')::integer
        end as poste_num
      ) p
      where a.session_id = $1
        and a.data #>> '{_poste,day}' in ('mardi', 'jeudi')
        and p.poste_num between 1 and 12
    `, [sessionId]);
    rows = result.rows;
  }
  const occupied: Record<string, string> = {};
  rows.forEach(row => {
    if (!isPosteDay(row.day) || !isValidPosteNumber(Number(row.num))) return;
    occupied[`${row.day}-${row.num}`] = row.juror_name === ownJurorName
      ? row.juror_name
      : "Occupé";
  });
  return occupied;
};

export const claimJurorIdentity = async ({
  sessionId,
  jurorName,
  tokenHash,
}: {
  sessionId: string;
  jurorName: string;
  tokenHash: string;
}): Promise<ParticipantMutationResult> => {
  const supabase = requireStore();
  if (supabase) {
    const { data, error } = await supabase.rpc("claim_juror_identity", {
      p_session_id: sessionId,
      p_juror_name: jurorName,
      p_access_token_hash: tokenHash,
    });
    if (error) throw error;
    const result = data as ParticipantMutationResult;
    return { ...result, revision: asRevision(result.revision), data: result.data || {} };
  }

  return withSqlTransaction(async client => {
    const active = await client.query(
      `select 1 from session_slots
       where session_id = $1 and slot_date = $2 and deleted_at is null limit 1`,
      [sessionId, getTodayInSlotTimezone()]
    );
    if (!active.rowCount) return { ok: false, code: "session_inactive" };

    const existing = await client.query<AnswerRow>(`
      select session_id, juror_name, data, revision, access_token_hash
      from answers where session_id = $1 and juror_name = $2 for update
    `, [sessionId, jurorName]);
    let row = existing.rows[0];
    if (!row) {
      const inserted = await client.query<AnswerRow>(`
        insert into answers (session_id, juror_name, data, access_token_hash)
        values ($1, $2, '{}'::jsonb, $3)
        returning session_id, juror_name, data, revision, access_token_hash
      `, [sessionId, jurorName, tokenHash]);
      row = inserted.rows[0];
    } else if (!row.access_token_hash) {
      const claimed = await client.query<AnswerRow>(`
        update answers set access_token_hash = $3
        where session_id = $1 and juror_name = $2
        returning session_id, juror_name, data, revision, access_token_hash
      `, [sessionId, jurorName, tokenHash]);
      row = claimed.rows[0];
    } else if (row.access_token_hash !== tokenHash) {
      return { ok: false, code: "identity_in_use" };
    }
    return { ok: true, data: row.data || {}, revision: asRevision(row.revision) };
  }).catch((error: unknown) => {
    if ((error as { code?: string }).code === "23505") return { ok: false, code: "identity_in_use" };
    throw error;
  });
};

export const saveParticipantAnswers = async ({
  sessionId,
  jurorName,
  tokenHash,
  data,
  expectedRevision,
}: {
  sessionId: string;
  jurorName: string;
  tokenHash: string;
  data: JurorAnswers;
  expectedRevision: number;
}): Promise<ParticipantMutationResult> => {
  const supabase = requireStore();
  if (supabase) {
    const { data: result, error } = await supabase.rpc("save_juror_answers", {
      p_session_id: sessionId,
      p_juror_name: jurorName,
      p_access_token_hash: tokenHash,
      p_data: data,
      p_expected_revision: expectedRevision,
    });
    if (error) throw error;
    const typed = result as ParticipantMutationResult;
    return { ...typed, revision: asRevision(typed.revision) };
  }

  const updated = await getSessionSqlPool().query<AnswerRow>(`
    update answers set data = $4::jsonb
    where session_id = $1 and juror_name = $2 and access_token_hash = $3 and revision = $5
    returning session_id, juror_name, data, revision
  `, [sessionId, jurorName, tokenHash, JSON.stringify(data), expectedRevision]);
  if (updated.rows[0]) return { ok: true, revision: asRevision(updated.rows[0].revision) };

  const current = await getSessionSqlPool().query<AnswerRow>(`
    select session_id, juror_name, data, revision from answers
    where session_id = $1 and juror_name = $2 and access_token_hash = $3
  `, [sessionId, jurorName, tokenHash]);
  if (!current.rows[0]) return { ok: false, code: "unauthorized" };
  return {
    ok: false,
    code: "revision_conflict",
    data: current.rows[0].data || {},
    revision: asRevision(current.rows[0].revision),
  };
};

export const claimParticipantPoste = async ({
  sessionId,
  jurorName,
  tokenHash,
  poste,
  expectedRevision,
}: {
  sessionId: string;
  jurorName: string;
  tokenHash: string;
  poste: Poste;
  expectedRevision: number;
}): Promise<ParticipantMutationResult> => {
  const supabase = requireStore();
  if (supabase) {
    const { data, error } = await supabase.rpc("claim_juror_poste", {
      p_session_id: sessionId,
      p_juror_name: jurorName,
      p_access_token_hash: tokenHash,
      p_day: poste.day,
      p_num: poste.num,
      p_expected_revision: expectedRevision,
    });
    if (error) throw error;
    const result = data as ParticipantMutationResult;
    return { ...result, revision: asRevision(result.revision) };
  }

  return withSqlTransaction(async client => {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [sessionId]);
    const occupied = await client.query(`
      select 1 from answers
      where session_id = $1 and juror_name <> $2
        and data #>> '{_poste,day}' = $3
        and data #>> '{_poste,num}' = $4
      limit 1
    `, [sessionId, jurorName, poste.day, String(poste.num)]);
    if (occupied.rowCount) return { ok: false, code: "poste_taken" };

    const updated = await client.query<AnswerRow>(`
      update answers
      set data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
        '_poste', jsonb_build_object('day', $4::text, 'num', $5::integer)
      )
      where session_id = $1 and juror_name = $2 and access_token_hash = $3 and revision = $6
      returning session_id, juror_name, data, revision
    `, [sessionId, jurorName, tokenHash, poste.day, poste.num, expectedRevision]);
    const row = updated.rows[0];
    return row
      ? { ok: true, data: row.data || {}, revision: asRevision(row.revision) }
      : { ok: false, code: "revision_conflict" };
  });
};

export const getAdminAnswers = async (sessionId: string): Promise<AllAnswers> => {
  const rows = await listAnswerRows(sessionId);
  return Object.fromEntries(rows.map(row => [row.juror_name, row.data || {}]));
};

export const upsertAdminAnswer = async (sessionId: string, jurorName: string, data: JurorAnswers) => {
  const supabase = requireStore();
  if (supabase) {
    const { error } = await supabase.from("answers").upsert({
      session_id: sessionId,
      juror_name: jurorName,
      data,
    }, { onConflict: "session_id,juror_name" });
    if (error) throw error;
    return;
  }
  await getSessionSqlPool().query(`
    insert into answers (session_id, juror_name, data)
    values ($1, $2, $3::jsonb)
    on conflict (session_id, juror_name) do update set data = excluded.data
  `, [sessionId, jurorName, JSON.stringify(data)]);
};

export const deleteAdminAnswer = async (sessionId: string, jurorName: string) => {
  const supabase = requireStore();
  if (supabase) {
    const { error } = await supabase.from("answers").delete()
      .eq("session_id", sessionId).eq("juror_name", jurorName);
    if (error) throw error;
    return;
  }
  await getSessionSqlPool().query(
    "delete from answers where session_id = $1 and juror_name = $2",
    [sessionId, jurorName]
  );
};

export const acknowledgeAdminHelpRequest = async (
  sessionId: string,
  jurorName: string,
  requestId: string
) => {
  const supabase = requireStore();
  for (let attempt = 0; attempt < 3; attempt++) {
    let current: AnswerRow | null = null;
    if (supabase) {
      const { data, error } = await supabase.from("answers")
        .select("session_id, juror_name, data, revision")
        .eq("session_id", sessionId)
        .eq("juror_name", jurorName)
        .maybeSingle();
      if (error) throw error;
      current = data as AnswerRow | null;
    } else {
      const { rows } = await getSessionSqlPool().query<AnswerRow>(`
        select session_id, juror_name, data, revision from answers
        where session_id = $1 and juror_name = $2
      `, [sessionId, jurorName]);
      current = rows[0] || null;
    }
    if (!current) return false;

    const revision = asRevision(current.revision);
    const next = acknowledgeHelpRequest(current.data || {}, requestId);
    if (supabase) {
      const { data, error } = await supabase.from("answers")
        .update({ data: next })
        .eq("session_id", sessionId)
        .eq("juror_name", jurorName)
        .eq("revision", revision)
        .select("revision")
        .maybeSingle();
      if (error) throw error;
      if (data) return true;
    } else {
      const updated = await getSessionSqlPool().query(`
        update answers set data = $4::jsonb
        where session_id = $1 and juror_name = $2 and revision = $3
      `, [sessionId, jurorName, revision, JSON.stringify(next)]);
      if (updated.rowCount) return true;
    }
  }
  return false;
};

export const patchSessionAdminData = async (
  sessionId: string,
  values: { resultsVisible?: boolean; analysisSettings?: Record<string, unknown> }
) => {
  const supabase = requireStore();
  const update: Record<string, unknown> = {};
  if (typeof values.resultsVisible === "boolean") update.results_visible = values.resultsVisible;
  if (values.analysisSettings) update.analysis_settings = values.analysisSettings;
  if (Object.keys(update).length === 0) return;
  if (supabase) {
    const { error } = await supabase.from("sessions").update(update).eq("id", sessionId);
    if (error) throw error;
    return;
  }
  if ("results_visible" in update) {
    await getSessionSqlPool().query(
      "update sessions set results_visible = $2 where id = $1",
      [sessionId, update.results_visible]
    );
  }
  if ("analysis_settings" in update) {
    await getSessionSqlPool().query(
      "update sessions set analysis_settings = $2::jsonb where id = $1",
      [sessionId, JSON.stringify(update.analysis_settings)]
    );
  }
};

export const deleteSessionAdmin = async (sessionId: string) => {
  const supabase = requireStore();
  if (supabase) {
    const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
    if (error) throw error;
    return;
  }
  await getSessionSqlPool().query("delete from sessions where id = $1", [sessionId]);
};

export const getPublicSummary = async (sessionId: string) => {
  const session = await getSessionDetails(sessionId);
  if (!session || !session.results_visible) return null;
  const rows = await listAnswerRows(sessionId);
  const answers: AllAnswers = {};
  rows.forEach((row, index) => {
    const data = { ...(row.data || {}) };
    delete data._helpRequests;
    delete data._poste;
    delete data._timing;
    delete data._completedSteps;
    delete data._finished;
    answers[`Jury ${index + 1}`] = data;
  });
  return { config: session.config, answers };
};

export const sessionRevision = (session: SessionRow) => asRevision(session.revision);
