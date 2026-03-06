export type AuditActorRole = 'super_admin' | 'global_admin' | 'admin' | 'editor'

export type AuditEntityType =
    | 'bed'
    | 'board_settings'
    | 'unit_user'
    | 'unit'
    | 'system'

export type AuditAppArea = 'mobile' | 'tv' | 'admin' | 'system'

export type AuditLog = {
    id: string
    unitId: string

    actor: {
        uid: string
        email: string
        displayName?: string
        role: AuditActorRole
    }

    action: string
    entityType: AuditEntityType
    entityId: string
    targetPath: string

    source: {
        appArea: AuditAppArea
        screen?: string
        feature?: string
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    before?: Record<string, any> | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    after?: Record<string, any> | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    diff?: Record<string, { before: any; after: any }> | null

    reason?: string | null
    correlationId?: string | null

    createdAt: unknown
}
