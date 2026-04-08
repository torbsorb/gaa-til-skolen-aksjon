import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import SurveyPage from './SurveyPage';
import ResultsPage from './ResultsPage';
import EditableTablePage from './EditableTablePage';
import LandingPage from './LandingPage';
import ClassLogoManagerPage from './ClassLogoManagerPage';

const TEACHER_PORTAL_PATH = '/secretTeacherPortal273892';

function RouteChromeManager() {
  const location = useLocation();

  useEffect(() => {
    const isTeacherPortal = location.pathname.startsWith(TEACHER_PORTAL_PATH);
    const title = isTeacherPortal
      ? 'Lærerportal | Gå til skolen-aksjon'
      : 'Gå til skolen-aksjon';
    const faviconHref = isTeacherPortal
      ? '/teacher-portal-favicon.svg?v=2'
      : '/walk-to-school-favicon.svg?v=1';

    document.title = title;

    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', 'icon');
      document.head.appendChild(favicon);
    }

    favicon.setAttribute('type', 'image/svg+xml');
    favicon.setAttribute('href', faviconHref);
  }, [location.pathname]);

  return null;
}

function AppRouter() {
  return (
    <BrowserRouter>
      <RouteChromeManager />
      <Routes>
        <Route path="/" element={<ResultsPage />} />
        <Route path="/results" element={<ResultsPage />} />

        <Route path={TEACHER_PORTAL_PATH} element={<LandingPage />} />
        <Route path={`${TEACHER_PORTAL_PATH}/survey`} element={<SurveyPage />} />
        <Route path={`${TEACHER_PORTAL_PATH}/edit-table`} element={<EditableTablePage />} />
        <Route path={`${TEACHER_PORTAL_PATH}/class-logos`} element={<ClassLogoManagerPage />} />

        <Route path="/survey" element={<Navigate to="/" replace />} />
        <Route path="/edit-table" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
