import { ApiClient } from '../api';

export function logout(): void {
  ApiClient.clearAuth();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('resto_access_token');
    window.localStorage.removeItem('resto_user');
    window.localStorage.removeItem('resto_refresh_token');
  }
}
