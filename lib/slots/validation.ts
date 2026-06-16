export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const normalizeDomain = (domain: string) => {
  return domain.trim().toLowerCase().replace(/^@+/, "");
};

export const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
};

export const getEmailDomain = (email: string) => {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at < 0) return "";
  return normalized.slice(at + 1);
};

export const isValidDomain = (domain: string) => {
  const normalized = normalizeDomain(domain);
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(normalized);
};
