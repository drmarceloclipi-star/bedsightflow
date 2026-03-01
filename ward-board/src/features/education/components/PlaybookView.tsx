import React from 'react';
import { BookOpen, CheckCircle, Info } from 'lucide-react';
import type { Playbook } from '../data/eduContent';

interface Props {
    playbook: Playbook;
    onBack: () => void;
}

export const PlaybookView: React.FC<Props> = ({ playbook, onBack }) => {
    return (
        <div className="edu-playbook-view">
            <header className="edu-playbook-view__header">
                <button
                    onClick={onBack}
                    className="edu-playbook-view__back-btn"
                    aria-label="Voltar para lista de playbooks"
                    data-testid="back-btn"
                >
                    <BookOpen size={20} />
                </button>
                <h2 className="edu-playbook-view__header-label">Playbook</h2>
            </header>

            <div className="edu-playbook-view__body">
                <div>
                    <h1 className="edu-playbook-view__title">{playbook.title}</h1>
                    <div className="edu-playbook-view__meta">
                        <span className="edu-playbook-view__meta-chip">
                            <strong>Quando:</strong>&nbsp;{playbook.when}
                        </span>
                        <span className="edu-playbook-view__meta-chip">
                            <strong>Quem:</strong>&nbsp;{playbook.who}
                        </span>
                    </div>
                </div>

                <div className="edu-info-box">
                    <Info size={20} className="edu-info-box__icon" />
                    <div>
                        <h3 className="edu-info-box__title">Gatilho (Input)</h3>
                        <p className="edu-info-box__text">{playbook.input}</p>
                    </div>
                </div>

                <div>
                    <h3 className="edu-steps__title">Passo a Passo</h3>
                    <div className="edu-steps__list">
                        {playbook.steps.map((step, idx) => (
                            <div key={idx} className="edu-step">
                                <div className="edu-step__number">{idx + 1}</div>
                                <p className="edu-step__text">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="edu-done-box">
                    <CheckCircle size={20} className="edu-done-box__icon" />
                    <div>
                        <h3 className="edu-done-box__title">Done Criteria (Sucesso)</h3>
                        <p className="edu-done-box__text">{playbook.doneCriteria}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
