// Only persist recognised protocol codes, never server messages or payloads.
const DATA_CODES = new Set(['23502', '23503', '23514', '22P02', '22001', '22003']);
const AUTH_CODES = new Set(['42501', 'PGRST301', 'PGRST302', 'PGRST303']);
const TRANSIENT_CODES = new Set(['40001', '40P01', '53300', '57P01', '57014']);

export const classifyTaskSyncError = (error) => {
  const code = error?.code;
  const status = Number(error?.status);
  if (AUTH_CODES.has(code) || status === 401 || status === 403) {
    return { category: 'auth', state: 'pending', lastErrorCode: AUTH_CODES.has(code) ? code : String(status) };
  }
  if (status === 408 || status === 429 || status >= 500 && status <= 599) {
    return { category: 'transient', state: 'pending', lastErrorCode: String(status) };
  }
  if (DATA_CODES.has(code)) {
    return { category: 'validation', state: 'blocked', lastErrorCode: code };
  }
  if (code === 'PGRST116') {
    return { category: 'conflict', state: 'blocked', lastErrorCode: code };
  }
  if (TRANSIENT_CODES.has(code) || error?.name === 'AbortError') {
    return { category: 'transient', state: 'pending', lastErrorCode: TRANSIENT_CODES.has(code) ? code : null };
  }
  // Unknown errors, including ambiguous fetch failures, are never permanent.
  return { category: 'unknown', state: 'pending', lastErrorCode: null };
};
