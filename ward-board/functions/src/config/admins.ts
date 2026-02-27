// Centralized Configuration for Admin Emails within Cloud Functions
// Keeps the same "seed" list but avoids relative imports from outside functions/src

const ADMIN_EMAILS = [
    'drmarceloclipi@gmail.com',
    'admin@lean.com',
];

export const isGlobalAdmin = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
};
