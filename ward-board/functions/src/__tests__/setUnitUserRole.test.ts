/**
 * functions/src/__tests__/setUnitUserRole.test.ts
 *
 * Unit tests for the setUnitUserRole Cloud Function.
 * Mocks firebase-admin (auth + firestore) and firebase-functions/v1.
 *
 * Covers:
 * - Auth guard: unauthenticated → unauthenticated error
 * - Argument validation: missing unitId / email / role / reason
 * - RBAC: non-admin → permission-denied; unit admin → allowed; global admin email → allowed
 * - Happy path (existing user): batch commit called, returns { success: true, userUid }
 * - New user creation: when auth/user-not-found, createUser called and succeeds
 * - createUser failure: propagated as 'internal' error
 */

// ── Mock firebase-functions/v1 ────────────────────────────────────────────────

const mockHttpsError = jest.fn().mockImplementation((code: string, msg: string) => {
    const err = new Error(msg);
    (err as Error & { code: string }).code = code;
    return err;
});
mockHttpsError.prototype = Error.prototype;

jest.mock('firebase-functions/v1', () => ({
    region: () => ({ https: { onCall: (h: unknown) => h } }),
    https: { HttpsError: mockHttpsError },
}));

// ── Mock firebase-admin/firestore ─────────────────────────────────────────────

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => '__SERVER_TIMESTAMP__' },
}));

// ── Mock firebase-admin (auth + db) ──────────────────────────────────────────

let mockGetUserByEmailResult: { uid: string; displayName?: string; email?: string } | null = {
    uid: 'target-uid-1',
    displayName: 'Dr Marcelo',
    email: 'marcelo@lean.com',
};
let mockGetUserByEmailError: { code?: string } | null = null;

let mockCreateUserResult: { uid: string; displayName?: string; email?: string } | null = null;
let mockCreateUserError: Error | null = null;

const mockGetUserByEmail = jest.fn().mockImplementation(() => {
    if (mockGetUserByEmailError) return Promise.reject(mockGetUserByEmailError);
    return Promise.resolve(mockGetUserByEmailResult);
});

const mockCreateUser = jest.fn().mockImplementation(() => {
    if (mockCreateUserError) return Promise.reject(mockCreateUserError);
    return Promise.resolve(mockCreateUserResult);
});

jest.mock('firebase-admin', () => ({
    auth: () => ({
        getUserByEmail: mockGetUserByEmail,
        createUser: mockCreateUser,
    }),
}));

// ── Mock admins (isGlobalAdmin) ───────────────────────────────────────────────

jest.mock('../config/admins', () => ({
    isGlobalAdmin: (email: string) => email === 'global@lean.com',
}));

// ── Mock firebase-admin db (config) ──────────────────────────────────────────

let mockRoleDocExists = false;
let mockRoleDocData: Record<string, unknown> = {};

let mockTargetUserDocExists = false;
let mockTargetUserDocData: Record<string, unknown> | null = null;

let mockAuthUserExists = false;

const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatch = { set: mockBatchSet, commit: mockBatchCommit };

const mockAuditLogDocRef = { id: 'audit-set-role-1' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
jest.mock('../config', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectionFn = (rootPath: string): any => {
        if (rootPath === 'authorized_users') {
            return {
                doc: () => ({
                    get: jest.fn().mockResolvedValue({ exists: mockAuthUserExists }),
                }),
            };
        }

        // units/* collection tree
        return {
            doc: () => ({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                collection: (sub: string): any => ({
                    doc: (docId?: string) => {
                        if (!docId) return mockAuditLogDocRef; // auto-id for audit log

                        if (sub === 'users') {
                            return {
                                get: jest.fn().mockImplementation(() => {
                                    // Caller RBAC check vs target user doc — distinguish by uid
                                    // For simplicity, use mockRoleDocExists for caller and mockTargetUserDocExists for target
                                    // The CF first calls roleDoc.get() then targetUserRef.get()
                                    // We control them via sequence in the mock
                                    return Promise.resolve({
                                        exists: mockRoleDocExists,
                                        data: () => mockRoleDocData,
                                    });
                                }),
                            };
                        }

                        return {
                            get: jest.fn().mockResolvedValue({
                                exists: mockTargetUserDocExists,
                                data: () => mockTargetUserDocData,
                            }),
                        };
                    },
                }),
            }),
        };
    };

    return {
        db: {
            collection: collectionFn,
            batch: () => mockBatch,
        },
    };
});

// ── Load function AFTER mocks ─────────────────────────────────────────────────

import { setUnitUserRole } from '../callables/setUnitUserRole';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Handler = (data: Record<string, unknown>, context: unknown) => Promise<unknown>;
const handler = setUnitUserRole as unknown as Handler;

function makeContext(uid = 'u1', email = 'caller@lean.com') {
    return { auth: { uid, token: { email, name: 'Caller Name', admin: false } } };
}

function makeData(overrides: Record<string, unknown> = {}) {
    return {
        unitId: 'unitA',
        email: 'marcelo@lean.com',
        role: 'admin',
        reason: 'Promoção a gestor de unidade',
        ...overrides,
    };
}

// ── Reset shared state before each test ───────────────────────────────────────

beforeEach(() => {
    mockRoleDocExists = false;
    mockRoleDocData = {};
    mockTargetUserDocExists = false;
    mockTargetUserDocData = null;
    mockAuthUserExists = false;
    mockGetUserByEmailResult = { uid: 'target-uid-1', displayName: 'Dr Marcelo', email: 'marcelo@lean.com' };
    mockGetUserByEmailError = null;
    mockCreateUserResult = null;
    mockCreateUserError = null;
    mockBatchSet.mockClear();
    mockBatchCommit.mockClear();
    mockGetUserByEmail.mockClear();
    mockCreateUser.mockClear();
});

// ── Suite 1: Auth guard ───────────────────────────────────────────────────────

describe('setUnitUserRole — auth guard', () => {
    it('throws unauthenticated when no auth', async () => {
        await expect(handler(makeData(), { auth: undefined })).rejects.toMatchObject({
            code: 'unauthenticated',
        });
    });
});

// ── Suite 2: Argument validation ─────────────────────────────────────────────

describe('setUnitUserRole — invalid-argument', () => {
    const ctx = makeContext();

    it('throws when unitId missing', async () => {
        await expect(handler({ email: 'x@x.com', role: 'admin', reason: 'test reason' }, ctx)).rejects.toMatchObject({
            code: 'invalid-argument',
        });
    });

    it('throws when email missing', async () => {
        await expect(handler({ unitId: 'u', role: 'admin', reason: 'test reason' }, ctx)).rejects.toMatchObject({
            code: 'invalid-argument',
        });
    });

    it('throws when role missing', async () => {
        await expect(handler({ unitId: 'u', email: 'x@x.com', reason: 'test reason' }, ctx)).rejects.toMatchObject({
            code: 'invalid-argument',
        });
    });

    it('throws when reason is too short', async () => {
        await expect(
            handler({ unitId: 'u', email: 'x@x.com', role: 'admin', reason: 'no' }, ctx)
        ).rejects.toMatchObject({ code: 'invalid-argument' });
    });
});

// ── Suite 3: RBAC ────────────────────────────────────────────────────────────

describe('setUnitUserRole — RBAC', () => {
    it('throws permission-denied when caller is not unit admin', async () => {
        mockRoleDocExists = false;
        await expect(handler(makeData(), makeContext('viewer', 'viewer@lean.com'))).rejects.toMatchObject({
            code: 'permission-denied',
        });
    });

    it('allows caller who is unit admin', async () => {
        mockRoleDocExists = true;
        mockRoleDocData = { role: 'admin' };
        const result = await handler(makeData(), makeContext('admin1', 'admin@lean.com'));
        expect(result).toMatchObject({ success: true });
    });

    it('allows global admin email to bypass unit RBAC', async () => {
        mockRoleDocExists = false; // not in unit users
        const result = await handler(makeData(), makeContext('gadmin', 'global@lean.com'));
        expect(result).toMatchObject({ success: true });
    });
});

// ── Suite 4: Happy path (existing user) ──────────────────────────────────────

describe('setUnitUserRole — happy path (existing user)', () => {
    beforeEach(() => {
        mockRoleDocExists = true;
        mockRoleDocData = { role: 'admin' };
        mockGetUserByEmailResult = { uid: 'target-uid-1', displayName: 'Dr Marcelo', email: 'marcelo@lean.com' };
    });

    it('returns { success: true, userUid }', async () => {
        const result = await handler(makeData(), makeContext('admin1', 'admin@lean.com'));
        expect(result).toMatchObject({ success: true, userUid: 'target-uid-1' });
    });

    it('calls batch.commit once', async () => {
        await handler(makeData(), makeContext('admin1', 'admin@lean.com'));
        expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('calls getUserByEmail with lowercased email', async () => {
        await handler(makeData({ email: 'Marcelo@Lean.COM' }), makeContext('admin1', 'admin@lean.com'));
        expect(mockGetUserByEmail).toHaveBeenCalledWith('marcelo@lean.com');
    });
});

// ── Suite 5: New user creation ────────────────────────────────────────────────

describe('setUnitUserRole — new user creation', () => {
    beforeEach(() => {
        mockRoleDocExists = true;
        mockRoleDocData = { role: 'admin' };
        // Simulate auth/user-not-found
        mockGetUserByEmailError = { code: 'auth/user-not-found' };
        mockCreateUserResult = { uid: 'new-uid-999', email: 'newbie@lean.com' };
    });

    it('creates user when not found and returns success', async () => {
        const result = await handler(
            makeData({ email: 'newbie@lean.com' }),
            makeContext('admin1', 'admin@lean.com')
        );
        expect(mockCreateUser).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ success: true, userUid: 'new-uid-999' });
    });

    it('throws internal when createUser itself fails', async () => {
        mockCreateUserError = new Error('Email already in use');
        await expect(
            handler(makeData({ email: 'bad@lean.com' }), makeContext('admin1', 'admin@lean.com'))
        ).rejects.toMatchObject({ code: 'internal' });
    });
});
