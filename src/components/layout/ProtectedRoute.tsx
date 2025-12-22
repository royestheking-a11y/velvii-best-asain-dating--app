import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const ProtectedRoute = () => {
    // All hooks must be called at the top, BEFORE any conditional returns
    const { isAuthenticated, isLoading, currentUser } = useAuth();

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center bg-black text-white">Loading...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Redirect to onboarding if profile is incomplete
    if (currentUser && currentUser.isProfileComplete === false) {
        return <Navigate to="/onboarding" replace />;
    }

    return <Outlet />;
};
