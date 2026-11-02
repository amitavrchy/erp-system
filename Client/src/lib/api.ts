import axios from 'axios';

let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  withCredentials: true,
  timeout: 20000,
});
export function setToken(token: string | null) {
  accessToken = token;
}
export async function refreshSession() {
  if (!refreshPromise)
    refreshPromise = api
      .post<{ accessToken: string }>('/auth/refresh')
      .then((r) => {
        setToken(r.data.accessToken);
        return r.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !config.url?.startsWith('/auth/')
    ) {
      config._retried = true;
      try {
        await refreshSession();
        return await api(config);
      } catch {
        setToken(null);
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('session-expired'));
      }
    }
    return Promise.reject(error);
  },
);
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return Array.isArray(message)
      ? message.join('. ')
      : typeof message === 'string'
        ? message
        : 'Cannot connect to Ledgerflow. Please try again.';
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
export const money = (value: number | string | undefined, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(
    Number(value ?? 0),
  );
export const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
        new Date(value),
      )
    : '—';
