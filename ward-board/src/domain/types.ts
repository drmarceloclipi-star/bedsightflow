import type { Timestamp } from 'firebase/firestore';

export type DischargeEstimate = '24h' | '2-3_days' | '>3_days' | 'later';

export const DischargeEstimateLabel: Record<DischargeEstimate, string> = {
    '24h': '< 24h',
    '2-3_days': '2-3 dias',
    '>3_days': '> 3 dias',
    'later': 'Indefinida',
};

export type KamishibaiStatus = 'ok' | 'blocked' | 'pending' | 'na';

export type SpecialtyKey =
    // Clínicas
    | 'cardio' | 'medical' | 'palliative' | 'gastro' | 'infecto' | 'nephro' | 'neuro' | 'pneumo' | 'psych' | 'endo' | 'intensive' | 'radio'
    // Cirúrgicas
    | 'head_neck' | 'bariatric' | 'cvs' | 'maxilo' | 'general_surgery' | 'vascular' | 'plastic' | 'thoracic' | 'obgyn' | 'urology' | 'digestive'
    // Outras existentes
    | 'nursing' | 'physio' | 'nutrition' | 'social' | 'psychology';

export const SpecialtyLabel: Record<SpecialtyKey, string> = {
    // Clínicas
    cardio: 'Cardiologia',
    medical: 'Clínica Médica',
    palliative: 'Cuidados Paliativos',
    gastro: 'Gastroenterologia',
    infecto: 'Infectologia',
    nephro: 'Nefrologia',
    neuro: 'Neurologia',
    pneumo: 'Pneumologia',
    psych: 'Psiquiatria',
    endo: 'Endocrinologia',
    intensive: 'Medicina Intensiva',
    radio: 'Radiologia',
    // Cirúrgicas
    head_neck: 'Cabeça e Pescoço',
    bariatric: 'Cirurgia Bariátrica',
    cvs: 'Cirurgia Cardiovascular',
    maxilo: 'Buco-maxilo',
    general_surgery: 'Cirurgia Geral',
    vascular: 'Cirurgia Vascular',
    plastic: 'Cirurgia Plástica',
    thoracic: 'Cirurgia Torácica',
    obgyn: 'Ginecologia e Obstetrícia',
    urology: 'Urologia',
    digestive: 'Aparelho Digestivo',
    // Outras
    nursing: 'Enfermagem',
    physio: 'Fisioterapia',
    nutrition: 'Nutrição',
    social: 'Serviço Social',
    psychology: 'Psicologia',
};

export interface KamishibaiEntry {
    status: KamishibaiStatus;
    updatedAt: string | Timestamp;
    updatedBy?: ActorRef;
    note?: string;
}

export interface ActorRef {
    id: string;
    name: string;
}

export interface Bed {
    id: string;
    unitId: string;
    number: string;         // Ex: 101-A
    patientAlias?: string;  // Nome social ou iniciais
    expectedDischarge: DischargeEstimate;
    mainBlocker: string;    // Bloqueador principal
    involvedSpecialties: SpecialtyKey[]; // Especialidades envolvidas no caso
    kamishibai: Record<SpecialtyKey, KamishibaiEntry>;
    lastUpdate: string | Timestamp; // ISO string or Firestore Timestamp
}

export interface Unit {
    id: string;
    name: string;
    totalBeds: number;
    specialties: SpecialtyKey[]; // Especialidades disponíveis na unidade
}

export type BoardScreenKey = 'kanban' | 'kamishibai' | 'summary';

export interface BoardScreenConfig {
    key: BoardScreenKey;
    label: string;
    durationSeconds: number;
    enabled: boolean;
}

export interface BoardSettings {
    unitId: string;
    rotationEnabled: boolean;
    screens: BoardScreenConfig[];
}

export interface SummaryMetrics {
    activePatients: number;
    discharges24h: number;
    withBlockers: number;
    pendingKamishibai: number;
}
