import { parseEther } from 'viem';

export const calculateInitialDeposit = (inputAmount: bigint, feeBps: bigint) => {
  // Calculate initial deposit amount accounting for fee percentage
  // Formula: inputAmount * 1e18 / (1e18 - (feeBps * 1e18 / 10000))
  // First 100n converts basis points to percent (10000 bps = 100%)
  // Second 100n converts percent to decimal (100% = 1.0)
  return (inputAmount * parseEther('1')) / (parseEther('1') - (feeBps * parseEther('1')) / 100n / 100n);
};

export const calculateAspFee = (amount: bigint, feeBps: bigint) => {
  // Calculate fee amount based on fee percentage in basis points
  // Formula: amount * feeBps / 10000
  // First 100n converts basis points to percent (10000 bps = 100%)
  // Second 100n converts percent to decimal (100% = 1.0)
  return (amount * feeBps) / 100n / 100n;
};
