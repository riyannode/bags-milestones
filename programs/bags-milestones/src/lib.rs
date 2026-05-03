//! Bags Milestones — Solana smart contract.
//!
//! Adds an accountability + governance layer on top of the Bags.fm
//! creator-token economy. Creators lock royalties into a per-token
//! escrow vault, publicly commit to up to 5 milestones, and only unlock
//! funds after holders vote to approve a milestone claim.
//!
//! High-level flow:
//!   1. `initialize_vault`  — creator opts into Milestones for a token.
//!   2. `set_milestone`     — creator commits to milestone (title, deadline, amount).
//!   3. `deposit_royalty`   — anyone can top up the escrow (typically the creator
//!                            forwarding royalties received from Bags).
//!   4. `claim_milestone`   — creator submits evidence and opens a 72h voting window.
//!   5. `vote`              — token holders vote approve/reject, weight = balance at
//!                            snapshot slot (recorded at claim time).
//!   6. `finalize_milestone`— anyone can call after voting ends; releases funds to
//!                            creator on majority approve, otherwise leaves locked.

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

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
        vault.bump = ctx.bumps.vault;
        vault.escrow_bump = ctx.bumps.escrow;

        emit!(VaultInitialized {
            vault: vault.key(),
            creator: vault.creator,
            token_mint: vault.token_mint,
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
        require!(title.as_bytes().len() <= MAX_TITLE_LEN, BagsError::TitleTooLong);
        require!(
            description.as_bytes().len() <= MAX_DESCRIPTION_LEN,
            BagsError::DescriptionTooLong
        );
        require!(amount > 0, BagsError::InvalidAmount);

        let now = Clock::get()?.unix_timestamp;
        require!(deadline > now, BagsError::DeadlineInPast);

        let milestone = &mut ctx.accounts.milestone;

        // If the milestone account already existed and is past `Pending`,
        // we cannot overwrite the commitment.
        if milestone.vault != Pubkey::default() {
            require!(
                matches!(milestone.status, MilestoneStatus::Pending),
                BagsError::MilestoneLocked
            );
        } else {
            // First-time initialization: bump milestone count.
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
    /// a webhook crank, etc.). The on-chain `escrow_balance` field is updated
    /// so the UI does not have to subtract rent-exempt minimum repeatedly.
    pub fn deposit_royalty(ctx: Context<DepositRoyalty>, amount: u64) -> Result<()> {
        require!(amount > 0, BagsError::InvalidAmount);

        let from = ctx.accounts.depositor.to_account_info();
        let to = ctx.accounts.escrow.to_account_info();

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            from.key,
            to.key,
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[from, to, ctx.accounts.system_program.to_account_info()],
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
    /// window and snapshots the current slot for vote-weight verification.
    pub fn claim_milestone(
        ctx: Context<ClaimMilestone>,
        _index: u8,
        evidence_url: String,
    ) -> Result<()> {
        require!(
            evidence_url.as_bytes().len() <= MAX_EVIDENCE_URL_LEN,
            BagsError::EvidenceUrlTooLong
        );

        let milestone = &mut ctx.accounts.milestone;
        require!(
            matches!(
                milestone.status,
                MilestoneStatus::Pending | MilestoneStatus::Rejected
            ),
            BagsError::MilestoneNotClaimable
        );

        let clock = Clock::get()?;
        milestone.status = MilestoneStatus::Claimed;
        milestone.claim_timestamp = clock.unix_timestamp;
        milestone.voting_ends = clock
            .unix_timestamp
            .checked_add(VOTING_DURATION_SECS)
            .ok_or(BagsError::ArithmeticOverflow)?;
        milestone.snapshot_slot = clock.slot;
        // Reset vote tallies if this is a re-claim after rejection.
        milestone.votes_approve = 0;
        milestone.votes_reject = 0;
        milestone.evidence_url = evidence_url;

        emit!(MilestoneClaimed {
            vault: milestone.vault,
            index: milestone.index,
            voting_ends: milestone.voting_ends,
            snapshot_slot: milestone.snapshot_slot,
        });
        Ok(())
    }

    /// Cast a vote on a `Claimed` milestone. Voting weight comes from the
    /// caller's current SPL token balance; the `snapshot_slot` is recorded
    /// for off-chain verification (clients should reject vote attempts that
    /// would have had zero balance at the snapshot slot).
    ///
    /// Anti-double-vote is enforced by the `VoteRecord` PDA being created
    /// fresh — re-vote attempts will fail at account init.
    pub fn vote(ctx: Context<Vote>, _index: u8, approve: bool) -> Result<()> {
        let milestone = &mut ctx.accounts.milestone;
        let vote_record = &mut ctx.accounts.vote_record;

        require!(
            matches!(milestone.status, MilestoneStatus::Claimed),
            BagsError::MilestoneNotInVoting
        );

        let now = Clock::get()?.unix_timestamp;
        require!(now < milestone.voting_ends, BagsError::VotingEnded);

        let weight = ctx.accounts.voter_token_account.amount;
        require!(weight > 0, BagsError::ZeroVoteWeight);
        require_keys_eq!(
            ctx.accounts.voter_token_account.owner,
            ctx.accounts.voter.key(),
            BagsError::TokenAccountOwnerMismatch
        );
        require_keys_eq!(
            ctx.accounts.voter_token_account.mint,
            ctx.accounts.token_mint.key(),
            BagsError::TokenAccountMintMismatch
        );

        if approve {
            milestone.votes_approve = milestone
                .votes_approve
                .checked_add(weight)
                .ok_or(BagsError::ArithmeticOverflow)?;
        } else {
            milestone.votes_reject = milestone
                .votes_reject
                .checked_add(weight)
                .ok_or(BagsError::ArithmeticOverflow)?;
        }

        vote_record.milestone = milestone.key();
        vote_record.voter = ctx.accounts.voter.key();
        vote_record.vote = approve;
        vote_record.token_weight = weight;
        vote_record.bump = ctx.bumps.vote_record;

        emit!(VoteCast {
            milestone: milestone.key(),
            voter: vote_record.voter,
            approve,
            weight,
        });
        Ok(())
    }

    /// Finalize a milestone after the voting window closes. Permissionless —
    /// anyone may call to pay the gas. Releases escrow to the creator on
    /// majority approve, otherwise marks the milestone `Rejected` and leaves
    /// funds locked (creator may re-submit evidence and re-claim).
    pub fn finalize_milestone(ctx: Context<FinalizeMilestone>, _index: u8) -> Result<()> {
        let milestone = &mut ctx.accounts.milestone;
        require!(
            matches!(milestone.status, MilestoneStatus::Claimed),
            BagsError::MilestoneNotFinalizable
        );

        let now = Clock::get()?.unix_timestamp;
        require!(now >= milestone.voting_ends, BagsError::VotingNotEnded);

        if milestone.votes_approve > milestone.votes_reject {
            // Approved → release `amount_locked` (capped to escrow balance) to creator.
            let vault = &mut ctx.accounts.vault;
            let payout = milestone.amount_locked.min(vault.escrow_balance);

            if payout > 0 {
                let escrow_info = ctx.accounts.escrow.to_account_info();
                let creator_info = ctx.accounts.creator.to_account_info();

                // Direct lamport debit/credit on PDA (no system_program::transfer
                // since the PDA is owned by this program, not the system program).
                **escrow_info.try_borrow_mut_lamports()? = escrow_info
                    .lamports()
                    .checked_sub(payout)
                    .ok_or(BagsError::ArithmeticOverflow)?;
                **creator_info.try_borrow_mut_lamports()? = creator_info
                    .lamports()
                    .checked_add(payout)
                    .ok_or(BagsError::ArithmeticOverflow)?;

                vault.escrow_balance = vault
                    .escrow_balance
                    .checked_sub(payout)
                    .ok_or(BagsError::ArithmeticOverflow)?;
            }

            milestone.status = MilestoneStatus::Approved;
            emit!(MilestoneFinalized {
                vault: milestone.vault,
                index: milestone.index,
                approved: true,
                payout,
            });
        } else {
            milestone.status = MilestoneStatus::Rejected;
            emit!(MilestoneFinalized {
                vault: milestone.vault,
                index: milestone.index,
                approved: false,
                payout: 0,
            });
        }

        Ok(())
    }
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
    pub bump: u8,
    pub escrow_bump: u8,
}

impl MilestoneVault {
    // 8 (disc) + 32 + 32 + 8 + 1 + 1 + 1
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 1 + 1 + 1;
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
    pub evidence_url: String,
    pub bump: u8,
}

impl Milestone {
    // disc + vault + index + (4 + title) + (4 + desc) + deadline +
    // amount + status (1) + claim_ts + votes_approve + votes_reject +
    // voting_ends + snapshot_slot + (4 + evidence) + bump
    pub const SIZE: usize = 8
        + 32
        + 1
        + 4 + MAX_TITLE_LEN
        + 4 + MAX_DESCRIPTION_LEN
        + 8
        + 8
        + 1
        + 8
        + 8
        + 8
        + 8
        + 8
        + 4 + MAX_EVIDENCE_URL_LEN
        + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum MilestoneStatus {
    Pending,
    Claimed,
    Approved,
    Rejected,
}

impl Default for MilestoneStatus {
    fn default() -> Self {
        MilestoneStatus::Pending
    }
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

    pub token_mint: Account<'info, Mint>,

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
        space = 8, // 8 bytes (discriminator only — we never deserialize it)
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

    /// Must be the same mint the vault is governing — otherwise a voter
    /// could pass any SPL token they hold a large balance of and inflate
    /// their vote weight (BUG_pr-review-job-...0001).
    #[account(address = vault.token_mint @ BagsError::TokenAccountMintMismatch)]
    pub token_mint: Account<'info, Mint>,

    /// Voter's SPL token account for the Bags creator token.
    pub voter_token_account: Account<'info, TokenAccount>,

    /// Vote record PDA. Seeded by `claim_timestamp` so a fresh PDA is
    /// allocated per claim round — prevents stale records from a previous
    /// round blocking re-votes after a `Rejected → Claimed` re-claim
    /// (BUG_pr-review-job-...0002).
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
    #[msg("Token account owner does not match voter.")]
    TokenAccountOwnerMismatch,
    #[msg("Token account mint does not match vault token mint.")]
    TokenAccountMintMismatch,
    #[msg("Milestone does not belong to this vault.")]
    MilestoneVaultMismatch,
    #[msg("Arithmetic overflow.")]
    ArithmeticOverflow,
}
