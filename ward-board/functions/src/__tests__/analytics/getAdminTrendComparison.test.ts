/**
 * Tests for getAdminTrendComparison
 *
 * These tests are integration-level: they write documents to the Firestore
 * emulator and verify the function reads them correctly.
 *
 * Prerequisites: Firestore emulator must be running on localhost:8080.
 */

// Point Admin SDK at the local emulator BEFORE any firebase imports
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'

 
const functionsTest = require('firebase-functions-test')

const testEnv = functionsTest({
    projectId: 'lean-841e5',
})

import * as admin from 'firebase-admin'
import { getAdminTrendComparison } from '../../callables/analytics/getAdminTrendComparison'

// Initialise admin SDK pointing to the emulator
if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'lean-841e5' })
}

const wrapped = testEnv.wrap(getAdminTrendComparison)
const db = admin.firestore()

const UNIT_ID = 'TEST_TREND'
const auth = { uid: 'user-123', token: {} }

/** Helper: delete all docs in a collection path */
async function clearCollection(collectionPath: string) {
    const snap = await db.collection(collectionPath).get()
    const batch = db.batch()
    snap.docs.forEach(doc => batch.delete(doc.ref))
    await batch.commit()
}

/** Helper: seed an audit log entry for a given date */
async function seedAuditLog(unitId: string, date: Date, entityType = 'bed') {
    await db.collection(`units/${unitId}/audit_logs`).add({
        entityType,
        createdAt: admin.firestore.Timestamp.fromDate(date),
        action: 'UPDATE_BED',
        actor: { uid: 'nurse-01', displayName: 'Nurse' },
    })
}

/** Helper: subtract days from a date */
function daysAgo(n: number): Date {
    const d = new Date()
    d.setDate(d.getDate() - n)
    d.setHours(12, 0, 0, 0)  // noon → guaranteed inside the day window
    return d
}

afterAll(async () => {
    await clearCollection(`units/${UNIT_ID}/audit_logs`)
    await clearCollection(`units/${UNIT_ID}/beds`)
    testEnv.cleanup()
})

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
describe('getAdminTrendComparison – auth guard', () => {
    it('throws unauthenticated when no auth context is provided', async () => {
        await expect(
            wrapped({ unitId: UNIT_ID }, { auth: undefined })
        ).rejects.toMatchObject({ code: 'unauthenticated' })
    })
})

// ---------------------------------------------------------------------------
// Argument validation
// ---------------------------------------------------------------------------
describe('getAdminTrendComparison – argument validation', () => {
    it('throws invalid-argument when unitId is missing', async () => {
        await expect(
            wrapped({}, { auth })
        ).rejects.toMatchObject({ code: 'invalid-argument' })
    })
})

// ---------------------------------------------------------------------------
// Fallback: no audit logs → uses bed snapshot
// ---------------------------------------------------------------------------
describe('getAdminTrendComparison – fallback when no audit logs', () => {
    beforeEach(async () => {
        await clearCollection(`units/${UNIT_ID}/audit_logs`)
        await clearCollection(`units/${UNIT_ID}/beds`)
    })

    it('returns a single-entry currentPeriod with bed snapshot count', async () => {
        // Seed 3 beds, 2 of which have expectedDischarge → occupied
        await db.collection(`units/${UNIT_ID}/beds`).add({ bedId: 'B1', expectedDischarge: '2026-02-28' })
        await db.collection(`units/${UNIT_ID}/beds`).add({ bedId: 'B2', expectedDischarge: '2026-03-01' })
        await db.collection(`units/${UNIT_ID}/beds`).add({ bedId: 'B3', expectedDischarge: null })

        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })

        expect(result.currentPeriod).toHaveLength(1)
        expect(result.currentPeriod[0].value).toBe(2)
        expect(result.previousPeriod).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// Correct aggregation from audit logs
// ---------------------------------------------------------------------------
describe('getAdminTrendComparison – aggregating audit logs', () => {
    beforeEach(async () => {
        await clearCollection(`units/${UNIT_ID}/audit_logs`)
    })

    it('counts bed events per day in the current period', async () => {
        // 2 events yesterday, 1 event 2 days ago — all in current 7d period
        await seedAuditLog(UNIT_ID, daysAgo(1))
        await seedAuditLog(UNIT_ID, daysAgo(1))
        await seedAuditLog(UNIT_ID, daysAgo(2))

        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })

        expect(result.currentPeriod.length).toBeGreaterThanOrEqual(2)
        const totalEvents = result.currentPeriod.reduce(
            (acc: number, p: { value: number }) => acc + p.value, 0
        )
        expect(totalEvents).toBe(3)
    })

    it('ignores events with entityType other than bed', async () => {
        await seedAuditLog(UNIT_ID, daysAgo(1), 'bed')
        await seedAuditLog(UNIT_ID, daysAgo(1), 'unit')   // should be ignored
        await seedAuditLog(UNIT_ID, daysAgo(1), 'user')   // should be ignored

        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })

        const totalEvents = result.currentPeriod.reduce(
            (acc: number, p: { value: number }) => acc + p.value, 0
        )
        expect(totalEvents).toBe(1)
    })

    it('returns dates in ascending order', async () => {
        await seedAuditLog(UNIT_ID, daysAgo(3))
        await seedAuditLog(UNIT_ID, daysAgo(1))

        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })

        const dates: string[] = result.currentPeriod.map((p: { date: string }) => p.date)
        const sorted = [...dates].sort()
        expect(dates).toEqual(sorted)
    })

    it('separates events into current and previous periods for 7d', async () => {
        // Events in current period (last 7 days)
        await seedAuditLog(UNIT_ID, daysAgo(2))
        await seedAuditLog(UNIT_ID, daysAgo(5))
        // Events in previous period (8–14 days ago)
        await seedAuditLog(UNIT_ID, daysAgo(9))
        await seedAuditLog(UNIT_ID, daysAgo(12))

        const result = await wrapped({ unitId: UNIT_ID, periodKey: '7d' }, { auth })

        const currentTotal = result.currentPeriod.reduce(
            (acc: number, p: { value: number }) => acc + p.value, 0
        )
        const previousTotal = result.previousPeriod.reduce(
            (acc: number, p: { value: number }) => acc + p.value, 0
        )
        expect(currentTotal).toBe(2)
        expect(previousTotal).toBe(2)
    })
})
