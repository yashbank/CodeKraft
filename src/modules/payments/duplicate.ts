/**
 * Duplicate UTR check helper (docs/09 §6.1, TM-01).
 */
export function isDuplicateUtr(
  candidateRef: string | null | undefined,
  existingReferences: (string | null | undefined)[],
): boolean {
  if (!candidateRef) return false;
  const normalized = candidateRef.trim().toLowerCase();
  if (!normalized) return false;

  return existingReferences.some(
    (ref) => ref && ref.trim().toLowerCase() === normalized,
  );
}

export function findDuplicateUtrWarnings(
  payments: Array<{ id: string; customerReference?: string | null }>,
): Map<string, string[]> {
  const refMap = new Map<string, string[]>();
  for (const p of payments) {
    if (!p.customerReference) continue;
    const norm = p.customerReference.trim().toLowerCase();
    if (!norm) continue;
    const list = refMap.get(norm) ?? [];
    list.push(p.id);
    refMap.set(norm, list);
  }

  const warnings = new Map<string, string[]>();
  for (const p of payments) {
    if (!p.customerReference) continue;
    const norm = p.customerReference.trim().toLowerCase();
    const matches = refMap.get(norm) ?? [];
    if (matches.length > 1) {
      warnings.set(p.id, [
        `Duplicate UTR: reference '${p.customerReference}' is shared with ${matches.length - 1} other payment(s)`,
      ]);
    }
  }

  return warnings;
}
