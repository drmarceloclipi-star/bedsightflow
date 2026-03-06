import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../infra/firebase/config';
import { useAuthStatus } from './useAuthStatus';
import type { UnitRole } from '../domain/types';

export const useHighestRole = () => {
    const { user } = useAuthStatus();
    const [highestRole, setHighestRole] = useState<UnitRole | null>(null);
    const [loadingRoles, setLoadingRoles] = useState(true);

    useEffect(() => {
        const fetchRole = async () => {
            if (!user) {
                setHighestRole(null);
                setLoadingRoles(false);
                return;
            }

            try {
                // Fetch central authz document
                const authzRef = doc(db, 'users', user.uid, 'authz', 'authz');
                const docSnap = await getDoc(authzRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const units = data.units || {};
                    const roles = Object.values(units).map((u: unknown) => (u as { role: string }).role as UnitRole);

                    if (roles.includes('admin')) {
                        setHighestRole('admin');
                    } else if (roles.includes('editor')) {
                        setHighestRole('editor');
                    } else if (roles.includes('viewer')) {
                        setHighestRole('viewer');
                    } else {
                        setHighestRole(null);
                    }
                } else {
                    setHighestRole(null);
                }
            } catch (error) {
                console.error('Error fetching user authz role:', error);
                setHighestRole(null);
            } finally {
                setLoadingRoles(false);
            }
        };

        fetchRole();
    }, [user]);

    // Role progression Check: 
    // Global Admin > Unit Admin ('admin') > Editor ('editor') > Viewer ('viewer')
    const hasUnitAdminAccess = highestRole === 'admin';
    const hasEditorAccess = hasUnitAdminAccess || highestRole === 'editor';
    const hasViewerAccess = hasEditorAccess || highestRole === 'viewer';

    return {
        highestRole,
        hasUnitAdminAccess,
        hasEditorAccess,
        hasViewerAccess,
        loadingRoles
    };
};
