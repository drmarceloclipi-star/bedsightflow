import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MobileAdminHome from './MobileAdminHome';
import MobileAdminUnitShell from './MobileAdminUnitShell';
import { EduCenterHome } from '../education/components/EduCenterHome';

const MobileAdminRouter: React.FC = () => {
    return (
        <Routes>
            <Route index element={<MobileAdminHome />} />
            <Route path="unit/:unitId" element={<MobileAdminUnitShell />} />
            <Route path="education" element={<EduCenterHome />} />
            <Route path="*" element={<Navigate to="/mobile-admin" replace />} />
        </Routes>
    );
};

export default MobileAdminRouter;
