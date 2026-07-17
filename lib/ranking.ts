export const findPerceptionThreshold = (
  products: string[],
  rankMeans: Record<string, number>,
  groups: Record<string, string>
): string | null => {
  const sortedByMean = [...products].sort((a, b) => rankMeans[a] - rankMeans[b]);
  return sortedByMean.find(product => !(groups[product] || "").includes("a")) || null;
};
