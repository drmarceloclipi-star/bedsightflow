import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Firebase mocks ──────────────────────────────────────────────────────────

vi.mock('../infra/firebase/config', () => ({ db: {} }))

const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockOnSnapshot = vi.fn()
const mockSetDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP')
const mockTimestampNow = vi.fn(() => ({ seconds: 0 }))

vi.mock('firebase/firestore', () => ({
    collection: (...a: unknown[]) => mockCollection(...a),
    doc: (...a: unknown[]) => mockDoc(...a),
    onSnapshot: (...a: unknown[]) => mockOnSnapshot(...a),
    setDoc: (...a: unknown[]) => mockSetDoc(...a),
    deleteDoc: (...a: unknown[]) => mockDeleteDoc(...a),
    serverTimestamp: () => mockServerTimestamp(),
    Timestamp: {
        now: () => mockTimestampNow(),
    },
}))

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UnitUsersRepository', () => {
    let repo: typeof import('./UnitUsersRepository').UnitUsersRepository

    beforeEach(async () => {
        vi.resetAllMocks()
        mockCollection.mockReturnValue('usersCol')
        mockDoc.mockReturnValue('userRef')
        mockSetDoc.mockResolvedValue(undefined)
        mockDeleteDoc.mockResolvedValue(undefined)

        const mod = await import('./UnitUsersRepository')
        repo = mod.UnitUsersRepository
    })

    // ── listenToUsers ────────────────────────────────────────────────────────

    describe('listenToUsers', () => {
        it('calls callback with mapped users including id', () => {
            const docs = [
                { id: 'uid1', data: () => ({ email: 'nurse@h.com', role: 'editor' }) },
                { id: 'uid2', data: () => ({ email: 'admin@h.com', role: 'admin' }) },
            ]
            mockOnSnapshot.mockImplementation((_col, onNext: (...args: any[]) => any) => {
                onNext({ docs })
                return () => {}
            })

            const callback = vi.fn()
            repo.listenToUsers('unit1', callback)

            expect(callback).toHaveBeenCalledWith([
                { id: 'uid1', email: 'nurse@h.com', role: 'editor' },
                { id: 'uid2', email: 'admin@h.com', role: 'admin' },
            ])
        })

        it('calls callback with empty array when collection is empty', () => {
            mockOnSnapshot.mockImplementation((_col, onNext: (...args: any[]) => any) => {
                onNext({ docs: [] })
                return () => {}
            })

            const callback = vi.fn()
            repo.listenToUsers('unit1', callback)
            expect(callback).toHaveBeenCalledWith([])
        })
    })

    // ── addUser ──────────────────────────────────────────────────────────────

    describe('addUser', () => {
        it('derives doc id by replacing non-alphanumeric chars with underscores', async () => {
            await repo.addUser('unit1', 'User@Example.COM', 'editor')
            // email lowercase → user@example_com → slug: user_example_com
            expect(mockDoc).toHaveBeenCalledWith(
                expect.anything(),
                'units', 'unit1', 'users',
                'user_example_com'
            )
        })

        it('stores email in lowercase and trimmed form', async () => {
            await repo.addUser('unit1', '  Admin@Hospital.ORG  ', 'admin', 'Dr. Admin')
            expect(mockSetDoc).toHaveBeenCalledWith(
                'userRef',
                expect.objectContaining({ email: 'admin@hospital.org', role: 'admin', displayName: 'Dr. Admin' }),
                { merge: false }
            )
        })

        it('defaults displayName to empty string when not provided', async () => {
            await repo.addUser('unit1', 'user@x.com', 'viewer')
            expect(mockSetDoc).toHaveBeenCalledWith(
                'userRef',
                expect.objectContaining({ displayName: '' }),
                { merge: false }
            )
        })
    })

    // ── updateUserRole ───────────────────────────────────────────────────────

    describe('updateUserRole', () => {
        it('calls setDoc with merge:true and the new role', async () => {
            await repo.updateUserRole('unit1', 'uid42', 'admin')
            expect(mockSetDoc).toHaveBeenCalledWith(
                'userRef',
                expect.objectContaining({ role: 'admin' }),
                { merge: true }
            )
            expect(mockDoc).toHaveBeenCalledWith(
                expect.anything(), 'units', 'unit1', 'users', 'uid42'
            )
        })
    })

    // ── removeUser ───────────────────────────────────────────────────────────

    describe('removeUser', () => {
        it('calls deleteDoc with the correct user ref', async () => {
            await repo.removeUser('unit1', 'uid99')
            expect(mockDeleteDoc).toHaveBeenCalledWith('userRef')
            expect(mockDoc).toHaveBeenCalledWith(
                expect.anything(), 'units', 'unit1', 'users', 'uid99'
            )
        })
    })
})
