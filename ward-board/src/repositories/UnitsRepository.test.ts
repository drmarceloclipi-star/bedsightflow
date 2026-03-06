import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Firebase mocks ──────────────────────────────────────────────────────────

vi.mock('../infra/firebase/config', () => ({ db: {} }))

const mockDoc = vi.fn()
const mockCollection = vi.fn()
const mockGetDoc = vi.fn()
const mockAddDoc = vi.fn()
const mockOnSnapshot = vi.fn()
const mockQuery = vi.fn()

vi.mock('firebase/firestore', () => ({
    doc: (...a: unknown[]) => mockDoc(...a),
    collection: (...a: unknown[]) => mockCollection(...a),
    getDoc: (...a: unknown[]) => mockGetDoc(...a),
    addDoc: (...a: unknown[]) => mockAddDoc(...a),
    onSnapshot: (...a: unknown[]) => mockOnSnapshot(...a),
    query: (...a: unknown[]) => mockQuery(...a),
}))

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UnitsRepository', () => {
    let repo: typeof import('./UnitsRepository').UnitsRepository

    beforeEach(async () => {
        vi.resetAllMocks()
        mockDoc.mockReturnValue('unitRef')
        mockCollection.mockReturnValue('unitsCol')
        mockQuery.mockReturnValue('unitsQuery')

        const mod = await import('./UnitsRepository')
        repo = mod.UnitsRepository
    })

    // ── getUnit ──────────────────────────────────────────────────────────────

    describe('getUnit', () => {
        it('returns null when document does not exist', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })
            const result = await repo.getUnit('nonexistent')
            expect(result).toBeNull()
        })

        it('returns unit with id prepended when document exists', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                id: 'unit42',
                data: () => ({ name: 'ICU', floors: 2 }),
            })
            const result = await repo.getUnit('unit42')
            expect(result).toEqual({ id: 'unit42', name: 'ICU', floors: 2 })
        })

        it('queries the correct Firestore path', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })
            await repo.getUnit('myUnit')
            expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'units', 'myUnit')
        })
    })

    // ── addUnit ──────────────────────────────────────────────────────────────

    describe('addUnit', () => {
        it('returns the new document id from addDoc', async () => {
            mockAddDoc.mockResolvedValue({ id: 'newUnit99' })
            const result = await repo.addUnit({ name: 'Cardiology' } as any)
            expect(result).toBe('newUnit99')
        })

        it('adds to the units collection', async () => {
            mockAddDoc.mockResolvedValue({ id: 'x' })
            await repo.addUnit({ name: 'ICU' } as any)
            expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'units')
        })
    })

    // ── listenToUnits ────────────────────────────────────────────────────────

    describe('listenToUnits', () => {
        it('calls callback with mapped units array', () => {
            const docs = [
                { id: 'u1', data: () => ({ name: 'ICU' }) },
                { id: 'u2', data: () => ({ name: 'Surgery' }) },
            ]
            mockOnSnapshot.mockImplementation((_q, onNext: (...args: any[]) => any) => {
                onNext({ docs })
                return () => {}
            })

            const callback = vi.fn()
            repo.listenToUnits(callback)

            expect(callback).toHaveBeenCalledWith([
                { id: 'u1', name: 'ICU' },
                { id: 'u2', name: 'Surgery' },
            ])
        })

        it('calls callback with empty array when no units exist', () => {
            mockOnSnapshot.mockImplementation((_q, onNext: (...args: any[]) => any) => {
                onNext({ docs: [] })
                return () => {}
            })

            const callback = vi.fn()
            repo.listenToUnits(callback)
            expect(callback).toHaveBeenCalledWith([])
        })
    })
})
