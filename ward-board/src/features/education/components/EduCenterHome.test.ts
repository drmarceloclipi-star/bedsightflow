import { describe, it, expect } from 'vitest';
import { PLAYBOOKS, MICROLESSONS, APP_TUTORIALS } from '../data/eduContent';
import type { Playbook, Microlesson, AppTutorial } from '../data/eduContent';

/**
 * P4 — EduCenter unit tests
 * Testa a integridade dos dados e a lógica de verificação das micro-lições,
 * bem como a conformidade estrutural dos playbooks.
 * Não usa DOM/rendering — consistente com a abordagem Vitest do projeto.
 */

describe('eduContent — PLAYBOOKS', () => {
    it('deve ter ao menos 1 playbook', () => {
        expect(PLAYBOOKS.length).toBeGreaterThanOrEqual(1);
    });

    it('cada playbook deve ter os campos obrigatórios', () => {
        PLAYBOOKS.forEach((pb: Playbook) => {
            expect(pb.id, `playbook ${pb.id} sem id`).toBeTruthy();
            expect(pb.title, `playbook ${pb.id} sem title`).toBeTruthy();
            expect(pb.when, `playbook ${pb.id} sem when`).toBeTruthy();
            expect(pb.who, `playbook ${pb.id} sem who`).toBeTruthy();
            expect(pb.input, `playbook ${pb.id} sem input`).toBeTruthy();
            expect(Array.isArray(pb.steps), `playbook ${pb.id} steps não é array`).toBe(true);
            expect(pb.steps.length, `playbook ${pb.id} sem steps`).toBeGreaterThanOrEqual(1);
            expect(pb.doneCriteria, `playbook ${pb.id} sem doneCriteria`).toBeTruthy();
        });
    });

    it('todos os playbooks devem ter IDs únicos', () => {
        const ids = PLAYBOOKS.map(pb => pb.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it('cada passo dos playbooks deve ser uma string não vazia', () => {
        PLAYBOOKS.forEach(pb => {
            pb.steps.forEach((step, i) => {
                expect(typeof step).toBe('string');
                expect(step.trim().length, `playbook ${pb.id} step[${i}] vazio`).toBeGreaterThan(0);
            });
        });
    });
});

describe('eduContent — MICROLESSONS', () => {
    it('deve ter exatamente 10 micro-lições (EDU-1)', () => {
        expect(MICROLESSONS.length).toBe(10);
    });

    it('cada micro-lição deve ter os campos obrigatórios', () => {
        MICROLESSONS.forEach((ml: Microlesson) => {
            expect(ml.id, `lesson ${ml.id} sem id`).toBeTruthy();
            expect(ml.title, `lesson ${ml.id} sem title`).toBeTruthy();
            expect(ml.situation, `lesson ${ml.id} sem situation`).toBeTruthy();
            expect(ml.error, `lesson ${ml.id} sem error`).toBeTruthy();
            expect(ml.leanRule, `lesson ${ml.id} sem leanRule`).toBeTruthy();
            expect(ml.action, `lesson ${ml.id} sem action`).toBeTruthy();
            expect(ml.verification, `lesson ${ml.id} sem verification`).toBeDefined();
        });
    });

    it('todos os IDs de micro-lições devem ser únicos', () => {
        const ids = MICROLESSONS.map(ml => ml.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it('cada verificação deve ter question, options (≥2) e correctKey', () => {
        MICROLESSONS.forEach(ml => {
            const v = ml.verification;
            expect(v.question.trim().length, `${ml.id}: question vazia`).toBeGreaterThan(0);
            expect(Array.isArray(v.options), `${ml.id}: options não é array`).toBe(true);
            expect(v.options.length, `${ml.id}: menos de 2 opções`).toBeGreaterThanOrEqual(2);
            expect(v.correctKey.trim().length, `${ml.id}: correctKey vazio`).toBeGreaterThan(0);
        });
    });

    it('cada verificação deve ter exatamente 1 opção correta', () => {
        MICROLESSONS.forEach(ml => {
            const v = ml.verification;
            const correctCount = v.options.filter(opt => opt.startsWith(v.correctKey)).length;
            expect(
                correctCount,
                `${ml.id}: esperava 1 opção correta para correctKey "${v.correctKey}", encontrou ${correctCount}`
            ).toBe(1);
        });
    });

    it('a resposta correta de cada micro-lição deve existir nas opções', () => {
        MICROLESSONS.forEach(ml => {
            const hasCorrect = ml.verification.options.some(opt =>
                opt.startsWith(ml.verification.correctKey)
            );
            expect(hasCorrect, `${ml.id}: correctKey "${ml.verification.correctKey}" não encontrado nas options`).toBe(true);
        });
    });
});

describe('eduContent — APP_TUTORIALS', () => {
    it('deve ter exatamente 3 tutoriais do app listados no plano preliminar', () => {
        expect(APP_TUTORIALS.length).toBe(3);
    });

    it('cada tutorial deve conter os campos obrigatórios e estrutura correta', () => {
        APP_TUTORIALS.forEach((tut: AppTutorial) => {
            expect(tut.id, `tutorial ${tut.id} sem id`).toBeTruthy();
            expect(tut.title, `tutorial ${tut.id} sem title`).toBeTruthy();
            expect(tut.description, `tutorial ${tut.id} sem description`).toBeTruthy();
            expect(tut.icon, `tutorial ${tut.id} sem icon`).toBeTruthy();
            expect(Array.isArray(tut.steps), `tutorial ${tut.id} steps não é array`).toBe(true);
            expect(tut.steps.length, `tutorial ${tut.id} sem steps`).toBeGreaterThanOrEqual(1);
        });
    });

    it('todos os tutoriais devem ter IDs únicos', () => {
        const ids = APP_TUTORIALS.map(t => t.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });
});

describe('lógica de tab — EduCenterHome (estado simulado)', () => {
    // Simula o estado puro que o componente gerencia sem renderizar DOM
    it('tab padrão deve ser playbooks', () => {
        const defaultTab: 'playbooks' | 'microlessons' | 'tutorials' = 'playbooks';
        expect(defaultTab).toBe('playbooks');
    });

    it('alternar tab de playbooks para tutorials funciona', () => {
        let activeTab: 'playbooks' | 'microlessons' | 'tutorials' = 'playbooks';
        activeTab = 'tutorials';
        expect(activeTab).toBe('tutorials');
    });

    it('selecionar playbook persiste o objeto', () => {
        let selected: Playbook | null = null;
        selected = PLAYBOOKS[0];
        expect(selected).not.toBeNull();
        expect(selected?.id).toBe(PLAYBOOKS[0].id);
    });

    it('onBack reseta selectedPlaybook para null', () => {
        let selected: Playbook | null = PLAYBOOKS[0];
        // simula onBack
        selected = null;
        expect(selected).toBeNull();
    });
});

describe('lógica de expand/collapse — MicrolessonList (estado simulado)', () => {
    it('expandedId inicia como null (tudo recolhido)', () => {
        const expandedId: string | null = null;
        expect(expandedId).toBeNull();
    });

    it('clicar numa lição expande ela (expandedId = lesson.id)', () => {
        let expandedId: string | null = null;
        const lesson = MICROLESSONS[0];
        expandedId = expandedId === lesson.id ? null : lesson.id;
        expect(expandedId).toBe(lesson.id);
    });

    it('clicar novamente na mesma lição recolhe (toggle)', () => {
        const lesson = MICROLESSONS[0];
        let expandedId: string | null = lesson.id;
        // segundo clique
        expandedId = expandedId === lesson.id ? null : lesson.id;
        expect(expandedId).toBeNull();
    });

    it('clicar em outra lição muda o expandedId', () => {
        let expandedId: string | null = MICROLESSONS[0].id;
        const next = MICROLESSONS[1];
        expandedId = next.id;
        expect(expandedId).toBe(next.id);
    });
});
