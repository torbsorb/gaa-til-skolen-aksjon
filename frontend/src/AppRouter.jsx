import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SurveyPage from './SurveyPage';
import ResultsPage from './ResultsPage';

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/survey" replace />} />
        <Route path="/survey" element={<SurveyPage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
