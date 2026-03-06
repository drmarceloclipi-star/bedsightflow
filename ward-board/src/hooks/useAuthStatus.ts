import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../infra/firebase/config';

export const useAuthStatus = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const token = await currentUser.getIdTokenResult();
                    // Super Admin: platform-level, managed via `superAdmin` custom claim.
                    // Super Admin is OUTSIDE the institutional hierarchy.
                    setIsSuperAdmin(token.claims.superAdmin === true);
                    // Global Admin (isAdmin): institution-level, managed via `admin` custom claim.
                    // Global Admin administers the institution, not the platform.
                    setIsAdmin(token.claims.admin === true);
                } catch (error) {
                    console.error("Error fetching token claims", error);
                    setIsSuperAdmin(false);
                    setIsAdmin(false);
                }
            } else {
                setIsSuperAdmin(false);
                setIsAdmin(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { user, isSuperAdmin, isAdmin, loading };
};
