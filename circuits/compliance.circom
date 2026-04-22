pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/mux1.circom";

// MerkleProof template verifies a Merkle path for a given leaf
// Computes the root from leaf, pathElements, and pathIndices
template MerkleProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    signal nodes[levels + 1];
    nodes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // Compute both possible hashes: left and right
        component hash_left = Poseidon(2);
        hash_left.inputs[0] <== nodes[i];
        hash_left.inputs[1] <== pathElements[i];

        component hash_right = Poseidon(2);
        hash_right.inputs[0] <== pathElements[i];
        hash_right.inputs[1] <== nodes[i];

        // Select the correct hash based on pathIndices[i]
        // mux1(s, a, b) = (1-s)*a + s*b
        // If pathIndices[i] == 0, use hash_left (leaf is left child)
        // If pathIndices[i] == 1, use hash_right (leaf is right child)
        component selector = Mux1();
        selector.s <== pathIndices[i];
        selector.c[0] <== hash_left.out;
        selector.c[1] <== hash_right.out;

        nodes[i + 1] <== selector.out;
    }

    root <== nodes[levels];
}

// ComplianceProof template implements the ZK compliance proof
// Verifies nullifier computation and Merkle tree inclusion
template ComplianceProof(levels) {
    signal input address;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input root;
    signal input nullifier;

    // Constraint 1: Verify nullifier computation
    // nullifier must equal Poseidon(address, secret)
    // This proves ownership of the address without revealing it
    // Same address+secret always produces same nullifier
    // Different secret produces different nullifier
    component nullifier_hash = Poseidon(2);
    nullifier_hash.inputs[0] <== address;
    nullifier_hash.inputs[1] <== secret;
    nullifier_hash.out === nullifier;

    // Constraint 2: Verify Merkle path validity
    // Recompute root from leaf=address and pathElements
    // Final computed root must equal public input root
    // Tree depth = levels (supports 2^levels addresses)
    component merkle_proof = MerkleProof(levels);
    merkle_proof.leaf <== address;
    for (var i = 0; i < levels; i++) {
        merkle_proof.pathElements[i] <== pathElements[i];
        merkle_proof.pathIndices[i] <== pathIndices[i];
    }
    merkle_proof.root === root;

    // Constraint 3: Leaf equals address
    // This is implicitly enforced by setting merkle_proof.leaf <== address
    // The Merkle proof verifies that this address is in the tree
}

// Main component declaration
// Public inputs: root and nullifier
// Private inputs: address, secret, pathElements, pathIndices
component main {public [root, nullifier]} = ComplianceProof(20);