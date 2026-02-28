/**
 * kamishibaiVisualState.ts
 *
 * Resolvedor canônico do estado visual Kamishibai.
 * Ref: LEAN_STATE_MACHINE_HRHDS §2, LEAN_CONTRACT_HRHDS §4, LEAN_SHIFTKEY_SPEC_HRHDS §6
 *
 * NUNCA armazene KamishibaiVisualState — é sempre derivado em runtime.
 */

import type { Bed, KamishibaiVisualState } from './types';
import type { SpecialtyKey } from './types';
import type { ShiftSchedule } from './shiftKey';
import { currentShiftKey, DEFAULT_SHIFT_SCHEDULE, DEFAULT_SHIFT_TZ } from './shiftKey';

// ── Opts ─────────────────────────────────────────────────────────────────────

export interface ResolveKamishibaiOpts {
    /**
     * Se o Kamishibai está habilitado como ferramenta na unidade.
     * Vem de UnitOpsSettings.kamishibaiEnabled.
     * Default: true (compat v0).
     */
    kamishibaiEnabled?: boolean;

    /**
     * shiftKey do turno atual ("YYYY-MM-DD-AM" | "YYYY-MM-DD-PM").
     * Se omitido, calculado internamente via currentShiftKey().
     * Passe explicitamente quando quiser o mesmo valor para todo o render de uma tela.
     */
    resolvedCurrentShiftKey?: string;

    /**
     * Configuração de horários de turno.
     * Usado se resolvedCurrentShiftKey não for passado.
     * Default: { amStart: '07:00', pmStart: '19:00' }.
     */
    schedule?: ShiftSchedule;

    /**
     * Timezone para cálculo do shiftKey.
     * Default: 'America/Sao_Paulo'.
     */
    tz?: string;
}

// ── isDomainApplicable ────────────────────────────────────────────────────────

/**
 * Verifica se um domínio Kamishibai se aplica ao paciente do leito.
 * Variante A: `applicableDomains[]` no bed.
 * Se ausente, todos os domínios são aplicáveis.
 * Ref: LEAN_MIGRATION_MAP §3 Variante A
 */
export function isDomainApplicable(bed: Bed, domain: SpecialtyKey): boolean {
    if (!bed.applicableDomains || bed.applicableDomains.length === 0) {
        return true; // campo ausente → todos aplicáveis (compat v0)
    }
    return bed.applicableDomains.includes(domain);
}

// ── resolveKamishibaiVisualState ──────────────────────────────────────────────

/**
 * Resolve o estado visual de um domínio Kamishibai para um leito.
 *
 * Sequência de precedência canônica (6 regras, em ordem):
 *  1. Leito vazio (patientAlias ausente ou vazio) → INACTIVE
 *  2. kamishibaiEnabled === false → INACTIVE
 *  3. Domínio não aplicável (fora de applicableDomains) → NOT_APPLICABLE
 *  4. status === 'blocked' → BLOCKED (imune a TTL, persiste entre turnos)
 *  5. reviewedShiftKey !== currentShiftKey → UNREVIEWED_THIS_SHIFT
 *  6. status === 'ok' revisado no turno → OK
 *
 * Compatibilidade v0:
 *  - status legado 'na' segue regras 1→3 e depois cai em UNREVIEWED_THIS_SHIFT
 *  - entry ausente + domínio aplicável → UNREVIEWED_THIS_SHIFT
 *  - entry ausente + domínio não aplicável → NOT_APPLICABLE (via regra 3)
 *  - reviewedShiftKey ausente → UNREVIEWED_THIS_SHIFT (regra 5)
 */
export function resolveKamishibaiVisualState(
    bed: Bed,
    domain: SpecialtyKey,
    opts: ResolveKamishibaiOpts = {}
): KamishibaiVisualState {
    const {
        kamishibaiEnabled = true,
        schedule = DEFAULT_SHIFT_SCHEDULE,
        tz = DEFAULT_SHIFT_TZ,
    } = opts;

    // ─── Regra 1: Leito vazio ────────────────────────────────────────────────
    const alias = bed.patientAlias?.trim() ?? '';
    if (alias === '') return 'INACTIVE';

    // ─── Regra 2: Kamishibai desabilitado ────────────────────────────────────
    if (kamishibaiEnabled === false) return 'INACTIVE';

    // ─── Regra 3: Domínio não aplicável ─────────────────────────────────────
    if (!isDomainApplicable(bed, domain)) return 'NOT_APPLICABLE';

    const entry = bed.kamishibai?.[domain];

    // ─── entry ausente (domínio aplicável mas sem dados) ─────────────────────
    // Conservador: se não há entry para domínio aplicável → UNREVIEWED
    if (!entry) return 'UNREVIEWED_THIS_SHIFT';

    // ─── Regra 4: Bloqueado ──────────────────────────────────────────────────
    // status 'blocked' persiste entre turnos (não sofre TTL)
    if (entry.status === 'blocked') return 'BLOCKED';

    // ─── Compatibilidade v0: status 'na' em leito ativo + domínio aplicável ─
    // Tratamento conservador: equivale a UNREVIEWED_THIS_SHIFT
    if (entry.status === 'na') return 'UNREVIEWED_THIS_SHIFT';

    // ─── Regra 5: TTL do verde ────────────────────────────────────────────────
    // Computar apenas quando necessário (status === 'ok')
    if (entry.status === 'ok') {
        if (!entry.reviewedShiftKey) {
            // Sem carimbo de turno → verde v0 legado → conservador: UNREVIEWED
            return 'UNREVIEWED_THIS_SHIFT';
        }

        const shiftKey = opts.resolvedCurrentShiftKey ?? currentShiftKey(schedule, tz);
        if (entry.reviewedShiftKey !== shiftKey) {
            // Verde do turno anterior → UNREVIEWED_THIS_SHIFT
            return 'UNREVIEWED_THIS_SHIFT';
        }

        // ─── Regra 6: OK válido ───────────────────────────────────────────────
        return 'OK';
    }

    // Fallback para qualquer status não reconhecido (defensivo)
    return 'UNREVIEWED_THIS_SHIFT';
}

// ── Helpers de display ────────────────────────────────────────────────────────

/**
 * Mapeia KamishibaiVisualState para a classe CSS v1 do dot.
 */
export function visualStateToCssClass(state: KamishibaiVisualState): string {
    switch (state) {
        case 'OK': return 'kamishibai-dot--ok';
        case 'BLOCKED': return 'kamishibai-dot--blocked';
        case 'NOT_APPLICABLE': return 'kamishibai-placeholder--na';
        case 'INACTIVE': return 'kamishibai-empty';
        case 'UNREVIEWED_THIS_SHIFT': return 'kamishibai-empty';
    }
}

/**
 * Retorna o label human-readable do estado visual (para aria-label e tooltips).
 */
export function visualStateLabel(state: KamishibaiVisualState): string {
    switch (state) {
        case 'OK': return 'OK — revisado neste turno';
        case 'BLOCKED': return 'Impedido';
        case 'NOT_APPLICABLE': return 'N/A — não se aplica';
        case 'INACTIVE': return 'Leito vazio ou Kamishibai inativo';
        case 'UNREVIEWED_THIS_SHIFT': return 'Não revisado neste turno';
    }
}
