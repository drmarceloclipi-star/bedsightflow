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

const AnalyticsScreen: React.FC = () => {
    const { unitId } = useParams<{ unitId: string }>();
    const safeUnitId = unitId || 'A';
    const [period, setPeriod] = useState<AnalyticsPeriodKey>('7d');

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
            paddingBottom: '4rem',
            maxWidth: '1200px',
            margin: '0 auto'
        }}>
            <AnalyticsFilters unitId={safeUnitId} period={period} onPeriodChange={setPeriod} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                <section>
                    <OverviewCards unitId={safeUnitId} period={period} />
                </section>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                    <section>
                        <FlowTrendChart unitId={safeUnitId} period={period} />
                    </section>
                    <section>
                        <KamishibaiStatusChart unitId={safeUnitId} period={period} />
                    </section>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                    <section>
                        <TopBlockersTable unitId={safeUnitId} period={period} />
                    </section>
                    <section>
                        <FreshnessCards unitId={safeUnitId} period={period} />
                    </section>
                </div>

                <section>
                    <TrendComparisonPanel unitId={safeUnitId} period={period} />
                </section>
            </div>
        </div>
    );
};

export default AnalyticsScreen;
