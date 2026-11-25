export const COMPOUNDING_PERIODS = {
  monthly: 12,
  quarterly: 4,
  half_yearly: 2,
  yearly: 1,
  none: 0,
};

export const calculateFD = ({ principal, annualRate, tenureDays, compoundingFrequency = 'quarterly' }) => {
  const principalAmount = Number(principal);
  const rate = Number(annualRate) / 100;
  const years = Number(tenureDays) / 365;

  if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
    throw new Error('principal must be greater than zero');
  }
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error('annualRate must be non-negative');
  }
  if (!Number.isFinite(years) || years <= 0) {
    throw new Error('tenureDays must be greater than zero');
  }

  const periods = COMPOUNDING_PERIODS[compoundingFrequency];
  if (periods === undefined) {
    throw new Error('Unsupported compounding frequency');
  }

  const maturityAmount = periods === 0
    ? principalAmount * (1 + rate * years)
    : principalAmount * Math.pow(1 + rate / periods, periods * years);
  const interest = maturityAmount - principalAmount;

  return {
    principal: roundMoney(principalAmount),
    tenureDays: Number(tenureDays),
    annualRate: roundMoney(Number(annualRate)),
    interest: roundMoney(interest),
    maturityAmount: roundMoney(maturityAmount),
  };
};

export const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
