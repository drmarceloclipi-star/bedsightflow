import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { AnalyticsPeriodKey } from '../../../domain/analytics';
import AnalyticsFilters from '../components/analytics/AnalyticsFilters';
import OverviewCards from '../components/analytics/OverviewCards';
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

    return (
        <div className="analytics-dashboard-container">
            {/* OPERATIONAL ALERTS (Top priority) */}
            <MissionControlTab unitId={safeUnitId} />

            {/* EXPLORATION (Context and Trends) */}
            <div className="analytics-exploration-content">
                <div className="analytics-section-title">
                    <span>🔍 Exploração e Tendências</span>
                    <AnalyticsFilters unitId={safeUnitId} period={period} onPeriodChange={setPeriod} />
                </div>

                {/* AGORA */}
                <div className="analytics-exploration-section">
                    <div className="analytics-grid-2">
                        <section>
                            <OverviewCards unitId={safeUnitId} period={period} />
                        </section>
                        <section>
                            <FreshnessCards unitId={safeUnitId} period={period} />
                        </section>
                    </div>
                </div>

                {/* PERÍODO */}
                <div className="analytics-exploration-section">
                    <h3 className="analytics-exploration-title">
                        Histórico e Volume (Janela: {period})
                    </h3>

                    <div className="analytics-grid-2">
                        <section>
                            <KamishibaiStatusChart unitId={safeUnitId} period={period} />
                        </section>
                        <section>
                            <FlowTrendChart unitId={safeUnitId} period={period} />
                        </section>
                    </div>

                    <div className="analytics-grid-2">
                        <section>
                            <TopBlockersTable unitId={safeUnitId} period={period} />
                        </section>
                        <section>
                            <TrendComparisonPanel unitId={safeUnitId} period={period} />
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsScreen;
