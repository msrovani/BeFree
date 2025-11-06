// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.20;

import "./Treasury.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract FlagRegistry is AccessControl {
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");
    Treasury public treasury;

    event Resolved(bytes32 indexed postCID, uint8 verdict, uint16 burnBps, uint256 burned);

    constructor(address treasury_) {
        treasury = Treasury(treasury_);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function resolve(bytes32 postCID, uint8 verdict, uint16 burnBps, uint256 relatedAmount) external onlyRole(ARBITER_ROLE) {
        require(burnBps <= 10_000, "bps > 100%");
        uint256 toBurn = (relatedAmount * burnBps) / 10_000;
        treasury.routeAndBurn(toBurn);
        emit Resolved(postCID, verdict, burnBps, toBurn);
    }
}
