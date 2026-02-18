import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { AppProviders } from './app/providers/AppProviders'
import { envConfigError } from './lib/env'
import './index.css'

if (envConfigError) {
  // eslint-disable-next-line no-console
  console.error(envConfigError)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {envConfigError ? (
      <section
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '680px',
            width: '100%',
            background: '#ffffff',
            border: '1px solid #e6d8dc',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 10px 30px rgba(25, 18, 21, 0.08)',
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: '1.4rem', color: '#8f1e37' }}>
            Configuration Error
          </h1>
          <p style={{ margin: '0 0 8px' }}>
            This app is missing required environment variables in Vercel.
          </p>
          <pre
            style={{
              margin: 0,
              padding: '12px',
              borderRadius: '8px',
              background: '#faf5f6',
              overflowX: 'auto',
            }}
          >
            {envConfigError}
          </pre>
        </div>
      </section>
    ) : (
      <AppProviders>
        <App />
      </AppProviders>
    )}
  </StrictMode>,
)
