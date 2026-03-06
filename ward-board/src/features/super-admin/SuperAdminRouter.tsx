import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SuperAdminHome from './SuperAdminHome';

const SuperAdminRouter: React.FC = () => {
    return (
        <Routes>
            <Route index element={<SuperAdminHome />} />
            <Route path="*" element={<Navigate to="/super-admin" replace />} />
        </Routes>
    );
};

export default SuperAdminRouter;
