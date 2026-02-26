import React, { useState, useEffect, useMemo } from 'react';
import type { Bed, BoardSettings, SummaryMetrics } from '../../../domain/types';
import KanbanScreen from './KanbanScreen';
import KamishibaiScreen from './KamishibaiScreen';
import SummaryScreen from './SummaryScreen';
import { SummaryCalculator } from '../../../domain/SummaryCalculator';

interface TvRotationContainerProps {
    beds: Bed[];
    settings: BoardSettings;
    unitName?: string;
}

const MAX_BEDS_PER_PAGE = 8;

const TvRotationContainer: React.FC<TvRotationContainerProps> = ({ beds, settings, unitName }) => {
    const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    const bedsByPage = useMemo(() => {
        const pages: Bed[][] = [];
        for (let i = 0; i < beds.length; i += MAX_BEDS_PER_PAGE) {
            pages.push(beds.slice(i, i + MAX_BEDS_PER_PAGE));
        }
        return pages;
    }, [beds]);

    const expandedScreens = useMemo(() => {
        const screens: { key: string; label: string; duration: number; beds?: Bed[]; metrics?: SummaryMetrics }[] = [];
        const enabled = settings.screens.filter(s => s.enabled);

        enabled.forEach(screen => {
            if (screen.key === 'kanban' || screen.key === 'kamishibai') {
                bedsByPage.forEach((pageBeds, idx) => {
                    screens.push({
                        key: screen.key,
                        label: `${screen.label} ${bedsByPage.length > 1 ? `(${idx + 1}/${bedsByPage.length})` : ''}`,
                        duration: screen.durationSeconds,
                        beds: pageBeds
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
    }, [settings.screens, bedsByPage]);

    const metrics: SummaryMetrics = useMemo(() => {
        return SummaryCalculator.calculateMetrics(beds);
    }, [beds]);

    const activeScreen = expandedScreens[currentScreenIndex];

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
                setCurrentScreenIndex((prev) => (prev + 1) % expandedScreens.length);
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
                {activeScreen.key === 'kanban' && <KanbanScreen beds={activeScreen.beds || []} />}
                {activeScreen.key === 'kamishibai' && <KamishibaiScreen beds={activeScreen.beds || []} />}
                {activeScreen.key === 'summary' && <SummaryScreen metrics={metrics} unitName={unitName} />}
            </div>

            <div className="progress-bar-container">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="tv-screen-indicator text-muted text-xs font-bold uppercase tracking-widest opacity-50">
                {activeScreen.label} • {currentScreenIndex + 1}/{expandedScreens.length}
            </div>
        </div>
    );
};

export default TvRotationContainer;
