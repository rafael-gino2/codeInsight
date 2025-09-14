import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/api',
  withCredentials: true // importante para enviar/receber cookie
});
