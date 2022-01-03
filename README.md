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
