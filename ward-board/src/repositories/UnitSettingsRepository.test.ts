import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Firebase mocks ──────────────────────────────────────────────────────────

vi.mock('../infra/firebase/config', () => ({ db: {} }))

const mockDoc = vi.fn()
const mockGetDoc = vi.fn()
const mockOnSnapshot = vi.fn()
const mockSetDoc = vi.fn()
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP')

vi.mock('firebase/firestore', () => ({
    doc: (...a: unknown[]) => mockDoc(...a),
    getDoc: (...a: unknown[]) => mockGetDoc(...a),
    onSnapshot: (...a: unknown[]) => mockOnSnapshot(...a),
    setDoc: (...a: unknown[]) => mockSetDoc(...a),
    serverTimestamp: () => mockServerTimestamp(),
}))

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UnitSettingsRepository', () => {
    let repo: typeof import('./UnitSettingsRepository').UnitSettingsRepository

    beforeEach(async () => {
        vi.resetAllMocks()
        mockDoc.mockReturnValue('opsRef')
        mockSetDoc.mockResolvedValue(undefined)

        const mod = await import('./UnitSettingsRepository')
        repo = mod.UnitSettingsRepository
    })

    // ── getUnitOpsSettings ───────────────────────────────────────────────────

    describe('getUnitOpsSettings', () => {
        it('returns default settings when doc does not exist', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false })
            const result = await repo.getUnitOpsSettings('u1')
            expect(result).toMatchObject({
                kanbanMode: 'PASSIVE',
                kamishibaiEnabled: true,
                huddleSchedule: { amStart: '07:00', pmStart: '19:00' },
            })
        })

        it('returns defaults on Firestore error', async () => {
            mockGetDoc.mockRejectedValue(new Error('permission-denied'))
            const result = await repo.getUnitOpsSettings('u1')
            expect(result.kanbanMode).toBe('PASSIVE')
            expect(result.kamishibaiEnabled).toBe(true)
        })

        it('parses kanbanMode ACTIVE_LITE correctly', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ kanbanMode: 'ACTIVE_LITE' }),
            })
            const result = await repo.getUnitOpsSettings('u1')
            expect(result.kanbanMode).toBe('ACTIVE_LITE')
        })

        it('defaults kanbanMode to PASSIVE for unrecognised values', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ kanbanMode: 'UNKNOWN_MODE' }),
            })
            const result = await repo.getUnitOpsSettings('u1')
            expect(result.kanbanMode).toBe('PASSIVE')
        })

        it('parses kamishibaiEnabled: false correctly', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ kamishibaiEnabled: false }),
            })
            const result = await repo.getUnitOpsSettings('u1')
            expect(result.kamishibaiEnabled).toBe(false)
        })

        it('defaults kamishibaiEnabled to true when field is absent', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({}),
            })
            const result = await repo.getUnitOpsSettings('u1')
            expect(result.kamishibaiEnabled).toBe(true)
        })

        it('parses a valid huddleSchedule', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    huddleSchedule: { amStart: '06:00', pmStart: '18:00' },
                }),
            })
            const result = await repo.getUnitOpsSettings('u1')
            expect(result.huddleSchedule).toEqual({ amStart: '06:00', pmStart: '18:00' })
        })

        it('defaults huddleSchedule when field is absent', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({}),
            })
            const result = await repo.getUnitOpsSettings('u1')
            expect(result.huddleSchedule).toEqual({ amStart: '07:00', pmStart: '19:00' })
        })

        it('defaults entire huddleSchedule when pmStart field is missing', async () => {
            // parseHuddleSchedule requires BOTH amStart and pmStart to be present in the object;
            // if either is missing the whole schedule falls back to DEFAULT_SHIFT_SCHEDULE.
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ huddleSchedule: { amStart: '06:00' } }),
            })
            const result = await repo.getUnitOpsSettings('u1')
            expect(result.huddleSchedule).toEqual({ amStart: '07:00', pmStart: '19:00' })
        })

        it('preserves lastHuddleShiftKey when present', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ lastHuddleShiftKey: '2026-03-01-AM' }),
            })
            const result = await repo.getUnitOpsSettings('u1')
            expect(result.lastHuddleShiftKey).toBe('2026-03-01-AM')
        })

        it('leaves lastHuddleShiftKey undefined when absent', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({}),
            })
            const result = await repo.getUnitOpsSettings('u1')
            expect(result.lastHuddleShiftKey).toBeUndefined()
        })
    })

    // ── subscribeUnitOpsSettings ─────────────────────────────────────────────

    describe('subscribeUnitOpsSettings', () => {
        it('calls callback with defaults when doc does not exist', () => {
            mockOnSnapshot.mockImplementation((_ref, onNext: (...args: any[]) => any) => {
                onNext({ exists: () => false })
                return () => {}
            })

            const callback = vi.fn()
            repo.subscribeUnitOpsSettings('u1', callback)

            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({ kanbanMode: 'PASSIVE', kamishibaiEnabled: true })
            )
        })

        it('calls callback with parsed settings when doc exists', () => {
            mockOnSnapshot.mockImplementation((_ref, onNext: (...args: any[]) => any) => {
                onNext({
                    exists: () => true,
                    data: () => ({ kanbanMode: 'ACTIVE_LITE', kamishibaiEnabled: false }),
                })
                return () => {}
            })

            const callback = vi.fn()
            repo.subscribeUnitOpsSettings('u1', callback)

            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({ kanbanMode: 'ACTIVE_LITE', kamishibaiEnabled: false })
            )
        })

        it('calls callback with defaults on Firestore error', () => {
            mockOnSnapshot.mockImplementation((_ref, _onNext: (...args: any[]) => any, onError: (...args: any[]) => any) => {
                onError(new Error('unavailable'))
                return () => {}
            })

            const callback = vi.fn()
            repo.subscribeUnitOpsSettings('u1', callback)

            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({ kanbanMode: 'PASSIVE' })
            )
        })
    })

    // ── setUnitKanbanMode ────────────────────────────────────────────────────

    describe('setUnitKanbanMode', () => {
        it('calls setDoc with merge:true and the correct kanbanMode', async () => {
            const actor = { uid: 'u1', email: 'admin@x.com' }
            await repo.setUnitKanbanMode('unit1', 'ACTIVE_LITE', actor)
            expect(mockSetDoc).toHaveBeenCalledWith(
                'opsRef',
                expect.objectContaining({ kanbanMode: 'ACTIVE_LITE', updatedBy: actor }),
                { merge: true }
            )
        })
    })

    // ── setKamishibaiEnabled ─────────────────────────────────────────────────

    describe('setKamishibaiEnabled', () => {
        it('calls setDoc with merge:true and the correct enabled flag', async () => {
            const actor = { uid: 'u1', email: 'admin@x.com' }
            await repo.setKamishibaiEnabled('unit1', false, actor)
            expect(mockSetDoc).toHaveBeenCalledWith(
                'opsRef',
                expect.objectContaining({ kamishibaiEnabled: false, updatedBy: actor }),
                { merge: true }
            )
        })
    })

    // ── registerHuddle ───────────────────────────────────────────────────────

    describe('registerHuddle', () => {
        it('saves huddleType and a shiftKey derived from current time', async () => {
            const actor = { id: 'u1', name: 'Nurse Ana' }
            await repo.registerHuddle('unit1', 'AM', actor)
            expect(mockSetDoc).toHaveBeenCalledWith(
                'opsRef',
                expect.objectContaining({
                    lastHuddleType: 'AM',
                    lastHuddleRegisteredBy: actor,
                    lastHuddleShiftKey: expect.any(String),
                }),
                { merge: true }
            )
        })

        it('uses provided schedule to compute shiftKey', async () => {
            const actor = { id: 'u1', name: 'Nurse Ana' }
            const schedule = { amStart: '06:00', pmStart: '18:00' }
            await repo.registerHuddle('unit1', 'PM', actor, schedule)
            expect(mockSetDoc).toHaveBeenCalledWith(
                'opsRef',
                expect.objectContaining({ lastHuddleType: 'PM' }),
                { merge: true }
            )
        })
    })
})
