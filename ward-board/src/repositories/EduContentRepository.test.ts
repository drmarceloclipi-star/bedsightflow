import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Firebase mocks ──────────────────────────────────────────────────────────

vi.mock('../infra/firebase/config', () => ({ db: {} }))

const mockDoc = vi.fn()
const mockGetDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
    doc: (...a: unknown[]) => mockDoc(...a),
    getDoc: (...a: unknown[]) => mockGetDoc(...a),
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

function existingSnap(data: object) {
    return { exists: () => true, data: () => data }
}
const missingSnap = { exists: () => false }

// ── Tests ────────────────────────────────────────────────────────────────────

describe('EduContentRepository', () => {
    let repo: typeof import('./EduContentRepository').EduContentRepository

    beforeEach(async () => {
        vi.resetAllMocks()
        mockDoc.mockReturnValue('docRef')

        const mod = await import('./EduContentRepository')
        repo = mod.EduContentRepository
    })

    describe('fetchEduContent', () => {
        it('returns null for both when neither document exists', async () => {
            mockGetDoc.mockResolvedValue(missingSnap)
            const result = await repo.fetchEduContent('unit1')
            expect(result).toEqual({ playbooks: null, microlessons: null })
        })

        it('returns playbook items when playbooks document exists', async () => {
            const playbooks = [{ id: 'pb1', title: 'Sepsis Protocol' }]
            mockGetDoc
                .mockResolvedValueOnce(existingSnap({ items: playbooks })) // playbooks
                .mockResolvedValueOnce(missingSnap)                        // microlessons

            const result = await repo.fetchEduContent('unit1')
            expect(result.playbooks).toEqual(playbooks)
            expect(result.microlessons).toBeNull()
        })

        it('returns microlesson items when microlessons document exists', async () => {
            const microlessons = [{ id: 'ml1', title: 'Hand Hygiene' }]
            mockGetDoc
                .mockResolvedValueOnce(missingSnap)                           // playbooks
                .mockResolvedValueOnce(existingSnap({ items: microlessons })) // microlessons

            const result = await repo.fetchEduContent('unit1')
            expect(result.playbooks).toBeNull()
            expect(result.microlessons).toEqual(microlessons)
        })

        it('returns items from both documents when both exist', async () => {
            const playbooks = [{ id: 'pb1', title: 'Sepsis Protocol' }]
            const microlessons = [{ id: 'ml1', title: 'Hand Hygiene' }]
            mockGetDoc
                .mockResolvedValueOnce(existingSnap({ items: playbooks }))
                .mockResolvedValueOnce(existingSnap({ items: microlessons }))

            const result = await repo.fetchEduContent('unit1')
            expect(result.playbooks).toEqual(playbooks)
            expect(result.microlessons).toEqual(microlessons)
        })

        it('returns null when items field is missing from document', async () => {
            mockGetDoc
                .mockResolvedValueOnce(existingSnap({})) // no items field
                .mockResolvedValueOnce(missingSnap)

            const result = await repo.fetchEduContent('unit1')
            expect(result.playbooks).toBeNull()
        })

        it('fetches from the correct Firestore paths', async () => {
            mockGetDoc.mockResolvedValue(missingSnap)
            await repo.fetchEduContent('hospitalUnit')

            expect(mockDoc).toHaveBeenCalledWith(
                expect.anything(), 'units', 'hospitalUnit', 'edu_content', 'playbooks'
            )
            expect(mockDoc).toHaveBeenCalledWith(
                expect.anything(), 'units', 'hospitalUnit', 'edu_content', 'microlessons'
            )
        })
    })
})
