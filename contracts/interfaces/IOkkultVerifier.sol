// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOkkultVerifier
 * @notice Interface for Okkult compliance proof verification.
 * @dev Protocols can import this to check user compliance proofs.
 * Enables zero-knowledge compliance without revealing user addresses.
 */
interface IOkkultVerifier {
    /**
     * @notice Emitted when a proof is successfully verified.
     * @param prover The address that submitted the proof.
     * @param nullifier The unique nullifier hash for the proof.
     * @param validUntil Timestamp until the proof remains valid.
     */
    event ProofVerified(
        address indexed prover,
        bytes32 indexed nullifier,
        uint256 validUntil
    );

    /**
     * @notice Verifies a zero-knowledge compliance proof on-chain.
     * @param proof_a The 'a' component of the Groth16 proof.
     * @param proof_b The 'b' component of the Groth16 proof.
     * @param proof_c The 'c' component of the Groth16 proof.
     * @param publicInputs Array containing [root, nullifier].
     * @return True if the proof is valid, false otherwise.
     * @dev Payable to allow for potential gas optimizations or fees.
     */
    function verifyProof(
        uint[2] calldata proof_a,
        uint[2][2] calldata proof_b,
        uint[2] calldata proof_c,
        uint[2] calldata publicInputs
    ) external payable returns (bool);

    /**
     * @notice Checks if a user has a currently valid compliance proof.
     * @param user The address to check.
     * @return True if the user has a valid, non-expired proof.
     */
    function hasValidProof(address user) external view returns (bool);

    /**
     * @notice Returns the expiry timestamp of a user's proof.
     * @param user The address to query.
     * @return The timestamp when the proof expires, or 0 if no proof exists.
     */
    function proofExpiry(address user) external view returns (uint256);
}
