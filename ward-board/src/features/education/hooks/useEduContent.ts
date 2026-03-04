/**
 * useEduContent
 *
 * Hook para carregar o conteúdo educativo de uma unidade.
 *
 * Estratégia:
 *   1. Inicia imediatamente com conteúdo estático (sem loading perceptível).
 *   2. Se unitId fornecido, tenta buscar conteúdo customizado do Firestore.
 *   3. Em erro ou documento ausente → mantém o conteúdo estático silenciosamente.
 *
 * Retrocompatível: hospitais sem conteúdo no Firestore funcionam imediatamente.
 */

import { useState, useEffect } from 'react';
import { PLAYBOOKS, MICROLESSONS, APP_TUTORIALS } from '../data/eduContent';
import type { Playbook, Microlesson, AppTutorial } from '../data/eduContent';
import { EduContentRepository } from '../../../repositories/EduContentRepository';

interface UseEduContentResult {
    playbooks: Playbook[];
    microlessons: Microlesson[];
    tutorials: AppTutorial[];
    loading: boolean;
    error: string | null;
    /** true se o conteúdo veio do Firestore, false se veio do fallback estático */
    fromFirestore: boolean;
}

export function useEduContent(unitId?: string): UseEduContentResult {
    // Inicia com conteúdo estático — sem flash de loading para a rota global
    const [playbooks, setPlaybooks] = useState<Playbook[]>(PLAYBOOKS);
    const [microlessons, setMicrolessons] = useState<Microlesson[]>(MICROLESSONS);
    const [tutorials] = useState<AppTutorial[]>(APP_TUTORIALS); // Estático por enquanto
    const [loading, setLoading] = useState<boolean>(!!unitId);
    const [error, setError] = useState<string | null>(null);
    const [fromFirestore, setFromFirestore] = useState<boolean>(false);

    // Sync loading state when unitId changes manually if needed, 
    // though the effect and initial value usually handle it.
    const [prevUnitId, setPrevUnitId] = useState(unitId);
    if (unitId !== prevUnitId) {
        setPrevUnitId(unitId);
        setLoading(true);
        setError(null);
    }

    useEffect(() => {
        // Sem unitId → conteúdo estático já no estado inicial, nada a fazer
        if (!unitId) return;

        let cancelled = false;
        // set-state-in-effect handled via render-sync pattern above

        EduContentRepository.fetchEduContent(unitId)
            .then((snapshot) => {
                if (cancelled) return;
                setPlaybooks(snapshot.playbooks ?? PLAYBOOKS);
                setMicrolessons(snapshot.microlessons ?? MICROLESSONS);
                setFromFirestore(
                    snapshot.playbooks !== null || snapshot.microlessons !== null
                );
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('[useEduContent] Firestore error — using static fallback:', err);
                // Não reseta state — já está no fallback estático desde o início
                setError('Conteúdo offline: usando versão padrão.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [unitId]);

    return { playbooks, microlessons, tutorials, loading, error, fromFirestore };
}
