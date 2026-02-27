import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { AnalyticsPeriodKey } from '../../../domain/analytics';
import AnalyticsFilters from '../../admin/components/analytics/AnalyticsFilters';
import OverviewCards from '../../admin/components/analytics/OverviewCards';
import FlowTrendChart from '../../admin/components/analytics/FlowTrendChart';
import KamishibaiStatusChart from '../../admin/components/analytics/KamishibaiStatusChart';
import TopBlockersTable from '../../admin/components/analytics/TopBlockersTable';
import FreshnessCards from '../../admin/components/analytics/FreshnessCards';
import TrendComparisonPanel from '../../admin/components/analytics/TrendComparisonPanel';

interface Props {
    unitId: string;
}

const MobileAnalyticsScreen: React.FC<Props> = ({ unitId }) => {
    const { unitId: paramUnitId } = useParams<{ unitId: string }>();
    const safeUnitId = unitId || paramUnitId || 'A';
    const [period, setPeriod] = useState<AnalyticsPeriodKey>('7d');

    return (
        <div className="madmin-screen-pad madmin-analytics-stack">
            <AnalyticsFilters
                unitId={safeUnitId}
                period={period}
                onPeriodChange={setPeriod}
            />

            <section>
                <OverviewCards unitId={safeUnitId} period={period} />
            </section>

            <section>
                <FlowTrendChart unitId={safeUnitId} period={period} />
            </section>

            <section>
                <KamishibaiStatusChart unitId={safeUnitId} period={period} />
            </section>

            <section>
                <TopBlockersTable unitId={safeUnitId} period={period} />
            </section>

            <section>
                <FreshnessCards unitId={safeUnitId} period={period} />
            </section>

            <section>
                <TrendComparisonPanel unitId={safeUnitId} period={period} />
            </section>
        </div>
    );
};

export default MobileAnalyticsScreen;
