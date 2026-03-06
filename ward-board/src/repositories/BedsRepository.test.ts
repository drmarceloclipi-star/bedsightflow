import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Firebase mocks ──────────────────────────────────────────────────────────

vi.mock('../infra/firebase/config', () => ({ db: { app: {} } }))

const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockOnSnapshot = vi.fn()
const mockUpdateDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP')
const mockRunTransaction = vi.fn()
const mockArrayUnion = vi.fn((val: unknown) => ({ _arrayUnion: val }))
const mockWriteBatch = vi.fn()

vi.mock('firebase/firestore', async () => {
    return {
        collection: (...a: unknown[]) => mockCollection(...a),
        doc: (...a: unknown[]) => mockDoc(...a),
        onSnapshot: (...a: unknown[]) => mockOnSnapshot(...a),
        updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
        getDocs: (...a: unknown[]) => mockGetDocs(...a),
        serverTimestamp: () => mockServerTimestamp(),
        runTransaction: (...a: unknown[]) => mockRunTransaction(...a),
        arrayUnion: (...a: unknown[]) => mockArrayUnion(...a),
        writeBatch: () => mockWriteBatch(),
        query: vi.fn((ref) => ref),
        orderBy: vi.fn(),
    }
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BedsRepository', () => {
    let repo: typeof import('./BedsRepository').BedsRepository

    beforeEach(async () => {
        vi.resetAllMocks()
        mockDoc.mockReturnValue('bedRef')
        mockCollection.mockReturnValue('bedsCol')
        mockUpdateDoc.mockResolvedValue(undefined)
        mockRunTransaction.mockResolvedValue(undefined)
        mockGetDocs.mockResolvedValue({ docs: [] })

        const mod = await import('./BedsRepository')
        repo = mod.BedsRepository
    })

    // ── updateBed ────────────────────────────────────────────────────────────

    describe('updateBed', () => {
        it('strips id and unitId from the data before writing', async () => {
            await repo.updateBed('unit1', 'bed1', { id: 'bed1', unitId: 'unit1', patientAlias: 'John' } as any)
            const [_ref, writtenData] = mockUpdateDoc.mock.calls[0]
            expect(writtenData).not.toHaveProperty('id')
            expect(writtenData).not.toHaveProperty('unitId')
            expect(writtenData.patientAlias).toBe('John')
        })

        it('includes updatedAt: SERVER_TIMESTAMP in every write', async () => {
            await repo.updateBed('unit1', 'bed1', { patientAlias: 'Jane' } as any)
            const [_ref, writtenData] = mockUpdateDoc.mock.calls[0]
            expect(writtenData.updatedAt).toBe('SERVER_TIMESTAMP')
        })

        it('sets updatedBy to null when no actor is provided', async () => {
            await repo.updateBed('unit1', 'bed1', { patientAlias: 'X' } as any)
            const [_ref, writtenData] = mockUpdateDoc.mock.calls[0]
            expect(writtenData.updatedBy).toBeNull()
        })

        it('includes actor in updatedBy when provided', async () => {
            const actor = { uid: 'u1', email: 'a@b.com', role: 'editor' }
            await repo.updateBed('unit1', 'bed1', {} as any, actor)
            const [_ref, writtenData] = mockUpdateDoc.mock.calls[0]
            expect(writtenData.updatedBy).toEqual(actor)
        })
    })

    // ── listenToBed ──────────────────────────────────────────────────────────

    describe('listenToBed', () => {
        it('calls callback with null when bed document does not exist', () => {
            mockOnSnapshot.mockImplementation((_ref, onNext: Function) => {
                onNext({ exists: () => false })
                return () => {}
            })
            const callback = vi.fn()
            repo.listenToBed('unit1', 'bed1', callback)
            expect(callback).toHaveBeenCalledWith(null)
        })

        it('calls callback with bed data including id when document exists', () => {
            mockOnSnapshot.mockImplementation((_ref, onNext: Function) => {
                onNext({
                    exists: () => true,
                    id: 'bed1',
                    data: () => ({ patientAlias: 'Alice', number: '1' }),
                })
                return () => {}
            })
            const callback = vi.fn()
            repo.listenToBed('unit1', 'bed1', callback)
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'bed1', patientAlias: 'Alice' })
            )
        })
    })

    // ── listenToBeds ─────────────────────────────────────────────────────────

    describe('listenToBeds', () => {
        it('calls callback with mapped beds array', () => {
            const docs = [
                { id: 'b1', data: () => ({ patientAlias: 'Alice', number: '1' }) },
                { id: 'b2', data: () => ({ patientAlias: '', number: '2' }) },
            ]
            mockOnSnapshot.mockImplementation((_q, onNext: Function) => {
                onNext({ docs })
                return () => {}
            })
            const callback = vi.fn()
            repo.listenToBeds('unit1', callback)
            expect(callback).toHaveBeenCalledWith([
                expect.objectContaining({ id: 'b1', patientAlias: 'Alice' }),
                expect.objectContaining({ id: 'b2', patientAlias: '' }),
            ])
        })

        it('calls onError when Firestore emits an error', () => {
            const err = new Error('permission-denied')
            mockOnSnapshot.mockImplementation((_q, _onNext: Function, onError: Function) => {
                onError(err)
                return () => {}
            })
            const onError = vi.fn()
            repo.listenToBeds('unit1', vi.fn(), onError)
            expect(onError).toHaveBeenCalledWith(err)
        })
    })

    // ── addPendency ──────────────────────────────────────────────────────────

    describe('addPendency', () => {
        it('calls updateDoc with arrayUnion containing the new pendency', async () => {
            const pendency = {
                id: 'p1',
                title: 'Exame',
                status: 'open',
                createdAt: '2026-01-01T00:00:00Z',
                createdBy: { id: 'u1', name: 'Nurse' },
            } as any

            await repo.addPendency('unit1', 'bed1', pendency)

            expect(mockUpdateDoc).toHaveBeenCalledWith(
                'bedRef',
                expect.objectContaining({
                    pendencies: expect.objectContaining({ _arrayUnion: pendency }),
                    updatedAt: 'SERVER_TIMESTAMP',
                })
            )
        })
    })

    // ── markPendencyDone ─────────────────────────────────────────────────────

    describe('markPendencyDone', () => {
        it('runs a transaction and updates the matching pendency to status done', async () => {
            const actor = { id: 'u1', name: 'Nurse Ana' }
            const pendencies = [
                { id: 'p1', status: 'open', title: 'X', createdAt: '', createdBy: actor },
                { id: 'p2', status: 'open', title: 'Y', createdAt: '', createdBy: actor },
            ]

            mockRunTransaction.mockImplementation(async (_db, txFn: Function) => {
                const tx = {
                    get: vi.fn().mockResolvedValue({
                        exists: () => true,
                        data: () => ({ pendencies }),
                    }),
                    update: vi.fn(),
                }
                await txFn(tx)
                // Verify the update was called with the right pendencies
                const [_ref, updateData] = tx.update.mock.calls[0]
                const updatedP1 = updateData.pendencies.find((p: any) => p.id === 'p1')
                expect(updatedP1.status).toBe('done')
                expect(updatedP1.doneBy).toEqual(actor)
                const updatedP2 = updateData.pendencies.find((p: any) => p.id === 'p2')
                expect(updatedP2.status).toBe('open') // unchanged
            })

            await repo.markPendencyDone('unit1', 'bed1', 'p1', actor as any)
            expect(mockRunTransaction).toHaveBeenCalled()
        })

        it('throws when bed document does not exist', async () => {
            mockRunTransaction.mockImplementation(async (_db, txFn: Function) => {
                const tx = {
                    get: vi.fn().mockResolvedValue({ exists: () => false }),
                    update: vi.fn(),
                }
                await txFn(tx)
            })

            await expect(repo.markPendencyDone('unit1', 'bedX', 'p1', {} as any)).rejects.toThrow(
                'Bed bedX not found'
            )
        })
    })

    // ── cancelPendency ───────────────────────────────────────────────────────

    describe('cancelPendency', () => {
        it('runs a transaction and updates the matching pendency to status canceled', async () => {
            const actor = { id: 'u1', name: 'Dr. House' }
            const pendencies = [
                { id: 'p1', status: 'open', title: 'Z', createdAt: '', createdBy: actor },
            ]

            mockRunTransaction.mockImplementation(async (_db, txFn: Function) => {
                const tx = {
                    get: vi.fn().mockResolvedValue({
                        exists: () => true,
                        data: () => ({ pendencies }),
                    }),
                    update: vi.fn(),
                }
                await txFn(tx)
                const [_ref, updateData] = tx.update.mock.calls[0]
                const updated = updateData.pendencies.find((p: any) => p.id === 'p1')
                expect(updated.status).toBe('canceled')
                expect(updated.canceledBy).toEqual(actor)
            })

            await repo.cancelPendency('unit1', 'bed1', 'p1', actor as any)
            expect(mockRunTransaction).toHaveBeenCalled()
        })
    })

    // ── bulkUpsertBeds ───────────────────────────────────────────────────────

    describe('bulkUpsertBeds', () => {
        it('applies defaults for missing optional fields', async () => {
            const mockBatch = {
                set: vi.fn(),
                commit: vi.fn().mockResolvedValue(undefined),
            }
            mockWriteBatch.mockReturnValue(mockBatch)

            await repo.bulkUpsertBeds('unit1', [{ number: '1A' }])

            const [_ref, data, opts] = mockBatch.set.mock.calls[0]
            expect(data.patientAlias).toBe('')
            expect(data.expectedDischarge).toBe('2-3_days')
            expect(data.mainBlocker).toBe('')
            expect(data.involvedSpecialties).toEqual(['medical'])
            expect(data.kamishibai).toEqual({})
            expect(opts).toEqual({ merge: true })
        })

        it('uses bed.number as the document id', async () => {
            const mockBatch = {
                set: vi.fn(),
                commit: vi.fn().mockResolvedValue(undefined),
            }
            mockWriteBatch.mockReturnValue(mockBatch)

            await repo.bulkUpsertBeds('unit1', [{ number: '3B' }])

            expect(mockDoc).toHaveBeenCalledWith(
                expect.anything(), 'units', 'unit1', 'beds', '3B'
            )
        })
    })
})
