export interface RadarDisplayPresetAxis {
  label: string;
  aliases: string[];
}

export interface RadarDisplayPreset {
  id: string;
  label: string;
  axes: RadarDisplayPresetAxis[];
  fixedScale: boolean;
}

export interface RadarDisplayAxis {
  id: string;
  label: string;
  matched: boolean;
}

export const FRUITY_RADAR_DISPLAY_PRESET: RadarDisplayPreset = {
  id: "fruity-seven",
  label: "Radar fruité 7 axes",
  fixedScale: true,
  axes: [
    { label: "Fruité", aliases: ["Fruité", "Fruit"] },
    { label: "Banane", aliases: ["Fruit > Fruit tropical > Banane", "Fruit > Fruits exotiques > Banane", "Banane"] },
    { label: "Poire", aliases: ["Fruit > Fruit blanc/jaune > Poire", "Poire"] },
    { label: "Fruits exotiques", aliases: ["Fruit > Fruit tropical", "Fruit tropical", "Fruit exotique", "Fruits exotiques", "Fruits tropicaux"] },
    { label: "Agrumes", aliases: ["Fruit > Agrume", "Agrume", "Agrumes"] },
    { label: "Fruits rouges", aliases: ["Fruit > Fruit rouge", "Fruit rouge", "Fruits rouges"] },
    { label: "Floral", aliases: ["Floral"] },
  ],
};

function normalizeRadarLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildCriteriaIndex(criteria: string[]) {
  const byFullLabel = new Map<string, string>();
  const byLeafLabel = new Map<string, string[]>();

  for (const criterion of criteria) {
    const normalizedCriterion = normalizeRadarLabel(criterion);
    if (!byFullLabel.has(normalizedCriterion)) {
      byFullLabel.set(normalizedCriterion, criterion);
    }

    const leaf = criterion.split(" > ").pop() || criterion;
    const normalizedLeaf = normalizeRadarLabel(leaf);
    const matches = byLeafLabel.get(normalizedLeaf) || [];
    matches.push(criterion);
    byLeafLabel.set(normalizedLeaf, matches);
  }

  return { byFullLabel, byLeafLabel };
}

function shortestCriterionFirst(a: string, b: string): number {
  return a.split(" > ").length - b.split(" > ").length || a.localeCompare(b);
}

function resolvePresetAxisId(axis: RadarDisplayPresetAxis, criteria: string[]): string | null {
  const index = buildCriteriaIndex(criteria);

  for (const alias of axis.aliases) {
    const match = index.byFullLabel.get(normalizeRadarLabel(alias));
    if (match) return match;
  }

  for (const alias of axis.aliases) {
    const matches = index.byLeafLabel.get(normalizeRadarLabel(alias));
    if (matches && matches.length > 0) {
      return [...matches].sort(shortestCriterionFirst)[0];
    }
  }

  return null;
}

export function buildRadarDisplayAxes(criteria: string[], preset: RadarDisplayPreset): RadarDisplayAxis[] {
  return preset.axes.map(axis => {
    const sourceId = resolvePresetAxisId(axis, criteria);
    return {
      id: sourceId || `__radar_preset:${preset.id}:${axis.label}`,
      label: axis.label,
      matched: sourceId !== null,
    };
  });
}

export function applyRadarAxisCorrection(value: number, correction: number, max: number): number {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeCorrection = Number.isFinite(correction) ? correction : 1; // Par défaut, multiplier par 1 (pas de changement)
  const safeMax = Number.isFinite(max) && max > 0 ? max : 10;
  return Math.min(safeMax, Math.max(0, safeValue * safeCorrection));
}
