/**
 * shiftKey.ts — Shared Cloud Function utility
 *
 * Single-source implementation of computeShiftKey for use inside Cloud Functions.
 * Mirrors the logic in src/domain/shiftKey.ts (frontend) — kept in sync manually.
 *
 * Cannot import from src/ (different TS project roots), so this file lives in
 * functions/src/shared/ and is the canonical CF implementation.
 *
 * Algorithm:
 *   1. Convert `now` to local time in SHIFT_TZ (America/Sao_Paulo by default)
 *   2. If local time is in [amStart, pmStart) → YYYY-MM-DD-AM (same local date)
 *   3. If local time is in [pmStart, 24:00) → YYYY-MM-DD-PM (same local date)
 *   4. Otherwise (midnight to amStart) → previous calendar day -PM
 */

export const SHIFT_TZ = 'America/Sao_Paulo'

/**
 * Computes the current shiftKey for the given instant.
 *
 * @param now      The instant to evaluate (default: new Date())
 * @param amStart  HH:MM when the AM shift starts (default '07:00')
 * @param pmStart  HH:MM when the PM shift starts (default '19:00')
 * @param tz       IANA timezone (default SHIFT_TZ = 'America/Sao_Paulo')
 * @returns        A string in the format 'YYYY-MM-DD-AM' or 'YYYY-MM-DD-PM'
 */
export function computeShiftKey(
    now: Date,
    amStart = '07:00',
    pmStart = '19:00',
    tz = SHIFT_TZ
): string {
    // Format now as 'YYYY-MM-DD HH:MM' in the target timezone (sv-SE locale gives ISO-like format)
    const localStr = new Intl.DateTimeFormat('sv-SE', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now)

    const [datePart, timePart] = localStr.split(' ')
    const [h, m] = (timePart ?? '00:00').split(':').map(Number)
    const localMin = (h ?? 0) * 60 + (m ?? 0)

    const [amH, amM] = amStart.split(':').map(Number)
    const [pmH, pmM] = pmStart.split(':').map(Number)
    const amMinutes = (amH ?? 7) * 60 + (amM ?? 0)
    const pmMinutes = (pmH ?? 19) * 60 + (pmM ?? 0)

    if (localMin >= amMinutes && localMin < pmMinutes) return `${datePart}-AM`
    if (localMin >= pmMinutes) return `${datePart}-PM`

    // Madrugada — pertence ao turno PM do dia anterior
    const d = new Date((datePart ?? '') + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    return `${d.toISOString().slice(0, 10)}-PM`
}
