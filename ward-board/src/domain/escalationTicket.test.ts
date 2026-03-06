/**
 * escalationTicket.test.ts — Unit tests for EscalationTicket helpers
 */

import { describe, it, expect } from 'vitest';
import { isTicketActive, isTicketResolved } from './escalationTicket';
import type { EscalationTicket } from './escalationTicket';

function makeTicket(status: EscalationTicket['status']): EscalationTicket {
    return {
        id: 'ticket-1',
        unitId: 'unit-a',
        bedId: 'bed-1',
        type: 'MAIN_BLOCKER_CRITICAL',
        status,
        triggeredAt: '2026-03-01T00:00:00.000Z',
        triggeredBySystem: true,
        triggerDetails: 'Bed blocked for > 24h',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
    };
}

// ── isTicketActive ────────────────────────────────────────────────────────────

describe('isTicketActive', () => {
    it('returns true for OPEN status', () => {
        expect(isTicketActive(makeTicket('OPEN'))).toBe(true);
    });

    it('returns true for ACKNOWLEDGED status', () => {
        expect(isTicketActive(makeTicket('ACKNOWLEDGED'))).toBe(true);
    });

    it('returns false for RESOLVED status', () => {
        expect(isTicketActive(makeTicket('RESOLVED'))).toBe(false);
    });

    it('returns false for AUTO_RESOLVED status', () => {
        expect(isTicketActive(makeTicket('AUTO_RESOLVED'))).toBe(false);
    });
});

// ── isTicketResolved ──────────────────────────────────────────────────────────

describe('isTicketResolved', () => {
    it('returns true for RESOLVED status', () => {
        expect(isTicketResolved(makeTicket('RESOLVED'))).toBe(true);
    });

    it('returns true for AUTO_RESOLVED status', () => {
        expect(isTicketResolved(makeTicket('AUTO_RESOLVED'))).toBe(true);
    });

    it('returns false for OPEN status', () => {
        expect(isTicketResolved(makeTicket('OPEN'))).toBe(false);
    });

    it('returns false for ACKNOWLEDGED status', () => {
        expect(isTicketResolved(makeTicket('ACKNOWLEDGED'))).toBe(false);
    });
});

// ── isTicketActive and isTicketResolved are mutually exclusive ────────────────

describe('isTicketActive / isTicketResolved mutual exclusivity', () => {
    const statuses: EscalationTicket['status'][] = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'AUTO_RESOLVED'];

    it('no status is both active and resolved', () => {
        for (const status of statuses) {
            const ticket = makeTicket(status);
            const bothTrue = isTicketActive(ticket) && isTicketResolved(ticket);
            expect(bothTrue).toBe(false);
        }
    });

    it('every status is either active or resolved', () => {
        for (const status of statuses) {
            const ticket = makeTicket(status);
            const eitherTrue = isTicketActive(ticket) || isTicketResolved(ticket);
            expect(eitherTrue).toBe(true);
        }
    });
});
