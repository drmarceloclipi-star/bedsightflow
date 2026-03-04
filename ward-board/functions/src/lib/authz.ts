import * as functions from 'firebase-functions/v1';
import { db } from '../config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UnitAuthz {
    role: string;
}

interface UserAuthz {
    allowedUnitIds?: string[];
    units?: Record<string, UnitAuthz>;
}

// ── Global admin ──────────────────────────────────────────────────────────────

/**
 * Returns true when the caller has the custom claim `admin: true`.
 * This is the single source of truth for global admin status in Cloud Functions.
 * See docs/RBAC_CONTRACT.md.
 */
export function isGlobalAdmin(context: functions.https.CallableContext): boolean {
    return context.auth?.token?.admin === true;
}

// ── Per-user authz (central model) ───────────────────────────────────────────

/**
 * Reads the central authz document for a user: /users/{uid}/authz/authz.
 * Returns an empty object if the document does not exist.
 */
export async function getUserAuthz(uid: string): Promise<UserAuthz> {
    const snap = await db.collection('users').doc(uid).collection('authz').doc('authz').get();
    if (!snap.exists) return {};
    return snap.data() as UserAuthz;
}

/**
 * Returns true when the user has an editor or admin role for the given unit,
 * as recorded in the central authz document.
 */
export function isUnitEditorOrAdmin(authz: UserAuthz, unitId: string): boolean {
    const unitData = authz.units?.[unitId];
    if (!unitData) return false;
    return ['editor', 'admin'].includes(unitData.role);
}
