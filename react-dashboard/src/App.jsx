import React from 'react';
import { Layout, Typography } from 'antd';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import LandingPage from './components/landingPage';
import ReportList from './components/reportList';
import ReportDetail from './components/reportDetail';
import SessionPage from './pages/SessionPage';
import './App.css';

import Navbar from './components/Navbar';

// [수정] Layout에서 Content와 Footer를 추출합니다.
const { Content, Footer } = Layout;

function PageContent() {
  const location = useLocation();
  const isSessionPage = location.pathname === '/session';

  return (
    <Layout style={{ minHeight: '100vh', background: '#101923' }}>
      {!isSessionPage && <Navbar />}

      <Content style={{ padding: 0 }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/reports" element={<ReportList />} />
          <Route path="/reports/:reportId" element={<ReportDetail />} />
          <Route path="/session" element={<SessionPage />} />
        </Routes>
      </Content>

      {!isSessionPage && (
        <Footer style={{ textAlign: 'center', background: '#0e161f', color: '#6b7280', borderTop: '1px solid #1f2937' }}>
          Attention Project ©{new Date().getFullYear()} Created by Hwichan
        </Footer>
      )}
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <PageContent />
    </Router>
  );
}

export default App;