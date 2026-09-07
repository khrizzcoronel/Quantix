import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// URL base del backend (En producción debería venir de import.meta.env.VITE_API_URL)
const API_URL = 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para inyectar el Token JWT en cada petición automáticamente
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para atrapar errores de autenticación (Token expirado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Si el token expira, deslogueamos al usuario globalmente
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
