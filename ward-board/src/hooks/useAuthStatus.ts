import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../infra/firebase/config';

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
                    // isAdmin is determined solely by the custom claim set via setGlobalAdminClaim.
                    // ADMIN_EMAILS is not used here — see docs/RBAC_CONTRACT.md.
                    setIsAdmin(token.claims.admin === true);
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
