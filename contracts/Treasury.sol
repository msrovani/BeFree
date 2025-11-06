// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.20;

import "./FREE.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Treasury is AccessControl {
    FREE public token;
    address public burnAddress = 0x000000000000000000000000000000000000dEaD;

    constructor(address token_) {
        token = FREE(token_);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function routeAndBurn(uint256 amountToBurn) external onlyRole(DEFAULT_ADMIN_ROLE) {
        token.transfer(burnAddress, amountToBurn);
    }
}
