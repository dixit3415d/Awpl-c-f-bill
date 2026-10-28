import { AWPLProduct } from '../types';

export type MatchedField = 'sku' | 'name' | 'category' | 'barcode' | 'batch' | 'sp';

export interface FuzzyProductMatch {
  product: AWPLProduct;
  score: number;
  matchedFields: MatchedField[];
  matchReason: string;
  isTypoMatch?: boolean;
}

/**
 * Bounded Damerau-Levenshtein edit distance for typo-tolerant fuzzy matching.
 * Handles character insertions, deletions, substitutions, and adjacent transpositions.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;
  if (Math.abs(lenA - lenB) > 3) return Math.abs(lenA - lenB);

  const dp: number[][] = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost); // transposition
      }
    }
  }
  return dp[lenA][lenB];
}

/**
 * Checks if needle characters appear in order inside haystack (subsequence match).
 * Returns a score > 0 if matched, higher when characters are consecutive.
 */
function subsequenceScore(needle: string, haystack: string): number {
  if (needle.length < 3 || needle.length > haystack.length) return 0;
  let nIdx = 0;
  let consecutive = 0;
  let maxConsecutive = 0;
  let firstMatchIdx = -1;

  for (let hIdx = 0; hIdx < haystack.length && nIdx < needle.length; hIdx++) {
    if (haystack[hIdx] === needle[nIdx]) {
      if (firstMatchIdx === -1) firstMatchIdx = hIdx;
      nIdx++;
      consecutive++;
      if (consecutive > maxConsecutive) maxConsecutive = consecutive;
    } else {
      consecutive = 0;
    }
  }

  if (nIdx < needle.length) return 0;
  const density = needle.length / Math.max(1, haystack.length - firstMatchIdx);
  if (density < 0.35 && maxConsecutive < 2) return 0;
  return Math.round(35 + density * 25 + maxConsecutive * 4);
}

/**
 * Builds word initials/acronym from a phrase (e.g. "Immunodoc Ras (1000 ml)" -> "ir1m" & "ir").
 */
function getAcronym(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('');
}

/**
 * Scores a single query token against a target string and returns { score, isTypo }.
 */
function scoreTokenAgainstText(
  token: string,
  targetLower: string,
  targetWords: string[],
  acronym: string
): { score: number; isTypo: boolean } {
  if (!token || !targetLower) return { score: 0, isTypo: false };

  // 1. Exact full string match
  if (targetLower === token) {
    return { score: 100, isTypo: false };
  }

  // 2. Starts with token (Prefix match)
  if (targetLower.startsWith(token)) {
    return { score: 94, isTypo: false };
  }

  // 3. Word-level exact or prefix match
  for (let i = 0; i < targetWords.length; i++) {
    const w = targetWords[i];
    if (w === token) {
      return { score: i === 0 ? 92 : 88, isTypo: false };
    }
    if (w.startsWith(token)) {
      return { score: i === 0 ? 86 : 82, isTypo: false };
    }
  }

  // 4. Direct substring match anywhere in target
  const subIdx = targetLower.indexOf(token);
  if (subIdx !== -1) {
    return { score: Math.max(70, 82 - Math.min(subIdx, 12)), isTypo: false };
  }

  // 5. Acronym / Initials match (e.g. "idr" or "ir" for "Immunodoc Ras", "aw" for "Ayurvedic Wellness")
  if (token.length >= 2 && acronym.startsWith(token)) {
    return { score: 78, isTypo: false };
  }

  // 6. Typo-tolerant edit distance against individual words
  if (token.length >= 4) {
    const maxAllowedDist = token.length >= 7 ? 2 : 1;
    let bestWordScore = 0;

    for (const w of targetWords) {
      if (w.length < 3) continue;
      // Compare token against word or word prefix of similar length
      const candidate = w.length > token.length + 2 ? w.slice(0, token.length + 1) : w;
      const dist = editDistance(token, candidate);
      if (dist <= maxAllowedDist) {
        const typoScore = dist === 1 ? 68 : 56;
        if (typoScore > bestWordScore) bestWordScore = typoScore;
      }
    }

    if (bestWordScore > 0) {
      return { score: bestWordScore, isTypo: true };
    }
  }

  // 7. Subsequence match (e.g., "imndc" -> "immunodoc")
  if (token.length >= 4) {
    for (const w of targetWords) {
      const subScore = subsequenceScore(token, w);
      if (subScore >= 48) {
        return { score: subScore, isTypo: true };
      }
    }
  }

  return { score: 0, isTypo: false };
}

/**
 * Real-time Fuzzy Search Filter for AWPL Products.
 * Supports searching by SKU, Product Name, AWPL Category, Barcode, Batch Number, or SP value,
 * with multi-token matching, acronym matching, numeric SKU shortcuts, and typo tolerance.
 */
export function fuzzyFilterProducts(
  products: AWPLProduct[],
  rawQuery: string,
  options?: {
    categoryFilter?: string;
    statusFilter?: 'all' | 'active' | 'out_of_stock' | 'discontinued';
  }
): FuzzyProductMatch[] {
  const categoryFilter = options?.categoryFilter || 'All';
  const statusFilter = options?.statusFilter || 'all';

  // Step 1: Apply strict category & status dropdown filters first
  const baseList = products.filter((p) => {
    const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchCat && matchStatus;
  });

  const cleanQuery = rawQuery.trim().toLowerCase();
  if (!cleanQuery) {
    return baseList.map((product) => ({
      product,
      score: 100,
      matchedFields: [],
      matchReason: 'Catalog',
      isTypoMatch: false,
    }));
  }

  const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);
  const results: FuzzyProductMatch[] = [];

  for (const product of baseList) {
    const skuLower = product.sku.toLowerCase();
    const skuCompact = skuLower.replace(/[^a-z0-9]/g, '');
    const skuParts = skuLower.split(/[-_\s]+/).filter(Boolean);

    const nameLower = product.name.toLowerCase();
    const nameWords = nameLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const nameAcronym = getAcronym(product.name);

    const categoryLower = product.category.toLowerCase();
    const categoryWords = categoryLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const categoryAcronym = getAcronym(product.category);

    const barcodeLower = (product.barcode || '').toLowerCase();
    const batchLower = (product.batchNumber || '').toLowerCase();
    const spString = `${product.sp}sp`;

    const matchedFieldsSet = new Set<MatchedField>();
    let totalTokenScore = 0;
    let allTokensMatched = true;
    let anyTypo = false;

    for (const token of queryTokens) {
      const tokenClean = token.replace(/[^a-z0-9]/g, '');
      let bestFieldScore = 0;
      let tokenMatchedField: MatchedField | null = null;
      let tokenIsTypo = false;

      // Check SKU (exact, prefix, compact, or numeric suffix like "1" -> "001")
      if (skuLower === token || skuCompact === tokenClean) {
        bestFieldScore = 100;
        tokenMatchedField = 'sku';
      } else if (skuLower.includes(token) || (tokenClean.length >= 2 && skuCompact.includes(tokenClean))) {
        bestFieldScore = skuLower.startsWith(token) ? 96 : 90;
        tokenMatchedField = 'sku';
      } else if (/^\d+$/.test(token)) {
        // Numeric shortcut: e.g. "1" or "01" matches SKU ending in "-001"
        const numericSkuPart = skuParts[skuParts.length - 1];
        if (numericSkuPart && Number(numericSkuPart) === Number(token)) {
          bestFieldScore = 93;
          tokenMatchedField = 'sku';
        }
      } else {
        const skuScore = scoreTokenAgainstText(token, skuLower, skuParts, '');
        if (skuScore.score > bestFieldScore) {
          bestFieldScore = skuScore.score;
          tokenMatchedField = 'sku';
          tokenIsTypo = skuScore.isTypo;
        }
      }

      // Check Product Name
      const nameScore = scoreTokenAgainstText(token, nameLower, nameWords, nameAcronym);
      if (nameScore.score > bestFieldScore) {
        bestFieldScore = nameScore.score;
        tokenMatchedField = 'name';
        tokenIsTypo = nameScore.isTypo;
      } else if (nameScore.score >= 70 && tokenMatchedField) {
        matchedFieldsSet.add('name');
      }

      // Check AWPL Category
      const catScore = scoreTokenAgainstText(token, categoryLower, categoryWords, categoryAcronym);
      if (catScore.score > bestFieldScore) {
        bestFieldScore = catScore.score;
        tokenMatchedField = 'category';
        tokenIsTypo = catScore.isTypo;
      } else if (catScore.score >= 70 && tokenMatchedField) {
        matchedFieldsSet.add('category');
      }

      // Check Barcode
      if (barcodeLower && token.length >= 3 && barcodeLower.includes(token)) {
        const bScore = barcodeLower === token ? 100 : 88;
        if (bScore > bestFieldScore) {
          bestFieldScore = bScore;
          tokenMatchedField = 'barcode';
          tokenIsTypo = false;
        } else {
          matchedFieldsSet.add('barcode');
        }
      }

      // Check Batch Number
      if (batchLower && token.length >= 2 && batchLower.includes(token)) {
        const btScore = 76;
        if (btScore > bestFieldScore) {
          bestFieldScore = btScore;
          tokenMatchedField = 'batch';
          tokenIsTypo = false;
        } else {
          matchedFieldsSet.add('batch');
        }
      }

      // Check SP (e.g., "27sp" or "15sp")
      if (tokenClean === spString || (token.endsWith('sp') && Number(token.replace('sp', '')) === product.sp)) {
        bestFieldScore = Math.max(bestFieldScore, 85);
        tokenMatchedField = 'sp';
      }

      if (bestFieldScore === 0 || !tokenMatchedField) {
        allTokensMatched = false;
        break;
      }

      matchedFieldsSet.add(tokenMatchedField);
      if (tokenIsTypo) anyTypo = true;
      totalTokenScore += bestFieldScore;
    }

    if (allTokensMatched && queryTokens.length > 0) {
      const avgScore = Math.min(100, Math.round(totalTokenScore / queryTokens.length));
      const matchedFields = Array.from(matchedFieldsSet);
      const fieldLabels: Record<MatchedField, string> = {
        sku: 'SKU',
        name: 'Name',
        category: 'AWPL Category',
        barcode: 'Barcode',
        batch: 'Batch',
        sp: 'SP Points',
      };
      const reasonLabel = matchedFields.map((f) => fieldLabels[f]).join(' + ');

      results.push({
        product,
        score: avgScore,
        matchedFields,
        matchReason: anyTypo ? `Fuzzy Match (${reasonLabel})` : `Matched ${reasonLabel}`,
        isTypoMatch: anyTypo,
      });
    }
  }

  // Sort by highest relevance score first, then alphabetically by name
  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.product.name.localeCompare(b.product.name);
  });
}

/**
 * Splits text into highlighted & non-highlighted segments for safe React rendering.
 */
export function getHighlightSegments(
  text: string,
  rawQuery: string
): { text: string; highlight: boolean }[] {
  const cleanQuery = rawQuery.trim();
  if (!cleanQuery || !text) {
    return [{ text, highlight: false }];
  }

  const tokens = cleanQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 1)
    .sort((a, b) => b.length - a.length);

  if (tokens.length === 0) {
    return [{ text, highlight: false }];
  }

  // Escape regex special characters
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  if (parts.length <= 1) {
    return [{ text, highlight: false }];
  }

  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      const lowerPart = part.toLowerCase();
      const isMatch = tokens.some((t) => t === lowerPart);
      return { text: part, highlight: isMatch };
    });
}
