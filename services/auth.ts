import "server-only";

export type AuthRole = "admin" | "superadmin";

export type AuthCapabilities = {
  calendar: boolean;
  mailing: boolean;
};

export type AuthUser = {
  id: string;
  entityId: string;
  name: string;
  email?: string;
  role: AuthRole;
  capabilities: AuthCapabilities;
};

export type AuthSession = {
  user: AuthUser;
  token: string;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
);

const asText = (value: unknown) => typeof value === "string" ? value.trim() : "";

const isEnabled = (value: string | undefined) => /^(1|true|yes)$/i.test(value || "");

const superadminIds = () => new Set(
  (process.env.SSO_SUPERADMIN_USER_IDS || process.env.IFPC_SUPERADMIN_USER_ID || "ifpc")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
);

const normalizeUser = (value: unknown): AuthUser => {
  const record = asRecord(value);
  const id = asText(record.id) || asText(record.sub) || asText(record.userId) || asText(record.user_id);
  if (!id) throw new Error("La réponse SSO ne contient pas d'identifiant utilisateur stable.");

  const requestedRole = asText(record.role).toLowerCase();
  const role: AuthRole = requestedRole === "superadmin" || superadminIds().has(id)
    ? "superadmin"
    : "admin";
  const rawCapabilities = asRecord(record.capabilities);
  const elevated = role === "superadmin";

  return {
    id,
    entityId: role === "superadmin"
      ? process.env.IFPC_OWNER_ID?.trim() || "ifpc"
      : asText(record.entityId) || asText(record.entity_id) || asText(record.tenantId) || asText(record.tenant_id) || id,
    name: asText(record.name) || asText(record.displayName) || asText(record.display_name) || asText(record.email) || id,
    email: asText(record.email) || undefined,
    role,
    capabilities: {
      calendar: elevated && rawCapabilities.calendar !== false,
      mailing: elevated && rawCapabilities.mailing !== false,
    },
  };
};

const mockUserFromToken = (token: string): AuthUser => {
  const segments = token.startsWith("mock:") ? token.split(":") : [];
  const id = segments[1]?.trim() || process.env.SSO_MOCK_USER_ID?.trim() || "ifpc";
  const role = segments[2]?.trim() || process.env.SSO_MOCK_ROLE?.trim() || (
    superadminIds().has(id) ? "superadmin" : "admin"
  );
  const name = segments[3] ? decodeURIComponent(segments[3]) : (
    process.env.SSO_MOCK_USER_NAME?.trim() || (id === "ifpc" ? "IFPC" : id)
  );
  const email = process.env.SSO_MOCK_USER_EMAIL?.trim();
  return normalizeUser({ id, role, name, email });
};

/**
 * Valide un jeton émis par l'application principale.
 *
 * Tant que l'endpoint central n'est pas disponible, le mode simulé doit être
 * explicitement activé avec SSO_MOCK_ENABLED=true. Un cookie contenant
 * `mock:<identifiant>:<admin|superadmin>:<nom>` permet alors de tester
 * plusieurs entités sans réintroduire de formulaire de connexion dans Senso.
 */
export const loginWithToken = async (token: string): Promise<AuthSession> => {
  const normalizedToken = token.trim();
  if (!normalizedToken) throw new Error("Jeton SSO absent.");

  const endpoint = process.env.SSO_AUTH_ENDPOINT?.trim();
  if (!endpoint) {
    if (!isEnabled(process.env.SSO_MOCK_ENABLED)) {
      throw new Error("Endpoint SSO non configuré.");
    }
    return { user: mockUserFromToken(normalizedToken), token: normalizedToken };
  }

  const method = (process.env.SSO_AUTH_METHOD || "POST").toUpperCase() === "GET" ? "GET" : "POST";
  const response = await fetch(endpoint, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${normalizedToken}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify({ token: normalizedToken }) } : {}),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as UnknownRecord;
  if (!response.ok) {
    throw new Error(asText(payload.error) || asText(payload.message) || "Jeton SSO invalide.");
  }

  return {
    user: normalizeUser(payload.user || payload),
    token: normalizedToken,
  };
};
