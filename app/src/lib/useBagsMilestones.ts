"use client";

/**
 * React hook that exposes the Anchor program + wrappers around each
 * instruction. Transaction building goes through Anchor; signing happens
 * via Privy's `useSignTransaction`; broadcasting + confirmation use a plain
 * Solana web3.js Connection. This works for both embedded Privy wallets and
 * external Solana wallet adapters.
 */

import { useMemo } from "react";
import { BN } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  useSignTransaction,
  useWallets,
} from "@privy-io/react-auth/solana";
import { usePrivy } from "@privy-io/react-auth";
import {
  findEscrowPda,
  findMilestonePda,
  findVaultPda,
  findVotePda,
  getConnection,
  getProgram,
  PROGRAM_ID,
  NETWORK,
} from "./anchor";
import { bytesToFixedArray } from "./merkle";

// `SolanaChain` is a literal union — Privy expects values like
// "solana:101" (mainnet) / "solana:103" (devnet) / "solana:102" (testnet).
const PRIVY_CHAIN: `solana:${string}` =
  NETWORK === "mainnet-beta"
    ? "solana:101"
    : NETWORK === "testnet"
      ? "solana:102"
      : "solana:103";

export interface UseBagsMilestonesResult {
  programId: PublicKey;
  connection: Connection;
  walletAddress: string | undefined;
  initializeVault: (mint: string) => Promise<string>;
  setMilestone: (
    mint: string,
    index: number,
    title: string,
    description: string,
    deadline: number,
    amountLamports: number,
  ) => Promise<string>;
  depositRoyalty: (mint: string, amountLamports: number) => Promise<string>;
  claimMilestone: (
    mint: string,
    index: number,
    evidenceUrl: string,
    snapshotRoot: Uint8Array,
    snapshotTotalSupply: bigint,
  ) => Promise<string>;
  vote: (
    mint: string,
    index: number,
    approve: boolean,
    claimedWeight: bigint,
    proof: Uint8Array[],
  ) => Promise<string>;
  finalizeMilestone: (
    mint: string,
    index: number,
    creatorAddress: string,
  ) => Promise<string>;
}

export function useBagsMilestones(): UseBagsMilestonesResult {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = authenticated ? wallets?.[0] : undefined;
  const walletAddress = wallet?.address;
  const { signTransaction: privySignTx } = useSignTransaction();

  const connection = useMemo(() => getConnection(), []);
  const program = useMemo(() => getProgram(connection, undefined), [connection]);

  const requireWallet = () => {
    if (!wallet || !walletAddress) throw new Error("Wallet not connected");
    return { wallet, pk: new PublicKey(walletAddress) };
  };

  const buildSignSend = async (tx: Transaction): Promise<string> => {
    const { wallet: w, pk } = requireWallet();
    const latest = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = latest.blockhash;
    tx.feePayer = pk;

    const serialized = tx.serialize({ requireAllSignatures: false });
    const out = await privySignTx({
      transaction: new Uint8Array(serialized),
      wallet: w,
      chain: PRIVY_CHAIN as never,
    });

    const sig = await connection.sendRawTransaction(
      out.signedTransaction,
      { skipPreflight: false, preflightCommitment: "confirmed" },
    );
    await connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed",
    );
    return sig;
  };

  const initializeVault = async (mint: string) => {
    const { pk } = requireWallet();
    const tokenMint = new PublicKey(mint);
    const tx = await program.methods
      .initializeVault()
      .accounts({ creator: pk, tokenMint } as never)
      .transaction();
    return buildSignSend(tx);
  };

  const setMilestone = async (
    mint: string,
    index: number,
    title: string,
    description: string,
    deadline: number,
    amountLamports: number,
  ) => {
    const { pk } = requireWallet();
    const tokenMint = new PublicKey(mint);
    const vault = findVaultPda(tokenMint);
    const milestone = findMilestonePda(vault, index);
    const tx = await program.methods
      .setMilestone(
        index,
        title,
        description,
        new BN(deadline),
        new BN(amountLamports),
      )
      .accounts({ creator: pk, vault, milestone } as never)
      .transaction();
    return buildSignSend(tx);
  };

  const depositRoyalty = async (mint: string, amountLamports: number) => {
    const { pk } = requireWallet();
    const tokenMint = new PublicKey(mint);
    const vault = findVaultPda(tokenMint);
    const escrow = findEscrowPda(tokenMint);
    const tx = await program.methods
      .depositRoyalty(new BN(amountLamports))
      .accounts({ depositor: pk, vault, escrow } as never)
      .transaction();
    return buildSignSend(tx);
  };

  const claimMilestone = async (
    mint: string,
    index: number,
    evidenceUrl: string,
    snapshotRoot: Uint8Array,
    snapshotTotalSupply: bigint,
  ) => {
    const { pk } = requireWallet();
    const tokenMint = new PublicKey(mint);
    const vault = findVaultPda(tokenMint);
    const milestone = findMilestonePda(vault, index);
    const rootArr = bytesToFixedArray(snapshotRoot);
    const tx = await program.methods
      .claimMilestone(
        index,
        evidenceUrl,
        rootArr,
        new BN(snapshotTotalSupply.toString()),
      )
      .accounts({ creator: pk, vault, milestone } as never)
      .transaction();
    return buildSignSend(tx);
  };

  const vote = async (
    mint: string,
    index: number,
    approve: boolean,
    claimedWeight: bigint,
    proof: Uint8Array[],
  ) => {
    const { pk } = requireWallet();
    const tokenMint = new PublicKey(mint);
    const vault = findVaultPda(tokenMint);
    const milestone = findMilestonePda(vault, index);
    // VoteRecord PDA is seeded by the milestone's `claim_timestamp`, so
    // each claim round allocates a fresh PDA (re-claim after rejection
    // re-opens voting cleanly).
    const milestoneAcc = await program.account.milestone.fetch(milestone);
    const voteRecord = findVotePda(milestone, pk, milestoneAcc.claimTimestamp);
    const proofArr = proof.map(bytesToFixedArray);
    const tx = await program.methods
      .vote(index, approve, new BN(claimedWeight.toString()), proofArr)
      .accounts({
        voter: pk,
        vault,
        milestone,
        voteRecord,
      } as never)
      .transaction();
    return buildSignSend(tx);
  };

  const finalizeMilestone = async (
    mint: string,
    index: number,
    creatorAddress: string,
  ) => {
    const { pk } = requireWallet();
    const tokenMint = new PublicKey(mint);
    const vault = findVaultPda(tokenMint);
    const milestone = findMilestonePda(vault, index);
    const escrow = findEscrowPda(tokenMint);
    const tx = await program.methods
      .finalizeMilestone(index)
      .accounts({
        payer: pk,
        creator: new PublicKey(creatorAddress),
        vault,
        milestone,
        escrow,
      } as never)
      .transaction();
    return buildSignSend(tx);
  };

  return {
    programId: PROGRAM_ID,
    connection,
    walletAddress,
    initializeVault,
    setMilestone,
    depositRoyalty,
    claimMilestone,
    vote,
    finalizeMilestone,
  };
}
