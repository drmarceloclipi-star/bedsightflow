import React, { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { auth } from '../../infra/firebase/config';
import { useNavigate } from 'react-router-dom';
import { authorizedUsersRepository } from '../../repositories/authorizedUsersRepository';

const isLocalhost = window.location.hostname === 'localhost';

const LoginScreen: React.FC = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Handle redirect result after returning from Google sign-in
    useEffect(() => {
        if (!isLocalhost) return;
        setLoading(true);
        getRedirectResult(auth)
            .then(async (result) => {
                if (!result) { setLoading(false); return; }
                const user = result.user;
                if (user.email) {
                    const isAuthorized = await authorizedUsersRepository.isAuthorized(user.email);
                    const ADMIN_EMAILS = ['drmarceloclipi@gmail.com', 'admin@lean.com'];
                    if (isAuthorized) {
                        navigate(ADMIN_EMAILS.includes(user.email.toLowerCase()) ? '/admin' : '/mobile');
                    } else {
                        await signOut(auth);
                        setError('Acesso não autorizado. Entre em contato com o administrador.');
                    }
                }
            })
            .catch((err) => {
                console.error('Google redirect result error:', err);
            })
            .finally(() => setLoading(false));
    }, [navigate]);

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        const provider = new GoogleAuthProvider();

        try {
            if (isLocalhost) {
                // Use redirect on localhost to avoid COOP popup issues with the Auth emulator
                await signInWithRedirect(auth, provider);
                return; // page will reload; result handled in useEffect above
            }

            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            if (user.email) {
                const isAuthorized = await authorizedUsersRepository.isAuthorized(user.email);

                if (isAuthorized) {
                    const ADMIN_EMAILS = ['drmarceloclipi@gmail.com', 'admin@lean.com'];
                    if (ADMIN_EMAILS.includes(user.email.toLowerCase())) {
                        navigate('/admin');
                    } else {
                        navigate('/mobile');
                    }
                } else {
                    await signOut(auth);
                    setError('Acesso não autorizado. Entre em contato com o administrador.');
                }
            }
        } catch (err) {
            console.error('Google login error:', err);
            setError('Não foi possível entrar com o Google. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-watermark">LEAN</div>

            <div className="login-card">
                <div className="login-header">
                    <h1 className="login-title">Ward Board</h1>
                    <p className="login-subtitle">UNIDADE DE GESTÃO HOSPITALAR</p>
                </div>

                <div className="login-notice">
                    <strong>Acesso Exclusivo a Pessoas Autorizadas</strong>
                    <p>O acesso fica restrito apenas às pessoas que têm o cadastro previamente realizado pelo admin.</p>
                </div>

                <div className="login-actions">
                    {error && <div className="login-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

                    <button
                        type="button"
                        className="google-login-button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        style={{ marginTop: '0.5rem' }}
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.02.68-2.33 1.09-3.71 1.09-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 1.47 2.18 2.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>{loading ? 'Verificando...' : 'Entrar com Google'}</span>
                    </button>
                </div>

                <div className="login-footer" style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.25rem 0' }}>
                        Ward Board &copy; 2026
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                        Desenvolvido por Dr. Marcelo Hugo R. T. Cavalcanti
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
