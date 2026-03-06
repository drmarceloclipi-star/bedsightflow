import type * as admin from 'firebase-admin';

const FIRESTORE_BATCH_LIMIT = 499; // Firestore hard limit is 500; keep 1 slot as safety margin

type WriteOperation = (batch: admin.firestore.WriteBatch) => void;

/**
 * Splits an arbitrary list of Firestore write operations into batches of ≤499
 * and commits them sequentially.
 *
 * NOTE: Unlike a single batch, multiple batches are NOT globally atomic.
 * If the k-th batch fails, writes from batches 0…k-1 are already committed.
 * For admin bulk operations (reset, seed) this is an acceptable tradeoff
 * over silently failing when a unit exceeds 500 beds.
 */
export async function chunkAndCommitBatch(
    db: admin.firestore.Firestore,
    operations: WriteOperation[]
): Promise<void> {
    for (let i = 0; i < operations.length; i += FIRESTORE_BATCH_LIMIT) {
        const chunk = operations.slice(i, i + FIRESTORE_BATCH_LIMIT);
        const batch = db.batch();
        for (const op of chunk) op(batch);
        await batch.commit();
    }
}
