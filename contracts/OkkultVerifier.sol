// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./NullifierRegistry.sol";
import "./ComplianceTree.sol";
import "./interfaces/IOkkultVerifier.sol";

/**
 * @title OkkultVerifier
 * @notice Main contract for verifying zero-knowledge compliance proofs.
 * @dev Integrates with NullifierRegistry and ComplianceTree to ensure proof validity.
 * Implements IOkkultVerifier for protocol integration.
 */
contract OkkultVerifier is IOkkultVerifier {
    /// @notice Interface for the Circom-generated verifier contract.
    interface ICircomVerifier {
        function verifyProof(
            uint[2] calldata a,
            uint[2][2] calldata b,
            uint[2] calldata c,
            uint[2] calldata input
        ) external view returns (bool);
    }

    /// @notice Registry for tracking used nullifiers.
    NullifierRegistry public immutable nullifierRegistry;

    /// @notice Contract managing the compliance Merkle tree.
    ComplianceTree public immutable complianceTree;

    /// @notice Circom verifier for ZK proof validation.
    ICircomVerifier public immutable circomVerifier;

    /// @notice Address to receive proof verification fees.
    address public immutable treasury;

    /// @notice Duration for which a proof remains valid (30 days).
    uint256 public constant PROOF_VALIDITY = 2592000; // 30 * 24 * 3600 seconds

    /// @notice Fee required for proof verification (0.001 ETH).
    uint256 public constant PROOF_FEE = 0.001 ether;

    /// @notice Mapping of user addresses to their proof expiry timestamps.
    mapping(address => uint256) public lastValidProof;

    /**
     * @notice Constructor initializes the contract with required addresses.
     * @param _nullifierRegistry Address of the NullifierRegistry contract.
     * @param _complianceTree Address of the ComplianceTree contract.
     * @param _circomVerifier Address of the Circom verifier contract.
     * @param _treasury Address to receive fees.
     */
    constructor(
        address _nullifierRegistry,
        address _complianceTree,
        address _circomVerifier,
        address _treasury
    ) {
        nullifierRegistry = NullifierRegistry(_nullifierRegistry);
        complianceTree = ComplianceTree(_complianceTree);
        circomVerifier = ICircomVerifier(_circomVerifier);
        treasury = _treasury;
    }

    /**
     * @notice Verifies a zero-knowledge compliance proof.
     * @param proof_a The 'a' component of the Groth16 proof.
     * @param proof_b The 'b' component of the Groth16 proof.
     * @param proof_c The 'c' component of the Groth16 proof.
     * @param publicInputs Array containing [root, nullifier].
     * @return True if the proof is valid and accepted.
     * @dev Requires payment of PROOF_FEE. Updates state to mark nullifier used and set user proof validity.
     */
    function verifyProof(
        uint[2] calldata proof_a,
        uint[2][2] calldata proof_b,
        uint[2] calldata proof_c,
        uint[2] calldata publicInputs
    ) external payable returns (bool) {
        // a. Check sufficient fee payment
        require(msg.value >= PROOF_FEE, "Insufficient fee");

        // b. Extract root from public inputs
        bytes32 root = bytes32(publicInputs[0]);

        // c. Extract nullifier from public inputs
        bytes32 nullifier = bytes32(publicInputs[1]);

        // d. Verify root is in historical roots
        require(complianceTree.isHistoricalRoot(root), "Invalid root");

        // e. Ensure the compliance tree is not outdated
        require(complianceTree.isRootValid(), "Tree outdated");

        // f. Check nullifier has not been used before
        require(!nullifierRegistry.isUsed(nullifier), "Already used");

        // g. Verify the ZK proof with Circom verifier
        require(
            circomVerifier.verifyProof(proof_a, proof_b, proof_c, publicInputs),
            "Invalid ZK proof"
        );

        // h. Mark nullifier as used
        nullifierRegistry.markUsed(nullifier);

        // i. Set proof validity for the user
        uint256 validUntil = block.timestamp + PROOF_VALIDITY;
        lastValidProof[msg.sender] = validUntil;

        // j. Transfer fee to treasury
        payable(treasury).transfer(msg.value);

        // k. Emit verification event
        emit ProofVerified(msg.sender, nullifier, validUntil);

        // l. Return success
        return true;
    }

    /**
     * @notice Checks if a user has a currently valid compliance proof.
     * @param user The address to check.
     * @return True if the user's proof is still valid.
     */
    function hasValidProof(address user) external view returns (bool) {
        return lastValidProof[user] > block.timestamp;
    }

    /**
     * @notice Returns the expiry timestamp of a user's proof.
     * @param user The address to query.
     * @return The timestamp when the proof expires, or 0 if no proof.
     */
    function proofExpiry(address user) external view returns (uint256) {
        return lastValidProof[user];
    }
}
