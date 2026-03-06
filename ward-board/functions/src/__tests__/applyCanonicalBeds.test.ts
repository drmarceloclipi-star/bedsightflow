/**
 * functions/src/__tests__/applyCanonicalBeds.test.ts
 *
 * Unit tests for the applyCanonicalBeds Cloud Function.
 * Mocks firebase-admin and firebase-functions/v1 — no emulator required.
 *
 * Covers:
 * - Auth guard: unauthenticated → unauthenticated error
 * - Argument validation: missing unitId, missing/short reason
 * - RBAC: non-admin user → permission-denied; admin → allowed
 * - Happy path: chunkAndCommitBatch called, returns { success: true }
 */

// ── Mock firebase-functions/v1 BEFORE imports ─────────────────────────────────

const mockHttpsError = jest.fn().mockImplementation((code: string, msg: string) => {
    const err = new Error(msg);
    (err as Error & { code: string }).code = code;
    return err;
});
mockHttpsError.prototype = Error.prototype;

jest.mock('firebase-functions/v1', () => ({
    region: () => ({
        https: {
            onCall: (handler: unknown) => handler,
        },
    }),
    https: {
        HttpsError: mockHttpsError,
    },
}));

// ── Mock firebase-admin/firestore ─────────────────────────────────────────────

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => '__SERVER_TIMESTAMP__',
    },
}));

// ── Mock uuid ─────────────────────────────────────────────────────────────────

jest.mock('uuid', () => ({ v4: () => 'mock-uuid-1234' }));

// ── Mock firestoreBatch ───────────────────────────────────────────────────────

const mockChunkAndCommitBatch = jest.fn().mockResolvedValue(undefined);
jest.mock('../lib/firestoreBatch', () => ({
    chunkAndCommitBatch: (...args: unknown[]) => mockChunkAndCommitBatch(...args),
}));

// ── Mock firebase-admin (db) ──────────────────────────────────────────────────

let mockRoleDocExists = false;
let mockRoleDocData: Record<string, unknown> = {};

// Existing beds returned by bedsRef.get()
let mockExistingBedDocs: Array<{ ref: { id: string } }> = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeDocMock(existsFn: () => boolean, dataFn: () => any): any {
    return {
        exists: existsFn(),
        data: dataFn,
        get: jest.fn().mockResolvedValue({
            exists: existsFn(),
            data: dataFn,
        }),
        // subcollection chain
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: (): any => ({
            doc: () => makeDocMock(existsFn, dataFn),
        }),
    };
}

const mockAuditLogDocRef = { id: 'audit-log-id-1' };

const mockBedsGet = jest.fn().mockImplementation(() =>
    Promise.resolve({ docs: mockExistingBedDocs })
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
jest.mock('../config', () => {
    const docFn = (docId?: string): any => {
        if (!docId) {
            // audit log doc (auto-id)
            return mockAuditLogDocRef;
        }
        return makeDocMock(
            () => mockRoleDocExists,
            () => mockRoleDocData,
        );
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectionFn = (path: string): any => {
        if (path === 'units') {
            return {
                doc: () => ({
                    collection: (sub: string) => ({
                        doc: docFn,
                        get: mockBedsGet,
                    }),
                }),
            };
        }
        return { doc: docFn };
    };

    return { db: { collection: collectionFn } };
});

// ── Load function AFTER mocks ─────────────────────────────────────────────────

import { applyCanonicalBeds } from '../callables/applyCanonicalBeds';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Handler = (data: Record<string, unknown>, context: unknown) => Promise<unknown>;
const handler = applyCanonicalBeds as unknown as Handler;

function makeContext(uid = 'u1', email = 'user@test.com') {
    return {
        auth: { uid, token: { email, name: 'Test User', admin: false } },
    };
}

function makeData(overrides: Record<string, unknown> = {}) {
    return { unitId: 'unitA', reason: 'Seeding canonical beds for new ward', ...overrides };
}

// ── Suite 1: Auth guard ───────────────────────────────────────────────────────

describe('applyCanonicalBeds — auth guard', () => {
    it('throws unauthenticated when no auth context', async () => {
        await expect(handler(makeData(), { auth: undefined })).rejects.toMatchObject({
            code: 'unauthenticated',
        });
    });
});

// ── Suite 2: Argument validation ─────────────────────────────────────────────

describe('applyCanonicalBeds — invalid-argument', () => {
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

    it('throws when reason is too short (< 3 chars)', async () => {
        await expect(handler({ unitId: 'unitA', reason: 'ab' }, ctx)).rejects.toMatchObject({
            code: 'invalid-argument',
        });
    });
});

// ── Suite 3: RBAC ────────────────────────────────────────────────────────────

describe('applyCanonicalBeds — RBAC', () => {
    beforeEach(() => {
        mockRoleDocExists = false;
        mockRoleDocData = {};
        mockExistingBedDocs = [];
        mockChunkAndCommitBatch.mockClear();
    });

    it('throws permission-denied when user is not unit admin', async () => {
        mockRoleDocExists = false;
        const ctx = makeContext('nonadmin', 'viewer@test.com');
        await expect(handler(makeData(), ctx)).rejects.toMatchObject({
            code: 'permission-denied',
        });
    });

    it('allows unit admin (roleDoc.role === admin)', async () => {
        mockRoleDocExists = true;
        mockRoleDocData = { role: 'admin' };
        const ctx = makeContext('admin1', 'admin@test.com');
        const result = await handler(makeData(), ctx);
        expect(result).toMatchObject({ success: true });
    });
});

// ── Suite 4: Happy path ───────────────────────────────────────────────────────

describe('applyCanonicalBeds — happy path', () => {
    beforeEach(() => {
        mockRoleDocExists = true;
        mockRoleDocData = { role: 'admin' };
        mockExistingBedDocs = [
            { ref: { id: 'old-bed-1' } },
            { ref: { id: 'old-bed-2' } },
        ];
        mockChunkAndCommitBatch.mockClear();
    });

    it('calls chunkAndCommitBatch once', async () => {
        const ctx = makeContext('admin1', 'admin@test.com');
        await handler(makeData(), ctx);
        expect(mockChunkAndCommitBatch).toHaveBeenCalledTimes(1);
    });

    it('passes db and an operations array to chunkAndCommitBatch', async () => {
        const ctx = makeContext('admin1', 'admin@test.com');
        await handler(makeData(), ctx);
        const [, ops] = mockChunkAndCommitBatch.mock.calls[0];
        // 2 deletes for existing beds + 36 canonical bed sets + 1 audit log = 39
        expect(Array.isArray(ops)).toBe(true);
        expect(ops.length).toBe(39); // 2 existing deletes + 36 canonical + 1 audit
    });

    it('returns { success: true }', async () => {
        const ctx = makeContext('admin1', 'admin@test.com');
        const result = await handler(makeData(), ctx);
        expect(result).toEqual({ success: true });
    });
});
