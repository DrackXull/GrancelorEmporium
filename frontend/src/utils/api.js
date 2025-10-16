// frontend/src/utils/api.js
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

const http = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error?.response?.data?.detail?.[0]?.msg ||
      error?.response?.data?.detail ||
      error?.message ||
      'Unknown error';
    error.__tpka_message = message;
    return Promise.reject(error);
  }
);

export const fetchAPI = (path, method = 'GET', data = null) => {
  return http({
    url: path,
    method,
    data,
  });
};

export default http;
