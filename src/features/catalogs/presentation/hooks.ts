import { useQuery } from '@tanstack/react-query';

import { catalogsRepository } from '../data/catalogsRepository';

const DAY = 24 * 60 * 60 * 1000;

/** Los catálogos cambian muy poco: se cachean agresivamente (el backend también los cachea en Redis). */
export const useStates = () =>
  useQuery({
    queryKey: ['catalogs', 'states'],
    queryFn: () => catalogsRepository.getStates(),
    staleTime: DAY,
  });

export const useMunicipalities = (stateCode: string | undefined) =>
  useQuery({
    queryKey: ['catalogs', 'municipalities', stateCode],
    queryFn: () => catalogsRepository.getMunicipalities(stateCode ?? ''),
    enabled: !!stateCode,
    staleTime: DAY,
  });

export const useGenders = () =>
  useQuery({
    queryKey: ['catalogs', 'genders'],
    queryFn: () => catalogsRepository.getGenders(),
    staleTime: DAY,
  });

export const useNationalities = () =>
  useQuery({
    queryKey: ['catalogs', 'nationalities'],
    queryFn: () => catalogsRepository.getNationalities(),
    staleTime: DAY,
  });

export const useMaritalStatuses = () =>
  useQuery({
    queryKey: ['catalogs', 'marital'],
    queryFn: () => catalogsRepository.getMaritalStatuses(),
    staleTime: DAY,
  });
