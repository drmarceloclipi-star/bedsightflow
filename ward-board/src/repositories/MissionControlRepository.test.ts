import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Firebase mocks ──────────────────────────────────────────────────────────

vi.mock('../infra/firebase/config', () => ({ functions: {} }))
vi.mock('../constants/functionNames', () => ({
    CLOUD_FUNCTIONS: { GET_ADMIN_MISSION_CONTROL_SNAPSHOT: 'getAdminMissionControlSnapshot' },
}))

const mockHttpsCallable = vi.fn()

vi.mock('firebase/functions', () => ({
    httpsCallable: (...a: unknown[]) => mockHttpsCallable(...a),
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Record<string, unknown> = {}) {
    return {
        generatedAt: '2026-03-01T12:00:00Z',
        source: 'firestore',
        thresholdsUsed: { mainBlockerCriticalHours: 24 },
        unreviewedBedsCount: 3,
        openPendenciesCount: 5,
        overduePendenciesCount: 2,
        escalations: {
            total: 4,
            overdueCritical: 1,
            blockerCritical: 3,
        },
        dischargeNext24hCount: 7,
        blockedBedsCount: 2,
        maxBlockedAgingHours: 36,
        ...overrides,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MissionControlRepository', () => {
    let repo: typeof import('./MissionControlRepository').MissionControlRepository

    beforeEach(async () => {
        vi.resetAllMocks()
        const mod = await import('./MissionControlRepository')
        repo = mod.MissionControlRepository
    })

    // ── getSnapshot ──────────────────────────────────────────────────────────

    describe('getSnapshot', () => {
        it('calls the correct Cloud Function and returns data', async () => {
            const snapshot = makeSnapshot()
            const mockFn = vi.fn().mockResolvedValue({ data: snapshot })
            mockHttpsCallable.mockReturnValue(mockFn)

            const result = await repo.getSnapshot('unit1')

            expect(mockHttpsCallable).toHaveBeenCalledWith(
                expect.anything(), 'getAdminMissionControlSnapshot'
            )
            expect(mockFn).toHaveBeenCalledWith({ unitId: 'unit1' })
            expect(result).toEqual(snapshot)
        })
    })

    // ── getHuddleSnapshotSummary ─────────────────────────────────────────────

    describe('getHuddleSnapshotSummary', () => {
        it('maps snapshot fields to HuddleSnapshotSummary correctly', async () => {
            const snapshot = makeSnapshot()
            const mockFn = vi.fn().mockResolvedValue({ data: snapshot })
            mockHttpsCallable.mockReturnValue(mockFn)

            const result = await repo.getHuddleSnapshotSummary('unit1', '2026-03-01-AM')

            expect(result).toMatchObject({
                generatedAt: '2026-03-01T12:00:00Z',
                source: 'firestore',
                shiftKey: '2026-03-01-AM',
                unreviewedBedsCount: 3,
                openPendenciesCount: 5,
                overduePendenciesCount: 2,
                escalationsTotal: 4,
                escalationsOverdueCritical: 1,
                escalationsBlockerCritical: 3,
                dischargeNext24hCount: 7,
                blockedBedsCount: 2,
                maxBlockedAgingHours: 36,
            })
        })

        it('uses the provided shiftKey in the result', async () => {
            const snapshot = makeSnapshot()
            const mockFn = vi.fn().mockResolvedValue({ data: snapshot })
            mockHttpsCallable.mockReturnValue(mockFn)

            const result = await repo.getHuddleSnapshotSummary('unit1', '2026-03-01-PM')
            expect(result?.shiftKey).toBe('2026-03-01-PM')
        })

        it('falls back to current ISO time when generatedAt is missing', async () => {
            const snapshot = makeSnapshot({ generatedAt: undefined })
            const mockFn = vi.fn().mockResolvedValue({ data: snapshot })
            mockHttpsCallable.mockReturnValue(mockFn)

            const result = await repo.getHuddleSnapshotSummary('unit1', '2026-03-01-AM')
            expect(typeof result?.generatedAt).toBe('string')
            expect(result?.generatedAt).not.toBe('')
        })

        it('returns undefined silently when Cloud Function fails', async () => {
            const mockFn = vi.fn().mockRejectedValue(new Error('functions/internal'))
            mockHttpsCallable.mockReturnValue(mockFn)

            const result = await repo.getHuddleSnapshotSummary('unit1', '2026-03-01-AM')
            expect(result).toBeUndefined()
        })

        it('handles missing escalations gracefully', async () => {
            const snapshot = makeSnapshot({ escalations: undefined })
            const mockFn = vi.fn().mockResolvedValue({ data: snapshot })
            mockHttpsCallable.mockReturnValue(mockFn)

            const result = await repo.getHuddleSnapshotSummary('unit1', '2026-03-01-AM')
            expect(result?.escalationsTotal).toBeUndefined()
            expect(result?.escalationsOverdueCritical).toBeUndefined()
            expect(result?.escalationsBlockerCritical).toBeUndefined()
        })
    })
})
