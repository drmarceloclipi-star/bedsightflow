// ── SEED / BOOTSTRAP ONLY ────────────────────────────────────────────────────
// ADMIN_EMAILS exists solely to ensure these addresses can log in during the
// migration to Firebase Custom Claims. It MUST NOT be used for:
//   • permission checks (use token.claims.admin === true)
//   • routing decisions (use useAuthStatus().isAdmin from the claim)
//
// To grant admin access to a user, call the Cloud Function setGlobalAdminClaim.
// Once all admin users have the custom claim set, remove this list in P1.
// See: docs/RBAC_CONTRACT.md
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_EMAILS = [
    'drmarceloclipi@gmail.com',
    'admin@lean.com',
    'global-admin@lean.com',
    'unit-admin@lean.com',
    'editor@lean.com',
    'viewer@lean.com',
];
