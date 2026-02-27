import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

type KamishibaiStatus = 'ok' | 'blocked' | 'pending' | 'na'

/**
 * Returns Kamishibai status distribution and per-specialty breakdown
 * from live Firestore bed data.
 *
 * Reads the `kamishibai` field of each bed (Record<SpecialtyKey, KamishibaiEntry>)
 * and aggregates status counts across all beds — total distribution and by specialty.
 */
export const getAdminKamishibaiStatsBQ = functions
    .region('southamerica-east1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'É preciso estar logado.')
        }

        const { unitId } = data
        if (!unitId) {
            throw new functions.https.HttpsError('invalid-argument', 'O unitId é obrigatório.')
        }

        const db = admin.firestore()
        const bedsSnap = await db.collection(`units/${unitId}/beds`).get()

        const distribution = { ok: 0, pending: 0, blocked: 0, na: 0 }
        // specialty → counts
        const specialtyMap = new Map<string, { ok: number; pending: number; blocked: number; na: number }>()

        for (const doc of bedsSnap.docs) {
            const bed = doc.data()
            if (!bed.kamishibai || typeof bed.kamishibai !== 'object') continue

            for (const [specialty, entry] of Object.entries(bed.kamishibai)) {
                const status = (entry as { status: KamishibaiStatus }).status ?? 'na'

                // accumulate global distribution
                distribution[status] = (distribution[status] ?? 0) + 1

                // accumulate per-specialty
                if (!specialtyMap.has(specialty)) {
                    specialtyMap.set(specialty, { ok: 0, pending: 0, blocked: 0, na: 0 })
                }
                const sc = specialtyMap.get(specialty)!
                sc[status] = (sc[status] ?? 0) + 1
            }
        }

        const byDomain = Array.from(specialtyMap.entries())
            .map(([domain, counts]) => ({ domain: domain.toUpperCase(), ...counts }))
            .sort((a, b) => (b.ok + b.pending + b.blocked + b.na) - (a.ok + a.pending + a.blocked + a.na))

        return { distribution, byDomain }
    })
