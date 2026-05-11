/**
 * HRATA Module (Hierarchical Rate-All-That-Apply)
 * Implements the methodology proposed by Léa Koenig for sensory analysis of structured, zero-inflated data.
 */

import { anovaTwoWay, anovaOneWay, cochranQ, pcaCovariance, projectToPCA, rvCoefficient, procrustes2D, pca2D } from "./stats";

export interface HrataObservation {
  subjectId: string;
  productId: string;
  attributeId: string;
  attributeLevel: "famille" | "classe" | "descripteur"; // Or any 3-level taxonomy
  intensity: number | null; // null represents missing data (before imputation)
}

export interface HrataConfig {
  minSubjects: number; // default: 10
  minCoverageRate: number; // default: 0.15 (15%)
  minPositiveSelections: number; // default: 5
  maxIntensityScale: number; // default: 10
}

export interface AttributeMetrics {
  attributeId: string;
  level: "famille" | "classe" | "descripteur";
  
  // Coverage & Usage
  totalSubjects: number;
  subjectsConsidering: number;
  coverageRate: number;
  positiveSelections: number;
  totalFrequency: number; // Same as positiveSelections for binary usage
  conditionalFrequency: number; // freq / (subjectsConsidering * n_products)
  
  // Intensity
  positiveMeanIntensity: number; // Mean of non-zero intensities
  conditionalMeanIntensity: number; // Mean including 0s (for considered subjects)
  
  // Dravnieks
  dravnieksConditional: number;
  dravnieksWeighted: number;

  isLowCoverage: boolean;
}

export type DiscriminationStatus = 
  | "Non discriminant"
  | "Discriminant par applicabilité"
  | "Discriminant par intensité"
  | "Discriminant par applicabilité et intensité"
  | "Descriptif seulement (faible couverture)"
  | "Modèle échoué";

export interface AttributeAnalysis extends AttributeMetrics {
  // P-values
  pApplicabilityRaw?: number; // From Cochran Q or Logistic Regression
  pApplicabilityFDR?: number; // Benjamini-Hochberg adjusted
  
  pIntensityRaw?: number; // From ANOVA on positive intensities
  pIntensityFDR?: number;

  status: DiscriminationStatus;
}

/**
 * 1. Data Preprocessing & Metric Calculation
 * Applies the NC vs 0 imputation rule.
 */
export function analyzeAttributes(
  data: HrataObservation[],
  config: HrataConfig = { minSubjects: 10, minCoverageRate: 0.15, minPositiveSelections: 5, maxIntensityScale: 10 }
): AttributeAnalysis[] {
  
  const subjects = Array.from(new Set(data.map(d => d.subjectId)));
  const products = Array.from(new Set(data.map(d => d.productId)));
  const attributes = Array.from(new Set(data.map(d => d.attributeId)));
  
  const totalSubjects = subjects.length;
  const numProducts = products.length;

  // Build quick access map: attr -> subject -> product -> intensity
  const dataMap: Record<string, Record<string, Record<string, number | null>>> = {};
  const levelMap: Record<string, "famille" | "classe" | "descripteur"> = {};

  data.forEach(d => {
    if (!dataMap[d.attributeId]) dataMap[d.attributeId] = {};
    if (!dataMap[d.attributeId][d.subjectId]) dataMap[d.attributeId][d.subjectId] = {};
    dataMap[d.attributeId][d.subjectId][d.productId] = d.intensity;
    levelMap[d.attributeId] = d.attributeLevel;
  });

  const analyses: AttributeAnalysis[] = [];

  for (const attr of attributes) {
    const level = levelMap[attr];
    const attrData = dataMap[attr];

    // Determine subjects considering the attribute (used > 0 at least once)
    const consideringSubjects = new Set<string>();
    let positiveSelections = 0;
    let sumPositiveIntensity = 0;

    subjects.forEach(sub => {
      let considered = false;
      products.forEach(prod => {
        const val = attrData[sub]?.[prod];
        if (val !== undefined && val !== null && val > 0) {
          considered = true;
          positiveSelections++;
          sumPositiveIntensity += val;
        }
      });
      if (considered) consideringSubjects.add(sub);
    });

    const subjectsConsidering = consideringSubjects.size;
    const coverageRate = totalSubjects > 0 ? subjectsConsidering / totalSubjects : 0;
    
    // Impute data and calculate conditional metrics
    let sumConditionalIntensity = 0;
    let conditionalObservations = 0;

    const matrixApplicability: number[][] = []; // [subjectsConsidering x products] for Cochran Q
    const matrixIntensity: (number | null)[][] = []; // [products x subjectsConsidering] for ANOVA

    for (let i = 0; i < numProducts; i++) {
      matrixIntensity.push([]);
    }

    let subIdx = 0;
    subjects.forEach(sub => {
      if (consideringSubjects.has(sub)) {
        const subAppRow: number[] = [];
        products.forEach((prod, prodIdx) => {
          let val = attrData[sub]?.[prod];
          if (val == null) val = 0; // Imputation rule: 0 if considered at least once, else NC
          
          sumConditionalIntensity += val;
          conditionalObservations++;
          
          subAppRow.push(val > 0 ? 1 : 0);
          matrixIntensity[prodIdx].push(val > 0 ? val : null); // ANOVA on positive intensities only
        });
        matrixApplicability.push(subAppRow);
        subIdx++;
      }
    });

    const positiveMeanIntensity = positiveSelections > 0 ? sumPositiveIntensity / positiveSelections : 0;
    const conditionalMeanIntensity = conditionalObservations > 0 ? sumConditionalIntensity / conditionalObservations : 0;
    const conditionalFrequency = (subjectsConsidering * numProducts) > 0 ? positiveSelections / (subjectsConsidering * numProducts) : 0;

    // Dravnieks calculations
    // freq_cond * (sum_int / max_possible_int) -> geometric mean
    const maxPossibleInt = subjectsConsidering * numProducts * config.maxIntensityScale;
    const intensityPercent = maxPossibleInt > 0 ? sumConditionalIntensity / maxPossibleInt : 0;
    const dravnieksConditional = Math.sqrt(conditionalFrequency * intensityPercent) * 100;
    const dravnieksWeighted = dravnieksConditional * coverageRate;

    const isLowCoverage = 
      subjectsConsidering < config.minSubjects || 
      coverageRate < config.minCoverageRate || 
      positiveSelections < config.minPositiveSelections;

    const analysis: AttributeAnalysis = {
      attributeId: attr,
      level,
      totalSubjects,
      subjectsConsidering,
      coverageRate,
      positiveSelections,
      totalFrequency: positiveSelections,
      conditionalFrequency,
      positiveMeanIntensity,
      conditionalMeanIntensity,
      dravnieksConditional,
      dravnieksWeighted,
      isLowCoverage,
      status: "Descriptif seulement (faible couverture)"
    };

    if (!isLowCoverage) {
      // Test applicability: Cochran's Q (Robust alternative to Logistic Regression with subject strata)
      try {
        const qRes = cochranQ(matrixApplicability);
        analysis.pApplicabilityRaw = qRes.pValue;
      } catch (e) {
        // Model failed
      }

      // Test intensity: ANOVA on positive values
      try {
        const aRes = anovaOneWay(matrixIntensity);
        analysis.pIntensityRaw = aRes.ok ? aRes.pValue : undefined;
      } catch (e) {
        // Not enough data for ANOVA
      }
    }

    analyses.push(analysis);
  }

  // 2. Multiplicity Correction (Benjamini-Hochberg FDR)
  // Processed separately by hierarchical level
  const levels = ["famille", "classe", "descripteur"] as const;
  
  levels.forEach(lvl => {
    const levelAn = analyses.filter(a => a.level === lvl && !a.isLowCoverage);
    
    // FDR for Applicability
    const appValid = levelAn.filter(a => a.pApplicabilityRaw !== undefined);
    const appPvals = appValid.map(a => a.pApplicabilityRaw as number);
    const appFdr = benjaminiHochberg(appPvals);
    appValid.forEach((a, i) => a.pApplicabilityFDR = appFdr[i]);

    // FDR for Intensity
    const intValid = levelAn.filter(a => a.pIntensityRaw !== undefined);
    const intPvals = intValid.map(a => a.pIntensityRaw as number);
    const intFdr = benjaminiHochberg(intPvals);
    intValid.forEach((a, i) => a.pIntensityFDR = intFdr[i]);
  });

  // 3. Classification
  analyses.forEach(a => {
    if (a.isLowCoverage) return; // Status already set

    const isAppDiscrim = a.pApplicabilityFDR !== undefined && a.pApplicabilityFDR < 0.05;
    const isIntDiscrim = a.pIntensityFDR !== undefined && a.pIntensityFDR < 0.05;

    if (a.pApplicabilityRaw === undefined && a.pIntensityRaw === undefined) {
      a.status = "Modèle échoué";
    } else if (isAppDiscrim && isIntDiscrim) {
      a.status = "Discriminant par applicabilité et intensité";
    } else if (isAppDiscrim) {
      a.status = "Discriminant par applicabilité";
    } else if (isIntDiscrim) {
      a.status = "Discriminant par intensité";
    } else {
      a.status = "Non discriminant";
    }
  });

  return analyses;
}

/**
 * Applies Benjamini-Hochberg False Discovery Rate adjustment.
 */
export function benjaminiHochberg(pValues: number[]): number[] {
  const n = pValues.length;
  if (n === 0) return [];
  
  // Create array of objects to keep track of original indices
  const indexedPvals = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  
  const fdr = new Array(n);
  let minAdj = 1;

  for (let i = n - 1; i >= 0; i--) {
    const rank = i + 1;
    const adjP = (indexedPvals[i].p * n) / rank;
    minAdj = Math.min(minAdj, adjP);
    fdr[indexedPvals[i].i] = minAdj;
  }

  return fdr.map(p => Math.min(p, 1));
}

/**
 * Computes Mantel correlation between two distance matrices using Pearson correlation
 * of their flattened upper triangles.
 */
export function mantelTest(distMat1: number[][], distMat2: number[][]): number {
  const n = distMat1.length;
  if (n < 2 || distMat2.length !== n) return 0;

  const vec1: number[] = [];
  const vec2: number[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      vec1.push(distMat1[i][j]);
      vec2.push(distMat2[i][j]);
    }
  }

  return pearson(vec1, vec2);
}

/** Utility: Pearson Correlation */
function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

/**
 * Creates matrices for Multidimensional Analysis.
 * Default value metric is "dravnieksWeighted".
 */
export function preparePcaMatrices(
  analyses: AttributeAnalysis[],
  products: string[], // List of product IDs in fixed order
  metric: "dravnieksWeighted" | "dravnieksConditional" | "conditionalFrequency" | "conditionalMeanIntensity" = "dravnieksWeighted"
): { 
  activeMatrix: number[][]; // Categories [products x attributes]
  illustrativeMatrix: number[][]; // Families & Terms [products x attributes]
  activeLabels: string[];
  illustrativeLabels: string[];
} {
  
  const activeAttrs = analyses.filter(a => a.level === "classe" && !a.isLowCoverage);
  const illusAttrs = analyses.filter(a => (a.level === "famille" || a.level === "descripteur") && !a.isLowCoverage);

  const buildMat = (attrs: AttributeAnalysis[]) => {
    // Note: This requires the metric to be calculated per product.
    // The current AttributeMetrics are global. 
    // Wait, the specification says: "Calculer les scores de Dravnieks par produit × attribut".
    // I need to expand the analysis to include per-product metrics!
    return [];
  };

  // I will refactor the design slightly to expose per-product matrices directly from the raw data processor.
  throw new Error("Pca matrix preparation requires per-product metric aggregation. Use getProductAttributeMatrix instead.");
}

/**
 * Calculates per-product metrics (Dravnieks, Means) to feed the PCA.
 */
export function getProductAttributeMatrix(
  data: HrataObservation[],
  analyses: AttributeAnalysis[],
  metric: "dravnieksWeighted" | "dravnieksConditional" | "conditionalFrequency" | "conditionalMeanIntensity",
  maxIntensityScale: number = 10
): {
  products: string[];
  categories: { labels: string[]; matrix: number[][] }; // Active
  illustratives: { labels: string[]; matrix: number[][] }; // Illustrative
} {
  const products = Array.from(new Set(data.map(d => d.productId))).sort();
  
  // Active variables: only classes (categories) with sufficient coverage
  const activeLabels = analyses.filter(a => a.level === "classe" && !a.isLowCoverage).map(a => a.attributeId);
  
  // Illustrative variables: families, descriptors, AND any category that had low coverage
  const illusLabels = analyses.filter(a => {
    if (a.level === "classe" && !a.isLowCoverage) return false; // already active
    return true; // include everything else as illustrative (even low coverage items, for exploratory interpretation)
  }).map(a => a.attributeId);

  // Group data by attr -> prod -> sub -> val
  const dataMap: Record<string, Record<string, Record<string, number>>> = {};
  data.forEach(d => {
    if (d.intensity != null && d.intensity > 0) {
      if (!dataMap[d.attributeId]) dataMap[d.attributeId] = {};
      if (!dataMap[d.attributeId][d.productId]) dataMap[d.attributeId][d.productId] = {};
      dataMap[d.attributeId][d.productId][d.subjectId] = d.intensity;
    }
  });

  const getMat = (labels: string[]) => {
    const mat: number[][] = products.map(() => []);
    
    labels.forEach(attrId => {
      const an = analyses.find(a => a.attributeId === attrId)!;
      const nTotal = an.totalSubjects;
      const nCons = an.subjectsConsidering;
      const covRate = an.coverageRate;

      products.forEach((prod, pIdx) => {
        const subNotes = dataMap[attrId]?.[prod] || {};
        const activeSubs = Object.keys(subNotes);
        
        const freq = activeSubs.length;
        const sumInt = activeSubs.reduce((acc, sub) => acc + subNotes[sub], 0);

        let val = 0;
        if (nCons > 0) {
          const freqCond = freq / nCons;
          const intCondMean = sumInt / nCons;
          const intPercent = sumInt / (nCons * maxIntensityScale);
          
          if (metric === "conditionalFrequency") val = freqCond;
          else if (metric === "conditionalMeanIntensity") val = intCondMean;
          else if (metric === "dravnieksConditional") val = Math.sqrt(freqCond * intPercent) * 100;
          else if (metric === "dravnieksWeighted") val = Math.sqrt(freqCond * intPercent) * 100 * covRate;
        }

        mat[pIdx].push(val);
      });
    });

    return mat;
  };

  return {
    products,
    categories: { labels: activeLabels, matrix: getMat(activeLabels) },
    illustratives: { labels: illusLabels, matrix: getMat(illusLabels) }
  };
}

/**
 * HRATA Multi-block analysis using stats.ts primitives
 */
export function runHrataMultidimensional(
  productMatrix: ReturnType<typeof getProductAttributeMatrix>,
  normalize: boolean = false
) {
  // Use non-normalized PCA (Covariance) by default for Dravnieks, else standard Correlation PCA
  const pcaFn = normalize ? pca2D : pcaCovariance; 

  const activeRes = pcaFn(productMatrix.categories.matrix);
  
  // Project illustratives
  const illusProj = projectToPCA(productMatrix.illustratives.matrix, activeRes.scores);

  return {
    scores: activeRes.scores,
    explained: activeRes.explained,
    activeLoadings: activeRes.loadings,
    illustrativeLoadings: illusProj
  };
}
