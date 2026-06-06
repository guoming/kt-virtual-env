import React from 'react';
import ReactDOM from 'react-dom/client';
import { createMockApi } from './create-mock-api';
import DocsApp from './DocsApp';
import { ErrorBoundary } from '../components/ErrorBoundary';
import '../index.css';

window.ktve = createMockApi();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <DocsApp />
    </ErrorBoundary>
  </React.StrictMode>,
);
