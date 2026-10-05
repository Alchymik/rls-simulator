import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { Loader } from '@/shared/ui/Loader';

const Login = lazy(() => import('@/pages/Login/Login'));
const MainMenu = lazy(() => import('@/pages/MainMenu/MainMenu'));
const Simulation = lazy(() => import('@/pages/Simulation/Simulation'));
const Profile = lazy(() => import('@/pages/Profile/Profile'));
const Settings = lazy(() => import('@/pages/Settings/Settings'));

export const App = () => (
  <BrowserRouter>
    <Suspense fallback={<Loader fullscreen />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<MainMenu />} />
            <Route path="simulation" element={<Simulation />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
