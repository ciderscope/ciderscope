import type { RadarAxis, RadarGroup } from "../types";

// Arbre de décision des arômes (reproduit la nomenclature IFPC).
// Structure : Catégorie (axe de la toile) → sous-catégorie → descripteur final.
const leaves = (labels: string[]): RadarAxis[] => labels.map(label => ({ label }));

const axes: RadarAxis[] = [
  {
    label: "Épice",
    children: [
      { label: "Épice", children: leaves(["Anis", "Cannelle", "Clou de girofle", "Olive noire", "Poivre", "Réglisse"]) },
    ],
  },
  {
    label: "Végétal",
    children: [
      { label: "Végétal", children: leaves(["Herbe", "Herbe coupée", "Poivron vert", "Vert"]) },
      { label: "Plante aromatique", children: leaves(["Laurier", "Menthe", "Thé", "Thym"]) },
    ],
  },
  {
    label: "Grillé",
    children: [
      { label: "Herbe séchée", children: leaves(["Foin", "Tabac"]) },
      { label: "Empyreumatique", children: leaves(["Café", "Caramel", "Chocolat", "Fumé", "Grillé", "Pain grillé", "Pain", "Vanille"]) },
    ],
  },
  {
    label: "Lactique",
    children: [
      { label: "Lactique", children: leaves(["Beurre", "Levure"]) },
    ],
  },
  {
    label: "Chimique",
    children: [
      { label: "Chimique", children: leaves(["Alcool", "Caoutchouc", "Dissolvant à ongles", "Vinaigre"]) },
    ],
  },
  {
    label: "Soufrée",
    children: [
      { label: "Soufrée", children: leaves(["Ail", "Choux", "Serpillère", "Oeuf pourri"]) },
    ],
  },
  {
    label: "Sous-bois",
    children: [
      { label: "Animal", children: leaves(["Cuir", "Sueur"]) },
      { label: "Terreux", children: leaves(["Champignon", "Liège", "Moisi", "Poussière", "Sous-bois", "Truffe"]) },
      { label: "Bois", children: leaves(["Chêne", "Liège", "Pin"]) },
    ],
  },
  {
    label: "Fruit",
    children: [
      { label: "Fruit rouge", children: leaves(["Cassis", "Cerise", "Figue", "Fraise", "Framboise", "Fruit mûr", "Fruit noir", "Groseille", "Mûre", "Myrtille"]) },
      { label: "Fruit blanc/jaune", children: leaves(["Abricot", "Coing", "Fruit à noyau", "Melon", "Pêche", "Poire", "Pomme", "Prune", "Raisin"]) },
      { label: "Agrume", children: leaves(["Citron", "Citron vert", "Orange", "Pamplemousse"]) },
      { label: "Fruit tropical", children: leaves(["Ananas", "Banane", "Fruit de la passion", "Litchi", "Mangue", "Noix de coco"]) },
    ],
  },
  {
    label: "Floral",
    children: [
      { label: "Floral", children: leaves(["Acacia", "Fleur d'oranger", "Jasmin", "Lilas", "Miel", "Rose", "Violette"]) },
    ],
  },
  {
    label: "Fruit sec",
    children: [
      { label: "Fruit sec", children: leaves(["Abricot sec", "Amande", "Noisette", "Noix"]) },
    ],
  },
];

const qualityAxes: RadarAxis[] = [
  { label: "Acidité" },
  { label: "Amertume" },
  { label: "Sucrosité" },
  { label: "Astringence" },
  { label: "Intensité" },
  { label: "Complexité" },
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
