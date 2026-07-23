// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Multisender
/// @author You
/// @notice Send native or ERC20 tokens to multiple recipients in one transaction
contract Multisender {
    using SafeERC20 for IERC20;

    /// @notice Emitted after a successful batch send
    event BatchSent(
        address indexed sender,
        address indexed token, // address(0) for native
        uint256 recipients,
        uint256 totalAmount
    );

    // =============================================================
    //                        NATIVE TOKEN
    // =============================================================

    /// @notice Send native tokens (ETH / MATIC / BNB / BASE ETH)
    function sendNative(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable {
        require(recipients.length > 0, "No recipients");
        require(recipients.length == amounts.length, "Length mismatch");

        uint256 total;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        require(msg.value == total, "Incorrect ETH value");

        for (uint256 i = 0; i < recipients.length; i++) {
            (bool success, ) = payable(recipients[i]).call{value: amounts[i]}("");
            require(success, "Native transfer failed");
        }

        emit BatchSent(msg.sender, address(0), recipients.length, total);
    }

    // =============================================================
    //                        ERC20 TOKEN
    // =============================================================

    /// @notice Send ERC20 tokens (requires prior approval)
    function sendERC20(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(token != address(0), "Invalid token");
        require(recipients.length > 0, "No recipients");
        require(recipients.length == amounts.length, "Length mismatch");

        IERC20 erc20 = IERC20(token);
        uint256 total;

        for (uint256 i = 0; i < recipients.length; i++) {
            total += amounts[i];
            erc20.safeTransferFrom(msg.sender, recipients[i], amounts[i]);
        }

        emit BatchSent(msg.sender, token, recipients.length, total);
    }
}
