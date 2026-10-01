// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IERC20} from '@oz/token/ERC20/ERC20.sol';
import {Script} from 'forge-std/Script.sol';
import {console} from 'forge-std/console.sol';

import {Entrypoint} from 'contracts/Entrypoint.sol';
import {Constants} from 'contracts/lib/Constants.sol';

import {BULLDOGS_TOKEN, IBulldogs} from './CourseDeploy.s.sol';

/**
 * @notice Post-deploy smoke deposits: 0.001 ETH and 10 BULLDOGS through the Entrypoint.
 * @dev Precommitments are random, so these seed deposits are not withdrawable; they only prove the deposit path.
 *      Env: ENTRYPOINT_ADDRESS, DEPLOYER_ADDRESS.
 */
contract CourseSmoke is Script {
  function run() external {
    Entrypoint _entrypoint = Entrypoint(payable(vm.envAddress('ENTRYPOINT_ADDRESS')));
    address _sender = vm.envAddress('DEPLOYER_ADDRESS');
    IERC20 _token = IERC20(BULLDOGS_TOKEN);
    uint256 _seed = uint256(keccak256(abi.encode(block.timestamp, block.number, _sender)));

    vm.startBroadcast(_sender);

    uint256 _ethCommitment = _entrypoint.deposit{value: 0.001 ether}(_precommitment(_seed, 1));
    console.log('ETH deposit commitment: %s', _ethCommitment);

    if (_token.balanceOf(_sender) < 10 ether) IBulldogs(BULLDOGS_TOKEN).claim();
    _token.approve(address(_entrypoint), 10 ether);
    uint256 _tokenCommitment = _entrypoint.deposit(_token, 10 ether, _precommitment(_seed, 2));
    console.log('BULLDOGS deposit commitment: %s', _tokenCommitment);

    vm.stopBroadcast();
  }

  function _precommitment(uint256 _seed, uint256 _i) internal pure returns (uint256) {
    return uint256(keccak256(abi.encode(_seed, _i))) % Constants.SNARK_SCALAR_FIELD;
  }
}
