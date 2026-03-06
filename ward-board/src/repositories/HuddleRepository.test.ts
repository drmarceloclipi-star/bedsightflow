import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Firebase mocks ──────────────────────────────────────────────────────────

vi.mock('../infra/firebase/config', () => ({ db: {} }))

// Mock MissionControlRepository dependency
vi.mock('./MissionControlRepository', () => ({
    MissionControlRepository: {
        getHuddleSnapshotSummary: vi.fn().mockResolvedValue(undefined),
    },
}))

const mockDoc = vi.fn()
const mockCollection = vi.fn()
const mockGetDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const mockOnSnapshot = vi.fn()
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP')

vi.mock('firebase/firestore', () => ({
    doc: (...a: unknown[]) => mockDoc(...a),
    collection: (...a: unknown[]) => mockCollection(...a),
    getDoc: (...a: unknown[]) => mockGetDoc(...a),
    setDoc: (...a: unknown[]) => mockSetDoc(...a),
    updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
    onSnapshot: (...a: unknown[]) => mockOnSnapshot(...a),
    serverTimestamp: () => mockServerTimestamp(),
}))

vi.mock('uuid', () => ({
    v4: () => 'mock-uuid-1234',
}))

// ── Tests ────────────────────────────────────────────────────────────────────

describe('HuddleRepository', () => {
    let repo: typeof import('./HuddleRepository').HuddleRepository

    const actor = { id: 'u1', name: 'Dr. House' }

    beforeEach(async () => {
        vi.resetAllMocks()
        mockDoc.mockReturnValue('huddleRef')
        mockCollection.mockReturnValue('huddlesCol')
        mockSetDoc.mockResolvedValue(undefined)
        mockUpdateDoc.mockResolvedValue(undefined)

        const mod = await import('./HuddleRepository')
        repo = mod.HuddleRepository
    })

    // ── getCollectionRef ─────────────────────────────────────────────────────

    describe('getCollectionRef', () => {
        it('uses the correct Firestore collection path', () => {
            repo.getCollectionRef('unit1')
            expect(mockCollection).toHaveBeenCalledWith(
                expect.anything(), 'units', 'unit1', 'ops', 'control', 'huddles'
            )
        })
    })

    // ── getHuddleRef ─────────────────────────────────────────────────────────

    describe('getHuddleRef', () => {
        it('uses the huddles subcollection path', () => {
            repo.getHuddleRef('unit1', '2026-03-01-AM')
            expect(mockDoc).toHaveBeenCalledWith(
                expect.anything(), 'units', 'unit1', 'huddles', '2026-03-01-AM'
            )
        })
    })

    // ── getHuddle ────────────────────────────────────────────────────────────

    describe('getHuddle', () => {
        it('returns null when the huddle document does not exist', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })
            const result = await repo.getHuddle('unit1', '2026-03-01-AM')
            expect(result).toBeNull()
        })

        it('returns the huddle data when the document exists', async () => {
            const huddleData = {
                id: '2026-03-01-AM',
                unitId: 'unit1',
                huddleType: 'AM',
                checklist: [],
                topActions: [],
            }
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => huddleData,
            })
            const result = await repo.getHuddle('unit1', '2026-03-01-AM')
            expect(result).toEqual(huddleData)
        })
    })

    // ── listenToHuddle ───────────────────────────────────────────────────────

    describe('listenToHuddle', () => {
        it('calls onUpdate with null when huddle does not exist', () => {
            mockOnSnapshot.mockImplementation((_ref, onNext: Function) => {
                onNext({ exists: () => false })
                return () => {}
            })
            const onUpdate = vi.fn()
            repo.listenToHuddle('unit1', '2026-03-01-AM', onUpdate)
            expect(onUpdate).toHaveBeenCalledWith(null)
        })

        it('calls onUpdate with huddle data when document exists', () => {
            const huddleData = { id: '2026-03-01-AM', topActions: [], checklist: [] }
            mockOnSnapshot.mockImplementation((_ref, onNext: Function) => {
                onNext({ exists: () => true, data: () => huddleData })
                return () => {}
            })
            const onUpdate = vi.fn()
            repo.listenToHuddle('unit1', '2026-03-01-AM', onUpdate)
            expect(onUpdate).toHaveBeenCalledWith(huddleData)
        })
    })

    // ── upsertHuddleStart ────────────────────────────────────────────────────

    describe('upsertHuddleStart', () => {
        it('returns the existing huddle without writing when it already exists', async () => {
            const existingHuddle = {
                id: '2026-03-01-AM',
                checklist: [],
                topActions: [],
                huddleType: 'AM',
            }
            // First getDoc call (existence check): exists
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => existingHuddle,
            })

            const result = await repo.upsertHuddleStart('unit1', 'AM', actor as any)
            expect(result).toEqual(existingHuddle)
            // Should NOT write a new document
            expect(mockSetDoc).not.toHaveBeenCalled()
        })

        it('creates a new huddle when none exists', async () => {
            // First getDoc: does not exist
            mockGetDoc.mockResolvedValue({ exists: () => false })

            await repo.upsertHuddleStart('unit1', 'AM', actor as any)

            expect(mockSetDoc).toHaveBeenCalledWith(
                'huddleRef',
                expect.objectContaining({
                    huddleType: 'AM',
                    unitId: 'unit1',
                    checklist: expect.any(Array),
                    topActions: [],
                    recordedBy: actor,
                }),
                { merge: true }
            )
        })

        it('sets ledBy when actor is provided', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })

            await repo.upsertHuddleStart('unit1', 'PM', actor as any)

            expect(mockSetDoc).toHaveBeenCalledWith(
                'huddleRef',
                expect.objectContaining({ ledBy: actor }),
                { merge: true }
            )
        })

        it('also updates the ops settings lastHuddleShiftKey pointer', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })

            await repo.upsertHuddleStart('unit1', 'AM', actor as any)

            // Two setDoc calls: one for the huddle, one for the ops settings
            expect(mockSetDoc).toHaveBeenCalledTimes(2)
            const opsCall = mockSetDoc.mock.calls.find(
                ([_ref, data]: [unknown, Record<string, unknown>]) =>
                    'lastHuddleShiftKey' in data
            )
            expect(opsCall).toBeDefined()
        })
    })

    // ── addTopAction ─────────────────────────────────────────────────────────

    describe('addTopAction', () => {
        const actionDraft = {
            title: 'Fix linen shortage',
            ownerName: 'Supervisor',
            dueAt: '2026-03-02T08:00:00Z',
            domain: 'nursing' as any,
        }

        it('throws when MAX_TOP_ACTIONS open actions already exist', async () => {
            const openActions = [
                { id: 'a1', status: 'open', title: 'A', createdAt: '', createdBy: actor },
                { id: 'a2', status: 'open', title: 'B', createdAt: '', createdBy: actor },
                { id: 'a3', status: 'open', title: 'C', createdAt: '', createdBy: actor },
            ]
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ topActions: openActions, checklist: [] }),
            })

            await expect(
                repo.addTopAction('unit1', '2026-03-01-AM', actionDraft, actor as any)
            ).rejects.toThrow(/Máximo de 3 ações/)
        })

        it('adds a new action when below the MAX_TOP_ACTIONS limit', async () => {
            const openActions = [
                { id: 'a1', status: 'open', title: 'A', createdAt: '', createdBy: actor },
            ]
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ topActions: openActions, checklist: [] }),
            })

            await repo.addTopAction('unit1', '2026-03-01-AM', actionDraft, actor as any)

            const [_ref, updateData] = mockUpdateDoc.mock.calls[0]
            expect(updateData.topActions).toHaveLength(2)
            const newAction = updateData.topActions[1]
            expect(newAction.title).toBe('Fix linen shortage')
            expect(newAction.status).toBe('open')
            expect(newAction.id).toBe('mock-uuid-1234')
            expect(newAction.createdBy).toEqual(actor)
        })

        it('counts only open actions toward the limit (done/canceled excluded)', async () => {
            const actions = [
                { id: 'a1', status: 'done', title: 'A', createdAt: '', createdBy: actor },
                { id: 'a2', status: 'canceled', title: 'B', createdAt: '', createdBy: actor },
                { id: 'a3', status: 'open', title: 'C', createdAt: '', createdBy: actor },
            ]
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ topActions: actions, checklist: [] }),
            })

            // Only 1 open action — should not throw
            await expect(
                repo.addTopAction('unit1', '2026-03-01-AM', actionDraft, actor as any)
            ).resolves.not.toThrow()
        })

        it('does nothing when huddle does not exist', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })
            await repo.addTopAction('unit1', 'ghost-huddle', actionDraft, actor as any)
            expect(mockUpdateDoc).not.toHaveBeenCalled()
        })
    })

    // ── updateTopActionStatus ────────────────────────────────────────────────

    describe('updateTopActionStatus', () => {
        const baseAction = {
            id: 'a1',
            status: 'open' as const,
            title: 'Fix issue',
            createdAt: '2026-01-01T00:00:00Z',
            createdBy: actor,
        }

        it('sets doneAt and doneBy when transitioning to done', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ topActions: [baseAction], checklist: [] }),
            })

            await repo.updateTopActionStatus('unit1', '2026-03-01-AM', 'a1', 'done', actor as any)

            const [_ref, updateData] = mockUpdateDoc.mock.calls[0]
            const updated = updateData.topActions.find((a: any) => a.id === 'a1')
            expect(updated.status).toBe('done')
            expect(updated.doneAt).toBeDefined()
            expect(updated.doneBy).toEqual(actor)
        })

        it('sets canceledAt and canceledBy when transitioning to canceled', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ topActions: [baseAction], checklist: [] }),
            })

            await repo.updateTopActionStatus('unit1', '2026-03-01-AM', 'a1', 'canceled', actor as any)

            const [_ref, updateData] = mockUpdateDoc.mock.calls[0]
            const updated = updateData.topActions.find((a: any) => a.id === 'a1')
            expect(updated.status).toBe('canceled')
            expect(updated.canceledAt).toBeDefined()
            expect(updated.canceledBy).toEqual(actor)
        })

        it('does not update when status is unchanged', async () => {
            const doneAction = { ...baseAction, status: 'done' as const }
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ topActions: [doneAction], checklist: [] }),
            })

            await repo.updateTopActionStatus('unit1', '2026-03-01-AM', 'a1', 'done', actor as any)

            const [_ref, updateData] = mockUpdateDoc.mock.calls[0]
            const updated = updateData.topActions.find((a: any) => a.id === 'a1')
            // Should be the same unchanged action
            expect(updated.doneAt).toBeUndefined()
        })

        it('does nothing when huddle does not exist', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })
            await repo.updateTopActionStatus('unit1', 'ghost', 'a1', 'done', actor as any)
            expect(mockUpdateDoc).not.toHaveBeenCalled()
        })
    })

    // ── updateChecklistItem ──────────────────────────────────────────────────

    describe('updateChecklistItem', () => {
        it('updates the matching checklist item status', async () => {
            const checklist = [
                { key: 'review_kanban', label: 'Kanban', status: 'skipped' },
                { key: 'review_kamishibai', label: 'Kamishibai', status: 'skipped' },
            ]
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ checklist, topActions: [] }),
            })

            await repo.updateChecklistItem('unit1', '2026-03-01-AM', 'review_kanban', 'done')

            const [_ref, updateData] = mockUpdateDoc.mock.calls[0]
            const updated = updateData.checklist.find((i: any) => i.key === 'review_kanban')
            expect(updated.status).toBe('done')
        })

        it('updates the note when provided', async () => {
            const checklist = [{ key: 'item1', label: 'Item 1', status: 'skipped' }]
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ checklist, topActions: [] }),
            })

            await repo.updateChecklistItem('unit1', 'h1', 'item1', 'done', 'Completed at 07:30')

            const [_ref, updateData] = mockUpdateDoc.mock.calls[0]
            const updated = updateData.checklist.find((i: any) => i.key === 'item1')
            expect(updated.note).toBe('Completed at 07:30')
        })

        it('does nothing when huddle does not exist', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })
            await repo.updateChecklistItem('unit1', 'ghost', 'item1', 'done')
            expect(mockUpdateDoc).not.toHaveBeenCalled()
        })
    })

    // ── setHuddleEnded ───────────────────────────────────────────────────────

    describe('setHuddleEnded', () => {
        // G3 fix: setHuddleEnded now reads the huddle document (getDoc) to extract
        // huddleType before updating ops settings. Tests must set up mockGetDoc.
        beforeEach(() => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ id: '2026-03-01-AM', huddleType: 'AM', checklist: [], topActions: [] }),
            })
        })

        it('writes endedAt and updatedAt timestamps', async () => {
            await repo.setHuddleEnded('unit1', '2026-03-01-AM')

            expect(mockUpdateDoc).toHaveBeenCalledWith(
                'huddleRef',
                expect.objectContaining({
                    endedAt: 'SERVER_TIMESTAMP',
                    updatedAt: 'SERVER_TIMESTAMP',
                })
            )
        })

        it('includes endSummary when MissionControlRepository returns data', async () => {
            const { MissionControlRepository } = await import('./MissionControlRepository')
            vi.mocked(MissionControlRepository.getHuddleSnapshotSummary).mockResolvedValueOnce({
                generatedAt: '2026-03-01T13:00:00Z',
                source: 'firestore',
                shiftKey: '2026-03-01-AM',
                thresholdsUsed: {},
                blockedBedsCount: 1,
                unreviewedBedsCount: 0,
                openPendenciesCount: 2,
                overduePendenciesCount: 0,
                escalationsTotal: 0,
                escalationsOverdueCritical: 0,
                escalationsBlockerCritical: 0,
                dischargeNext24hCount: 3,
                maxBlockedAgingHours: 0,
            })

            await repo.setHuddleEnded('unit1', '2026-03-01-AM')

            const [_ref, updateData] = mockUpdateDoc.mock.calls[0]
            expect(updateData.endSummary).toBeDefined()
        })

        it('omits endSummary when MissionControlRepository returns undefined', async () => {
            const { MissionControlRepository } = await import('./MissionControlRepository')
            vi.mocked(MissionControlRepository.getHuddleSnapshotSummary).mockResolvedValueOnce(undefined)

            await repo.setHuddleEnded('unit1', '2026-03-01-AM')

            const [_ref, updateData] = mockUpdateDoc.mock.calls[0]
            expect(updateData.endSummary).toBeUndefined()
        })

        // ── G3 fix: ops settings must be updated on COMPLETION ────────────────
        // Before this fix, lastHuddleAt/lastHuddleType were never written on
        // setHuddleEnded, so the TV "HUDDLE PENDENTE" badge relied on
        // lastHuddleShiftKey (set on START) instead of on actual completion.

        it('updates ops settings with lastHuddleAt, lastHuddleType and lastHuddleShiftKey', async () => {
            await repo.setHuddleEnded('unit1', '2026-03-01-AM')

            // setDoc must be called for ops settings update
            expect(mockSetDoc).toHaveBeenCalledWith(
                'huddleRef', // doc() always returns 'huddleRef' in mock
                expect.objectContaining({
                    lastHuddleAt: 'SERVER_TIMESTAMP',
                    lastHuddleType: 'AM',
                    lastHuddleShiftKey: '2026-03-01-AM',
                }),
                { merge: true }
            )
        })

        it('infers huddleType from huddleId suffix when huddle document is missing', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })

            await repo.setHuddleEnded('unit1', '2026-03-01-PM')

            expect(mockSetDoc).toHaveBeenCalledWith(
                'huddleRef',
                expect.objectContaining({ lastHuddleType: 'PM' }),
                { merge: true }
            )
        })

        it('uses AM inferred type for AM suffix huddleIds when document missing', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })

            await repo.setHuddleEnded('unit1', '2026-03-01-AM')

            expect(mockSetDoc).toHaveBeenCalledWith(
                'huddleRef',
                expect.objectContaining({ lastHuddleType: 'AM' }),
                { merge: true }
            )
        })
    })
})
