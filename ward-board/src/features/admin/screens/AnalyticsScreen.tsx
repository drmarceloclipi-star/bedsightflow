import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { AnalyticsPeriodKey } from '../../../domain/analytics';
import AnalyticsFilters from '../components/analytics/AnalyticsFilters';
import FlowTrendChart from '../components/analytics/FlowTrendChart';
import KamishibaiStatusChart from '../components/analytics/KamishibaiStatusChart';
import TopBlockersTable from '../components/analytics/TopBlockersTable';
import FreshnessCards from '../components/analytics/FreshnessCards';
import TrendComparisonPanel from '../components/analytics/TrendComparisonPanel';
import MissionControlTab from '../components/analytics/MissionControlTab';

interface AnalyticsScreenProps {
    unitId?: string;
}

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ unitId: propUnitId }) => {
    const { unitId: routeUnitId } = useParams<{ unitId: string }>();
    const safeUnitId = propUnitId || routeUnitId || 'A';
    const [period, setPeriod] = useState<AnalyticsPeriodKey>('7d');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const [activeTab, setActiveTab] = useState<'mission-control' | 'exploration'>('mission-control');

    const handleRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
        setLastUpdated(new Date());
    };

    return (
        <div className="analytics-dashboard-container">
            {/* GLOBAL HEADER CONTROLS & TABS */}
            <div className="analytics-header">
                <div className="mc-toolbar">
                    <span className="mc-last-updated">
                        Atualizado: {lastUpdated.toLocaleTimeString('pt-BR')}
                    </span>
                    <button
                        className="btn btn-outline mc-refresh-btn"
                        onClick={handleRefresh}
                        type="button"
                    >
                        ↻ Atualizar
                    </button>
                </div>

                <div className="analytics-tabs">
                    <button
                        className={`analytics-tab-btn ${activeTab === 'mission-control' ? 'active' : ''}`}
                        onClick={() => setActiveTab('mission-control')}
                    >
                        Mission Control
                    </button>
                    <button
                        className={`analytics-tab-btn ${activeTab === 'exploration' ? 'active' : ''}`}
                        onClick={() => setActiveTab('exploration')}
                    >
                        Exploração
                    </button>
                </div>
            </div>

            {/* CONTEÚDOS DAS ABAS */}
            {activeTab === 'mission-control' && (
                <div className="analytics-tab-pane slide-in">
                    <MissionControlTab unitId={safeUnitId} refreshTrigger={refreshTrigger} />
                </div>
            )}

            {activeTab === 'exploration' && (
                <div className="analytics-tab-pane slide-in analytics-exploration-content">
                    <div className="analytics-section-divider">
                        <h2 className="analytics-section-divider-title">📊 Histórico e Tendências</h2>
                        <AnalyticsFilters unitId={safeUnitId} period={period} onPeriodChange={setPeriod} />
                    </div>

                    {/* Freshness (dados únicos: breakdown 12h/24h/48h) */}
                    <FreshnessCards unitId={safeUnitId} period={period} refreshTrigger={refreshTrigger} />

                    {/* Gráficos históricos */}
                    <div className="analytics-grid-2">
                        <FlowTrendChart unitId={safeUnitId} period={period} refreshTrigger={refreshTrigger} />
                        <KamishibaiStatusChart unitId={safeUnitId} period={period} refreshTrigger={refreshTrigger} />
                    </div>

                    <div className="analytics-grid-2">
                        <TopBlockersTable unitId={safeUnitId} period={period} refreshTrigger={refreshTrigger} />
                        <TrendComparisonPanel unitId={safeUnitId} period={period} refreshTrigger={refreshTrigger} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalyticsScreen;
