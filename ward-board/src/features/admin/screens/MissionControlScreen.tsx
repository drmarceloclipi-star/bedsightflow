import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import MissionControlTab from '../components/analytics/MissionControlTab';

interface MissionControlScreenProps {
    unitId?: string;
}

const AUTO_REFRESH_INTERVAL_MS = 60_000; // 60 seconds

const MissionControlScreen: React.FC<MissionControlScreenProps> = ({ unitId: propUnitId }) => {
    const { unitId: routeUnitId } = useParams<{ unitId: string }>();
    const safeUnitId = propUnitId || routeUnitId || 'A';
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isAutoRefresh, setIsAutoRefresh] = useState(false);

    const triggerRefresh = useCallback((auto = false) => {
        setRefreshTrigger(prev => prev + 1);
        setLastUpdated(new Date());
        setIsAutoRefresh(auto);
    }, []);

    // Auto-refresh every 60 seconds so the Mission Control stays live
    // without requiring a manual button click.
    useEffect(() => {
        const interval = setInterval(() => triggerRefresh(true), AUTO_REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [triggerRefresh]);

    return (
        <div className="analytics-dashboard-container">
            {/* GLOBAL HEADER CONTROLS */}
            <div className="analytics-header">
                <div className="mc-toolbar">
                    <span className="mc-last-updated">
                        {isAutoRefresh ? '↺ ' : ''}Atualizado: {lastUpdated.toLocaleTimeString('pt-BR')}
                    </span>
                    <button
                        className="btn btn-outline mc-refresh-btn"
                        onClick={() => triggerRefresh(false)}
                        type="button"
                    >
                        ↻ Atualizar agora
                    </button>
                </div>
            </div>

            <div className="analytics-tab-pane slide-in">
                <MissionControlTab unitId={safeUnitId} refreshTrigger={refreshTrigger} />
            </div>
        </div>
    );
};

export default MissionControlScreen;
