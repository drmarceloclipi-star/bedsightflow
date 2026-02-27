import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../infra/firebase/config';
import { ADMIN_EMAILS } from '../config/admins';

export const useAuthStatus = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const token = await currentUser.getIdTokenResult();
                    const hasAdminClaim = token.claims.admin === true;
                    const isLegacyAdmin = ADMIN_EMAILS.includes(currentUser.email?.toLowerCase() || '');

                    setIsAdmin(hasAdminClaim || isLegacyAdmin);
                } catch (error) {
                    console.error("Error fetching token claims", error);
                    setIsAdmin(false);
                }
            } else {
                setIsAdmin(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { user, isAdmin, loading };
};
