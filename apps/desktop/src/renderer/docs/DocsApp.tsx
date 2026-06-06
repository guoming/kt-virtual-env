import { useEffect } from 'react';
import App from '../App';
import { useAppStore, type PageId } from '../stores/app-store';
import { MOCK_SESSIONS } from './mock-data';

const PAGE_IDS: PageId[] = ['home', 'stain', 'connect', 'forward', 'settings'];

function parsePage(value: string | null): PageId {
  if (value && PAGE_IDS.includes(value as PageId)) {
    return value as PageId;
  }
  return 'settings';
}

export default function DocsApp() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    useAppStore.setState({
      page: parsePage(params.get('page')),
      sessions: MOCK_SESSIONS,
      helperRunning: true,
      clusterOk: true,
    });
  }, []);

  return <App />;
}
