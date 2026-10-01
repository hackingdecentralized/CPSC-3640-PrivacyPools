// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IERC20} from '@oz/token/ERC20/ERC20.sol';
import {Test} from 'forge-std/Test.sol';
import {Vm} from 'forge-std/Vm.sol';

import {Entrypoint} from 'contracts/Entrypoint.sol';
import {Constants} from 'contracts/lib/Constants.sol';
import {IEntrypoint} from 'interfaces/IEntrypoint.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';

import {BULLDOGS_TOKEN, CourseSepolia, IBulldogs} from 'script/CourseDeploy.s.sol';

/**
 * @notice Fork rehearsal: runs the real course deploy script on a Sepolia fork,
 *         then exercises ETH and BULLDOGS deposits against the fresh deployment.
 * @dev Requires ETHEREUM_SEPOLIA_RPC.
 */
contract CourseDeployFork is Test {
  IERC20 internal constant _ETH = IERC20(Constants.NATIVE_ASSET);
  IERC20 internal constant _BULLDOGS = IERC20(BULLDOGS_TOKEN);
  bytes32 internal constant _DEPOSITED_SIG = keccak256('Deposited(address,uint256,uint256,uint256,uint256)');

  address internal _deployer = makeAddr('deployer');
  address internal _postman = makeAddr('postman');
  address internal _student = makeAddr('student');

  CourseSepolia internal _script;
  Entrypoint internal _entrypoint;
  IPrivacyPool internal _ethPool;
  IPrivacyPool internal _tokenPool;

  struct DepositedLog {
    address depositor;
    uint256 commitment;
    uint256 label;
    uint256 value;
    uint256 precommitmentHash;
  }

  function setUp() public {
    vm.createSelectFork(vm.rpcUrl('sepolia'));

    vm.setEnv('OWNER_ADDRESS', vm.toString(_deployer));
    vm.setEnv('POSTMAN_ADDRESS', vm.toString(_postman));
    vm.setEnv('DEPLOYER_ADDRESS', vm.toString(_deployer));
    vm.deal(_deployer, 1 ether);
    vm.deal(_student, 1 ether);

    _script = new CourseSepolia();
    _script.setUp();
    _script.run();

    _entrypoint = _script.entrypoint();
    (_ethPool,,,) = _entrypoint.assetConfig(_ETH);
    (_tokenPool,,,) = _entrypoint.assetConfig(_BULLDOGS);
  }

  function test_poolsAreRegisteredWithCourseConfig() public view {
    _assertPoolConfig(_ETH, _ethPool, 0.001 ether);
    _assertPoolConfig(_BULLDOGS, _tokenPool, 10 ether);
    assertTrue(address(_ethPool) != address(_tokenPool), 'pools must differ');
  }

  function test_rolesAreAssigned() public view {
    assertTrue(_entrypoint.hasRole(keccak256('OWNER_ROLE'), _deployer), 'owner role');
    assertTrue(_entrypoint.hasRole(keccak256('ASP_POSTMAN'), _postman), 'postman role');
    assertFalse(_entrypoint.hasRole(keccak256('ASP_POSTMAN'), _deployer), 'deployer is not postman');
  }

  function test_poolsUseDeployedVerifiers() public view {
    assertEq(address(_ethPool.WITHDRAWAL_VERIFIER()), _script.withdrawalVerifier());
    assertEq(address(_ethPool.RAGEQUIT_VERIFIER()), _script.ragequitVerifier());
    assertEq(address(_tokenPool.WITHDRAWAL_VERIFIER()), _script.withdrawalVerifier());
    assertEq(address(_tokenPool.RAGEQUIT_VERIFIER()), _script.ragequitVerifier());
  }

  function test_ethDeposit() public {
    uint256 _precommitment = _precommitmentFor('eth');
    uint256 _poolBalanceBefore = address(_ethPool).balance;
    uint256 _treeSizeBefore = _ethPool.currentTreeSize();

    vm.recordLogs();
    vm.prank(_student);
    uint256 _commitment = _entrypoint.deposit{value: 0.001 ether}(_precommitment);

    DepositedLog memory _log = _findDeposited(address(_ethPool));
    assertEq(_log.depositor, _student, 'depositor');
    assertEq(_log.commitment, _commitment, 'commitment');
    assertEq(_log.value, 0.001 ether, 'value (zero vetting fee)');
    assertEq(_log.precommitmentHash, _precommitment, 'precommitment');
    assertEq(_ethPool.depositors(_log.label), _student, 'label -> depositor');
    assertEq(address(_ethPool).balance, _poolBalanceBefore + 0.001 ether, 'pool ETH balance');
    assertEq(_ethPool.currentTreeSize(), _treeSizeBefore + 1, 'tree size');
  }

  function test_tokenClaimApproveDeposit() public {
    uint256 _precommitment = _precommitmentFor('bulldogs');

    vm.startPrank(_student);
    IBulldogs(BULLDOGS_TOKEN).claim();
    assertGe(_BULLDOGS.balanceOf(_student), 10 ether, 'claim gives at least 10 BULLDOGS');
    _BULLDOGS.approve(address(_entrypoint), 10 ether);

    uint256 _poolBalanceBefore = _BULLDOGS.balanceOf(address(_tokenPool));
    vm.recordLogs();
    uint256 _commitment = _entrypoint.deposit(_BULLDOGS, 10 ether, _precommitment);
    vm.stopPrank();

    DepositedLog memory _log = _findDeposited(address(_tokenPool));
    assertEq(_log.depositor, _student, 'depositor');
    assertEq(_log.commitment, _commitment, 'commitment');
    assertEq(_log.value, 10 ether, 'value (zero vetting fee)');
    assertEq(_log.precommitmentHash, _precommitment, 'precommitment');
    assertEq(_BULLDOGS.balanceOf(address(_tokenPool)), _poolBalanceBefore + 10 ether, 'pool token balance');
    assertEq(_BULLDOGS.balanceOf(address(_entrypoint)), 0, 'entrypoint keeps no tokens');
  }

  function test_tokenDepositBelowMinimumReverts() public {
    vm.startPrank(_student);
    IBulldogs(BULLDOGS_TOKEN).claim();
    _BULLDOGS.approve(address(_entrypoint), 9 ether);
    vm.expectRevert(IEntrypoint.MinimumDepositAmount.selector);
    _entrypoint.deposit(_BULLDOGS, 9 ether, _precommitmentFor('too-small'));
    vm.stopPrank();
  }

  function _assertPoolConfig(IERC20 _asset, IPrivacyPool _pool, uint256 _expectedMin) internal view {
    (IPrivacyPool _registered, uint256 _min, uint256 _vetting, uint256 _maxRelay) = _entrypoint.assetConfig(_asset);
    assertTrue(address(_registered) != address(0), 'pool registered');
    assertEq(address(_registered), address(_pool), 'assetConfig pool');
    assertEq(_min, _expectedMin, 'minimum deposit');
    assertEq(_vetting, 0, 'vetting fee');
    assertEq(_maxRelay, 100, 'max relay fee');
    assertEq(address(_entrypoint.scopeToPool(_pool.SCOPE())), address(_pool), 'scopeToPool');
    assertEq(_pool.ASSET(), address(_asset), 'pool asset');
    assertEq(address(_pool.ENTRYPOINT()), address(_entrypoint), 'pool entrypoint');
    assertFalse(_pool.dead(), 'pool alive');
  }

  function _precommitmentFor(string memory _tag) internal pure returns (uint256) {
    return uint256(keccak256(abi.encodePacked('course-fork-test', _tag))) % Constants.SNARK_SCALAR_FIELD;
  }

  function _findDeposited(address _pool) internal returns (DepositedLog memory _log) {
    Vm.Log[] memory _logs = vm.getRecordedLogs();
    for (uint256 _i; _i < _logs.length; ++_i) {
      if (_logs[_i].emitter == _pool && _logs[_i].topics[0] == _DEPOSITED_SIG) {
        _log.depositor = address(uint160(uint256(_logs[_i].topics[1])));
        (_log.commitment, _log.label, _log.value, _log.precommitmentHash) =
          abi.decode(_logs[_i].data, (uint256, uint256, uint256, uint256));
        return _log;
      }
    }
    revert('Deposited event not found');
  }
}
