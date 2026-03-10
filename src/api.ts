import axios from 'axios';

const api = axios.create({
  baseURL: 'https://trade-backend-k71d.onrender.com',
});

// Автоматически добавляем токен к каждому запросу, если он есть
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token'); // Проверь, как у тебя в AuthContext сохраняется токен
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;