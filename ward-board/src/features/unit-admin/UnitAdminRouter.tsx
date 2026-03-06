import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import UnitAdminHome from './UnitAdminHome';
import UnitAdminShell from './UnitAdminShell';
import AnalyticsListScreen from '../admin/screens/AnalyticsListScreen';
import { EduCenterHome } from '../education/components/EduCenterHome';

const UnitAdminRouter: React.FC = () => {
    return (
        <Routes>
            <Route index element={<UnitAdminHome />} />
            <Route path=":unitId" element={<UnitAdminShell />} />
            <Route path=":unitId/analytics/lists" element={<AnalyticsListScreen />} />
            <Route path="education" element={<EduCenterHome />} />
            <Route path="*" element={<Navigate to="/unit-admin" replace />} />
        </Routes>
    );
};

export default UnitAdminRouter;
