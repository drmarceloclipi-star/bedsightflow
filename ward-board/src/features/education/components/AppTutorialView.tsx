import React from 'react';
import { Smartphone, LayoutDashboard, BedDouble, ChevronLeft } from 'lucide-react';
import type { AppTutorial } from '../data/eduContent';

interface Props {
    tutorial: AppTutorial;
    onBack: () => void;
}

const getIconComponent = (iconName: string, size = 20) => {
    switch (iconName) {
        case 'smartphone': return <Smartphone size={size} />;
        case 'layout-dashboard': return <LayoutDashboard size={size} />;
        case 'bed-double': return <BedDouble size={size} />;
        default: return <Smartphone size={size} />;
    }
};

export const AppTutorialView: React.FC<Props> = ({ tutorial, onBack }) => {
    return (
        <div className="edu-playbook-view" data-testid="tutorial-view">
            <header className="edu-playbook-view__header">
                <button
                    onClick={onBack}
                    className="edu-playbook-view__back-btn"
                    aria-label="Voltar para lista de tutoriais"
                    data-testid="tutorial-back-btn"
                >
                    <ChevronLeft size={20} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getIconComponent(tutorial.icon, 20)}
                    <h2 className="edu-playbook-view__header-label" style={{ margin: 0 }}>Guia do App</h2>
                </div>
            </header>

            <div className="edu-playbook-view__body">
                <div>
                    <h1 className="edu-playbook-view__title">{tutorial.title}</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                        {tutorial.description}
                    </p>
                </div>

                <div style={{ marginTop: '2rem' }}>
                    <h3 className="edu-steps__title">Passo a Passo</h3>
                    <div className="edu-steps__list">
                        {tutorial.steps.map((step, idx) => (
                            <div key={idx} className="edu-step">
                                <div className="edu-step__number">{idx + 1}</div>
                                <p className="edu-step__text">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
