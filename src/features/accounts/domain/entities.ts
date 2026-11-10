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
  email?: string;
  mobilePhone?: string;
  curp: string;
  rfc?: string;
  isActive: boolean;
  accounts: Account[];
  primaryAccount?: Account;
  address?: string;
  occupation?: string;
  company?: string;
}
