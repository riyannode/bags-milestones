//! Bags Milestones — Solana smart contract.
//!
//! Adds an accountability + governance layer on top of the Bags.fm
//! creator-token economy. Creators lock royalties into a per-token
//! escrow vault, publicly commit to up to 5 milestones, and only unlock
//! funds after holders vote to approve a milestone claim.
//!
//! High-level flow:
//! 1. `initialize_vault`  — creator opts into Milestones for a token.
//! 2. `set_milestone`     — creator commits to milestone (title, deadline, amount).
//! 3. `deposit_royalty`   — anyone can top up the escrow (typically the creator
//!    forwarding royalties received from Bags).
//! 4. `claim_milestone`   — creator submits evidence + an off-chain Merkle root
//!    of holder balances at the snapshot slot, opening a 72h voting window.
//! 5. `vote`              — token holders vote approve/reject. Vote weight is
//!    **proven** via a Merkle proof against the snapshot root, so a holder's
//!    weight equals their balance at the snapshot slot — buying tokens after
//!    claim does not inflate vote power.
//! 6. `finalize_milestone`— anyone can call after voting ends. Honors a quorum
//!    threshold (default 5% of snapshot supply) and releases funds on majority
//!    approve.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;
use anchor_lang::system_program;

declare_id!("FqSvFQXV86ggp9Td2Nuea7qjJrpfJS91fWsXXcsTaRvz");

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

/// Maximum number of milestones a creator can commit to per token.
pub const MAX_MILESTONES: u8 = 5;

/// Maximum length of a milestone title in bytes.
pub const MAX_TITLE_LEN: usize = 64;

/// Maximum length of a milestone description in bytes.
pub const MAX_DESCRIPTION_LEN: usize = 256;

/// Maximum length of an evidence URL in bytes.
pub const MAX_EVIDENCE_URL_LEN: usize = 256;

/// Voting window duration once a milestone is claimed (72 hours).
pub const VOTING_DURATION_SECS: i64 = 72 * 60 * 60;

/// Grace period after `milestone.deadline` during which the creator may
/// still claim the milestone. After this grace, claims are rejected and
/// the creator must re-set a new deadline. This is what gives the
/// `deadline` field on-chain teeth.
pub const CLAIM_GRACE_PERIOD_SECS: i64 = 7 * 24 * 60 * 60;

/// Default quorum threshold in basis points (1 bps = 0.01%).
/// `(votes_approve + votes_reject) * 10_000 >= snapshot_total_supply * quorum_bps`
/// Default is 5% of the snapshot supply — without it a single whale
/// (often the creator at launch) can self-approve trivially.
pub const DEFAULT_QUORUM_BPS: u16 = 500;

/// Maximum length of a Merkle inclusion proof (in 32-byte siblings).
/// `2^32` voters fits easily; capping the length protects against
/// griefing via oversized proofs and keeps the tx size bounded.
pub const MAX_MERKLE_PROOF_LEN: usize = 32;

// PDA seed prefixes
pub const VAULT_SEED: &[u8] = b"vault";
pub const MILESTONE_SEED: &[u8] = b"milestone";
pub const VOTE_SEED: &[u8] = b"vote";
pub const ESCROW_SEED: &[u8] = b"escrow";

// ---------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------

#[program]
pub mod bags_milestones {
    use super::*;

    /// Initialize a `MilestoneVault` for a given Bags token.
    /// The signer becomes the creator authority for the vault.
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.creator = ctx.accounts.creator.key();
        vault.token_mint = ctx.accounts.token_mint.key();
        vault.escrow_balance = 0;
        vault.milestone_count = 0;
        vault.quorum_bps = DEFAULT_QUORUM_BPS;
        vault.bump = ctx.bumps.vault;
        vault.escrow_bump = ctx.bumps.escrow;

        emit!(VaultInitialized {
            vault: vault.key(),
            creator: vault.creator,
            token_mint: vault.token_mint,
            quorum_bps: vault.quorum_bps,
        });
        Ok(())
    }

    /// Creator commits to milestone `index` (0..MAX_MILESTONES).
    /// Re-calling with the same index while it is still `Pending` overwrites
    /// the previous commitment; once voting starts the milestone is locked.
    pub fn set_milestone(
        ctx: Context<SetMilestone>,
        index: u8,
        title: String,
        description: String,
        deadline: i64,
        amount: u64,
    ) -> Result<()> {
        require!(index < MAX_MILESTONES, BagsError::MilestoneIndexOutOfRange);
        require!(title.len() <= MAX_TITLE_LEN, BagsError::TitleTooLong);
        require!(
            description.len() <= MAX_DESCRIPTION_LEN,
            BagsError::DescriptionTooLong
        );
        require!(amount > 0, BagsError::InvalidAmount);

        let now = Clock::get()?.unix_timestamp;
        require!(deadline > now, BagsError::DeadlineInPast);

        let milestone = &mut ctx.accounts.milestone;

        if milestone.vault != Pubkey::default() {
            require!(
                matches!(milestone.status, MilestoneStatus::Pending),
                BagsError::MilestoneLocked
            );
        } else {
            let vault = &mut ctx.accounts.vault;
            if index >= vault.milestone_count {
                vault.milestone_count = index + 1;
            }
        }

        milestone.vault = ctx.accounts.vault.key();
        milestone.index = index;
        milestone.title = title;
        milestone.description = description;
        milestone.deadline = deadline;
        milestone.amount_locked = amount;
        milestone.status = MilestoneStatus::Pending;
        milestone.claim_timestamp = 0;
        milestone.votes_approve = 0;
        milestone.votes_reject = 0;
        milestone.voting_ends = 0;
        milestone.snapshot_slot = 0;
        milestone.snapshot_root = [0u8; 32];
        milestone.snapshot_total_supply = 0;
        milestone.evidence_url = String::new();
        milestone.bump = ctx.bumps.milestone;

        emit!(MilestoneSet {
            vault: milestone.vault,
            index,
            amount,
            deadline,
        });
        Ok(())
    }

    /// Top up the escrow PDA. Anyone can deposit (creator forwarding royalties,
    /// a webhook crank, etc.). The on-chain `escrow_balance` tracks deposits
    /// for UI convenience; `finalize_milestone` always reconciles against the
    /// PDA's actual lamport balance so out-of-band deposits also count.
    pub fn deposit_royalty(ctx: Context<DepositRoyalty>, amount: u64) -> Result<()> {
        require!(amount > 0, BagsError::InvalidAmount);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.depositor.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            amount,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.escrow_balance = vault
            .escrow_balance
            .checked_add(amount)
            .ok_or(BagsError::ArithmeticOverflow)?;

        emit!(RoyaltyDeposited {
            vault: vault.key(),
            depositor: ctx.accounts.depositor.key(),
            amount,
        });
        Ok(())
    }

    /// Creator claims that milestone `index` is complete. Opens a 72h voting
    /// window and stores the snapshot Merkle root + total supply that voters
    /// will be checked against.
    ///
    /// Off-chain, the caller MUST build a Merkle tree whose leaves are
    /// `keccak(voter_pubkey || balance.to_le_bytes())` for every holder of
    /// the token at the current slot. The root is committed on-chain; the
    /// `MilestoneClaimed` event emits the snapshot slot so any indexer can
    /// independently rebuild the same tree and verify the root.
    pub fn claim_milestone(
        ctx: Context<ClaimMilestone>,
        _index: u8,
        evidence_url: String,
        snapshot_root: [u8; 32],
        snapshot_total_supply: u64,
    ) -> Result<()> {
        require!(
            evidence_url.len() <= MAX_EVIDENCE_URL_LEN,
            BagsError::EvidenceUrlTooLong
        );
        require!(snapshot_total_supply > 0, BagsError::InvalidSnapshotSupply);

        let milestone = &mut ctx.accounts.milestone;
        require!(
            matches!(
                milestone.status,
                MilestoneStatus::Pending | MilestoneStatus::Rejected
            ),
            BagsError::MilestoneNotClaimable
        );

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;
        let claim_cutoff = milestone
            .deadline
            .checked_add(CLAIM_GRACE_PERIOD_SECS)
            .ok_or(BagsError::ArithmeticOverflow)?;
        require!(now <= claim_cutoff, BagsError::ClaimDeadlinePassed);

        milestone.status = MilestoneStatus::Claimed;
        milestone.claim_timestamp = now;
        milestone.voting_ends = now
            .checked_add(VOTING_DURATION_SECS)
            .ok_or(BagsError::ArithmeticOverflow)?;
        milestone.snapshot_slot = clock.slot;
        milestone.snapshot_root = snapshot_root;
        milestone.snapshot_total_supply = snapshot_total_supply;
        milestone.votes_approve = 0;
        milestone.votes_reject = 0;
        milestone.evidence_url = evidence_url;

        emit!(MilestoneClaimed {
            vault: milestone.vault,
            index: milestone.index,
            voting_ends: milestone.voting_ends,
            snapshot_slot: milestone.snapshot_slot,
            snapshot_root,
            snapshot_total_supply,
        });
        Ok(())
    }

    /// Cast a vote on a `Claimed` milestone. The voter proves their balance
    /// at the snapshot slot via a Merkle inclusion proof against
    /// `milestone.snapshot_root`. The proven weight is what counts —
    /// buying tokens after claim does not inflate vote power.
    ///
    /// Anti-double-vote is enforced by the `VoteRecord` PDA being created
    /// fresh (seeded by `claim_timestamp`, so each re-claim opens a new
    /// round of votes).
    pub fn vote(
        ctx: Context<Vote>,
        _index: u8,
        approve: bool,
        claimed_weight: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let milestone = &mut ctx.accounts.milestone;
        let vote_record = &mut ctx.accounts.vote_record;

        require!(
            matches!(milestone.status, MilestoneStatus::Claimed),
            BagsError::MilestoneNotInVoting
        );

        let now = Clock::get()?.unix_timestamp;
        require!(now < milestone.voting_ends, BagsError::VotingEnded);

        require!(claimed_weight > 0, BagsError::ZeroVoteWeight);
        require!(
            proof.len() <= MAX_MERKLE_PROOF_LEN,
            BagsError::MerkleProofTooLong
        );

        let leaf = leaf_hash(&ctx.accounts.voter.key(), claimed_weight);
        require!(
            verify_merkle(&leaf, &proof, &milestone.snapshot_root),
            BagsError::InvalidMerkleProof
        );

        if approve {
            milestone.votes_approve = milestone
                .votes_approve
                .checked_add(claimed_weight)
                .ok_or(BagsError::ArithmeticOverflow)?;
        } else {
            milestone.votes_reject = milestone
                .votes_reject
                .checked_add(claimed_weight)
                .ok_or(BagsError::ArithmeticOverflow)?;
        }

        vote_record.milestone = milestone.key();
        vote_record.voter = ctx.accounts.voter.key();
        vote_record.vote = approve;
        vote_record.token_weight = claimed_weight;
        vote_record.bump = ctx.bumps.vote_record;

        emit!(VoteCast {
            milestone: milestone.key(),
            voter: vote_record.voter,
            approve,
            weight: claimed_weight,
        });
        Ok(())
    }

    /// Finalize a milestone after the voting window closes. Permissionless —
    /// anyone may call to pay the gas. Honors quorum: if total turnout is
    /// below `quorum_bps` of the snapshot supply, the milestone is marked
    /// `Rejected` regardless of approve/reject ratio (the creator may
    /// re-claim with a fresh evidence + snapshot). Otherwise a strict
    /// majority of approve over reject releases the funds.
    ///
    /// Payout is capped at the actual liquid lamport balance of the escrow
    /// PDA (`escrow.lamports() - rent_exempt_min`). This means out-of-band
    /// SOL transfers into the PDA are payable, and a partial payout is
    /// emitted via `MilestoneFinalized.payout` if the escrow is short of
    /// `amount_locked`.
    pub fn finalize_milestone(ctx: Context<FinalizeMilestone>, _index: u8) -> Result<()> {
        let milestone = &mut ctx.accounts.milestone;
        require!(
            matches!(milestone.status, MilestoneStatus::Claimed),
            BagsError::MilestoneNotFinalizable
        );

        let now = Clock::get()?.unix_timestamp;
        require!(now >= milestone.voting_ends, BagsError::VotingNotEnded);

        let total_votes = milestone
            .votes_approve
            .checked_add(milestone.votes_reject)
            .ok_or(BagsError::ArithmeticOverflow)?;

        // Quorum: total_votes * 10_000 >= supply * quorum_bps. Computed in
        // u128 so a 100% turnout on a maxed-out u64 supply doesn't overflow.
        let quorum_bps = ctx.accounts.vault.quorum_bps as u128;
        let supply = milestone.snapshot_total_supply as u128;
        let quorum_threshold = supply
            .checked_mul(quorum_bps)
            .ok_or(BagsError::ArithmeticOverflow)?;
        let turnout = (total_votes as u128)
            .checked_mul(10_000)
            .ok_or(BagsError::ArithmeticOverflow)?;
        let quorum_met = turnout >= quorum_threshold;

        if quorum_met && milestone.votes_approve > milestone.votes_reject {
            // Approved → release `amount_locked` (capped to liquid escrow) to creator.
            let escrow_info = ctx.accounts.escrow.to_account_info();
            let creator_info = ctx.accounts.creator.to_account_info();

            let rent = Rent::get()?;
            let rent_exempt_min = rent.minimum_balance(escrow_info.data_len());
            let liquid = escrow_info.lamports().saturating_sub(rent_exempt_min);
            let payout = milestone.amount_locked.min(liquid);

            if payout > 0 {
                // Direct lamport debit/credit on PDA (owned by this program).
                let new_escrow = escrow_info
                    .lamports()
                    .checked_sub(payout)
                    .ok_or(BagsError::ArithmeticOverflow)?;
                require!(
                    new_escrow >= rent_exempt_min,
                    BagsError::EscrowRentExemptViolation
                );

                **escrow_info.try_borrow_mut_lamports()? = new_escrow;
                **creator_info.try_borrow_mut_lamports()? = creator_info
                    .lamports()
                    .checked_add(payout)
                    .ok_or(BagsError::ArithmeticOverflow)?;

                let vault = &mut ctx.accounts.vault;
                vault.escrow_balance = vault.escrow_balance.saturating_sub(payout);
            }

            milestone.status = MilestoneStatus::Approved;
            emit!(MilestoneFinalized {
                vault: milestone.vault,
                index: milestone.index,
                approved: true,
                payout,
                quorum_met: true,
            });
        } else {
            milestone.status = MilestoneStatus::Rejected;
            emit!(MilestoneFinalized {
                vault: milestone.vault,
                index: milestone.index,
                approved: false,
                payout: 0,
                quorum_met,
            });
        }

        Ok(())
    }
}

// ---------------------------------------------------------------------
// Merkle helpers
// ---------------------------------------------------------------------

/// Hash a voter / balance pair into a Merkle leaf.
///
/// `keccak(voter_pubkey || balance.to_le_bytes())`. Off-chain tooling MUST
/// match this exact encoding.
fn leaf_hash(voter: &Pubkey, balance: u64) -> [u8; 32] {
    keccak::hashv(&[voter.as_ref(), &balance.to_le_bytes()]).0
}

/// Verify a Merkle inclusion proof using sorted-pair hashing
/// (the OpenZeppelin / Uniswap convention).
fn verify_merkle(leaf: &[u8; 32], proof: &[[u8; 32]], root: &[u8; 32]) -> bool {
    let mut computed = *leaf;
    for sibling in proof {
        let pair = if computed <= *sibling {
            keccak::hashv(&[&computed, sibling]).0
        } else {
            keccak::hashv(&[sibling, &computed]).0
        };
        computed = pair;
    }
    &computed == root
}

// ---------------------------------------------------------------------
// Accounts (state)
// ---------------------------------------------------------------------

#[account]
#[derive(Default)]
pub struct MilestoneVault {
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub escrow_balance: u64,
    pub milestone_count: u8,
    pub quorum_bps: u16,
    pub bump: u8,
    pub escrow_bump: u8,
}

impl MilestoneVault {
    // disc + creator + mint + escrow_balance + milestone_count + quorum_bps + bump + escrow_bump
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 1 + 2 + 1 + 1;
}

#[account]
pub struct Milestone {
    pub vault: Pubkey,
    pub index: u8,
    pub title: String,
    pub description: String,
    pub deadline: i64,
    pub amount_locked: u64,
    pub status: MilestoneStatus,
    pub claim_timestamp: i64,
    pub votes_approve: u64,
    pub votes_reject: u64,
    pub voting_ends: i64,
    pub snapshot_slot: u64,
    pub snapshot_root: [u8; 32],
    pub snapshot_total_supply: u64,
    pub evidence_url: String,
    pub bump: u8,
}

impl Milestone {
    // disc + vault + index + (4+title) + (4+desc) + deadline + amount_locked
    // + status (1) + claim_ts + votes_approve + votes_reject + voting_ends
    // + snapshot_slot + snapshot_root (32) + snapshot_total_supply
    // + (4+evidence) + bump
    pub const SIZE: usize = 8
        + 32
        + 1
        + 4
        + MAX_TITLE_LEN
        + 4
        + MAX_DESCRIPTION_LEN
        + 8
        + 8
        + 1
        + 8
        + 8
        + 8
        + 8
        + 8
        + 32
        + 8
        + 4
        + MAX_EVIDENCE_URL_LEN
        + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum MilestoneStatus {
    #[default]
    Pending,
    Claimed,
    Approved,
    Rejected,
}

#[account]
#[derive(Default)]
pub struct VoteRecord {
    pub milestone: Pubkey,
    pub voter: Pubkey,
    pub vote: bool,
    pub token_weight: u64,
    pub bump: u8,
}

impl VoteRecord {
    // disc + milestone + voter + vote (1) + weight + bump
    pub const SIZE: usize = 8 + 32 + 32 + 1 + 8 + 1;
}

// ---------------------------------------------------------------------
// Account contexts
// ---------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(
        init,
        payer = creator,
        space = MilestoneVault::SIZE,
        seeds = [VAULT_SEED, token_mint.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, MilestoneVault>,

    /// Escrow PDA that physically holds the locked SOL.
    /// Owned by this program so we can debit it inside `finalize_milestone`.
    #[account(
        init,
        payer = creator,
        space = 8, // 8-byte placeholder so the PDA is allocated; never deserialized.
        seeds = [ESCROW_SEED, token_mint.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA used solely to hold lamports; not deserialized.
    pub escrow: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct SetMilestone<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.token_mint.as_ref()],
        bump = vault.bump,
        has_one = creator @ BagsError::Unauthorized,
    )]
    pub vault: Account<'info, MilestoneVault>,

    #[account(
        init_if_needed,
        payer = creator,
        space = Milestone::SIZE,
        seeds = [MILESTONE_SEED, vault.key().as_ref(), &[index]],
        bump,
    )]
    pub milestone: Account<'info, Milestone>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositRoyalty<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.token_mint.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, MilestoneVault>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, vault.token_mint.as_ref()],
        bump = vault.escrow_bump,
    )]
    /// CHECK: PDA used solely to hold lamports; not deserialized.
    pub escrow: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct ClaimMilestone<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, vault.token_mint.as_ref()],
        bump = vault.bump,
        has_one = creator @ BagsError::Unauthorized,
    )]
    pub vault: Account<'info, MilestoneVault>,

    #[account(
        mut,
        seeds = [MILESTONE_SEED, vault.key().as_ref(), &[index]],
        bump = milestone.bump,
        constraint = milestone.vault == vault.key() @ BagsError::MilestoneVaultMismatch,
    )]
    pub milestone: Account<'info, Milestone>,
}

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct Vote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, vault.token_mint.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, MilestoneVault>,

    #[account(
        mut,
        seeds = [MILESTONE_SEED, vault.key().as_ref(), &[index]],
        bump = milestone.bump,
        constraint = milestone.vault == vault.key() @ BagsError::MilestoneVaultMismatch,
    )]
    pub milestone: Account<'info, Milestone>,

    /// Vote record PDA. Seeded by `claim_timestamp` so a fresh PDA is
    /// allocated per claim round — voters from a Rejected round are not
    /// locked out of the next round.
    #[account(
        init,
        payer = voter,
        space = VoteRecord::SIZE,
        seeds = [
            VOTE_SEED,
            milestone.key().as_ref(),
            &milestone.claim_timestamp.to_le_bytes(),
            voter.key().as_ref(),
        ],
        bump,
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct FinalizeMilestone<'info> {
    /// Anyone — the caller pays gas; rewards (if any) go to the creator.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: validated against `vault.creator`. Must be writable for payouts.
    #[account(
        mut,
        constraint = creator.key() == vault.creator @ BagsError::Unauthorized,
    )]
    pub creator: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.token_mint.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, MilestoneVault>,

    #[account(
        mut,
        seeds = [MILESTONE_SEED, vault.key().as_ref(), &[index]],
        bump = milestone.bump,
        constraint = milestone.vault == vault.key() @ BagsError::MilestoneVaultMismatch,
    )]
    pub milestone: Account<'info, Milestone>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, vault.token_mint.as_ref()],
        bump = vault.escrow_bump,
    )]
    /// CHECK: PDA used solely to hold lamports; not deserialized.
    pub escrow: AccountInfo<'info>,
}

// ---------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub quorum_bps: u16,
}

#[event]
pub struct MilestoneSet {
    pub vault: Pubkey,
    pub index: u8,
    pub amount: u64,
    pub deadline: i64,
}

#[event]
pub struct RoyaltyDeposited {
    pub vault: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MilestoneClaimed {
    pub vault: Pubkey,
    pub index: u8,
    pub voting_ends: i64,
    pub snapshot_slot: u64,
    pub snapshot_root: [u8; 32],
    pub snapshot_total_supply: u64,
}

#[event]
pub struct VoteCast {
    pub milestone: Pubkey,
    pub voter: Pubkey,
    pub approve: bool,
    pub weight: u64,
}

#[event]
pub struct MilestoneFinalized {
    pub vault: Pubkey,
    pub index: u8,
    pub approved: bool,
    pub payout: u64,
    pub quorum_met: bool,
}

// ---------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------

#[error_code]
pub enum BagsError {
    #[msg("Caller is not authorized for this action.")]
    Unauthorized,
    #[msg("Milestone index out of range (0..MAX_MILESTONES).")]
    MilestoneIndexOutOfRange,
    #[msg("Title exceeds maximum length.")]
    TitleTooLong,
    #[msg("Description exceeds maximum length.")]
    DescriptionTooLong,
    #[msg("Evidence URL exceeds maximum length.")]
    EvidenceUrlTooLong,
    #[msg("Amount must be > 0.")]
    InvalidAmount,
    #[msg("Deadline must be in the future.")]
    DeadlineInPast,
    #[msg("Milestone is locked and cannot be edited.")]
    MilestoneLocked,
    #[msg("Milestone cannot be claimed in its current state.")]
    MilestoneNotClaimable,
    #[msg("Milestone is not currently open for voting.")]
    MilestoneNotInVoting,
    #[msg("Voting window has ended.")]
    VotingEnded,
    #[msg("Voting window has not yet ended.")]
    VotingNotEnded,
    #[msg("Milestone cannot be finalized in its current state.")]
    MilestoneNotFinalizable,
    #[msg("Voter has zero token weight at snapshot.")]
    ZeroVoteWeight,
    #[msg("Milestone does not belong to this vault.")]
    MilestoneVaultMismatch,
    #[msg("Arithmetic overflow.")]
    ArithmeticOverflow,
    #[msg("Claim deadline + grace period has passed; reset the milestone.")]
    ClaimDeadlinePassed,
    #[msg("Snapshot total supply must be > 0.")]
    InvalidSnapshotSupply,
    #[msg("Merkle inclusion proof failed verification.")]
    InvalidMerkleProof,
    #[msg("Merkle proof exceeds maximum allowed length.")]
    MerkleProofTooLong,
    #[msg("Escrow PDA cannot be drained below the rent-exempt minimum.")]
    EscrowRentExemptViolation,
}
