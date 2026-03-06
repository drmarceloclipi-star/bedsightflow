import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Firebase mocks ──────────────────────────────────────────────────────────

vi.mock('../infra/firebase/config', () => ({ db: {}, functions: {} }))
vi.mock('../constants/functionNames', () => ({
    CLOUD_FUNCTIONS: { UPDATE_BOARD_SETTINGS: 'updateBoardSettings' },
}))

const mockDoc = vi.fn()
const mockGetDoc = vi.fn()
const mockOnSnapshot = vi.fn()
const mockHttpsCallable = vi.fn()

vi.mock('firebase/firestore', () => ({
    doc: (...a: unknown[]) => mockDoc(...a),
    getDoc: (...a: unknown[]) => mockGetDoc(...a),
    onSnapshot: (...a: unknown[]) => mockOnSnapshot(...a),
}))

vi.mock('firebase/functions', () => ({
    httpsCallable: (...a: unknown[]) => mockHttpsCallable(...a),
}))

// ── Shared defaults ──────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
    rotationEnabled: true,
    screens: expect.arrayContaining([
        expect.objectContaining({ key: 'kanban' }),
        expect.objectContaining({ key: 'kamishibai' }),
        expect.objectContaining({ key: 'summary' }),
    ]),
    kanbanBedsPerPage: 18,
    kamishibaiBedsPerPage: 18,
    kanbanColumnsPerPage: 1,
    kamishibaiColumnsPerPage: 1,
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BoardSettingsRepository', () => {
    let repo: typeof import('./BoardSettingsRepository').BoardSettingsRepository

    beforeEach(async () => {
        vi.resetAllMocks()
        mockDoc.mockReturnValue('settingsRef')

        const mod = await import('./BoardSettingsRepository')
        repo = mod.BoardSettingsRepository
    })

    // ── getSettings ──────────────────────────────────────────────────────────

    describe('getSettings', () => {
        it('returns default settings when doc does not exist', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })
            const result = await repo.getSettings('unit1')
            expect(result).toMatchObject({ ...DEFAULT_SETTINGS, unitId: 'unit1' })
        })

        it('returns stored settings when doc exists', async () => {
            const stored = {
                unitId: 'unit1',
                rotationEnabled: false,
                screens: [],
                kanbanBedsPerPage: 12,
                kamishibaiBedsPerPage: 12,
                kanbanColumnsPerPage: 2,
                kamishibaiColumnsPerPage: 2,
            }
            mockGetDoc.mockResolvedValue({ exists: () => true, data: () => stored })
            const result = await repo.getSettings('unit1')
            expect(result).toEqual(stored)
        })
    })

    // ── listenToSettings ─────────────────────────────────────────────────────

    describe('listenToSettings', () => {
        it('calls callback with default settings when doc does not exist', () => {
            mockOnSnapshot.mockImplementation((_ref, onNext: (...args: any[]) => any) => {
                onNext({ exists: () => false })
                return () => {}
            })

            const callback = vi.fn()
            repo.listenToSettings('unit1', callback)

            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({ unitId: 'unit1', rotationEnabled: true })
            )
        })

        it('calls callback with stored settings when doc exists', () => {
            const stored = {
                unitId: 'unit1',
                rotationEnabled: false,
                screens: [{ key: 'kanban', label: 'Kanban', durationSeconds: 20, enabled: true }],
                kanbanBedsPerPage: 6,
                kamishibaiBedsPerPage: 6,
                kanbanColumnsPerPage: 3,
                kamishibaiColumnsPerPage: 3,
            }
            mockOnSnapshot.mockImplementation((_ref, onNext: (...args: any[]) => any) => {
                onNext({ exists: () => true, data: () => stored })
                return () => {}
            })

            const callback = vi.fn()
            repo.listenToSettings('unit1', callback)

            expect(callback).toHaveBeenCalledWith(stored)
        })

        it('calls onError when Firestore emits an error', () => {
            const fakeError = new Error('unavailable')
            mockOnSnapshot.mockImplementation((_ref, _onNext: (...args: any[]) => any, onError: (...args: any[]) => any) => {
                onError(fakeError)
                return () => {}
            })

            const callback = vi.fn()
            const onError = vi.fn()
            repo.listenToSettings('unit1', callback, onError)

            expect(onError).toHaveBeenCalledWith(fakeError)
            expect(callback).not.toHaveBeenCalled()
        })

        it('does not throw when onError is not provided', () => {
            mockOnSnapshot.mockImplementation((_ref, _onNext: (...args: any[]) => any, onError: (...args: any[]) => any) => {
                onError(new Error('oops'))
                return () => {}
            })
            expect(() => repo.listenToSettings('unit1', vi.fn())).not.toThrow()
        })
    })

    // ── updateSettings ───────────────────────────────────────────────────────

    describe('updateSettings', () => {
        it('calls the Cloud (...args: any[]) => any with unitId, settings, and reason', async () => {
            const mockFn = vi.fn().mockResolvedValue({})
            mockHttpsCallable.mockReturnValue(mockFn)

            const settings = { rotationEnabled: false }
            await repo.updateSettings('unit1', settings, 'Disabled rotation')

            expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'updateBoardSettings')
            expect(mockFn).toHaveBeenCalledWith({
                unitId: 'unit1',
                reason: 'Disabled rotation',
                settings,
            })
        })
    })
})
