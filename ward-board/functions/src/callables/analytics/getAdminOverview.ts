import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import type { Timestamp } from 'firebase-admin/firestore'

type KamishibaiStatus = 'ok' | 'blocked' | 'na'

/**
 * Returns current ward overview metrics from live Firestore data.
 *
 * Reads the beds sub-collection to derive:
 *  - occupancy (occupied / vacant)
 *  - expected discharges within 24h
 *  - beds with a documented blocker
 *  - kamishibai blocked counts
 *  - stale beds (not updated in >24h)
 */
export const getAdminOverview = functions
    .region('southamerica-east1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'É preciso estar logado.')
        }

        const { unitId } = data
        if (!unitId) {
            throw new functions.https.HttpsError('invalid-argument', 'O unitId é obrigatório.')
        }

        try {
            const db = admin.firestore()
            const bedsSnap = await db.collection(`units/${unitId}/beds`).get()

            const now = Date.now()
            const ms24h = 24 * 60 * 60 * 1000

            let occupiedBeds = 0
            let vacantBeds = 0
            let dischargeLt24h = 0
            let bedsWithBlocker = 0
            let blockedKamishibai = 0
            let staleBeds24h = 0

            for (const doc of bedsSnap.docs) {
                const bed = doc.data()
                const hasPatient = bed.patientAlias && bed.patientAlias.trim() !== ''

                if (hasPatient) {
                    occupiedBeds++
                } else {
                    vacantBeds++
                }

                if (hasPatient && bed.expectedDischarge === '24h') dischargeLt24h++
                if (hasPatient && bed.mainBlocker && bed.mainBlocker.trim() !== '') bedsWithBlocker++

                // Kamishibai aggregation across all specialties for this bed
                if (bed.kamishibai && typeof bed.kamishibai === 'object') {
                    for (const entry of Object.values(bed.kamishibai)) {
                        const status = (entry as { status: KamishibaiStatus }).status
                        if (status === 'blocked') blockedKamishibai++
                    }
                }

                // Stale check: use updatedAt
                const rawTs = bed.updatedAt
                if (rawTs) {
                    let updatedMs: number
                    if (typeof rawTs === 'string') {
                        updatedMs = new Date(rawTs).getTime()
                    } else {
                        updatedMs = (rawTs as Timestamp).toMillis()
                    }
                    if (!isNaN(updatedMs) && now - updatedMs > ms24h) staleBeds24h++
                }
            }

            return {
                activePatients: occupiedBeds,
                occupiedBeds,
                vacantBeds,
                dischargeLt24h,
                bedsWithBlocker,
                blockedKamishibai,
                staleBeds24h,
            }
        } catch (error: unknown) {
            if (error instanceof functions.https.HttpsError) throw error
            const msg = error instanceof Error ? error.message : 'Erro interno'
            throw new functions.https.HttpsError('internal', msg)
        }
    })
