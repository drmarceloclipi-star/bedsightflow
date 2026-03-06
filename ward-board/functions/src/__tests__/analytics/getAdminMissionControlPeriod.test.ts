/**
 * Tests for getAdminMissionControlPeriod
 *
 * Integration tests against the Firestore emulator.
 * Prerequisites: Firestore emulator must be running on localhost:8080.
 *
 * G1 fix: validates that the function no longer uses 'action in [...]' + range
 * (which could fail without an explicit Firestore index) but instead uses two
 * separate equality queries, one per action type.
 */

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const functionsTest = require('firebase-functions-test')

const testEnv = functionsTest({ projectId: 'lean-841e5' })

import * as admin from 'firebase-admin'
import { getAdminMissionControlPeriod } from '../../callables/analytics/getAdminMissionControlPeriod'

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'lean-841e5' })
}

const wrapped = testEnv.wrap(getAdminMissionControlPeriod)
const db = admin.firestore()

const UNIT_ID = 'TEST_MC_PERIOD'
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

async function seedReset(date: Date, action: 'RESET_BED_KANBAN' | 'RESET_BED_ALL', mainBlocker?: string) {
    await db.collection(`units/${UNIT_ID}/audit_logs`).add({
        entityType: 'bed',
        action,
        before: { patientAlias: 'P.S.', ...(mainBlocker ? { mainBlocker } : {}) },
        after: { patientAlias: '' },
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
describe('getAdminMissionControlPeriod – auth guard', () => {
    it('throws unauthenticated when no auth context', async () => {
        await expect(
            wrapped({ unitId: UNIT_ID }, { auth: undefined })
        ).rejects.toMatchObject({ code: 'unauthenticated' })
    })
})

// ---------------------------------------------------------------------------
// Argument validation
// ---------------------------------------------------------------------------
describe('getAdminMissionControlPeriod – argument validation', () => {
    it('throws invalid-argument when unitId is missing', async () => {
        await expect(wrapped({}, { auth })).rejects.toMatchObject({ code: 'invalid-argument' })
    })
})

// ---------------------------------------------------------------------------
// Response structure
// ---------------------------------------------------------------------------
describe('getAdminMissionControlPeriod – response structure', () => {
    beforeAll(() => clearCollection(`units/${UNIT_ID}/audit_logs`))

    it('returns expected top-level fields', async () => {
        const result = await wrapped({ unitId: UNIT_ID, range: '7d' }, { auth })
        expect(result).toMatchObject({
            generatedAt: expect.any(String),
            source: 'audit_logs_firestore',
            definitionsVersion: 'v1',
            range: '7d',
            dischargesByDay: expect.any(Array),
            totalDischarges: expect.any(Number),
            avgDischargesPerDay: expect.any(Number),
            prevPeriodTotalDischarges: expect.any(Number),
            topBlockersPeriod: expect.any(Array),
        })
    })

    it('returns 7 entries in dischargesByDay for range=7d', async () => {
        const result = await wrapped({ unitId: UNIT_ID, range: '7d' }, { auth })
        expect(result.dischargesByDay).toHaveLength(7)
    })

    it('returns 30 entries in dischargesByDay for range=30d', async () => {
        const result = await wrapped({ unitId: UNIT_ID, range: '30d' }, { auth })
        expect(result.dischargesByDay).toHaveLength(30)
    })

    it('returns 1 entry in dischargesByDay for range=today', async () => {
        const result = await wrapped({ unitId: UNIT_ID, range: 'today' }, { auth })
        expect(result.dischargesByDay).toHaveLength(1)
    })
})

// ---------------------------------------------------------------------------
// G1 fix: RESET_BED_KANBAN and RESET_BED_ALL both counted as discharges
// Previously these were queried with 'action in [...]' + createdAt range,
// which could fail. Now each action is queried separately and results merged.
// ---------------------------------------------------------------------------
describe('getAdminMissionControlPeriod – discharge counting (G1 fix)', () => {
    beforeEach(() => clearCollection(`units/${UNIT_ID}/audit_logs`))

    it('counts RESET_BED_KANBAN as a discharge', async () => {
        await seedReset(daysAgo(1), 'RESET_BED_KANBAN')

        const result = await wrapped({ unitId: UNIT_ID, range: '7d' }, { auth })
        expect(result.totalDischarges).toBe(1)
    })

    it('counts RESET_BED_ALL as a discharge', async () => {
        await seedReset(daysAgo(1), 'RESET_BED_ALL')

        const result = await wrapped({ unitId: UNIT_ID, range: '7d' }, { auth })
        expect(result.totalDischarges).toBe(1)
    })

    it('counts both action types correctly when mixed in the same period', async () => {
        await seedReset(daysAgo(1), 'RESET_BED_KANBAN')
        await seedReset(daysAgo(2), 'RESET_BED_ALL')
        await seedReset(daysAgo(3), 'RESET_BED_KANBAN')

        const result = await wrapped({ unitId: UNIT_ID, range: '7d' }, { auth })
        expect(result.totalDischarges).toBe(3)
    })

    it('computes topBlockersPeriod from before.mainBlocker', async () => {
        await seedReset(daysAgo(1), 'RESET_BED_KANBAN', 'Alta bloqueada por médico')
        await seedReset(daysAgo(1), 'RESET_BED_KANBAN', 'Alta bloqueada por médico')
        await seedReset(daysAgo(1), 'RESET_BED_ALL', 'Família não encontrada')

        const result = await wrapped({ unitId: UNIT_ID, range: '7d' }, { auth })
        expect(result.topBlockersPeriod[0]).toMatchObject({
            blocker: 'Alta bloqueada por médico',
            count: 2,
        })
    })

    it('separates current from previous period for throughputDelta', async () => {
        // Current period: 3 discharges
        await seedReset(daysAgo(1), 'RESET_BED_KANBAN')
        await seedReset(daysAgo(2), 'RESET_BED_KANBAN')
        await seedReset(daysAgo(3), 'RESET_BED_ALL')
        // Previous period (8–14 days ago): 1 discharge
        await seedReset(daysAgo(9), 'RESET_BED_KANBAN')

        const result = await wrapped({ unitId: UNIT_ID, range: '7d' }, { auth })
        expect(result.totalDischarges).toBe(3)
        expect(result.prevPeriodTotalDischarges).toBe(1)
        expect(result.throughputDelta).toBe(200) // (3-1)/1 * 100 = 200%
    })

    it('sets throughputDelta to null when previous period had zero discharges', async () => {
        await seedReset(daysAgo(1), 'RESET_BED_KANBAN')

        const result = await wrapped({ unitId: UNIT_ID, range: '7d' }, { auth })
        expect(result.prevPeriodTotalDischarges).toBe(0)
        expect(result.throughputDelta).toBeNull()
    })
})
