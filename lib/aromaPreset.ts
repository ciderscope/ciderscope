import type { RadarAxis, RadarGroup } from "../types";

// Arbre de décision des arômes (reproduit la nomenclature IFPC).
// Structure : Catégorie (axe de la toile) → sous-catégorie → descripteur final.
const leaves = (labels: string[]): RadarAxis[] => labels.map(label => ({ label }));

const axes: RadarAxis[] = [
  {
    label: "Épice",
    children: [
      { label: "Mentholé", children: leaves(["Anis", "Menthe", "Réglisse"]) },
      { label: "Épice", children: leaves(["Cannelle", "Clou de girofle", "Olive noire", "Poivre"]) },
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
      { label: "Lactique", children: leaves(["Beurre", "Levure", "Pain"]) },
      { label: "Herbe séchée", children: leaves(["Foin", "Tabac", "Thé"]) },
      { label: "Brûlé", children: leaves(["Café", "Fumé", "Grillé", "Pain grillé"]) },
    ],
  },
  {
    label: "Minéral",
    children: [
      { label: "Minéral", children: leaves(["Silex"]) },
    ],
  },
  {
    label: "Chimique",
    children: [
      { label: "Chimique", children: leaves(["Alcool", "Caoutchouc", "Dissolvant à ongles", "Pétrole", "Sulfure", "Vinaigre"]) },
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
      { label: "Fruit rouge", children: leaves(["Cassis", "Cerise", "Figue", "Fraise", "Framboise", "Fruit mûr", "Fruit noir", "Groseille", "Mûre", "Myrtille", "Raisin"]) },
      { label: "Fruit blanc/jaune", children: leaves(["Abricot", "Fruit à noyau", "Fruit blanc", "Fruit jaune", "Melon", "Pêche", "Poire", "Pomme", "Prune", "Raisin"]) },
      { label: "Agrume", children: leaves(["Citron", "Citron vert", "Orange", "Pamplemousse"]) },
      { label: "Fruit tropical", children: leaves(["Ananas", "Fruit de la passion", "Litchi", "Mangue", "Noix de coco"]) },
      { label: "Amylique", children: leaves(["Banane", "Bonbon anglais"]) },
    ],
  },
  {
    label: "Floral",
    children: [
      { label: "Floral", children: leaves(["Acacia", "Fleur d'oranger", "Jasmin", "Lilas", "Rose", "Violette"]) },
    ],
  },
  {
    label: "Fruit sec",
    children: [
      { label: "Sucré", children: leaves(["Caramel", "Chocolat", "Miel", "Vanille"]) },
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
