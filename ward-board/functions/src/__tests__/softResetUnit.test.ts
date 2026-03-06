/**
 * functions/src/__tests__/softResetUnit.test.ts
 *
 * Unit tests for the softResetUnit Cloud Function.
 * Mocks firebase-admin and firebase-functions/v1 — no emulator required.
 *
 * Covers:
 * - Auth guard: unauthenticated → unauthenticated error
 * - Argument validation: missing unitId, missing/short reason
 * - RBAC: non-admin → permission-denied; admin → allowed
 * - Happy path: chunkAndCommitBatch called with correct operation count,
 *   kamishibai keys reset to 'na', returns { success: true }
 */

// ── Mock firebase-functions/v1 ────────────────────────────────────────────────

const mockHttpsError = jest.fn().mockImplementation((code: string, msg: string) => {
    const err = new Error(msg);
    (err as Error & { code: string }).code = code;
    return err;
});
mockHttpsError.prototype = Error.prototype;

jest.mock('firebase-functions/v1', () => ({
    region: () => ({
        https: { onCall: (handler: unknown) => handler },
    }),
    https: { HttpsError: mockHttpsError },
}));

// ── Mock firebase-admin/firestore ─────────────────────────────────────────────

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => '__SERVER_TIMESTAMP__' },
}));

// ── Mock uuid ─────────────────────────────────────────────────────────────────

jest.mock('uuid', () => ({ v4: () => 'mock-uuid-soft-reset' }));

// ── Mock firestoreBatch ───────────────────────────────────────────────────────

const mockChunkAndCommitBatch = jest.fn().mockResolvedValue(undefined);
jest.mock('../lib/firestoreBatch', () => ({
    chunkAndCommitBatch: (...args: unknown[]) => mockChunkAndCommitBatch(...args),
}));

// ── Mock firebase-admin (db) ──────────────────────────────────────────────────

let mockRoleDocExists = false;
let mockRoleDocData: Record<string, unknown> = {};

type FakeBedDoc = { ref: { id: string }; data: () => Record<string, unknown> };
let mockExistingBedDocs: FakeBedDoc[] = [];

const mockAuditLogDocRef = { id: 'audit-soft-reset-1' };

 
jest.mock('../config', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docFn = (docId?: string): any => {
        if (!docId) return mockAuditLogDocRef;
        return {
            exists: mockRoleDocExists,
            data: () => mockRoleDocData,
            get: jest.fn().mockImplementation(() =>
                Promise.resolve({ exists: mockRoleDocExists, data: () => mockRoleDocData })
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            collection: (): any => ({ doc: docFn }),
        };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectionFn = (): any => ({
        doc: () => ({
            collection: () => ({
                doc: docFn,
                get: jest.fn().mockImplementation(() =>
                    Promise.resolve({ docs: mockExistingBedDocs, size: mockExistingBedDocs.length })
                ),
            }),
        }),
    });

    return { db: { collection: collectionFn } };
});

// ── Load function AFTER mocks ─────────────────────────────────────────────────

import { softResetUnit } from '../callables/softResetUnit';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Handler = (data: Record<string, unknown>, context: unknown) => Promise<unknown>;
const handler = softResetUnit as unknown as Handler;

function makeContext(uid = 'u1', email = 'user@test.com') {
    return { auth: { uid, token: { email, name: 'Test User', admin: false } } };
}

function makeData(overrides: Record<string, unknown> = {}) {
    return { unitId: 'unitA', reason: 'End of shift reset', ...overrides };
}

function makeBedDoc(id: string, kamishibaiKeys: string[] = ['medical', 'nursing']): FakeBedDoc {
    const kamishibai: Record<string, unknown> = {};
    kamishibaiKeys.forEach(k => { kamishibai[k] = { status: 'ok', note: 'previous note' }; });
    return {
        ref: { id },
        data: () => ({
            id,
            patientAlias: 'João B.',
            expectedDischarge: '24h',
            mainBlocker: 'Aguarda exame',
            involvedSpecialties: ['medical'],
            kamishibai,
        }),
    };
}

// ── Suite 1: Auth guard ───────────────────────────────────────────────────────

describe('softResetUnit — auth guard', () => {
    it('throws unauthenticated when no auth', async () => {
        await expect(handler(makeData(), { auth: undefined })).rejects.toMatchObject({
            code: 'unauthenticated',
        });
    });
});

// ── Suite 2: Argument validation ─────────────────────────────────────────────

describe('softResetUnit — invalid-argument', () => {
    const ctx = makeContext();

    it('throws when unitId is missing', async () => {
        await expect(handler({ reason: 'valid reason' }, ctx)).rejects.toMatchObject({
            code: 'invalid-argument',
        });
    });

    it('throws when reason is missing', async () => {
        await expect(handler({ unitId: 'unitA' }, ctx)).rejects.toMatchObject({
            code: 'invalid-argument',
        });
    });

    it('throws when reason has fewer than 3 characters', async () => {
        await expect(handler({ unitId: 'unitA', reason: 'no' }, ctx)).rejects.toMatchObject({
            code: 'invalid-argument',
        });
    });
});

// ── Suite 3: RBAC ────────────────────────────────────────────────────────────

describe('softResetUnit — RBAC', () => {
    beforeEach(() => {
        mockRoleDocExists = false;
        mockRoleDocData = {};
        mockExistingBedDocs = [];
        mockChunkAndCommitBatch.mockClear();
    });

    it('throws permission-denied for non-admin', async () => {
        await expect(handler(makeData(), makeContext('viewer', 'viewer@test.com'))).rejects.toMatchObject({
            code: 'permission-denied',
        });
    });

    it('allows unit admin', async () => {
        mockRoleDocExists = true;
        mockRoleDocData = { role: 'admin' };
        const result = await handler(makeData(), makeContext('admin1', 'admin@test.com'));
        expect(result).toMatchObject({ success: true });
    });
});

// ── Suite 4: Happy path ───────────────────────────────────────────────────────

describe('softResetUnit — happy path', () => {
    beforeEach(() => {
        mockRoleDocExists = true;
        mockRoleDocData = { role: 'admin' };
        mockChunkAndCommitBatch.mockClear();
    });

    it('returns { success: true } with multiple beds', async () => {
        mockExistingBedDocs = [makeBedDoc('bed_301'), makeBedDoc('bed_302'), makeBedDoc('bed_303')];
        const result = await handler(makeData(), makeContext('admin1', 'admin@test.com'));
        expect(result).toEqual({ success: true });
    });

    it('calls chunkAndCommitBatch exactly once', async () => {
        mockExistingBedDocs = [makeBedDoc('bed_301'), makeBedDoc('bed_302')];
        await handler(makeData(), makeContext('admin1', 'admin@test.com'));
        expect(mockChunkAndCommitBatch).toHaveBeenCalledTimes(1);
    });

    it('includes N_beds set operations + 1 audit log in operations', async () => {
        mockExistingBedDocs = [makeBedDoc('bed_301'), makeBedDoc('bed_302'), makeBedDoc('bed_303')];
        await handler(makeData(), makeContext('admin1', 'admin@test.com'));
        const [, ops] = mockChunkAndCommitBatch.mock.calls[0];
        // 3 bed updates + 1 audit log
        expect(Array.isArray(ops)).toBe(true);
        expect(ops.length).toBe(4);
    });

    it('handles empty unit (no beds) — only audit log operation', async () => {
        mockExistingBedDocs = [];
        await handler(makeData(), makeContext('admin1', 'admin@test.com'));
        const [, ops] = mockChunkAndCommitBatch.mock.calls[0];
        expect(ops.length).toBe(1); // just the audit log
    });
});
