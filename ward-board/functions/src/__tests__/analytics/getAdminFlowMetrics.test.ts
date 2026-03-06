/**
 * Tests for getAdminFlowMetrics (real Firestore data version)
 *
 * Now an integration test — queries real audit_logs from the Firestore emulator.
 * Prerequisites: Firestore emulator must be running on localhost:8080.
 */

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const functionsTest = require('firebase-functions-test')

const testEnv = functionsTest({
    projectId: 'lean-841e5',
})

import * as admin from 'firebase-admin'
import { getAdminFlowMetrics } from '../../callables/analytics/getAdminFlowMetrics'

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'lean-841e5' })
}

const wrapped = testEnv.wrap(getAdminFlowMetrics)
const db = admin.firestore()

const UNIT_ID = 'TEST_FLOW'
const auth = { uid: 'user-123', token: {} }

function daysAgo(n: number, hour = 12): Date {
    const d = new Date()
    d.setDate(d.getDate() - n)
    d.setHours(hour, 0, 0, 0)
    return d
}

async function clearCollection(path: string) {
    const snap = await db.collection(path).get()
    const batch = db.batch()
    snap.docs.forEach(doc => batch.delete(doc.ref))
    await batch.commit()
}

/** Seed a RESET_BED_KANBAN (always treated as a discharge) */
async function seedReset(date: Date, expectedDischarge = 'later') {
    await db.collection(`units/${UNIT_ID}/audit_logs`).add({
        entityType: 'bed',
        action: 'RESET_BED_KANBAN',
        before: { patientAlias: 'P.S.', expectedDischarge },
        after: { patientAlias: '', expectedDischarge: 'later' },
        createdAt: admin.firestore.Timestamp.fromDate(date),
    })
}

/** Seed an UPDATE_BED that represents a patient being cleared */
async function seedUpdateClear(date: Date, expectedDischarge = 'later') {
    await db.collection(`units/${UNIT_ID}/audit_logs`).add({
        entityType: 'bed',
        action: 'UPDATE_BED',
        before: { patientAlias: 'A.B.', expectedDischarge },
        after: { patientAlias: '' },
        createdAt: admin.firestore.Timestamp.fromDate(date),
    })
}

/** Seed an UPDATE_BED that is NOT a discharge (patient updated but not cleared) */
async function seedUpdateNonDischarge(date: Date) {
    await db.collection(`units/${UNIT_ID}/audit_logs`).add({
        entityType: 'bed',
        action: 'UPDATE_BED',
        before: { patientAlias: 'A.B.', expectedDischarge: '24h' },
        after: { patientAlias: 'A.B.', expectedDischarge: '2-3_days' },
        createdAt: admin.firestore.Timestamp.fromDate(date),
    })
}

afterAll(async () => {
    await clearCollection(`units/${UNIT_ID}/audit_logs`)
    testEnv.cleanup()
})

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
describe('getAdminFlowMetrics – auth guard', () => {
    it('throws unauthenticated when no auth context is provided', async () => {
        await expect(
            wrapped({ unitId: UNIT_ID }, { auth: undefined })
        ).rejects.toMatchObject({ code: 'unauthenticated' })
    })
})

// ---------------------------------------------------------------------------
// Argument validation
// ---------------------------------------------------------------------------
describe('getAdminFlowMetrics – argument validation', () => {
    it('throws invalid-argument when unitId is missing', async () => {
        await expect(wrapped({}, { auth })).rejects.toMatchObject({ code: 'invalid-argument' })
    })
})

// ---------------------------------------------------------------------------
// Response structure
// ---------------------------------------------------------------------------
describe('getAdminFlowMetrics – response structure', () => {
    beforeAll(() => clearCollection(`units/${UNIT_ID}/audit_logs`))

    it('returns 1 point for periodKey=today', async () => {
        const result = await wrapped({ unitId: UNIT_ID, periodKey: 'today' }, { auth })
        expect(result).toHaveLength(1)
    })

    it('returns 7 points for periodKey=7d', async () => {
        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })
        expect(result).toHaveLength(7)
    })

    it('returns 30 points for periodKey=30d', async () => {
        const result = await wrapped({ unitId: UNIT_ID, periodKey: '30d' }, { auth })
        expect(result).toHaveLength(30)
    })

    it('each point has the correct shape', async () => {
        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })
        for (const point of result) {
            expect(point).toMatchObject({
                date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                lt24h: expect.any(Number),
                d2to3: expect.any(Number),
                gt3d: expect.any(Number),
                undefinedBucket: expect.any(Number),
            })
        }
    })

    it('dates are in ascending order', async () => {
        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })
        const dates: string[] = result.map((p: { date: string }) => p.date)
        expect(dates).toEqual([...dates].sort())
    })

    it('last date in result is today', async () => {
        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        const todayStr = today.toISOString().slice(0, 10)
        expect(result[result.length - 1].date).toBe(todayStr)
    })
})

// ---------------------------------------------------------------------------
// Bucket assignment from real audit logs
// ---------------------------------------------------------------------------
describe('getAdminFlowMetrics – bucket assignment', () => {
    beforeEach(() => clearCollection(`units/${UNIT_ID}/audit_logs`))

    it('counts RESET_BED_KANBAN as a discharge and assigns correct bucket', async () => {
        await seedReset(daysAgo(1), '24h')
        await seedReset(daysAgo(1), '2-3_days')
        await seedReset(daysAgo(1), '>3_days')
        await seedReset(daysAgo(1), 'later')

        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })
        const yesterday = result[result.length - 2]

        expect(yesterday.lt24h).toBe(1)
        expect(yesterday.d2to3).toBe(1)
        expect(yesterday.gt3d).toBe(1)
        expect(yesterday.undefinedBucket).toBe(1)
    })

    it('counts UPDATE_BED that clears a patient as a discharge', async () => {
        await seedUpdateClear(daysAgo(1), '24h')

        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })
        const yesterday = result[result.length - 2]

        expect(yesterday.lt24h).toBe(1)
    })

    it('does NOT count UPDATE_BED that does not clear a patient', async () => {
        await seedUpdateNonDischarge(daysAgo(1))

        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })
        const total = result.reduce(
            (acc: number, p: { lt24h: number; d2to3: number; gt3d: number; undefinedBucket: number }) =>
                acc + p.lt24h + p.d2to3 + p.gt3d + p.undefinedBucket, 0
        )
        expect(total).toBe(0)
    })

    it('days with no discharges have all buckets at zero', async () => {
        // Only seed yesterday
        await seedReset(daysAgo(1), '24h')

        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })
        // All days except yesterday should be zero
        const otherDays = [...result.slice(0, -2), result[result.length - 1]]
        for (const p of otherDays) {
            expect(p.lt24h + p.d2to3 + p.gt3d + p.undefinedBucket).toBe(0)
        }
    })

    it('null/undefined expectedDischarge goes to undefinedBucket', async () => {
        // Seed a discharge with no expectedDischarge on before
        await db.collection(`units/${UNIT_ID}/audit_logs`).add({
            entityType: 'bed',
            action: 'RESET_BED_KANBAN',
            before: { patientAlias: 'X.Y.' },  // no expectedDischarge field
            after: { patientAlias: '' },
            createdAt: admin.firestore.Timestamp.fromDate(daysAgo(1)),
        })

        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })
        const yesterday = result[result.length - 2]
        expect(yesterday.undefinedBucket).toBe(1)
    })
})
