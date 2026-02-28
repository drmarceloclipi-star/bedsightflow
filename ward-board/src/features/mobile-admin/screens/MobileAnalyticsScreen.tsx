import React, { useState } from 'react';
import type { AnalyticsPeriodKey } from '../../../domain/analytics';

import AnalyticsFilters from '../../admin/components/analytics/AnalyticsFilters';
import FlowTrendChart from '../../admin/components/analytics/FlowTrendChart';
import KamishibaiStatusChart from '../../admin/components/analytics/KamishibaiStatusChart';
import TopBlockersTable from '../../admin/components/analytics/TopBlockersTable';
import FreshnessCards from '../../admin/components/analytics/FreshnessCards';
import TrendComparisonPanel from '../../admin/components/analytics/TrendComparisonPanel';

import MissionControlTab from '../../admin/components/analytics/MissionControlTab';

interface Props {
    unitId: string;
}

const MobileAnalyticsScreen: React.FC<Props> = ({ unitId }) => {
    const [period, setPeriod] = useState<AnalyticsPeriodKey>('7d');

    return (
        <div className="analytics-dashboard-container madmin-screen-pad">
            {/* OPERATIONAL ALERTS (Top priority) */}
            <MissionControlTab unitId={unitId} />

            {/* EXPLORATION (Context and Trends) */}
            <div className="analytics-exploration-content">
                <div className="analytics-section-title">
                    <span>🔍 Exploração e Tendências</span>
                    <AnalyticsFilters
                        unitId={unitId}
                        period={period}
                        onPeriodChange={setPeriod}
                    />
                </div>
                <FreshnessCards unitId={unitId} period={period} />
                <FlowTrendChart unitId={unitId} period={period} />
                <KamishibaiStatusChart unitId={unitId} period={period} />
                <TopBlockersTable unitId={unitId} period={period} />
                <TrendComparisonPanel unitId={unitId} period={period} />
            </div>
        </div>
    );
};

export default MobileAnalyticsScreen;
