/** DTOs exactos del backend. Importes llegan como number JSON (BigDecimal). */
export interface AccountDto {
  idAccount: number;
  accountNumber: string;
  balance: number;
  status: string;
  openedAt?: string;
  updatedAt?: string;
}

export interface MovementDto {
  idBalance: number;
  idAccount: number;
  accountNumber: string;
  previousBalance: number;
  amount: number;
  currentBalance: number;
  movementType: string;
  description?: string;
  createdAt: string;
}

export interface ClientDto {
  name: string;
  secondName?: string;
  lastName: string;
  secondLastName?: string;
  birthDate?: string;
  curp: string;
  rfc?: string;
  isActive?: boolean;
  primaryAccount?: AccountDto;
  accounts?: AccountDto[];
  contactDetail?: { email?: string; mobilePhone?: string; alternativePhone?: string };
  home?: {
    street?: string;
    exteriorNumber?: string;
    interiorNumber?: string;
    neighborhood?: string;
    municipalityName?: string;
    stateName?: string;
    postalCode?: string;
  };
  employmentInformation?: { occupation?: string; company?: string; monthlyIncome?: number };
}
