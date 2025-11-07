// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.20;

import "./BFR.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ReputationEscrow is AccessControl {
    BFR public token;
    mapping(address => uint256) public stakeOf;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);

    constructor(address token_) {
        token = BFR(token_);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function stake(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        stakeOf[msg.sender] += amount;
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        require(stakeOf[msg.sender] >= amount, "insufficient");
        stakeOf[msg.sender] -= amount;
        require(token.transfer(msg.sender, amount), "transfer failed");
        emit Unstaked(msg.sender, amount);
    }
}
