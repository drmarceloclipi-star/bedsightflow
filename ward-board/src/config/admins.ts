// Centralized Configuration for Admin Emails
// IMPORTANTE: Este arquivo agora serve apenas como uma lista "semente" (seed)
// e fallback temporário para migração para Custom Claims (firebase auth JWT).
// Para dar acesso de admin a um novo usuário, use a nova Cloud Function setGlobalAdminClaim
// que gravará a claim real { admin: true } no token do usuário.

export const ADMIN_EMAILS = [
    'drmarceloclipi@gmail.com',
    'admin@lean.com',
];

export const isGlobalAdmin = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
};
