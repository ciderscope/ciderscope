import type { RadarAxis, RadarGroup } from "../types";

// Arbre de décision des arômes (reproduit la nomenclature IFPC mise à jour).
// Structure : Catégorie (axe de la toile) → sous-catégorie → descripteur final.
const leaves = (labels: string[]): RadarAxis[] => labels.map(label => ({ label }));

const axes: RadarAxis[] = [
  {
    label: "Fruit",
    children: [
      { label: "Fruit rouge", children: leaves(["Cassis", "Cerise", "Figue", "Fraise", "Framboise", "Groseille", "Mûre", "Myrtille"]) },
      { label: "Fruit blanc/jaune", children: leaves(["Abricot", "Coing", "Melon", "Pêche", "Poire", "Pomme", "Prune"]) },
      { label: "Agrume", children: leaves(["Citron", "Orange", "Pamplemousse"]) },
      { label: "Fruit tropical", children: leaves(["Ananas", "Banane", "Fruit de la passion", "Litchi", "Mangue"]) },
      { label: "Fruit élaboré", children: leaves(["Compote", "Fruit confit"]) },
      { label: "Fruit à coque", children: leaves(["Amande", "Noisette", "Noix"]) },
      { label: "Fruit séché", children: leaves(["Abricot sec", "Pruneau"]) },
    ],
  },
  {
    label: "Épice",
    children: [
      { label: "Épice", children: leaves(["Anis", "Cannelle", "Clou de girofle", "Réglisse"]) },
    ],
  },
  {
    label: "Végétal",
    children: [
      { label: "Végétal", children: leaves(["Foin", "Paille", "Herbe coupée", "Tige"]) },
      { label: "Plante aromatique", children: leaves(["Laurier", "Menthe", "Thé", "Thym"]) },
    ],
  },
  {
    label: "Grillé",
    children: [
      { label: "Empyreumatique", children: leaves(["Tabac", "Fumé", "Grillé", "Pain grillé", "Pain"]) },
      { label: "Arôme brun", children: leaves(["Café", "Caramel", "Chocolat", "Vanille"]) },
    ],
  },
  {
    label: "Lactique",
    children: [
      { label: "Lactique", children: leaves(["Yaourt", "Beurre", "Crême", "Levure"]) },
    ],
  },
  {
    label: "Chimique",
    children: [
      { label: "Chimique", children: leaves(["Alcool", "Colle scotch", "Caoutchouc", "Dissolvant à ongles", "Encre/Gouache", "Vinaigre"]) },
    ],
  },
  {
    label: "Soufrée",
    children: [
      { label: "Soufrée", children: leaves(["Ail", "Chou", "Serpillère", "Oeuf pourri"]) },
    ],
  },
  {
    label: "Sous-bois",
    children: [
      { label: "Animal", children: leaves(["Cheval", "Cuir", "Sueur"]) },
      { label: "Terreux", children: leaves(["Champignon", "Moisi"]) },
      { label: "Bois", children: leaves(["Chêne", "Liège", "Pin"]) },
    ],
  },
  {
    label: "Floral",
    children: [
      { label: "Floral", children: leaves(["Acacia", "Chevrefeuille", "Fleur d'oranger", "Jasmin", "Lilas", "Miel", "Rose", "Violette"]) },
    ],
  },
];

const qualityAxes: RadarAxis[] = [
  { label: "Acidité" },
  { label: "Amertume" },
  { label: "Sucrosité" },
  { label: "Astringence" },
];

export const AROMA_PRESET: RadarGroup[] = [
  {
    id: "aromes",
    title: "Arômes",
    axes,
  },
  {
    id: "gustatif",
    title: "Profil gustatif",
    axes: qualityAxes,
  },
];
