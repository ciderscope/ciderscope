export type ANonAStatus = "A" | "non-A";

export const isANonAStatus = (value: unknown): value is ANonAStatus =>
  value === "A" || value === "non-A";

export const parseANonAAnswer = (value: string | null | undefined): Record<string, string> => {
  if (!value) return {};
  return Object.fromEntries(
    value
      .split(",")
      .map(part => {
        const idx = part.indexOf(":");
        if (idx < 0) return ["", ""];
        return [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
      })
      .filter(([code, answer]) => code && isANonAStatus(answer))
  );
};

export const serializeANonAAnswer = (value: Record<string, string>): string =>
  Object.entries(value)
    .map(([code, answer]) => [code.trim(), answer.trim()] as const)
    .filter(([code, answer]) => code && isANonAStatus(answer))
    .map(([code, answer]) => `${code}:${answer}`)
    .join(",");
