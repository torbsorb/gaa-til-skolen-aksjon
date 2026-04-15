function normalizeApiBase(raw) {
  if (raw == null || raw === '') return '/api';
  return String(raw).trim().replace(/\/+$/, '') || '/api';
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

export default API_BASE;
