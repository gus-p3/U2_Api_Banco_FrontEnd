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

export interface OperationAmountRange {
  id: number;
  label: string;
  minAmount: number;
  maxAmount: number;
}

export interface CatalogsRepository {
  getGenders(): Promise<CatalogItem[]>;
  getNationalities(): Promise<CatalogItem[]>;
  getMaritalStatuses(): Promise<CatalogItem[]>;
  getProfessions(): Promise<CatalogItem[]>;
  getOperationAmounts(): Promise<OperationAmountRange[]>;
  getStates(): Promise<State[]>;
  getMunicipalities(stateCode: string): Promise<Municipality[]>;
}
