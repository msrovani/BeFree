// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.20;

import "./FREE.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ElasticIssuance is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    uint256 public E_MIN;
    uint256 public ALPHA;
    FREE public token;

    event Emitted(uint256 dayIndex, uint256 amount);

    constructor(address token_, uint256 eMin, uint256 alpha) {
        token = FREE(token_);
        E_MIN = eMin;
        ALPHA = alpha;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function updateActivity(uint256 dayIndex, uint256 normActivity) external onlyRole(ORACLE_ROLE) {
        uint256 emission = E_MIN + (ALPHA * normActivity);
        token.mint(address(this), emission);
        emit Emitted(dayIndex, emission);
    }
}
