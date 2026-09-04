// Centralized application configuration
// Uses VITE_API_URL if provided, otherwise defaults to the deployed Render backend in production
const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;

export const API_BASE_URL = 
  (envApiUrl && envApiUrl.trim().length > 0)
    ? envApiUrl.trim().replace(/\/$/, '')
    : (import.meta.env.PROD 
        ? 'https://smart-logistics-api-286r.onrender.com' 
        : 'http://localhost:8000');

