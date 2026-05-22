import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ReadinessTracker } from './pages/ReadinessTracker';
import { EstimationPlanner } from './pages/EstimationPlanner';
import { ReleaseReadiness } from './pages/ReleaseReadiness';
import { Configuration } from './pages/Configuration';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ConfigProvider } from './contexts/ConfigContext';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <ConfigProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<ReadinessTracker />} />
                  <Route path="estimation" element={<EstimationPlanner />} />
                  <Route path="release" element={<ReleaseReadiness />} />
                  <Route path="config" element={<Configuration />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ConfigProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
