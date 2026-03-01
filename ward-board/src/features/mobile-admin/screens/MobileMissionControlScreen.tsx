import React from 'react';
import MissionControlTab from '../../admin/components/analytics/MissionControlTab';

interface Props {
    unitId: string;
}

const MobileMissionControlScreen: React.FC<Props> = ({ unitId }) => {
    return (
        <div className="analytics-dashboard-container madmin-screen-pad">
            <MissionControlTab unitId={unitId} />
        </div>
    );
};

export default MobileMissionControlScreen;
