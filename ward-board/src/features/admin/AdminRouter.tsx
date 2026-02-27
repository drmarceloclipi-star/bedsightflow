import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminHome from './AdminHome';
import AdminUnitShell from './AdminUnitShell';
import AnalyticsListScreen from './screens/AnalyticsListScreen';

const AdminRouter: React.FC = () => {
    return (
        <Routes>
            <Route index element={<AdminHome />} />
            <Route path="unit/:unitId" element={<AdminUnitShell />} />
            <Route path="unit/:unitId/analytics/lists" element={<AnalyticsListScreen />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
    );
};

export default AdminRouter;
