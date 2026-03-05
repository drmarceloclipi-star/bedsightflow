import type { EscalationType } from './escalation';

export type EscalationTicketStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'AUTO_RESOLVED';

export interface EscalationTicketActor {
    uid: string;
    name: string;
}

export interface EscalationTicket {
    id: string; // Document ID
    unitId: string;
    bedId: string;
    type: EscalationType;
    status: EscalationTicketStatus;

    // Trigger info
    triggeredAt: string; // ISO String
    triggeredBySystem: boolean;
    triggerDetails: string;

    // Debounce fields (stored as ISO strings; Timestamps on server side)
    pendingAutoResolveSince?: string;  // Set when condition clears; sweeper resolves after 15min
    clearedAt?: string;                // Audit: when condition first cleared
    lastCriticalAt?: string;           // Audit: last time condition was critical (detects flapping)
    lastEvaluatedAt?: string;          // Audit: last time trigger evaluated this bed
    cooldownUntil?: string;            // Prevents ticket storm: reopen window after AUTO_RESOLVED

    // Optional user interaction data
    acknowledgedAt?: string;
    acknowledgedBy?: EscalationTicketActor;

    resolvedAt?: string;
    resolvedBy?: EscalationTicketActor;
    resolutionNote?: string;

    // Metadata
    createdAt: string;
    updatedAt: string;
}

export function isTicketActive(ticket: EscalationTicket): boolean {
    return ticket.status === 'OPEN' || ticket.status === 'ACKNOWLEDGED';
}

export function isTicketResolved(ticket: EscalationTicket): boolean {
    return ticket.status === 'RESOLVED' || ticket.status === 'AUTO_RESOLVED';
}

