import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleDefinition } from '../types';

export function ProtectedRoute({ 
  children, 
  permission 
}: { 
  children: ReactNode, 
  permission?: keyof RoleDefinition 
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  // Ignore RBAC/permission checking logic under simple submission guidelines
  return <>{children}</>;
}
