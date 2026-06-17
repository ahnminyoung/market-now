import { Navigate, Route, Routes } from 'react-router-dom';
import MarketDashboard from './components/MarketDashboard.jsx';
import CalendarPage from './components/CalendarPage.jsx';
import EarningsPage from './components/EarningsPage.jsx';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/kr" element={<MarketDashboard marketId="kr" />} />
        <Route path="/us" element={<MarketDashboard marketId="us" />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/earnings" element={<EarningsPage />} />
        <Route path="*" element={<Navigate to="/kr" replace />} />
      </Routes>
      <footer>
        마켓나우 · 네이버 증권 비공개 API 기반 데모입니다. 시세는 지연될 수 있으며 투자 판단의
        근거가 될 수 없습니다. 실적 캘린더는 현재 mock 데이터입니다.
      </footer>
    </>
  );
}
