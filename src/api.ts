import axios from 'axios';

const api = axios.create({
  baseURL: 'https://trade-backend-k71d.onrender.com',
});

// Автоматически добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Если токен просрочен/невалиден — чистим localStorage и перезагружаем
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('tg_user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;