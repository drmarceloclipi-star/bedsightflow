import React, { useRef, useEffect } from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    title: string;
    description: string;
    consequences?: string[];
    confirmLabel?: string;
    isDangerous?: boolean;
    /** If provided, user must type this exactly to unlock confirm */
    requireTyping?: string;
}

/**
 * Inner component — mounted fresh every time the modal opens (via `key={isOpen}`).
 * This avoids all stale-state issues without calling setState in effects.
 */
const ModalContent: React.FC<ConfirmModalProps & { onClose: () => void }> = ({
    onClose,
    onConfirm,
    title,
    description,
    consequences = [],
    confirmLabel = 'Confirmar',
    isDangerous = false,
    requireTyping,
}) => {
    const [reason, setReason] = React.useState('');
    const [typed, setTyped] = React.useState('');
    const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    // Focus first input on mount
    useEffect(() => {
        const id = setTimeout(() => firstInputRef.current?.focus(), 50);
        return () => clearTimeout(id);
    }, []);

    // Close on Escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const typingOk = !requireTyping || typed === requireTyping;
    const canConfirm = reason.trim().length >= 5 && typingOk;

    return (
        <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="modal-panel">
                {/* Header */}
                <div className={`modal-header ${isDangerous ? 'modal-header--danger' : ''}`}>
                    <span aria-hidden="true" className="modal-header-icon">
                        {isDangerous ? '⚠️' : 'ℹ️'}
                    </span>
                    <h2 id="confirm-modal-title" className="modal-title">{title}</h2>
                </div>

                {/* Body */}
                <div className="modal-body">
                    <p className="modal-description">{description}</p>

                    {consequences.length > 0 && (
                        <ul className="modal-consequences">
                            {consequences.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                    )}

                    {requireTyping && (
                        <div className="modal-field">
                            <label htmlFor="modal-typing" className="modal-label">
                                Digite <strong>{requireTyping}</strong> para confirmar:
                            </label>
                            <input
                                id="modal-typing"
                                type="text"
                                value={typed}
                                onChange={e => setTyped(e.target.value.toUpperCase())}
                                placeholder={requireTyping}
                                className={`modal-input${typed === requireTyping ? ' modal-input--valid' : ''}`}
                                ref={firstInputRef as React.RefObject<HTMLInputElement>}
                                autoComplete="off"
                            />
                        </div>
                    )}

                    <div className="modal-field">
                        <label htmlFor="modal-reason" className="modal-label">
                            Motivo{' '}
                            <span className="modal-label-hint">(obrigatório para auditoria, mín. 5 caracteres)</span>
                        </label>
                        <textarea
                            id="modal-reason"
                            rows={3}
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Descreva o motivo desta ação..."
                            className="modal-textarea"
                            ref={requireTyping ? undefined : firstInputRef as React.RefObject<HTMLTextAreaElement>}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <button type="button" onClick={onClose} className="btn btn-outline modal-btn-cancel">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => canConfirm && onConfirm(reason.trim())}
                        disabled={!canConfirm}
                        className={`btn ${isDangerous ? 'btn-danger' : 'btn-primary'}${!canConfirm ? ' btn-disabled' : ''} modal-btn-confirm`}
                        aria-disabled={!canConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Public wrapper — only mounts the inner content when `isOpen` is true,
 * ensuring React remounts the inner component on each open (clean state).
 */
const ConfirmModal: React.FC<ConfirmModalProps> = (props) => {
    if (!props.isOpen) return null;
    return <ModalContent {...props} />;
};

export default ConfirmModal;
