// ── SEED / BOOTSTRAP ONLY ────────────────────────────────────────────────────
// These lists exist solely to bootstrap custom claims during initial setup.
// They MUST NOT be used for runtime permission checks.
// See docs/RBAC_CONTRACT.md.
// ─────────────────────────────────────────────────────────────────────────────

const SUPER_ADMIN_EMAILS = [
    'drmarceloclipi@gmail.com',
];

const GLOBAL_ADMIN_EMAILS = [
    'admin@lean.com',
];

export const isSuperAdminEmail = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
};

export const isGlobalAdminEmail = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return GLOBAL_ADMIN_EMAILS.includes(email.toLowerCase());
};

/** @deprecated Use isSuperAdminEmail or isGlobalAdminEmail instead */
export const isGlobalAdmin = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return SUPER_ADMIN_EMAILS.includes(email.toLowerCase()) || GLOBAL_ADMIN_EMAILS.includes(email.toLowerCase());
};
