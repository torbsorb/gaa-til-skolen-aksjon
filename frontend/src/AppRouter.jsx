import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import SurveyPage from './SurveyPage';
import ResultsPage from './ResultsPage';
import EditableTablePage from './EditableTablePage';
import LandingPage from './LandingPage';
import ClassLogoManagerPage from './ClassLogoManagerPage';

const TEACHER_PORTAL_PATH = '/secretTeacherPortal273892';

function AppRouter() {
  return (
    <BrowserRouter>
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
