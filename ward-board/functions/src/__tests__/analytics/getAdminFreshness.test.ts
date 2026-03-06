/**
 * Tests for getAdminFreshness (Firestore emulator)
 *
 * R2 validation: stale counts should use kamishibai[domain].reviewedAt as the
 * freshness signal, not bed.updatedAt.
 *
 * Prerequisites: Firestore emulator must be running on localhost:8080.
 */

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'

 
const functionsTest = require('firebase-functions-test')

const testEnv = functionsTest({ projectId: 'lean-841e5' })

import * as admin from 'firebase-admin'
import { getAdminFreshness } from '../../callables/analytics/getAdminFreshness'

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'lean-841e5' })
}

const wrapped = testEnv.wrap(getAdminFreshness)
const db = admin.firestore()

const UNIT_ID = 'TEST_FRESHNESS'
const auth = { uid: 'user-123', token: {} }

async function clearCollection(path: string) {
    const snap = await db.collection(path).get()
    const batch = db.batch()
    snap.docs.forEach(doc => batch.delete(doc.ref))
    await batch.commit()
}

function hoursAgoTs(h: number): admin.firestore.Timestamp {
    return admin.firestore.Timestamp.fromDate(new Date(Date.now() - h * 3600_000))
}

afterAll(async () => {
    await clearCollection(`units/${UNIT_ID}/beds`)
    testEnv.cleanup()
})

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
describe('getAdminFreshness – auth guard', () => {
    it('throws unauthenticated when no auth context', async () => {
        await expect(
            wrapped({ unitId: UNIT_ID }, { auth: undefined })
        ).rejects.toMatchObject({ code: 'unauthenticated' })
    })
})

// ---------------------------------------------------------------------------
// Argument validation
// ---------------------------------------------------------------------------
describe('getAdminFreshness – argument validation', () => {
    it('throws invalid-argument when unitId is missing', async () => {
        await expect(wrapped({}, { auth })).rejects.toMatchObject({ code: 'invalid-argument' })
    })
})

// ---------------------------------------------------------------------------
// Response structure
// ---------------------------------------------------------------------------
describe('getAdminFreshness – response structure', () => {
    beforeAll(() => clearCollection(`units/${UNIT_ID}/beds`))

    it('returns stale counts and activity arrays', async () => {
        const result = await wrapped({ unitId: UNIT_ID }, { auth })
        expect(result).toMatchObject({
            stale12h: expect.any(Number),
            stale24h: expect.any(Number),
            stale48h: expect.any(Number),
            updatesByHour: expect.any(Array),
            updatesByDay: expect.any(Array),
        })
        expect(result.updatesByHour).toHaveLength(24)
        expect(result.updatesByDay).toHaveLength(7)
    })
})

// ---------------------------------------------------------------------------
// R2: reviewedAt takes precedence over updatedAt for staleness
// ---------------------------------------------------------------------------
describe('getAdminFreshness – R2: reviewedAt as freshness signal', () => {
    beforeEach(() => clearCollection(`units/${UNIT_ID}/beds`))

    it('uses kamishibai reviewedAt (recent) — bed NOT stale even if updatedAt is old', async () => {
        // updatedAt = 30h ago (would make the bed stale24h), but reviewedAt = 1h ago (fresh)
        await db.collection(`units/${UNIT_ID}/beds`).add({
            patientAlias: 'P.S.',
            updatedAt: hoursAgoTs(30),
            kamishibai: {
                nursing: {
                    status: 'ok',
                    reviewedAt: hoursAgoTs(1),   // recent review → fresh
                },
            },
        })

        const result = await wrapped({ unitId: UNIT_ID }, { auth })
        // reviewedAt = 1h ago → NOT stale for any threshold
        expect(result.stale12h).toBe(0)
        expect(result.stale24h).toBe(0)
        expect(result.stale48h).toBe(0)
    })

    it('uses kamishibai reviewedAt (old) — bed IS stale even if updatedAt is recent', async () => {
        // updatedAt = 1h ago (would be fresh), but reviewedAt = 30h ago (stale)
        await db.collection(`units/${UNIT_ID}/beds`).add({
            patientAlias: 'Q.R.',
            updatedAt: hoursAgoTs(1),
            kamishibai: {
                medical: {
                    status: 'blocked',
                    reviewedAt: hoursAgoTs(30),  // 30h old → stale24h
                },
            },
        })

        const result = await wrapped({ unitId: UNIT_ID }, { auth })
        expect(result.stale24h).toBeGreaterThanOrEqual(1)
    })

    it('uses max reviewedAt across multiple domains', async () => {
        // nursing reviewed 25h ago, medical reviewed 5h ago → max = 5h → fresh
        await db.collection(`units/${UNIT_ID}/beds`).add({
            patientAlias: 'A.B.',
            updatedAt: hoursAgoTs(25),
            kamishibai: {
                nursing: { status: 'ok', reviewedAt: hoursAgoTs(25) },
                medical: { status: 'ok', reviewedAt: hoursAgoTs(5) },
            },
        })

        const result = await wrapped({ unitId: UNIT_ID }, { auth })
        expect(result.stale12h).toBe(0)
        expect(result.stale24h).toBe(0)
    })

    it('falls back to bed.updatedAt when no kamishibai reviewedAt exists', async () => {
        // No kamishibai; updatedAt = 25h ago → stale24h
        await db.collection(`units/${UNIT_ID}/beds`).add({
            patientAlias: 'C.D.',
            updatedAt: hoursAgoTs(25),
        })

        const result = await wrapped({ unitId: UNIT_ID }, { auth })
        expect(result.stale24h).toBeGreaterThanOrEqual(1)
    })

    it('skips beds with no updatedAt and no reviewedAt', async () => {
        await db.collection(`units/${UNIT_ID}/beds`).add({
            patientAlias: 'E.F.',
            // neither updatedAt nor reviewedAt
        })

        const result = await wrapped({ unitId: UNIT_ID }, { auth })
        // Should not throw; counts remain 0
        expect(result.stale12h).toBe(0)
    })
})
