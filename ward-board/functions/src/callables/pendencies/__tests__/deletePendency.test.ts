/**
 * functions/src/callables/pendencies/__tests__/deletePendency.test.ts
 *
 * Unit tests for deletePendency Cloud Function.
 * Mocks firebase-admin and firebase-functions/v1 — no emulator required.
 *
 * Covers:
 * - RBAC: unauthenticated, non-admin (permission-denied), global-admin bypass, unit-admin OK
 * - invalid-argument: missing fields
 * - not-found: bed missing, pendency missing
 * - happy path: success response + correct path
 */

// ── Mock firebase-functions/v1 BEFORE any import of the function ──────────────

const mockHttpsError = jest.fn().mockImplementation((code: string, msg: string) => {
    const err = new Error(msg)
        ; (err as Error & { code: string }).code = code
    return err
})

// Simulate functions.https.HttpsError constructor behaviour
mockHttpsError.prototype = Error.prototype

jest.mock('firebase-functions/v1', () => ({
    region: () => ({
        https: {
            onCall: (handler: unknown) => handler,
        },
    }),
    https: {
        HttpsError: mockHttpsError,
    },
}))

// ── Mock firebase-admin/firestore FieldValue ──────────────────────────────────

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => '__SERVER_TIMESTAMP__',
    },
}))

// ── Mock firebase-admin (db) ──────────────────────────────────────────────────
//
// Firestore chain used by deletePendency:
//   RBAC:   db.collection('units').doc(unitId).collection('users').doc(uid).get()
//   Txn:    tx.get(bedRef), tx.update(bedRef, data)
//   bedRef: db.collection('units').doc(unitId).collection('beds').doc(bedId)

let mockRoleDocExists = false
let mockRoleDocData: Record<string, unknown> = {}

const mockGet = jest.fn()               // used inside runTransaction
const mockUpdate = jest.fn()            // used inside runTransaction
const mockRunTransaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = { get: mockGet, update: mockUpdate }
    return cb(tx)
})

// A reusable doc mock that supports .get() AND .collection() chains
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeDocMock(getImpl: () => any): any {
    return {
        get: jest.fn().mockImplementation(getImpl),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: (): any => ({
            doc: () => makeDocMock(() => Promise.resolve({
                exists: mockRoleDocExists,
                data: () => mockRoleDocData,
            })),
        }),
    }
}

// Top-level collection mock: returns a doc that supports subcollection chaining
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCollection = jest.fn((): any => ({
    doc: () => makeDocMock(() => Promise.resolve({
        exists: mockRoleDocExists,
        data: () => mockRoleDocData,
    })),
}))

jest.mock('../../../config', () => ({
    db: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: (path: string): any => mockCollection(path),
        runTransaction: (...args: Parameters<typeof mockRunTransaction>) => mockRunTransaction(...args),
    },
}))


// ── Load the function AFTER mocks are in place ────────────────────────────────

import { deletePendency } from '../deletePendency'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(uid = 'u1', email = 'user@test.com', isAdmin = false) {
    return {
        auth: {
            uid,
            token: { email, admin: isAdmin, name: 'Test User' },
        },
    }
}

function makeData(overrides: Record<string, unknown> = {}) {
    return { unitId: 'unitA', bedId: 'bed01', pendencyId: 'PEND_01', ...overrides }
}

// Cast the exported function (after mock onCall wraps it, it IS the handler)
type Handler = (data: Record<string, unknown>, context: ReturnType<typeof makeContext> | { auth?: undefined }) => Promise<unknown>
const handler = deletePendency as unknown as Handler

// ── Suite 1: Auth guard ───────────────────────────────────────────────────────

describe('deletePendency — auth guard', () => {
    it('throws unauthenticated when no auth', async () => {
        await expect(handler(makeData(), { auth: undefined })).rejects.toMatchObject({ code: 'unauthenticated' })
    })
})

// ── Suite 2: Argument validation ─────────────────────────────────────────────

describe('deletePendency — invalid-argument', () => {
    const ctx = makeContext()

    it('throws when unitId is missing', async () => {
        await expect(handler({ bedId: 'b1', pendencyId: 'p1' }, ctx)).rejects.toMatchObject({ code: 'invalid-argument' })
    })

    it('throws when bedId is missing', async () => {
        await expect(handler({ unitId: 'u', pendencyId: 'p1' }, ctx)).rejects.toMatchObject({ code: 'invalid-argument' })
    })

    it('throws when pendencyId is missing', async () => {
        await expect(handler({ unitId: 'u', bedId: 'b' }, ctx)).rejects.toMatchObject({ code: 'invalid-argument' })
    })
})

// ── Suite 3: RBAC ────────────────────────────────────────────────────────────

describe('deletePendency — RBAC', () => {
    beforeEach(() => {
        mockRoleDocExists = false
        mockRoleDocData = {}

        // Transaction bed mock (used inside runTransaction)
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ pendencies: [{ id: 'PEND_01' }] }),
        })
    })

    it('throws permission-denied for non-admin user', async () => {
        const ctx = makeContext('u1', 'user@test.com', false)
        // Role doc does not exist, no custom claim → not admin
        await expect(handler(makeData(), ctx)).rejects.toMatchObject({ code: 'permission-denied' })
    })

    it('allows unit admin (roleDoc.role === admin)', async () => {
        mockRoleDocExists = true
        mockRoleDocData = { role: 'admin' }
        const ctx = makeContext('admin1', 'admin@test.com', false)
        const result = await handler(makeData(), ctx)
        expect(result).toMatchObject({ success: true, deletedId: 'PEND_01' })
    })

    it('allows global admin via custom claim token.admin === true', async () => {
        const ctx = makeContext('gadmin', 'global@test.com', true)
        const result = await handler(makeData(), ctx)
        expect(result).toMatchObject({ success: true })
    })

    it('denies user with role=editor', async () => {
        mockRoleDocExists = true
        mockRoleDocData = { role: 'editor' }
        await expect(handler(makeData(), makeContext())).rejects.toMatchObject({ code: 'permission-denied' })
    })
})

// ── Suite 4: not-found errors ────────────────────────────────────────────────

describe('deletePendency — not-found', () => {
    const adminCtx = makeContext('gadmin', 'global@test.com', true) // bypass RBAC via custom claim

    it('throws not-found when bed does not exist', async () => {
        mockGet.mockResolvedValueOnce({ exists: false, data: () => null })
        await expect(handler(makeData(), adminCtx)).rejects.toMatchObject({ code: 'not-found' })
    })

    it('throws not-found when pendency id not in bed', async () => {
        mockGet.mockResolvedValueOnce({
            exists: true,
            data: () => ({ pendencies: [{ id: 'OTHER_PEND' }] }),
        })
        await expect(handler(makeData(), adminCtx)).rejects.toMatchObject({ code: 'not-found' })
    })
})

// ── Suite 5: Happy path ───────────────────────────────────────────────────────

describe('deletePendency — happy path', () => {
    const adminCtx = makeContext('gadmin', 'global@test.com', true)

    beforeEach(() => {
        mockUpdate.mockClear()
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({
                pendencies: [
                    { id: 'PEND_01', status: 'open' },
                    { id: 'PEND_02', status: 'done' },
                ],
            }),
        })
    })

    it('returns { success: true, deletedId }', async () => {
        const result = await handler(makeData(), adminCtx)
        expect(result).toMatchObject({ success: true, deletedId: 'PEND_01' })
    })

    it('calls tx.update with pendencies array minus the deleted item', async () => {
        await handler(makeData(), adminCtx)
        const updateArgs = mockUpdate.mock.calls[0]
        const updatedPendencies: { id: string }[] = updateArgs[1].pendencies
        expect(updatedPendencies).toHaveLength(1)
        expect(updatedPendencies[0].id).toBe('PEND_02')
    })

    it('allows deleting a done/canceled pendency (per spec)', async () => {
        // "user requested to just allow delete even if canceled/done" (source code comment)
        mockGet.mockResolvedValueOnce({
            exists: true,
            data: () => ({ pendencies: [{ id: 'PEND_DONE', status: 'done' }] }),
        })
        const result = await handler(makeData({ pendencyId: 'PEND_DONE' }), adminCtx)
        expect(result).toMatchObject({ success: true, deletedId: 'PEND_DONE' })
    })
})
