# Eth Pool

> Simple contract to stake eth to a pool and get rewards for staking.

# Assumptions

- Rewards are deposited only once per cycle.
- Users can't withdraw partial amount (this wasn't clear in the requirement either if they are allowed to withdraw partial)

# Algorithm

- Users are allocated an accounting token when they stake eth.
- The accounting token is ERC20Snapshot
- At every deposit of rewards, the snapshot is recorded.
- This snapshot record is then used to calculate the rewards of the user once the user withdraws

# Deployment

A verified contract is deployed on ropsten at https://ropsten.etherscan.io/address/0x964064Ee15BAbA0D00D9Eae4D5e22aD38d384827

# Hardhat task to find the total staked ETH

Run `yarn totalStaked` to find the total staked eth in the contract.
