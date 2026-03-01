import React, { useState } from 'react';
import { GraduationCap, ChevronDown, ChevronUp, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react';
import type { Microlesson } from '../data/eduContent';

interface Props {
    lessons: Microlesson[];
}

export const MicrolessonList: React.FC<Props> = ({ lessons }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

    return (
        <div className="edu-lesson-list">
            {lessons.map(lesson => (
                <div key={lesson.id} className="edu-lesson-card" data-testid={`lesson-card-${lesson.id}`}>
                    <button
                        className="edu-lesson-card__toggle"
                        onClick={() => toggle(lesson.id)}
                        aria-expanded={expandedId === lesson.id}
                        data-testid={`lesson-toggle-${lesson.id}`}
                    >
                        <div className="edu-lesson-card__toggle-left">
                            <div className="edu-lesson-card__icon-wrapper">
                                <GraduationCap size={20} />
                            </div>
                            <h3 className="edu-lesson-card__title">{lesson.title}</h3>
                        </div>
                        {expandedId === lesson.id
                            ? <ChevronUp size={20} className="edu-lesson-card__chevron" />
                            : <ChevronDown size={20} className="edu-lesson-card__chevron" />
                        }
                    </button>

                    {expandedId === lesson.id && (
                        <div className="edu-lesson-card__body">
                            <div className="edu-lesson-card__body-inner">
                                <p className="edu-lesson-section-label">Situação</p>
                                <p className="edu-lesson-situation">{lesson.situation}</p>
                            </div>

                            <div className="edu-lesson-two-col">
                                <div className="edu-lesson-error-box">
                                    <div className="edu-lesson-error-box__header">
                                        <AlertTriangle size={14} /> Erro
                                    </div>
                                    <p className="edu-lesson-box-text">{lesson.error}</p>
                                </div>
                                <div className="edu-lesson-rule-box">
                                    <div className="edu-lesson-rule-box__header">
                                        <Lightbulb size={14} /> Regra Lean
                                    </div>
                                    <p className="edu-lesson-box-text">{lesson.leanRule}</p>
                                </div>
                            </div>

                            <div className="edu-lesson-action-box">
                                <div className="edu-lesson-action-box__header">
                                    <CheckCircle2 size={14} /> Ação BedSight
                                </div>
                                <p className="edu-lesson-box-text">{lesson.action}</p>
                            </div>

                            <div className="edu-lesson-verification">
                                <p className="edu-lesson-verification__question">
                                    <strong>Verificação:</strong> {lesson.verification.question}
                                </p>
                                <div className="edu-lesson-verification__options">
                                    {lesson.verification.options.map((opt, i) => {
                                        const isCorrect = opt.startsWith(lesson.verification.correctKey);
                                        return (
                                            <span
                                                key={i}
                                                className={`edu-lesson-option${isCorrect ? ' edu-lesson-option--correct' : ''}`}
                                            >
                                                {opt} {isCorrect && '✓'}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
