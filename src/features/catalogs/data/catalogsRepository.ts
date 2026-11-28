import type { AxiosInstance } from 'axios';

import { http } from '@/core/http/client';

import type {
  CatalogItem,
  CatalogsRepository,
  Municipality,
  OperationAmountRange,
  State,
} from '../domain/entities';

interface SimpleDto {
  idGender?: number;
  idNationality?: number;
  idMaritalStatus?: number;
  idProfession?: number;
  name: string;
  description?: string;
  isActive?: boolean;
}
interface OperationAmountDto {
  idOperationAmount: number;
  label: string;
  minAmount: number;
  maxAmount: number;
  isActive?: boolean;
}
interface StateDto {
  idState: number;
  cveEnt: string;
  name: string;
  isActive?: boolean;
}
interface MunicipalityDto {
  idMunicipality: number;
  idState: number;
  cveMun: string;
  name: string;
  isActive?: boolean;
}

const toItem = (dto: SimpleDto): CatalogItem => ({
  id: dto.idGender ?? dto.idNationality ?? dto.idMaritalStatus ?? dto.idProfession ?? 0,
  name: dto.name,
  description: dto.description,
});

export function createCatalogsRepository(client: AxiosInstance): CatalogsRepository {
  const list = async (path: string): Promise<CatalogItem[]> => {
    const { data } = await client.get<SimpleDto[]>(`/v1/catalogos/${path}`, { skipAuth: true });
    return data.filter((d) => d.isActive !== false).map(toItem);
  };

  return {
    getGenders: () => list('generos'),
    getNationalities: () => list('nacionalidades'),
    getMaritalStatuses: () => list('estados-civiles'),
    getProfessions: () => list('profesiones'),
    async getOperationAmounts(): Promise<OperationAmountRange[]> {
      const { data } = await client.get<OperationAmountDto[]>('/v1/catalogos/montos-operacion', {
        skipAuth: true,
      });
      return data
        .filter((r) => r.isActive !== false)
        .map((r) => ({
          id: r.idOperationAmount,
          label: r.label,
          minAmount: Number(r.minAmount),
          maxAmount: Number(r.maxAmount),
        }));
    },
    async getStates(): Promise<State[]> {
      const { data } = await client.get<StateDto[]>('/v1/catalogos/estados', { skipAuth: true });
      return data
        .filter((s) => s.isActive !== false)
        .map((s) => ({ id: s.idState, code: s.cveEnt, name: s.name }));
    },
    async getMunicipalities(stateCode): Promise<Municipality[]> {
      const { data } = await client.get<MunicipalityDto[]>(
        `/v1/catalogos/municipios/${encodeURIComponent(stateCode)}`,
        { skipAuth: true },
      );
      return data
        .filter((m) => m.isActive !== false)
        .map((m) => ({ id: m.idMunicipality, stateId: m.idState, code: m.cveMun, name: m.name }));
    },
  };
}

export const catalogsRepository = createCatalogsRepository(http);
