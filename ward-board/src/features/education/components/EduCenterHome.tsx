import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, ArrowRight, ArrowLeft, Smartphone } from 'lucide-react';
import type { Playbook, AppTutorial } from '../data/eduContent';
import { useEduContent } from '../hooks/useEduContent';
import { PlaybookView } from './PlaybookView';
import { AppTutorialView } from './AppTutorialView';
import { MicrolessonList } from './MicrolessonList';
import '../../../styles/edu.css';

interface Props {
    /**
     * ID da unidade hospitalar.
     * Se fornecido, o hook tenta carregar conteúdo customizado do Firestore.
     * Se omitido (route global /education), usa conteúdo estático de eduContent.ts.
     */
    unitId?: string;
    /**
     * Quando true, o botão "Voltar" é ocultado.
     * Use quando EduCenterHome é renderizado como aba/painel dentro de outro shell
     * que já fornece navegação própria (ex: AdminUnitShell).
     */
    embedded?: boolean;
}

export const EduCenterHome: React.FC<Props> = ({ unitId, embedded = false }) => {
    const navigate = useNavigate();
    const { playbooks, microlessons, tutorials, loading } = useEduContent(unitId);
    const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
    const [selectedTutorial, setSelectedTutorial] = useState<AppTutorial | null>(null);
    const [activeTab, setActiveTab] = useState<'playbooks' | 'microlessons' | 'tutorials'>('playbooks');

    if (selectedPlaybook) {
        return <PlaybookView playbook={selectedPlaybook} onBack={() => setSelectedPlaybook(null)} />;
    }

    if (selectedTutorial) {
        return <AppTutorialView tutorial={selectedTutorial} onBack={() => setSelectedTutorial(null)} />;
    }

    return (
        <div className="edu-page">
            <header className="edu-header">
                {!embedded && (
                    <button
                        className="edu-back-btn"
                        onClick={() => navigate(-1)}
                        aria-label="Voltar"
                    >
                        <ArrowLeft size={16} />
                        Voltar
                    </button>
                )}
                <h1 className="edu-header__title">
                    <BookOpen size={24} className="edu-header__icon" />
                    Central Educativa
                </h1>
                <p className="edu-header__subtitle">
                    Playbooks Lean e micro-lições para o dia-a-dia da unidade.
                </p>
            </header>

            <div className="edu-tabs">
                <button
                    className={`edu-tab${activeTab === 'playbooks' ? ' edu-tab--active' : ''}`}
                    onClick={() => setActiveTab('playbooks')}
                    data-testid="tab-playbooks"
                >
                    <BookOpen size={16} />
                    Playbooks ({playbooks.length})
                </button>
                <button
                    className={`edu-tab${activeTab === 'tutorials' ? ' edu-tab--active' : ''}`}
                    onClick={() => setActiveTab('tutorials')}
                    data-testid="tab-tutorials"
                >
                    {/* Reusing existing lucide icons if Smartphone is not already imported above.
                     // But we should import Smartphone. 
                     */}
                    <Smartphone size={16} />
                    Tutoriais do App ({tutorials?.length || 0})
                </button>
                <button
                    className={`edu-tab${activeTab === 'microlessons' ? ' edu-tab--active' : ''}`}
                    onClick={() => setActiveTab('microlessons')}
                    data-testid="tab-microlessons"
                >
                    <GraduationCap size={16} />
                    Micro-lições ({microlessons.length})
                </button>
            </div>

            <div className="edu-content">
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Carregando conteúdo…
                    </div>
                ) : activeTab === 'playbooks' ? (
                    <div className="edu-playbook-grid">
                        {playbooks.map(playbook => (
                            <button
                                key={playbook.id}
                                onClick={() => setSelectedPlaybook(playbook)}
                                className="edu-playbook-card"
                                data-testid={`playbook-card-${playbook.id}`}
                            >
                                <div className="edu-playbook-card__row">
                                    <div className="edu-playbook-card__icon-wrapper">
                                        <BookOpen size={20} />
                                    </div>
                                    <ArrowRight size={18} className="edu-playbook-card__arrow" />
                                </div>
                                <h3 className="edu-playbook-card__title">{playbook.title}</h3>
                                <p className="edu-playbook-card__who">Ator: {playbook.who}</p>
                            </button>
                        ))}
                    </div>
                ) : activeTab === 'tutorials' ? (
                    <div className="edu-playbook-grid">
                        {tutorials.map(tutorial => (
                            <button
                                key={tutorial.id}
                                onClick={() => setSelectedTutorial(tutorial)}
                                className="edu-playbook-card"
                                data-testid={`tutorial-card-${tutorial.id}`}
                            >
                                <div className="edu-playbook-card__row">
                                    <div className="edu-playbook-card__icon-wrapper">
                                        <Smartphone size={20} />
                                    </div>
                                    <ArrowRight size={18} className="edu-playbook-card__arrow" />
                                </div>
                                <h3 className="edu-playbook-card__title">{tutorial.title}</h3>
                                <p className="edu-playbook-card__who" style={{ height: '3rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tutorial.description}</p>
                            </button>
                        ))}
                    </div>
                ) : (
                    <MicrolessonList lessons={microlessons} />
                )}
            </div>
        </div>
    );
};
