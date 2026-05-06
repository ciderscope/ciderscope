"use client";
import { RadarAxis } from "../../../types";

// Génère un id unique pour une nouvelle question/groupe.
export const nextId = (prefix: string): string => {
  const rnd = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
};

// Applique un patch sur un nœud (identifié par son chemin d'indices dans l'arbre) d'une liste d'axes.
export function updateAxisAtPath(axes: RadarAxis[], path: number[], updater: (ax: RadarAxis) => RadarAxis): RadarAxis[] {
  if (path.length === 0) return axes;
  const [head, ...rest] = path;
  return axes.map((ax, i) => {
    if (i !== head) return ax;
    if (rest.length === 0) return updater(ax);
    const kids = ax.children ?? [];
    return { ...ax, children: updateAxisAtPath(kids, rest, updater) };
  });
}

// Supprime un nœud (identifié par path) d'une liste d'axes.
export function removeAxisAtPath(axes: RadarAxis[], path: number[]): RadarAxis[] {
  if (path.length === 0) return axes;
  const [head, ...rest] = path;
  if (rest.length === 0) return axes.filter((_, i) => i !== head);
  return axes.map((ax, i) => {
    if (i !== head) return ax;
    const kids = ax.children ?? [];
    return { ...ax, children: removeAxisAtPath(kids, rest) };
  });
}

// Ajoute un enfant à un nœud (identifié par path).
export function addChildAtPath(axes: RadarAxis[], path: number[]): RadarAxis[] {
  return updateAxisAtPath(axes, path, ax => ({
    ...ax,
    children: [...(ax.children ?? []), { label: "" }],
  }));
}

// Retourne un libellé par défaut cohérent avec le type de question si le champ est vide.
export const getDefaultLabel = (type: string): string => {
  switch (type) {
    case "radar": return "décrivez le profil aromatique et gustatif de cet échantillon";
    case "triangulaire": return "Quel échantillon est différent des deux autres ?";
    case "duo-trio": return "Lequel de ces deux échantillons est identique au témoin ?";
    case "a-non-a": return "Cet échantillon présente-t-il le défaut ?";
    case "classement": return "Classez ces échantillons par ordre de préférence";
    case "seuil": return "Indiquez le rang de cet échantillon";
    case "seuil-bet": return "Identifiez l'échantillon différent à chaque niveau";
    case "scale": return "Notez cet échantillon";
    case "qcm": return "Sélectionnez une option";
    case "text": return "Commentaires libres";
    default: return "Nouvelle question";
  }
};
