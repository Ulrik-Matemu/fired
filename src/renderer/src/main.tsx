import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { createMockApi } from './demo/mockApi'

// Initialize mock API when running in web demo mode or outside Electron
if (import.meta.env.VITE_DEMO_MODE === 'true' || typeof window.api === 'undefined') {
  window.api = createMockApi();
  (window as unknown as { __IS_DEMO_MODE__: boolean }).__IS_DEMO_MODE__ = true;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
