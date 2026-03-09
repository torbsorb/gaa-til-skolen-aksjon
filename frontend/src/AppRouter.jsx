import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import SurveyPage from './SurveyPage';
import ResultsPage from './ResultsPage';
import EditableTablePage from './EditableTablePage';
import LandingPage from './LandingPage';

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/survey" element={<SurveyPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/edit-table" element={<EditableTablePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
