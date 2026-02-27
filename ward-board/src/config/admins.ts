// Centralized Configuration for Admin Emails
// This file is the single source of truth for global admin emails.
// It is imported by the frontend and used in security rules.

export const ADMIN_EMAILS = [
    'drmarceloclipi@gmail.com',
    'admin@lean.com',
];

export const isGlobalAdmin = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
};
