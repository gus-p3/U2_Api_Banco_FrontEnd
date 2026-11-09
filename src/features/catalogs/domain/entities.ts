export interface CatalogItem {
  id: number;
  name: string;
  description?: string;
}

export interface State {
  id: number;
  code: string; // cveEnt
  name: string;
}

export interface Municipality {
  id: number;
  stateId: number;
  code: string;
  name: string;
}

export interface CatalogsRepository {
  getGenders(): Promise<CatalogItem[]>;
  getNationalities(): Promise<CatalogItem[]>;
  getMaritalStatuses(): Promise<CatalogItem[]>;
  getStates(): Promise<State[]>;
  getMunicipalities(stateCode: string): Promise<Municipality[]>;
}
