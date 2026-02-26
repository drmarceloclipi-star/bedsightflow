import type { SpecialtyKey } from './types';
import { SpecialtyLabel } from './types';

/**
 * Domínios usados exclusivamente no Quadro Kamishibai.
 *
 * REGRA CONCEITUAL FIXA:
 * - O Kamishibai representa o acompanhamento operacional por EQUIPE/DOMÍNIO.
 * - Todo o domínio médico é representado por UMA ÚNICA coluna: 'medical' (MÉDICA).
 * - Subespecialidades médicas (Cardiologia, Nefrologia, etc.) pertencem ao Kanban,
 *   e NÃO devem virar colunas separadas no Kamishibai.
 *
 * Ordem canônica: MÉDICA · ENFERMAGEM · FISIOTERAPIA · NUTRIÇÃO · PSICOLOGIA · SERVIÇO SOCIAL
 */
export const KAMISHIBAI_DOMAINS: SpecialtyKey[] = [
    'medical', 'nursing', 'physio', 'nutrition', 'psychology', 'social'
];

/**
 * Especialidades médicas/clínicas — aparecem no Kanban e na seleção do leito.
 */
export const CLINICAL_SPECIALTIES: SpecialtyKey[] = [
    'cardio', 'medical', 'palliative', 'gastro', 'infecto', 'nephro',
    'neuro', 'pneumo', 'psych', 'endo', 'intensive', 'radio'
];

/**
 * Especialidades cirúrgicas — aparecem no Kanban e na seleção do leito.
 */
export const SURGICAL_SPECIALTIES: SpecialtyKey[] = [
    'head_neck', 'bariatric', 'cvs', 'maxilo', 'general_surgery',
    'vascular', 'plastic', 'thoracic', 'obgyn', 'urology', 'digestive'
];

/**
 * Todas as especialidades médicas (clínicas + cirúrgicas).
 * Usadas no campo `involvedSpecialties` do leito.
 */
export const ALL_MEDICAL_SPECIALTIES: SpecialtyKey[] = [
    ...CLINICAL_SPECIALTIES,
    ...SURGICAL_SPECIALTIES,
];

/**
 * Retorna se uma especialidade é estritamente médica (Clínica ou Cirúrgica).
 */
export const isMedicalSpecialty = (s: SpecialtyKey): boolean => {
    return ALL_MEDICAL_SPECIALTIES.includes(s);
};

/**
 * Retorna as especialidades que devem ser exibidas no Kanban nesta fase do MVP.
 * Regra provisória: apenas "MÉDICA" (medical).
 */
export const getVisibleSpecialties = (involved: SpecialtyKey[]): SpecialtyKey[] => {
    return involved.filter(s => s === 'medical');
};

/**
 * Retorna a sigla canônica para exibição compacta na TV e no mobile.
 */
export const getShortSpecialty = (s: SpecialtyKey): string => {
    const map: Record<SpecialtyKey, string> = {
        // Clínicas
        cardio: 'CARD', medical: 'CM', palliative: 'CPAL', gastro: 'GAST',
        infecto: 'INF', nephro: 'NEF', neuro: 'NEU', pneumo: 'PNEU',
        psych: 'PSIQ', endo: 'ENDO', intensive: 'UTI', radio: 'RAD',
        // Cirúrgicas
        head_neck: 'CP', bariatric: 'BARI', cvs: 'CCV', maxilo: 'BMF',
        general_surgery: 'CG', vascular: 'VASC', plastic: 'PLAST',
        thoracic: 'TORAX', obgyn: 'GO', urology: 'URO',
        digestive: 'CAD',
        // Multiprofissional
        nursing: 'ENF', physio: 'FIS', nutrition: 'NUT', social: 'SS',
        psychology: 'PSIC',
    };
    return map[s] ?? s.substring(0, 4).toUpperCase();
};
/**
 * Retorna o rótulo canônico para o Quadro Kamishibai (em caixa alta).
 */
export const getKamishibaiLabel = (s: SpecialtyKey): string => {
    const map: Partial<Record<SpecialtyKey, string>> = {
        medical: 'MÉDICA',
        nursing: 'ENFERMAGEM',
        physio: 'FISIOTERAPIA',
        nutrition: 'NUTRIÇÃO',
        psychology: 'PSICOLOGIA',
        social: 'SERVIÇO SOCIAL',
    };
    return map[s] || (SpecialtyLabel[s] || s).toUpperCase();
};
