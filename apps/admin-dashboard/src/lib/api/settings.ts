import { ApiClient } from '../api';
import {
  TenantSettingsDTO,
  UpdateTenantSettingsRequest,
} from '@packages/shared-types';

export async function fetchTenantSettings(): Promise<TenantSettingsDTO> {
  const res = await ApiClient.request('/v1/tenant/settings');
  const payload = res?.data ?? res;
  return payload as TenantSettingsDTO;
}

export async function updateTenantSettings(
  data: UpdateTenantSettingsRequest
): Promise<TenantSettingsDTO> {
  const res = await ApiClient.request('/v1/tenant/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  const payload = res?.data ?? res;
  return payload as TenantSettingsDTO;
}
