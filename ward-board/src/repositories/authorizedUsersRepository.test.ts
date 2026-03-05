import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ── Firebase mocks ──────────────────────────────────────────────────────────

vi.mock('../infra/firebase/config', () => ({ db: {} }))

const mockGetDocs = vi.fn()
const mockAddDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockQuery = vi.fn()
const mockWhere = vi.fn()
const mockTimestampNow = vi.fn()

vi.mock('firebase/firestore', () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    doc: (...args: unknown[]) => mockDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    query: (...args: unknown[]) => mockQuery(...args),
    where: (...args: unknown[]) => mockWhere(...args),
    Timestamp: {
        now: () => mockTimestampNow(),
    },
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
    return {
        empty: docs.length === 0,
        docs: docs.map(d => ({ id: d.id, data: () => d.data })),
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('authorizedUsersRepository', () => {
    // Import after mocks are set up
    let repo: typeof import('./authorizedUsersRepository').authorizedUsersRepository

    beforeEach(async () => {
        vi.resetAllMocks()
        mockCollection.mockReturnValue('collRef')
        mockDoc.mockReturnValue('docRef')
        mockQuery.mockReturnValue('queryRef')
        mockWhere.mockReturnValue('whereClause')
        mockTimestampNow.mockReturnValue({ seconds: 0, toDate: () => new Date(0) })
        mockDeleteDoc.mockResolvedValue(undefined)
        mockAddDoc.mockResolvedValue({ id: 'newDocId' })

        // Re-import to pick up fresh module state
        const mod = await import('./authorizedUsersRepository')
        repo = mod.authorizedUsersRepository
    })

    // ── isAuthorized ─────────────────────────────────────────────────────────

    describe('isAuthorized', () => {
        it('returns true immediately for admin emails without querying Firestore', async () => {
            const result = await repo.isAuthorized('drmarceloclipi@gmail.com')
            expect(result).toBe(true)
            expect(mockGetDocs).not.toHaveBeenCalled()
        })

        it('is case-insensitive for admin email lookup', async () => {
            const result = await repo.isAuthorized('DRMARCELOCLIPI@GMAIL.COM')
            expect(result).toBe(true)
            expect(mockGetDocs).not.toHaveBeenCalled()
        })

        it('returns true for non-admin email found in Firestore', async () => {
            mockGetDocs.mockResolvedValue(makeSnapshot([{ id: 'u1', data: { email: 'user@hospital.com' } }]))
            const result = await repo.isAuthorized('user@hospital.com')
            expect(result).toBe(true)
        })

        it('returns false for email not in admin list and not in Firestore', async () => {
            mockGetDocs.mockResolvedValue(makeSnapshot([]))
            const result = await repo.isAuthorized('unknown@example.com')
            expect(result).toBe(false)
        })

        it('queries Firestore with normalized lowercase email', async () => {
            mockGetDocs.mockResolvedValue(makeSnapshot([]))
            await repo.isAuthorized('User@Example.COM')
            expect(mockWhere).toHaveBeenCalledWith('email', '==', 'user@example.com')
        })
    })

    // ── getAll ───────────────────────────────────────────────────────────────

    describe('getAll', () => {
        it('maps docs to AuthorizedUser with id and email', async () => {
            const fakeDate = new Date('2025-01-01')
            mockGetDocs.mockResolvedValue(makeSnapshot([
                { id: 'u1', data: { email: 'a@b.com', addedAt: { toDate: () => fakeDate } } },
            ]))
            const result = await repo.getAll()
            expect(result).toHaveLength(1)
            expect(result[0]).toMatchObject({ id: 'u1', email: 'a@b.com', addedAt: fakeDate })
        })

        it('handles non-Timestamp addedAt (ISO string fallback)', async () => {
            const isoDate = '2025-06-15T00:00:00.000Z'
            mockGetDocs.mockResolvedValue(makeSnapshot([
                { id: 'u2', data: { email: 'b@c.com', addedAt: isoDate } },
            ]))
            const result = await repo.getAll()
            expect(result[0].addedAt).toBeInstanceOf(Date)
        })

        it('handles missing addedAt gracefully', async () => {
            mockGetDocs.mockResolvedValue(makeSnapshot([
                { id: 'u3', data: { email: 'c@d.com' } },
            ]))
            const result = await repo.getAll()
            expect(result[0].addedAt).toBeInstanceOf(Date)
        })
    })

    // ── add ──────────────────────────────────────────────────────────────────

    describe('add', () => {
        it('normalizes email to lowercase and trims whitespace before saving', async () => {
            // isAuthorized check first: not admin, not in DB
            mockGetDocs.mockResolvedValue(makeSnapshot([]))
            await repo.add('  User@Example.COM  ')
            expect(mockAddDoc).toHaveBeenCalledWith(
                'collRef',
                expect.objectContaining({ email: 'user@example.com' })
            )
        })

        it('does not add a duplicate if email is already authorized', async () => {
            // Simulate the email is already in Firestore
            mockGetDocs.mockResolvedValue(makeSnapshot([{ id: 'existing', data: { email: 'dup@x.com' } }]))
            await repo.add('dup@x.com')
            expect(mockAddDoc).not.toHaveBeenCalled()
        })

        it('skips add for admin emails', async () => {
            await repo.add('admin@lean.com')
            expect(mockAddDoc).not.toHaveBeenCalled()
        })
    })

    // ── remove ───────────────────────────────────────────────────────────────

    describe('remove', () => {
        it('calls deleteDoc with the correct reference', async () => {
            await repo.remove('someUserId')
            expect(mockDeleteDoc).toHaveBeenCalledWith('docRef')
            expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'authorized_users', 'someUserId')
        })
    })
})
