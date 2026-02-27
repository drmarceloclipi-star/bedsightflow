type AuditDiff = Record<string, { before: unknown; after: unknown }>;

/**
 * Builds a shallow diff object comparing before and after states.
 * Uses JSON stringification for basic comparison.
 */
export function buildAuditDiff(
    before: Record<string, unknown> | undefined | null,
    after: Record<string, unknown> | undefined | null
): AuditDiff | null {
    if (!before && !after) return null;

    const diff: AuditDiff = {};
    const beforeObj = before || {};
    const afterObj = after || {};

    const allKeys = new Set([
        ...Object.keys(beforeObj),
        ...Object.keys(afterObj)
    ]);

    for (const key of allKeys) {
        // Ignorar campos de auditoria e updates na diff de alteração
        if (key === 'updatedAt' || key === 'updatedBy' || key === 'lastUpdate') {
            continue;
        }

        const b = beforeObj[key];
        const a = afterObj[key];

        if (JSON.stringify(b) !== JSON.stringify(a)) {
            diff[key] = { before: b ?? null, after: a ?? null };
        }
    }

    return Object.keys(diff).length > 0 ? diff : null;
}
