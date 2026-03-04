import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import MissionControlTab from '../components/analytics/MissionControlTab';

interface MissionControlScreenProps {
    unitId?: string;
}

const MissionControlScreen: React.FC<MissionControlScreenProps> = ({ unitId: propUnitId }) => {
    const { unitId: routeUnitId } = useParams<{ unitId: string }>();
    const safeUnitId = propUnitId || routeUnitId || 'A';
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const handleRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
        setLastUpdated(new Date());
    };

    return (
        <div className="analytics-dashboard-container">
            {/* GLOBAL HEADER CONTROLS */}
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
            </div>

            <div className="analytics-tab-pane slide-in">
                <MissionControlTab unitId={safeUnitId} refreshTrigger={refreshTrigger} />
            </div>
        </div>
    );
};

export default MissionControlScreen;
