// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./AccountingToken.sol";

/*
 * @notice EthPool exposes functions to stake Eth and receive rewards based on the time and share of staked amount.
 */
contract EthPool is Ownable {
  using SafeMath for uint256;

  // Minimum duration of each round of rewards in seconds
  uint256 private constant REWARDS_ROUND_DURATION = 7 days;

  uint256 public lastSnapshotIdForRewards;
  uint256 public lastRecordedSnapshotTimestamp;

  struct RewardRound {
    uint256 snapshotId;
    uint256 amount;
  }

  RewardRound[] lastRewardTimestamps;

  AccountingToken public accToken;

  constructor() {
    // Token used for internal accounting and pegged 1:1 with deposited eth.
    accToken = new AccountingToken();

    lastRecordedSnapshotTimestamp = block.timestamp;
  }

  function stake() external payable {
    require(msg.sender != owner(), 'owner cant stake');

    accToken.mint(msg.sender, msg.value);
  }

  function depositRewards() external payable onlyOwner() {
    require(accToken.totalSupply() > 0, 'Total staked should be greater than zero');
    if(_isNewRewardsRound()) {
      _recordSnapshot();
    }
  }

  function withdraw() external {
    require(accToken.balanceOf(msg.sender) > 0, 'User has no balance');

    uint256 rewards = 0;
    uint256 totalUserDeposits = accToken.balanceOf(msg.sender);

    for (uint32 i = 0 ; i < lastRewardTimestamps.length; i++) {
      uint256 snapshotId = lastRewardTimestamps[i].snapshotId;
      uint256 amount = lastRewardTimestamps[i].amount;
      uint256 totalDepositsAtBlock = accToken.totalSupplyAt(snapshotId);
      uint256 totalUserDepositsAtBlock = accToken.balanceOfAt(msg.sender, snapshotId);
      uint256 userReward = (totalUserDepositsAtBlock.mul(amount)).div(totalDepositsAtBlock);

      rewards = rewards.add(userReward);
    }

    accToken.burn(msg.sender, totalUserDeposits);
    payable(msg.sender).transfer(totalUserDeposits.add(rewards));
  }

  function totalStaked() external view returns(uint256) {
    return accToken.totalSupply();
  }

  function _recordSnapshot() private {
    RewardRound memory r;
    lastSnapshotIdForRewards = accToken.snapshot();
    lastRecordedSnapshotTimestamp = block.timestamp;

    r.snapshotId = lastSnapshotIdForRewards;
    r.amount = msg.value;
    lastRewardTimestamps.push(r);
  }

  function _isNewRewardsRound() private returns (bool) {
    return block.timestamp >= lastRecordedSnapshotTimestamp + REWARDS_ROUND_DURATION;
  }

}