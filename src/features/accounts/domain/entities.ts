export interface Account {
  id: number;
  number: string;
  balance: number;
  status: string;
  openedAt?: string;
}

export type MovementType =
  'APERTURA' | 'DEPOSITO' | 'RETIRO' | 'AJUSTE' | 'PAGO_SERVICIO' | 'REVERSO_PAGO';

export interface Movement {
  id: number;
  accountNumber: string;
  type: MovementType | string;
  description: string;
  /** Importe con signo: positivo abona, negativo carga (derivado de saldo previo y resultante). */
  signedAmount: number;
  previousBalance: number;
  currentBalance: number;
  createdAt: string;
}

export interface Customer {
  fullName: string;
  firstName: string;
  secondName?: string;
  lastName?: string;
  secondLastName?: string;
  email?: string;
  mobilePhone?: string;
  alternativePhone?: string;
  curp: string;
  rfc?: string;
  genderId?: number;
  genderName?: string;
  nationalityId?: number;
  nationalityName?: string;
  maritalStatusId?: number;
  maritalStatusName?: string;
  isActive: boolean;
  accounts: Account[];
  primaryAccount?: Account;
  address?: string;
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  neighborhood?: string;
  municipalityId?: number;
  municipalityName?: string;
  stateId?: number;
  stateCode?: string;
  stateName?: string;
  postalCode?: string;
  occupation?: string;
  professionId?: number;
  professionName?: string;
  operationAmountId?: number;
  operationAmountLabel?: string;
  operationAmountMax?: number;
  company?: string;
  monthlyIncome?: number;
}
