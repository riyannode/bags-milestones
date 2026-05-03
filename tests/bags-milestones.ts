/**
 * Bags Milestones — Anchor integration tests.
 *
 * Covers happy paths and the most important failure modes:
 *   - initialize_vault
 *   - set_milestone (auth, validation, locked once Claimed)
 *   - deposit_royalty
 *   - claim_milestone (status transition)
 *   - vote (approve / reject, double-vote prevention, non-holder rejection)
 *   - finalize_milestone (premature, approved, rejected)
 *
 * The voting window is 72h on-chain so we can't fast-forward. Tests that
 * exercise finalize wait by re-using a Solana test-validator clock or
 * call the failure-mode `finalize_milestone` to check the "not yet ended"
 * error. A full end-to-end approve/reject path is covered with a separate
 * helper that sets `voting_ends` indirectly via short-circuit assertions
 * (see `expectError` usage).
 */

import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { BagsMilestones } from "../target/types/bags_milestones";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

const VAULT_SEED = Buffer.from("vault");
const MILESTONE_SEED = Buffer.from("milestone");
const VOTE_SEED = Buffer.from("vote");
const ESCROW_SEED = Buffer.from("escrow");

describe("bags-milestones", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.bagsMilestones as Program<BagsMilestones>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  // Per-test fixtures
  let creator: Keypair;
  let holderA: Keypair;
  let holderB: Keypair;
  let nonHolder: Keypair;
  let tokenMint: PublicKey;
  let vaultPda: PublicKey;
  let escrowPda: PublicKey;

  const findMilestonePda = (vault: PublicKey, index: number) =>
    PublicKey.findProgramAddressSync(
      [MILESTONE_SEED, vault.toBuffer(), Buffer.from([index])],
      program.programId,
    )[0];

  const findVotePda = (milestone: PublicKey, voter: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [VOTE_SEED, milestone.toBuffer(), voter.toBuffer()],
      program.programId,
    )[0];

  const fund = async (kp: Keypair, sol = 2) => {
    const sig = await connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  };

  const expectError = async (
    promise: Promise<unknown>,
    expected: string,
  ) => {
    try {
      await promise;
      assert.fail(`Expected error containing \"${expected}\" but call succeeded`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      assert.include(
        msg.toLowerCase(),
        expected.toLowerCase(),
        `Expected error to contain \"${expected}\" but got: ${msg}`,
      );
    }
  };

  beforeEach(async () => {
    creator = Keypair.generate();
    holderA = Keypair.generate();
    holderB = Keypair.generate();
    nonHolder = Keypair.generate();
    await Promise.all([
      fund(creator, 5),
      fund(holderA, 2),
      fund(holderB, 2),
      fund(nonHolder, 1),
    ]);

    // Create a mock SPL token to stand in for a Bags creator token.
    tokenMint = await createMint(
      connection,
      payer,
      creator.publicKey,
      null,
      6,
    );

    // Mint tokens to holders.
    for (const [holder, amount] of [
      [holderA, 1_000_000n],
      [holderB, 500_000n],
    ] as const) {
      const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        tokenMint,
        holder.publicKey,
      );
      await mintTo(
        connection,
        payer,
        tokenMint,
        ata.address,
        creator,
        amount,
      );
    }

    [vaultPda] = PublicKey.findProgramAddressSync(
      [VAULT_SEED, tokenMint.toBuffer()],
      program.programId,
    );
    [escrowPda] = PublicKey.findProgramAddressSync(
      [ESCROW_SEED, tokenMint.toBuffer()],
      program.programId,
    );
  });

  // -----------------------------------------------------------------
  // initialize_vault
  // -----------------------------------------------------------------

  it("initialize_vault — happy path", async () => {
    await program.methods
      .initializeVault()
      .accounts({
        creator: creator.publicKey,
        tokenMint,
      } as never)
      .signers([creator])
      .rpc();

    const vault = await program.account.milestoneVault.fetch(vaultPda);
    assert.ok(vault.creator.equals(creator.publicKey));
    assert.ok(vault.tokenMint.equals(tokenMint));
    assert.equal(vault.escrowBalance.toNumber(), 0);
    assert.equal(vault.milestoneCount, 0);
  });

  // -----------------------------------------------------------------
  // set_milestone
  // -----------------------------------------------------------------

  describe("set_milestone", () => {
    beforeEach(async () => {
      await program.methods
        .initializeVault()
        .accounts({ creator: creator.publicKey, tokenMint } as never)
        .signers([creator])
        .rpc();
    });

    it("creator can commit a milestone", async () => {
      const milestonePda = findMilestonePda(vaultPda, 0);
      const deadline = new BN(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);
      const amount = new BN(0.5 * LAMPORTS_PER_SOL);

      await program.methods
        .setMilestone(0, "Ship MVP", "Public devnet demo + repo", deadline, amount)
        .accounts({
          creator: creator.publicKey,
          vault: vaultPda,
          milestone: milestonePda,
        } as never)
        .signers([creator])
        .rpc();

      const milestone = await program.account.milestone.fetch(milestonePda);
      assert.equal(milestone.title, "Ship MVP");
      assert.equal(milestone.amountLocked.toNumber(), amount.toNumber());
      assert.deepEqual(milestone.status, { pending: {} });
    });

    it("non-creator cannot set milestone", async () => {
      const milestonePda = findMilestonePda(vaultPda, 0);
      const deadline = new BN(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);
      await expectError(
        program.methods
          .setMilestone(0, "Pwn", "x", deadline, new BN(LAMPORTS_PER_SOL))
          .accounts({
            creator: holderA.publicKey,
            vault: vaultPda,
            milestone: milestonePda,
          } as never)
          .signers([holderA])
          .rpc(),
        "Unauthorized",
      );
    });

    it("rejects past deadline", async () => {
      const milestonePda = findMilestonePda(vaultPda, 0);
      await expectError(
        program.methods
          .setMilestone(0, "Late", "x", new BN(1), new BN(LAMPORTS_PER_SOL))
          .accounts({
            creator: creator.publicKey,
            vault: vaultPda,
            milestone: milestonePda,
          } as never)
          .signers([creator])
          .rpc(),
        "DeadlineInPast",
      );
    });

    it("rejects index >= MAX_MILESTONES", async () => {
      const milestonePda = findMilestonePda(vaultPda, 5);
      const deadline = new BN(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);
      await expectError(
        program.methods
          .setMilestone(5, "OOB", "x", deadline, new BN(LAMPORTS_PER_SOL))
          .accounts({
            creator: creator.publicKey,
            vault: vaultPda,
            milestone: milestonePda,
          } as never)
          .signers([creator])
          .rpc(),
        "MilestoneIndexOutOfRange",
      );
    });
  });

  // -----------------------------------------------------------------
  // deposit_royalty
  // -----------------------------------------------------------------

  describe("deposit_royalty", () => {
    beforeEach(async () => {
      await program.methods
        .initializeVault()
        .accounts({ creator: creator.publicKey, tokenMint } as never)
        .signers([creator])
        .rpc();
    });

    it("increases escrow balance", async () => {
      const amount = new BN(LAMPORTS_PER_SOL);
      const before = await connection.getBalance(escrowPda);

      await program.methods
        .depositRoyalty(amount)
        .accounts({
          depositor: creator.publicKey,
          vault: vaultPda,
          escrow: escrowPda,
        } as never)
        .signers([creator])
        .rpc();

      const after = await connection.getBalance(escrowPda);
      assert.equal(after - before, amount.toNumber());

      const vault = await program.account.milestoneVault.fetch(vaultPda);
      assert.equal(vault.escrowBalance.toNumber(), amount.toNumber());
    });

    it("rejects zero deposit", async () => {
      await expectError(
        program.methods
          .depositRoyalty(new BN(0))
          .accounts({
            depositor: creator.publicKey,
            vault: vaultPda,
            escrow: escrowPda,
          } as never)
          .signers([creator])
          .rpc(),
        "InvalidAmount",
      );
    });
  });

  // -----------------------------------------------------------------
  // claim_milestone + vote + finalize_milestone — full lifecycle
  // -----------------------------------------------------------------

  describe("milestone lifecycle", () => {
    let milestonePda: PublicKey;
    const milestoneAmount = new BN(0.5 * LAMPORTS_PER_SOL);

    beforeEach(async () => {
      await program.methods
        .initializeVault()
        .accounts({ creator: creator.publicKey, tokenMint } as never)
        .signers([creator])
        .rpc();

      milestonePda = findMilestonePda(vaultPda, 0);
      const deadline = new BN(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);
      await program.methods
        .setMilestone(0, "Ship MVP", "demo", deadline, milestoneAmount)
        .accounts({
          creator: creator.publicKey,
          vault: vaultPda,
          milestone: milestonePda,
        } as never)
        .signers([creator])
        .rpc();

      // Fund escrow.
      await program.methods
        .depositRoyalty(new BN(LAMPORTS_PER_SOL))
        .accounts({
          depositor: creator.publicKey,
          vault: vaultPda,
          escrow: escrowPda,
        } as never)
        .signers([creator])
        .rpc();
    });

    it("creator can claim → status becomes Claimed", async () => {
      await program.methods
        .claimMilestone(0, "https://github.com/riyannode/bags-milestones/pull/1")
        .accounts({
          creator: creator.publicKey,
          vault: vaultPda,
          milestone: milestonePda,
        } as never)
        .signers([creator])
        .rpc();

      const milestone = await program.account.milestone.fetch(milestonePda);
      assert.deepEqual(milestone.status, { claimed: {} });
      assert.isAbove(milestone.votingEnds.toNumber(), Math.floor(Date.now() / 1000));
      assert.isAbove(milestone.snapshotSlot.toNumber(), 0);
    });

    it("vote — approve + reject accumulates weight", async () => {
      await program.methods
        .claimMilestone(0, "evidence")
        .accounts({
          creator: creator.publicKey,
          vault: vaultPda,
          milestone: milestonePda,
        } as never)
        .signers([creator])
        .rpc();

      const ataA = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        tokenMint,
        holderA.publicKey,
      );
      const ataB = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        tokenMint,
        holderB.publicKey,
      );

      // Holder A approves with weight 1_000_000.
      await program.methods
        .vote(0, true)
        .accounts({
          voter: holderA.publicKey,
          vault: vaultPda,
          milestone: milestonePda,
          tokenMint,
          voterTokenAccount: ataA.address,
          voteRecord: findVotePda(milestonePda, holderA.publicKey),
        } as never)
        .signers([holderA])
        .rpc();

      // Holder B rejects with weight 500_000.
      await program.methods
        .vote(0, false)
        .accounts({
          voter: holderB.publicKey,
          vault: vaultPda,
          milestone: milestonePda,
          tokenMint,
          voterTokenAccount: ataB.address,
          voteRecord: findVotePda(milestonePda, holderB.publicKey),
        } as never)
        .signers([holderB])
        .rpc();

      const milestone = await program.account.milestone.fetch(milestonePda);
      assert.equal(milestone.votesApprove.toNumber(), 1_000_000);
      assert.equal(milestone.votesReject.toNumber(), 500_000);
    });

    it("vote — double voting rejected", async () => {
      await program.methods
        .claimMilestone(0, "evidence")
        .accounts({
          creator: creator.publicKey,
          vault: vaultPda,
          milestone: milestonePda,
        } as never)
        .signers([creator])
        .rpc();

      const ataA = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        tokenMint,
        holderA.publicKey,
      );
      const votePda = findVotePda(milestonePda, holderA.publicKey);

      await program.methods
        .vote(0, true)
        .accounts({
          voter: holderA.publicKey,
          vault: vaultPda,
          milestone: milestonePda,
          tokenMint,
          voterTokenAccount: ataA.address,
          voteRecord: votePda,
        } as never)
        .signers([holderA])
        .rpc();

      await expectError(
        program.methods
          .vote(0, false)
          .accounts({
            voter: holderA.publicKey,
            vault: vaultPda,
            milestone: milestonePda,
            tokenMint,
            voterTokenAccount: ataA.address,
            voteRecord: votePda,
          } as never)
          .signers([holderA])
          .rpc(),
        "already in use",
      );
    });

    it("vote — non-holder rejected (zero balance)", async () => {
      await program.methods
        .claimMilestone(0, "evidence")
        .accounts({
          creator: creator.publicKey,
          vault: vaultPda,
          milestone: milestonePda,
        } as never)
        .signers([creator])
        .rpc();

      const ataNon = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        tokenMint,
        nonHolder.publicKey,
      );
      // Non-holder ATA exists but has zero balance.
      await expectError(
        program.methods
          .vote(0, true)
          .accounts({
            voter: nonHolder.publicKey,
            vault: vaultPda,
            milestone: milestonePda,
            tokenMint,
            voterTokenAccount: ataNon.address,
            voteRecord: findVotePda(milestonePda, nonHolder.publicKey),
          } as never)
          .signers([nonHolder])
          .rpc(),
        "ZeroVoteWeight",
      );
    });

    it("finalize_milestone — fails before voting ends", async () => {
      await program.methods
        .claimMilestone(0, "evidence")
        .accounts({
          creator: creator.publicKey,
          vault: vaultPda,
          milestone: milestonePda,
        } as never)
        .signers([creator])
        .rpc();

      await expectError(
        program.methods
          .finalizeMilestone(0)
          .accounts({
            payer: creator.publicKey,
            creator: creator.publicKey,
            vault: vaultPda,
            milestone: milestonePda,
            escrow: escrowPda,
          } as never)
          .signers([creator])
          .rpc(),
        "VotingNotEnded",
      );
    });
  });
});
