import React, { useState, useEffect, useMemo } from 'react';
import type { Bed, BoardSettings, SummaryMetrics, UnitOpsSettings } from '../../../domain/types';
import KanbanScreen from './KanbanScreen';
import KamishibaiScreen from './KamishibaiScreen';
import SummaryScreen from './SummaryScreen';
import { SummaryCalculator } from '../../../domain/SummaryCalculator';

interface TvRotationContainerProps {
    beds: Bed[];
    settings: BoardSettings;
    unitName?: string;
    /** v1: configuração operacional da unidade (kamishibaiEnabled, huddleSchedule, etc.) */
    opsSettings?: UnitOpsSettings | null;
    /** v1.5: referência de tempo para calcular overdue nas screens (state do TvDashboard) */
    now?: Date;
    /** For testing/debugging: forces a specific screen key */
    forceScreen?: string;
}



const TvRotationContainer: React.FC<TvRotationContainerProps> = ({ beds, settings, unitName, opsSettings, now = new Date(), forceScreen }) => {
    const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    const paginateBeds = (allBeds: Bed[], pageSize: number) => {
        const pages: Bed[][] = [];
        for (let i = 0; i < allBeds.length; i += pageSize) {
            pages.push(allBeds.slice(i, i + pageSize));
        }
        return pages;
    };

    const expandedScreens = useMemo(() => {
        const screens: { key: string; label: string; duration: number; beds?: Bed[]; metrics?: SummaryMetrics; columns?: number }[] = [];
        const enabled = settings.screens.filter(s => forceScreen ? s.key === forceScreen : s.enabled);

        enabled.forEach(screen => {
            if (screen.key === 'kanban' || screen.key === 'kamishibai') {
                const pageSize = screen.key === 'kanban' ? settings.kanbanBedsPerPage : settings.kamishibaiBedsPerPage;
                const pages = paginateBeds(beds, pageSize || 18);

                const columns = screen.key === 'kanban' ? (settings.kanbanColumnsPerPage ?? 1) : (settings.kamishibaiColumnsPerPage ?? 1);

                pages.forEach((pageBeds, idx) => {
                    screens.push({
                        key: screen.key,
                        label: `${screen.label} ${pages.length > 1 ? `(${idx + 1}/${pages.length})` : ''}`,
                        duration: screen.durationSeconds,
                        beds: pageBeds,
                        columns
                    });
                });
            } else if (screen.key === 'summary') {
                screens.push({
                    key: screen.key,
                    label: screen.label,
                    duration: screen.durationSeconds
                });
            }
        });
        return screens;
    }, [settings.screens, settings.kanbanBedsPerPage, settings.kamishibaiBedsPerPage, settings.kanbanColumnsPerPage, settings.kamishibaiColumnsPerPage, beds, forceScreen]);

    const metrics: SummaryMetrics = useMemo(() => {
        return SummaryCalculator.calculateMetrics(beds, now);
    }, [beds, now]);

    // Ensure valid index if setting changes alter expandedScreens length
    const validScreenIndex = currentScreenIndex >= expandedScreens.length ? 0 : currentScreenIndex;
    const activeScreen = expandedScreens[validScreenIndex];

    useEffect(() => {
        if (!settings.rotationEnabled || expandedScreens.length <= 1) {
            return;
        }

        const duration = (activeScreen?.duration || 10) * 1000;
        const startTime = Date.now();

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const newProgress = Math.min((elapsed / duration) * 100, 100);
            setProgress(newProgress);

            if (newProgress >= 100) {
                setCurrentScreenIndex((prev) => {
                    const valid = prev >= expandedScreens.length ? 0 : prev;
                    return (valid + 1) % expandedScreens.length;
                });
                setProgress(0);
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [currentScreenIndex, expandedScreens, settings.rotationEnabled, activeScreen]);

    if (!activeScreen) return <div className="p-8 text-center text-2xl">Nenhuma tela habilitada.</div>;


    return (
        <div className="h-full flex flex-col relative">
            <div className="flex-1 overflow-hidden">
                {activeScreen.key === 'kanban' && <KanbanScreen beds={activeScreen.beds || []} columns={activeScreen.columns} now={now} kanbanMode={opsSettings?.kanbanMode} />}
                {activeScreen.key === 'kamishibai' && <KamishibaiScreen beds={activeScreen.beds || []} columns={activeScreen.columns} opsSettings={opsSettings} now={now} />}
                {activeScreen.key === 'summary' && <SummaryScreen metrics={metrics} unitName={unitName} />}
            </div>

            {settings.rotationEnabled && expandedScreens.length > 1 && (
                <div className="progress-bar-container">
                    <div
                        className="progress-bar-fill"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            <div className="tv-screen-indicator text-muted text-xs font-bold uppercase tracking-widest opacity-50">
                {activeScreen.label} • {currentScreenIndex + 1}/{expandedScreens.length}
            </div>
        </div>
    );
};

export default TvRotationContainer;
