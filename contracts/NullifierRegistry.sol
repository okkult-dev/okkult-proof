// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NullifierRegistry
 * @notice Stores nullifiers that have already been used to prevent double-spending in ZK proofs.
 * @dev A nullifier is a unique hash derived from (address + secret). Once used, it can never be used again.
 * This contract is part of Okkult Protocol's zero-knowledge privacy infrastructure for Ethereum.
 */
contract NullifierRegistry {
    /// @notice Mapping to track used nullifiers. True if the nullifier has been spent.
    mapping(bytes32 => bool) public usedNullifiers;

    /// @notice Address of the OkkultVerifier contract that can register nullifiers.
    address public immutable verifier;

    /// @notice Emitted when a nullifier is marked as used.
    event NullifierUsed(bytes32 indexed nullifier);

    /// @notice Modifier to restrict access to the verifier contract only.
    modifier onlyVerifier() {
        require(msg.sender == verifier, "Only verifier");
        _;
    }

    /**
     * @notice Constructor sets the verifier address.
     * @param _verifier The address of the OkkultVerifier contract.
     */
    constructor(address _verifier) {
        verifier = _verifier;
    }

    /**
     * @notice Checks if a nullifier has been used before.
     * @param nullifier The nullifier hash to check.
     * @return True if the nullifier has been used, false otherwise.
     * @dev Gas-efficient O(1) mapping lookup.
     */
    function isUsed(bytes32 nullifier) external view returns (bool) {
        return usedNullifiers[nullifier];
    }

    /**
     * @notice Marks a nullifier as used. Can only be called by the verifier.
     * @param nullifier The nullifier hash to mark as used.
     * @dev Prevents the same ZK proof from being submitted twice. Reverts if already used.
     */
    function markUsed(bytes32 nullifier) external onlyVerifier {
        require(!usedNullifiers[nullifier], "Already used");
        usedNullifiers[nullifier] = true;
        emit NullifierUsed(nullifier);
    }
}
