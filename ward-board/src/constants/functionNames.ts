/**
 * Centralized names for Firebase Cloud Functions to avoid typos
 * and make management easier.
 */
export const CLOUD_FUNCTIONS = {
    // Platform / Admin claim management
    SET_SUPER_ADMIN_CLAIM: 'setSuperAdminClaim',
    SET_GLOBAL_ADMIN_CLAIM: 'setGlobalAdminClaim',

    // Admin / Command operations
    UPDATE_BOARD_SETTINGS: 'updateBoardSettings',
    APPLY_CANONICAL_BEDS: 'applyCanonicalBeds',
    SET_UNIT_USER_ROLE: 'setUnitUserRole',
    REMOVE_UNIT_USER: 'removeUnitUser',
    SOFT_RESET_UNIT: 'softResetUnit',
    RESET_BED_KANBAN: 'resetBedKanban',
    RESET_BED_KAMISHIBAI: 'resetBedKamishibai',
    RESET_BED_ALL: 'resetBedAll',

    // Analytics (query Firestore audit logs)
    GET_ADMIN_FRESHNESS: 'getAdminFreshness',
    GET_ADMIN_KAMISHIBAI_STATS: 'getAdminKamishibaiStats',
    GET_ADMIN_FLOW_METRICS: 'getAdminFlowMetrics',
    GET_ADMIN_OVERVIEW: 'getAdminOverview',
    GET_ADMIN_TREND_COMPARISON: 'getAdminTrendComparison',
    GET_ADMIN_TOP_BLOCKERS: 'getAdminTopBlockers',

    // Mission Control
    GET_ADMIN_MISSION_CONTROL_SNAPSHOT: 'getAdminMissionControlSnapshot',
    GET_ADMIN_MISSION_CONTROL_PERIOD: 'getAdminMissionControlPeriod',
} as const;
