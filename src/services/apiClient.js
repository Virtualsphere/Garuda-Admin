import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ─── Request Interceptor: Attach JWT token ───────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('garuda_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: Handle 401 & auto-refresh ─────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry refresh or login requests
      if (
        originalRequest.url?.includes('/employee/refresh') ||
        originalRequest.url?.includes('/employee/login')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('garuda_refresh_token');

      if (!refreshToken) {
        isRefreshing = false;
        // Clear auth state — no refresh token available
        localStorage.removeItem('garuda_access_token');
        localStorage.removeItem('garuda_refresh_token');
        localStorage.removeItem('garuda_user');
        window.dispatchEvent(new Event('garuda:auth:expired'));
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_URL}/employee/refresh`, {
          refreshToken,
        });

        const newAccessToken = data.accessToken;
        localStorage.setItem('garuda_access_token', newAccessToken);

        apiClient.defaults.headers.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('garuda_access_token');
        localStorage.removeItem('garuda_refresh_token');
        localStorage.removeItem('garuda_user');
        window.dispatchEvent(new Event('garuda:auth:expired'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
