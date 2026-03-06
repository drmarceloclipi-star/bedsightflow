/**
 * PushNotificationToggle.tsx
 *
 * P2-04 — Toggle de ativação/desativação de push notifications no painel admin.
 *
 * Fluxo:
 *  1. Componente verifica se FCM é suportado e o estado atual de inscrição.
 *  2. Usuário clica "Ativar" → requestAndRegisterToken() → FcmTokenRepository.addToken()
 *  3. Usuário clica "Desativar" → revokeCurrentToken() → FcmTokenRepository.deactivate()
 *
 * NOTA: Requer VITE_FCM_VAPID_KEY configurado no .env.
 * Sem a VAPID key, getToken() falha e o componente exibe mensagem de erro.
 */

import React, { useState, useEffect } from 'react';
import {
    isFcmSupported,
    currentPermissionState,
    requestAndRegisterToken,
    revokeCurrentToken,
} from '../../../../infra/firebase/messaging';
import { FcmTokenRepository } from '../../../../repositories/FcmTokenRepository';

interface Props {
    unitId: string;
    uid: string;
}

type ToggleStatus =
    | 'loading'       // Verificando suporte/estado inicial
    | 'unsupported'   // FCM não suportado neste browser/contexto
    | 'active'        // Inscrito e ativo
    | 'inactive'      // Não inscrito (permissão não solicitada ainda)
    | 'denied'        // Permissão negada pelo browser
    | 'error';        // Erro genérico

const PushNotificationToggle: React.FC<Props> = ({ unitId, uid }) => {
    const [status, setStatus] = useState<ToggleStatus>('loading');
    const [currentToken, setCurrentToken] = useState<string | null>(null);
    const [working, setWorking] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Inicialização: verificar suporte e estado atual
    useEffect(() => {
        let cancelled = false;

        async function init() {
            const supported = await isFcmSupported();
            if (cancelled) return;

            if (!supported) {
                setStatus('unsupported');
                return;
            }

            const perm = currentPermissionState();
            if (perm === 'denied') {
                setStatus('denied');
                return;
            }

            // Verificar se já está inscrito no Firestore
            const isActive = await FcmTokenRepository.isActiveSubscriber(unitId, uid);
            if (cancelled) return;

            setStatus(isActive ? 'active' : 'inactive');
        }

        init().catch(() => setStatus('error'));
        return () => { cancelled = true; };
    }, [unitId, uid]);

    const handleActivate = async () => {
        setWorking(true);
        setErrorMsg(null);
        try {
            const result = await requestAndRegisterToken();

            if (result.permission === 'denied') {
                setStatus('denied');
                return;
            }
            if (result.permission === 'unsupported') {
                setStatus('unsupported');
                return;
            }
            if (!result.token || result.error) {
                setErrorMsg(result.error ?? 'Falha ao obter token FCM.');
                setStatus('error');
                return;
            }

            await FcmTokenRepository.addToken(unitId, uid, result.token);
            setCurrentToken(result.token);
            setStatus('active');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(msg);
            setStatus('error');
        } finally {
            setWorking(false);
        }
    };

    const handleDeactivate = async () => {
        setWorking(true);
        setErrorMsg(null);
        try {
            // Revogar token no browser
            await revokeCurrentToken();

            // Desativar inscrição no Firestore
            if (currentToken) {
                await FcmTokenRepository.removeToken(unitId, uid, currentToken);
            } else {
                await FcmTokenRepository.deactivate(unitId, uid);
            }

            setCurrentToken(null);
            setStatus('inactive');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(msg);
        } finally {
            setWorking(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    if (status === 'loading') {
        return <div className="skeleton h-10 w-full rounded-lg" />;
    }

    if (status === 'unsupported') {
        return (
            <div className="text-xs text-muted p-3 bg-surface-2 border rounded-md">
                Push notifications não são suportadas neste browser ou contexto (HTTPS obrigatório).
            </div>
        );
    }

    if (status === 'denied') {
        return (
            <div className="text-xs text-warning-700 p-3 bg-warning-50 border border-warning-200 rounded-md">
                Permissão de notificação bloqueada pelo browser. Para ativar, acesse as configurações do site e permita notificações.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            status === 'active'
                                ? 'bg-success-100 text-success-800 border-success-200'
                                : 'bg-surface-3 text-muted border-border'
                        }`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-success-600' : 'bg-muted'}`}
                            aria-hidden="true"
                        />
                        {status === 'active' ? 'Notificações ativas' : 'Notificações desativadas'}
                    </span>
                </div>

                {status === 'active' ? (
                    <button
                        className="btn btn-secondary text-xs py-1.5 px-3 h-auto min-h-0"
                        disabled={working}
                        onClick={handleDeactivate}
                    >
                        {working ? 'Desativando...' : 'Desativar'}
                    </button>
                ) : (
                    <button
                        className="btn btn-primary text-xs py-1.5 px-3 h-auto min-h-0"
                        disabled={working}
                        onClick={handleActivate}
                    >
                        {working ? 'Ativando...' : 'Ativar notificações'}
                    </button>
                )}
            </div>

            {(status === 'error' || errorMsg) && (
                <p className="text-xs text-danger mt-1">
                    {errorMsg ?? 'Erro desconhecido.'}
                    {!errorMsg?.includes('VAPID') && (
                        <span className="block text-muted mt-0.5">
                            Verifique se VITE_FCM_VAPID_KEY está configurado no .env.
                        </span>
                    )}
                </p>
            )}
        </div>
    );
};

export default PushNotificationToggle;
