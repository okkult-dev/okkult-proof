// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ComplianceTree
 * @notice Manages the Merkle root of the compliance set on-chain.
 * @dev The compliance set is a Merkle tree of non-sanctioned wallet addresses.
 * The root is updated periodically by an off-chain service when sanctions data changes.
 * Historical roots are maintained to allow proofs against recent versions.
 */
contract ComplianceTree {
    /// @notice The latest valid Merkle root of the compliance set.
    bytes32 public currentRoot;

    /// @notice Array of historical Merkle roots for proof validation.
    bytes32[] public rootHistory;

    /// @notice Address authorized to update the root (multisig or DAO).
    address public updater;

    /// @notice Timestamp of the last root update.
    uint256 public lastUpdated;

    /// @notice Maximum age for a root to be considered valid (48 hours).
    uint256 public constant MAX_ROOT_AGE = 172800; // 48 * 3600 seconds

    /// @notice Maximum number of historical roots to store.
    uint256 public constant ROOT_HISTORY_SIZE = 100;

    /// @notice Emitted when the root is updated.
    event RootUpdated(
        bytes32 indexed newRoot,
        bytes32 indexed oldRoot,
        uint256 timestamp
    );

    /// @notice Modifier to restrict access to the updater.
    modifier onlyUpdater() {
        require(msg.sender == updater, "Only updater");
        _;
    }

    /**
     * @notice Constructor initializes the contract with the initial root and updater.
     * @param _initialRoot The initial Merkle root.
     * @param _updater The address allowed to update the root.
     */
    constructor(bytes32 _initialRoot, address _updater) {
        require(_initialRoot != bytes32(0), "Invalid initial root");
        currentRoot = _initialRoot;
        updater = _updater;
        lastUpdated = block.timestamp;
        rootHistory.push(_initialRoot);
    }

    /**
     * @notice Updates the Merkle root. Only callable by the updater.
     * @param newRoot The new Merkle root to set.
     * @dev Implements a circular buffer for rootHistory to cap storage costs.
     * Rotates historical roots to maintain the most recent ones.
     */
    function updateRoot(bytes32 newRoot) external onlyUpdater {
        require(newRoot != bytes32(0), "Invalid root");
        bytes32 oldRoot = currentRoot;
        currentRoot = newRoot;
        lastUpdated = block.timestamp;

        // Circular buffer: maintain up to ROOT_HISTORY_SIZE roots
        if (rootHistory.length < ROOT_HISTORY_SIZE) {
            rootHistory.push(newRoot);
        } else {
            // Shift elements left to remove the oldest root
            for (uint256 i = 0; i < ROOT_HISTORY_SIZE - 1; i++) {
                rootHistory[i] = rootHistory[i + 1];
            }
            rootHistory[ROOT_HISTORY_SIZE - 1] = newRoot;
        }

        emit RootUpdated(newRoot, oldRoot, block.timestamp);
    }

    /**
     * @notice Checks if the current root is still valid (not too old).
     * @return True if the root is within the maximum age, false otherwise.
     * @dev Used by verifiers to reject proofs against stale roots.
     */
    function isRootValid() external view returns (bool) {
        return (block.timestamp - lastUpdated) <= MAX_ROOT_AGE;
    }

    /**
     * @notice Checks if a given root exists in the historical roots.
     * @param root The root to check.
     * @return True if the root is in history, false otherwise.
     * @dev Allows validation of proofs generated against recent historical roots.
     */
    function isHistoricalRoot(bytes32 root) external view returns (bool) {
        for (uint256 i = 0; i < rootHistory.length; i++) {
            if (rootHistory[i] == root) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Returns the number of roots in the history.
     * @return The length of the rootHistory array.
     * @dev Useful for off-chain monitoring and analytics.
     */
    function getRootHistoryLength() external view returns (uint256) {
        return rootHistory.length;
    }
}
