// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {DeployProtocol} from './BaseDeploy.s.sol';
import {IERC20} from '@oz/token/ERC20/ERC20.sol';
import {Constants} from 'contracts/lib/Constants.sol';

// Existing course ERC-20 on Sepolia (Bulldogs, BULLDOGS, 18 decimals). Never redeployed.
address constant BULLDOGS_TOKEN = 0xBc2BEfb9a8aA70AfA23F7451A0794466976B6974;

/// @notice Public airdrop on the course token: mints 10,000 BULLDOGS to the caller.
interface IBulldogs {
  function claim() external;
}

/**
 * @notice CPSC 3640 course demo deployment on Ethereum Sepolia.
 * @dev One Entrypoint, a native ETH pool and a BULLDOGS pool. Zero vetting fee; relay fee capped at 1%.
 */
contract CourseSepolia is DeployProtocol {
  function setUp() public override chainId(11_155_111) {
    _nativePoolConfig = PoolConfig({
      symbol: 'ETH',
      asset: IERC20(Constants.NATIVE_ASSET),
      minimumDepositAmount: 0.001 ether,
      vettingFeeBPS: 0,
      maxRelayFeeBPS: 100
    });

    // setUp may run more than once in tests; never register the same token twice
    delete _tokenPoolConfigs;
    _tokenPoolConfigs.push(
      PoolConfig({
        symbol: 'BULLDOGS',
        asset: IERC20(BULLDOGS_TOKEN),
        minimumDepositAmount: 10 ether, // 18 decimals -> 10 BULLDOGS
        vettingFeeBPS: 0,
        maxRelayFeeBPS: 100
      })
    );

    super.setUp();
  }
}
