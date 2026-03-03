/**
 * specialtyUtils.test.ts — Unit tests for specialty utility functions and constants
 */

import { describe, it, expect } from 'vitest';
import {
    KAMISHIBAI_DOMAINS,
    CLINICAL_SPECIALTIES,
    SURGICAL_SPECIALTIES,
    ALL_MEDICAL_SPECIALTIES,
    isMedicalSpecialty,
    getVisibleSpecialties,
    getShortSpecialty,
    getKamishibaiLabel,
} from './specialtyUtils';

// ── Constants ─────────────────────────────────────────────────────────────────

describe('KAMISHIBAI_DOMAINS', () => {
    it('contains exactly 6 entries in canonical order', () => {
        expect(KAMISHIBAI_DOMAINS).toEqual([
            'medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social',
        ]);
    });
});

describe('ALL_MEDICAL_SPECIALTIES', () => {
    it('includes all clinical specialties', () => {
        for (const s of CLINICAL_SPECIALTIES) {
            expect(ALL_MEDICAL_SPECIALTIES).toContain(s);
        }
    });

    it('includes all surgical specialties', () => {
        for (const s of SURGICAL_SPECIALTIES) {
            expect(ALL_MEDICAL_SPECIALTIES).toContain(s);
        }
    });

    it('does not include multiprofessional domains', () => {
        expect(ALL_MEDICAL_SPECIALTIES).not.toContain('nursing');
        expect(ALL_MEDICAL_SPECIALTIES).not.toContain('physio');
        expect(ALL_MEDICAL_SPECIALTIES).not.toContain('nutrition');
        expect(ALL_MEDICAL_SPECIALTIES).not.toContain('social');
        expect(ALL_MEDICAL_SPECIALTIES).not.toContain('psychology');
    });
});

// ── isMedicalSpecialty ────────────────────────────────────────────────────────

describe('isMedicalSpecialty', () => {
    it('returns true for clinical specialties', () => {
        expect(isMedicalSpecialty('medical')).toBe(true);
        expect(isMedicalSpecialty('cardio')).toBe(true);
        expect(isMedicalSpecialty('nephro')).toBe(true);
        expect(isMedicalSpecialty('intensive')).toBe(true);
    });

    it('returns true for surgical specialties', () => {
        expect(isMedicalSpecialty('general_surgery')).toBe(true);
        expect(isMedicalSpecialty('obgyn')).toBe(true);
        expect(isMedicalSpecialty('urology')).toBe(true);
    });

    it('returns false for multiprofessional domains', () => {
        expect(isMedicalSpecialty('nursing')).toBe(false);
        expect(isMedicalSpecialty('physio')).toBe(false);
        expect(isMedicalSpecialty('nutrition')).toBe(false);
        expect(isMedicalSpecialty('psychology')).toBe(false);
        expect(isMedicalSpecialty('social')).toBe(false);
    });
});

// ── getVisibleSpecialties ─────────────────────────────────────────────────────

describe('getVisibleSpecialties', () => {
    it('returns only medical specialties from the input list', () => {
        const result = getVisibleSpecialties(['medical', 'nursing', 'cardio', 'physio']);
        expect(result).toEqual(['medical', 'cardio']);
    });

    it('returns empty array when no medical specialties are present', () => {
        const result = getVisibleSpecialties(['nursing', 'physio', 'social']);
        expect(result).toEqual([]);
    });

    it('returns all items when all are medical specialties', () => {
        const result = getVisibleSpecialties(['medical', 'cardio', 'nephro']);
        expect(result).toEqual(['medical', 'cardio', 'nephro']);
    });

    it('returns empty array for empty input', () => {
        expect(getVisibleSpecialties([])).toEqual([]);
    });
});

// ── getShortSpecialty ─────────────────────────────────────────────────────────

describe('getShortSpecialty', () => {
    it('returns correct abbreviations for clinical specialties', () => {
        expect(getShortSpecialty('medical')).toBe('CM');
        expect(getShortSpecialty('cardio')).toBe('CARD');
        expect(getShortSpecialty('nephro')).toBe('NEF');
        expect(getShortSpecialty('neuro')).toBe('NEU');
        expect(getShortSpecialty('intensive')).toBe('UTI');
    });

    it('returns correct abbreviations for surgical specialties', () => {
        expect(getShortSpecialty('general_surgery')).toBe('CG');
        expect(getShortSpecialty('obgyn')).toBe('GO');
        expect(getShortSpecialty('urology')).toBe('URO');
        expect(getShortSpecialty('bariatric')).toBe('BARI');
    });

    it('returns correct abbreviations for multiprofessional domains', () => {
        expect(getShortSpecialty('nursing')).toBe('ENF');
        expect(getShortSpecialty('physio')).toBe('FIS');
        expect(getShortSpecialty('nutrition')).toBe('NUT');
        expect(getShortSpecialty('psychology')).toBe('PSIC');
        expect(getShortSpecialty('social')).toBe('SS');
    });
});

// ── getKamishibaiLabel ────────────────────────────────────────────────────────

describe('getKamishibaiLabel', () => {
    it('returns uppercase canonical labels for kamishibai domains', () => {
        expect(getKamishibaiLabel('medical')).toBe('MÉDICA');
        expect(getKamishibaiLabel('nursing')).toBe('ENFERMAGEM');
        expect(getKamishibaiLabel('physio')).toBe('FISIOTERAPIA');
        expect(getKamishibaiLabel('nutrition')).toBe('NUTRIÇÃO');
        expect(getKamishibaiLabel('psychology')).toBe('PSICOLOGIA');
        expect(getKamishibaiLabel('social')).toBe('SERVIÇO SOCIAL');
    });

    it('falls back to SpecialtyLabel uppercased for non-kamishibai specialties', () => {
        // 'cardio' is not in the kamishibai map — should fall back to label uppercased
        const label = getKamishibaiLabel('cardio');
        expect(typeof label).toBe('string');
        expect(label).toBe(label.toUpperCase());
        expect(label.length).toBeGreaterThan(0);
    });
});
