/**
 * EduContentRepository
 *
 * Lê o conteúdo educativo de `units/{unitId}/edu_content/`.
 * Estrutura Firestore:
 *   units/{unitId}/edu_content/playbooks   → { items: Playbook[] }
 *   units/{unitId}/edu_content/microlessons → { items: Microlesson[] }
 *
 * Se o documento não existir (unidade sem conteúdo customizado),
 * retorna null — o chamador faz fallback para o conteúdo estático.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../infra/firebase/config';
import type { Playbook, Microlesson } from '../features/education/data/eduContent';

export interface EduContentSnapshot {
    playbooks: Playbook[] | null;
    microlessons: Microlesson[] | null;
}

export const EduContentRepository = {
    async fetchEduContent(unitId: string): Promise<EduContentSnapshot> {
        const baseRef = (docId: string) =>
            doc(db, 'units', unitId, 'edu_content', docId);

        const [pbSnap, mlSnap] = await Promise.all([
            getDoc(baseRef('playbooks')),
            getDoc(baseRef('microlessons')),
        ]);

        return {
            playbooks: pbSnap.exists()
                ? ((pbSnap.data() as { items: Playbook[] }).items ?? null)
                : null,
            microlessons: mlSnap.exists()
                ? ((mlSnap.data() as { items: Microlesson[] }).items ?? null)
                : null,
        };
    },
};
