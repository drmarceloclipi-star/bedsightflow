import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../infra/firebase/config';
import { useAuthStatus } from './useAuthStatus';
import type { UnitRole, PortalLevel } from '../domain/types';
import { getVisiblePortalLevels } from '../domain/types';

export const useHighestRole = () => {
    const { user, isSuperAdmin, isAdmin } = useAuthStatus();
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

    // ── Derived access checks ────────────────────────────────────────────────
    // Super Admin is OUTSIDE the institutional hierarchy — has separate panel.
    // Global Admin (isAdmin claim) is the top of the institutional hierarchy.

    const hasGlobalAdminAccess = isAdmin;
    const hasUnitAdminAccess = hasGlobalAdminAccess || highestRole === 'admin';
    const hasEditorAccess = hasUnitAdminAccess || highestRole === 'editor';
    const hasViewerAccess = hasEditorAccess || highestRole === 'viewer';

    // ── Portal level for card visibility ─────────────────────────────────────
    // Determines which portal level the user belongs to (institutional hierarchy).
    // Super Admin does NOT get a portal level — they go to their own panel.
    let portalLevel: PortalLevel | null = null;
    if (isAdmin) {
        portalLevel = 'global_admin';
    } else if (highestRole === 'admin') {
        portalLevel = 'unit_admin';
    } else if (highestRole === 'editor') {
        portalLevel = 'editor';
    } else if (highestRole === 'viewer') {
        portalLevel = 'viewer';
    }

    const visiblePortalLevels = portalLevel ? getVisiblePortalLevels(portalLevel) : [];

    return {
        highestRole,
        isSuperAdmin,
        hasGlobalAdminAccess,
        hasUnitAdminAccess,
        hasEditorAccess,
        hasViewerAccess,
        portalLevel,
        visiblePortalLevels,
        loadingRoles,
    };
};
