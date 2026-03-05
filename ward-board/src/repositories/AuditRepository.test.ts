import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Firebase mocks ──────────────────────────────────────────────────────────

vi.mock('../infra/firebase/config', () => ({ db: {} }))

const mockCollection = vi.fn()
const mockQuery = vi.fn()
const mockWhere = vi.fn()
const mockOrderBy = vi.fn()
const mockGetDocs = vi.fn()
const mockOnSnapshot = vi.fn()
const mockTimestampFromDate = vi.fn()

vi.mock('firebase/firestore', () => ({
    collection: (...a: unknown[]) => mockCollection(...a),
    query: (ref: unknown, ...constraints: unknown[]) => ({ ref, constraints }),
    where: (...a: unknown[]) => mockWhere(...a),
    orderBy: (...a: unknown[]) => mockOrderBy(...a),
    getDocs: (...a: unknown[]) => mockGetDocs(...a),
    onSnapshot: (...a: unknown[]) => mockOnSnapshot(...a),
    Timestamp: {
        fromDate: (d: Date) => mockTimestampFromDate(d),
    },
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
    return {
        docs: docs.map(d => ({ id: d.id, data: () => d.data })),
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuditRepository', () => {
    let repo: typeof import('./AuditRepository').AuditRepository

    beforeEach(async () => {
        vi.resetAllMocks()
        mockCollection.mockReturnValue('collRef')
        mockWhere.mockImplementation((field, op, val) => ({ field, op, val }))
        mockOrderBy.mockImplementation((field, dir) => ({ orderBy: field, dir }))
        mockTimestampFromDate.mockImplementation((d: Date) => ({ _ts: d }))

        const mod = await import('./AuditRepository')
        repo = mod.AuditRepository
    })

    // ── getCollectionRef ─────────────────────────────────────────────────────

    describe('getCollectionRef', () => {
        it('builds the correct Firestore path', () => {
            repo.getCollectionRef('unit42')
            expect(mockCollection).toHaveBeenCalledWith(
                expect.anything(),
                'units', 'unit42', 'audit_logs'
            )
        })
    })

    // ── buildQuery ───────────────────────────────────────────────────────────

    describe('buildQuery', () => {
        it('creates base query ordered by createdAt desc with no filters', () => {
            const q = repo.buildQuery('u1') as any
            // Inner-most query has the base collRef and orderBy constraint
            expect(q.ref).toBe('collRef')
            expect(q.constraints).toHaveLength(1)
            expect(q.constraints[0]).toMatchObject({ orderBy: 'createdAt', dir: 'desc' })
        })

        it('adds entityType where clause when filter is provided', () => {
            repo.buildQuery('u1', { entityType: 'bed' as any })
            expect(mockWhere).toHaveBeenCalledWith('entityType', '==', 'bed')
        })

        it('adds actorUid where clause when filter is provided', () => {
            repo.buildQuery('u1', { actorUid: 'uid123' })
            expect(mockWhere).toHaveBeenCalledWith('actor.uid', '==', 'uid123')
        })

        it('adds action where clause when filter is provided', () => {
            repo.buildQuery('u1', { action: 'UPDATE_BED' })
            expect(mockWhere).toHaveBeenCalledWith('action', '==', 'UPDATE_BED')
        })

        it('adds startDate where clause with Timestamp.fromDate conversion', () => {
            const start = new Date('2026-01-01')
            repo.buildQuery('u1', { startDate: start })
            expect(mockTimestampFromDate).toHaveBeenCalledWith(start)
            expect(mockWhere).toHaveBeenCalledWith('createdAt', '>=', expect.anything())
        })

        it('adds endDate where clause with Timestamp.fromDate conversion', () => {
            const end = new Date('2026-01-31')
            repo.buildQuery('u1', { endDate: end })
            expect(mockTimestampFromDate).toHaveBeenCalledWith(end)
            expect(mockWhere).toHaveBeenCalledWith('createdAt', '<=', expect.anything())
        })

        it('applies all filters simultaneously', () => {
            const start = new Date('2026-01-01')
            const end = new Date('2026-01-31')
            repo.buildQuery('u1', {
                entityType: 'bed' as any,
                actorUid: 'u1',
                action: 'UPDATE',
                startDate: start,
                endDate: end,
            })
            expect(mockWhere).toHaveBeenCalledTimes(5)
        })

        it('does not add any where clause when filters object is empty', () => {
            repo.buildQuery('u1', {})
            expect(mockWhere).not.toHaveBeenCalled()
        })
    })

    // ── getAuditLogs ─────────────────────────────────────────────────────────

    describe('getAuditLogs', () => {
        it('returns mapped AuditLog array with id from doc', async () => {
            mockGetDocs.mockResolvedValue(makeSnapshot([
                { id: 'log1', data: { action: 'UPDATE_BED', entityType: 'bed', actor: { uid: 'u1' } } },
                { id: 'log2', data: { action: 'ADD_USER', entityType: 'user', actor: { uid: 'u2' } } },
            ]))

            const logs = await repo.getAuditLogs('unit1')
            expect(logs).toHaveLength(2)
            expect(logs[0]).toMatchObject({ id: 'log1', action: 'UPDATE_BED' })
            expect(logs[1]).toMatchObject({ id: 'log2', action: 'ADD_USER' })
        })

        it('returns empty array when no logs exist', async () => {
            mockGetDocs.mockResolvedValue(makeSnapshot([]))
            const logs = await repo.getAuditLogs('unit1')
            expect(logs).toEqual([])
        })
    })

    // ── listenToAuditLogs ────────────────────────────────────────────────────

    describe('listenToAuditLogs', () => {
        it('calls callback with mapped logs on snapshot update', () => {
            const snapshotDocs = [
                { id: 'l1', data: () => ({ action: 'RESET', entityType: 'bed' }) },
            ]
            mockOnSnapshot.mockImplementation((_q, onNext: Function) => {
                onNext({ docs: snapshotDocs })
                return () => {}
            })

            const callback = vi.fn()
            repo.listenToAuditLogs('unit1', undefined, callback)

            expect(callback).toHaveBeenCalledWith([
                expect.objectContaining({ id: 'l1', action: 'RESET' }),
            ])
        })

        it('calls onError callback on Firestore error', () => {
            const fakeError = new Error('permission-denied')
            mockOnSnapshot.mockImplementation((_q, _onNext: Function, onError: Function) => {
                onError(fakeError)
                return () => {}
            })

            const callback = vi.fn()
            const onError = vi.fn()
            repo.listenToAuditLogs('unit1', undefined, callback, onError)

            expect(onError).toHaveBeenCalledWith(fakeError)
            expect(callback).not.toHaveBeenCalled()
        })

        it('does not throw if onError is not provided', () => {
            const fakeError = new Error('network-error')
            mockOnSnapshot.mockImplementation((_q, _onNext: Function, onError: Function) => {
                onError(fakeError)
                return () => {}
            })

            expect(() => repo.listenToAuditLogs('unit1', undefined, vi.fn())).not.toThrow()
        })
    })
})
