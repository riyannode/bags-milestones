/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/bags_milestones.json`.
 */
export type BagsMilestones = {
  "address": "FqSvFQXV86ggp9Td2Nuea7qjJrpfJS91fWsXXcsTaRvz",
  "metadata": {
    "name": "bagsMilestones",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimMilestone",
      "docs": [
        "Creator claims that milestone `index` is complete. Opens a 72h voting",
        "window and stores the snapshot Merkle root + total supply that voters",
        "will be checked against.",
        "",
        "Off-chain, the caller MUST build a Merkle tree whose leaves are",
        "`keccak(voter_pubkey || balance.to_le_bytes())` for every holder of",
        "the token at the current slot. The root is committed on-chain; the",
        "`MilestoneClaimed` event emits the snapshot slot so any indexer can",
        "independently rebuild the same tree and verify the root."
      ],
      "discriminator": [
        211,
        134,
        152,
        37,
        3,
        82,
        214,
        189
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.token_mint",
                "account": "milestoneVault"
              }
            ]
          }
        },
        {
          "name": "milestone",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "evidenceUrl",
          "type": "string"
        },
        {
          "name": "snapshotRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "snapshotTotalSupply",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositRoyalty",
      "docs": [
        "Top up the escrow PDA. Anyone can deposit (creator forwarding royalties,",
        "a webhook crank, etc.). The on-chain `escrow_balance` tracks deposits",
        "for UI convenience; `finalize_milestone` always reconciles against the",
        "PDA's actual lamport balance so out-of-band deposits also count."
      ],
      "discriminator": [
        234,
        6,
        85,
        217,
        36,
        30,
        33,
        127
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.token_mint",
                "account": "milestoneVault"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault.token_mint",
                "account": "milestoneVault"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "finalizeMilestone",
      "docs": [
        "Finalize a milestone after the voting window closes. Permissionless —",
        "anyone may call to pay the gas. Honors quorum: if total turnout is",
        "below `quorum_bps` of the snapshot supply, the milestone is marked",
        "`Rejected` regardless of approve/reject ratio (the creator may",
        "re-claim with a fresh evidence + snapshot). Otherwise a strict",
        "majority of approve over reject releases the funds.",
        "",
        "Payout is capped at the actual liquid lamport balance of the escrow",
        "PDA (`escrow.lamports() - rent_exempt_min`). This means out-of-band",
        "SOL transfers into the PDA are payable, and a partial payout is",
        "emitted via `MilestoneFinalized.payout` if the escrow is short of",
        "`amount_locked`."
      ],
      "discriminator": [
        7,
        134,
        89,
        13,
        34,
        31,
        108,
        149
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Anyone — the caller pays gas; rewards (if any) go to the creator."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "creator",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.token_mint",
                "account": "milestoneVault"
              }
            ]
          }
        },
        {
          "name": "milestone",
          "writable": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault.token_mint",
                "account": "milestoneVault"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeVault",
      "docs": [
        "Initialize a `MilestoneVault` for a given Bags token.",
        "The signer becomes the creator authority for the vault."
      ],
      "discriminator": [
        48,
        191,
        163,
        44,
        71,
        129,
        63,
        164
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "docs": [
            "Escrow PDA that physically holds the locked SOL.",
            "Owned by this program so we can debit it inside `finalize_milestone`."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "setMilestone",
      "docs": [
        "Creator commits to milestone `index` (0..MAX_MILESTONES).",
        "Re-calling with the same index while it is still `Pending` overwrites",
        "the previous commitment; once voting starts the milestone is locked."
      ],
      "discriminator": [
        174,
        213,
        91,
        82,
        156,
        42,
        105,
        3
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.token_mint",
                "account": "milestoneVault"
              }
            ]
          }
        },
        {
          "name": "milestone",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "deadline",
          "type": "i64"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "vote",
      "docs": [
        "Cast a vote on a `Claimed` milestone. The voter proves their balance",
        "at the snapshot slot via a Merkle inclusion proof against",
        "`milestone.snapshot_root`. The proven weight is what counts —",
        "buying tokens after claim does not inflate vote power.",
        "",
        "Anti-double-vote is enforced by the `VoteRecord` PDA being created",
        "fresh (seeded by `claim_timestamp`, so each re-claim opens a new",
        "round of votes)."
      ],
      "discriminator": [
        227,
        110,
        155,
        23,
        136,
        126,
        172,
        25
      ],
      "accounts": [
        {
          "name": "voter",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.token_mint",
                "account": "milestoneVault"
              }
            ]
          }
        },
        {
          "name": "milestone",
          "writable": true
        },
        {
          "name": "voteRecord",
          "docs": [
            "Vote record PDA. Seeded by `claim_timestamp` so a fresh PDA is",
            "allocated per claim round — voters from a Rejected round are not",
            "locked out of the next round."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "milestone"
              },
              {
                "kind": "account",
                "path": "milestone.claim_timestamp",
                "account": "milestone"
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "approve",
          "type": "bool"
        },
        {
          "name": "claimedWeight",
          "type": "u64"
        },
        {
          "name": "proof",
          "type": {
            "vec": {
              "array": [
                "u8",
                32
              ]
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "milestone",
      "discriminator": [
        38,
        210,
        239,
        177,
        85,
        184,
        10,
        44
      ]
    },
    {
      "name": "milestoneVault",
      "discriminator": [
        102,
        252,
        135,
        167,
        252,
        224,
        122,
        1
      ]
    },
    {
      "name": "voteRecord",
      "discriminator": [
        112,
        9,
        123,
        165,
        234,
        9,
        157,
        167
      ]
    }
  ],
  "events": [
    {
      "name": "milestoneClaimed",
      "discriminator": [
        239,
        148,
        18,
        25,
        177,
        1,
        39,
        40
      ]
    },
    {
      "name": "milestoneFinalized",
      "discriminator": [
        111,
        135,
        213,
        124,
        28,
        224,
        152,
        217
      ]
    },
    {
      "name": "milestoneSet",
      "discriminator": [
        18,
        247,
        244,
        42,
        211,
        18,
        157,
        101
      ]
    },
    {
      "name": "royaltyDeposited",
      "discriminator": [
        87,
        50,
        218,
        173,
        18,
        216,
        222,
        153
      ]
    },
    {
      "name": "vaultInitialized",
      "discriminator": [
        180,
        43,
        207,
        2,
        18,
        71,
        3,
        75
      ]
    },
    {
      "name": "voteCast",
      "discriminator": [
        39,
        53,
        195,
        104,
        188,
        17,
        225,
        213
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Caller is not authorized for this action."
    },
    {
      "code": 6001,
      "name": "milestoneIndexOutOfRange",
      "msg": "Milestone index out of range (0..MAX_MILESTONES)."
    },
    {
      "code": 6002,
      "name": "titleTooLong",
      "msg": "Title exceeds maximum length."
    },
    {
      "code": 6003,
      "name": "descriptionTooLong",
      "msg": "Description exceeds maximum length."
    },
    {
      "code": 6004,
      "name": "evidenceUrlTooLong",
      "msg": "Evidence URL exceeds maximum length."
    },
    {
      "code": 6005,
      "name": "invalidAmount",
      "msg": "Amount must be > 0."
    },
    {
      "code": 6006,
      "name": "deadlineInPast",
      "msg": "Deadline must be in the future."
    },
    {
      "code": 6007,
      "name": "milestoneLocked",
      "msg": "Milestone is locked and cannot be edited."
    },
    {
      "code": 6008,
      "name": "milestoneNotClaimable",
      "msg": "Milestone cannot be claimed in its current state."
    },
    {
      "code": 6009,
      "name": "milestoneNotInVoting",
      "msg": "Milestone is not currently open for voting."
    },
    {
      "code": 6010,
      "name": "votingEnded",
      "msg": "Voting window has ended."
    },
    {
      "code": 6011,
      "name": "votingNotEnded",
      "msg": "Voting window has not yet ended."
    },
    {
      "code": 6012,
      "name": "milestoneNotFinalizable",
      "msg": "Milestone cannot be finalized in its current state."
    },
    {
      "code": 6013,
      "name": "zeroVoteWeight",
      "msg": "Voter has zero token weight at snapshot."
    },
    {
      "code": 6014,
      "name": "milestoneVaultMismatch",
      "msg": "Milestone does not belong to this vault."
    },
    {
      "code": 6015,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow."
    },
    {
      "code": 6016,
      "name": "claimDeadlinePassed",
      "msg": "Claim deadline + grace period has passed; reset the milestone."
    },
    {
      "code": 6017,
      "name": "invalidSnapshotSupply",
      "msg": "Snapshot total supply must be > 0."
    },
    {
      "code": 6018,
      "name": "invalidMerkleProof",
      "msg": "Merkle inclusion proof failed verification."
    },
    {
      "code": 6019,
      "name": "merkleProofTooLong",
      "msg": "Merkle proof exceeds maximum allowed length."
    },
    {
      "code": 6020,
      "name": "escrowRentExemptViolation",
      "msg": "Escrow PDA cannot be drained below the rent-exempt minimum."
    }
  ],
  "types": [
    {
      "name": "milestone",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "amountLocked",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "milestoneStatus"
              }
            }
          },
          {
            "name": "claimTimestamp",
            "type": "i64"
          },
          {
            "name": "votesApprove",
            "type": "u64"
          },
          {
            "name": "votesReject",
            "type": "u64"
          },
          {
            "name": "votingEnds",
            "type": "i64"
          },
          {
            "name": "snapshotSlot",
            "type": "u64"
          },
          {
            "name": "snapshotRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "snapshotTotalSupply",
            "type": "u64"
          },
          {
            "name": "evidenceUrl",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "milestoneClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "votingEnds",
            "type": "i64"
          },
          {
            "name": "snapshotSlot",
            "type": "u64"
          },
          {
            "name": "snapshotRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "snapshotTotalSupply",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "milestoneFinalized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "approved",
            "type": "bool"
          },
          {
            "name": "payout",
            "type": "u64"
          },
          {
            "name": "quorumMet",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "milestoneSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "deadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "milestoneStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "claimed"
          },
          {
            "name": "approved"
          },
          {
            "name": "rejected"
          }
        ]
      }
    },
    {
      "name": "milestoneVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "escrowBalance",
            "type": "u64"
          },
          {
            "name": "milestoneCount",
            "type": "u8"
          },
          {
            "name": "quorumBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "escrowBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "royaltyDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vaultInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "quorumBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "voteCast",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "milestone",
            "type": "pubkey"
          },
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "approve",
            "type": "bool"
          },
          {
            "name": "weight",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "voteRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "milestone",
            "type": "pubkey"
          },
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "vote",
            "type": "bool"
          },
          {
            "name": "tokenWeight",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
