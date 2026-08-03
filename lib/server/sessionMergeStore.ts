import type { JurorAnswers } from "../../types";
import { getSessionSqlPool, hasSessionSqlConfig } from "./sessionSql";
import { getSupabaseAdminIfConfigured } from "./supabaseAdmin";

export type SessionMergeAnswerRow = {
  jurorName: string;
  data: JurorAnswers;
  revision: number;
};

export type SessionMergeDatabaseResult = {
  ok: boolean;
  code?: string;
  movedAnswers?: number;
  movedSlots?: number;
};

const asRevision = (value: number | string | null | undefined) => {
  const parsed = Number(value || 0);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
};

export const listSessionMergeAnswerRows = async (sessionId: string): Promise<SessionMergeAnswerRow[]> => {
  const supabase = getSupabaseAdminIfConfigured();
  if (supabase) {
    const { data, error } = await supabase
      .from("answers")
      .select("juror_name, data, revision")
      .eq("session_id", sessionId)
      .order("juror_name");
    if (error) throw error;
    return (data || []).map(row => ({
      jurorName: String(row.juror_name),
      data: (row.data || {}) as JurorAnswers,
      revision: asRevision(row.revision),
    }));
  }

  if (!hasSessionSqlConfig()) {
    throw new Error("Database configuration is required for session merge.");
  }
  const { rows } = await getSessionSqlPool().query<{
    juror_name: string;
    data: JurorAnswers | null;
    revision: number | string | null;
  }>(`
    select juror_name, data, revision
    from answers
    where session_id = $1
    order by juror_name
  `, [sessionId]);
  return rows.map(row => ({
    jurorName: row.juror_name,
    data: row.data || {},
    revision: asRevision(row.revision),
  }));
};

export const executeSessionMerge = async ({
  targetSessionId,
  sourceSessionId,
  expectedTargetRevision,
  expectedSourceRevision,
  transformedAnswers,
}: {
  targetSessionId: string;
  sourceSessionId: string;
  expectedTargetRevision: number;
  expectedSourceRevision: number;
  transformedAnswers: SessionMergeAnswerRow[];
}): Promise<SessionMergeDatabaseResult> => {
  const payload = transformedAnswers.map(answer => ({
    jurorName: answer.jurorName,
    revision: answer.revision,
    data: answer.data,
  }));
  const supabase = getSupabaseAdminIfConfigured();
  if (supabase) {
    const { data, error } = await supabase.rpc("merge_sessions", {
      p_target_session_id: targetSessionId,
      p_source_session_id: sourceSessionId,
      p_expected_target_revision: expectedTargetRevision,
      p_expected_source_revision: expectedSourceRevision,
      p_transformed_answers: payload,
    });
    if (error) throw error;
    return data as SessionMergeDatabaseResult;
  }

  if (!hasSessionSqlConfig()) {
    throw new Error("Database configuration is required for session merge.");
  }
  const { rows } = await getSessionSqlPool().query<{ result: SessionMergeDatabaseResult }>(`
    select merge_sessions($1, $2, $3, $4, $5::jsonb) as result
  `, [
    targetSessionId,
    sourceSessionId,
    expectedTargetRevision,
    expectedSourceRevision,
    JSON.stringify(payload),
  ]);
  return rows[0]?.result || { ok: false, code: "merge_failed" };
};
