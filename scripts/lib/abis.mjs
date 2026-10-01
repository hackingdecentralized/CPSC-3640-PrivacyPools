import { keccak256, parseAbi, toHex } from 'viem';

export const NATIVE_ASSET = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const ROLES = {
  OWNER: keccak256(toHex('OWNER_ROLE')),
  POSTMAN: keccak256(toHex('ASP_POSTMAN')),
};

export const entrypointAbi = parseAbi([
  'function assetConfig(address asset) view returns (address pool, uint256 minimumDepositAmount, uint256 vettingFeeBPS, uint256 maxRelayFeeBPS)',
  'function scopeToPool(uint256 scope) view returns (address pool)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
]);

export const poolAbi = parseAbi([
  'function SCOPE() view returns (uint256)',
  'function ASSET() view returns (address)',
  'function ENTRYPOINT() view returns (address)',
  'function WITHDRAWAL_VERIFIER() view returns (address)',
  'function RAGEQUIT_VERIFIER() view returns (address)',
  'function dead() view returns (bool)',
  'event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)',
]);

export const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
]);
