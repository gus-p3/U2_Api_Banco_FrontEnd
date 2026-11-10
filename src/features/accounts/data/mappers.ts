import type { Account, Customer, Movement } from '../domain/entities';
import type { AccountDto, ClientDto, MovementDto } from './dto';

export const toAccount = (dto: AccountDto): Account => ({
  id: dto.idAccount,
  number: dto.accountNumber,
  balance: Number(dto.balance),
  status: dto.status,
  openedAt: dto.openedAt,
});

export const toMovement = (dto: MovementDto): Movement => {
  const previous = Number(dto.previousBalance);
  const current = Number(dto.currentBalance);
  return {
    id: dto.idBalance,
    accountNumber: dto.accountNumber,
    type: dto.movementType,
    description: dto.description ?? '',
    signedAmount: Math.round((current - previous) * 100) / 100,
    previousBalance: previous,
    currentBalance: current,
    createdAt: dto.createdAt,
  };
};

export function toCustomer(dto: ClientDto): Customer {
  const fullName = [dto.name, dto.secondName, dto.lastName, dto.secondLastName]
    .filter(Boolean)
    .join(' ');
  const home = dto.home;
  const address = home
    ? [
        [home.street, home.exteriorNumber].filter(Boolean).join(' '),
        home.neighborhood,
        home.municipalityName,
        home.stateName,
        home.postalCode,
      ]
        .filter(Boolean)
        .join(', ')
    : undefined;
  const accounts = (dto.accounts ?? []).map(toAccount);
  return {
    fullName,
    firstName: dto.name,
    email: dto.contactDetail?.email,
    mobilePhone: dto.contactDetail?.mobilePhone,
    curp: dto.curp,
    rfc: dto.rfc,
    isActive: dto.isActive ?? true,
    accounts,
    primaryAccount: dto.primaryAccount ? toAccount(dto.primaryAccount) : accounts[0],
    address,
    occupation: dto.employmentInformation?.occupation,
    company: dto.employmentInformation?.company,
  };
}
