// Centralized application configuration
// In production or when VITE_API_URL is provided, it uses the specified URL.
// In development, if not provided, it falls back to http://localhost:8000.
export const API_BASE_URL = 
  (import.meta.env.VITE_API_URL as string | undefined) || 
  (import.meta.env.PROD ? '' : 'http://localhost:8000');
