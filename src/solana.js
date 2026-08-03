// Solana support: wallet-agnostic helpers for the multisend flows.
//
// Solana has no Multisender contract — a batch send is one (or more)
// transactions carrying many SystemProgram.transfer / SPL transfer
// instructions. Transactions are size-limited (1232 bytes), so large
// recipient lists are chunked and signed together via signAllTransactions
// when the wallet supports it (single prompt), falling back to one
// prompt per chunk otherwise.

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  unpackMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token'

// AppKit reports this as chainId when connected to Solana mainnet
// (its genesis-hash-derived id, not a number like EVM chains).
export const SOLANA_MAINNET_CHAIN_ID = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'

export const isSolanaChain = (chainId) => String(chainId) === SOLANA_MAINNET_CHAIN_ID

// Base fee per transaction (single signer) in lamports.
const LAMPORTS_PER_SIGNATURE = 5000
// Rent-exempt minimum for a 165-byte SPL token account, in lamports.
// (Stable protocol constant; avoids an extra RPC round-trip per estimate.)
const ATA_RENT_LAMPORTS = 2039280

// Recipients per transaction, sized against the 1232-byte packet limit.
// SOL transfer ≈ 50 bytes each; ATA-create + transfer ≈ 150 bytes each.
const SOL_CHUNK_SIZE = 18
const SPL_TX_WEIGHT_CAPACITY = 18 // transfer = 1 unit, create+transfer = 3 units

const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

export const isValidSolanaAddress = (address) => {
  if (typeof address !== 'string' || address.length < 32 || address.length > 44) return false
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

// One cached Connection per RPC url
const connections = new Map()
export const getSolConnection = (rpcUrl) => {
  if (!connections.has(rpcUrl)) {
    connections.set(rpcUrl, new Connection(rpcUrl, 'confirmed'))
  }
  return connections.get(rpcUrl)
}

// Returns the SOL balance as a decimal string (matches formatEther-style output)
export const getSolBalance = async (rpcUrl, address) => {
  const connection = getSolConnection(rpcUrl)
  const lamports = await connection.getBalance(new PublicKey(address))
  return (lamports / 1e9).toString()
}

// Read name/symbol from the mint's Metaplex metadata PDA. Layout after the
// 1-byte key + 32-byte update authority + 32-byte mint: three borsh strings
// (u32 LE length + bytes) for name, symbol, uri.
const fetchMetaplexMetadata = async (connection, mintPk) => {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('metadata'), METADATA_PROGRAM_ID.toBytes(), mintPk.toBytes()],
    METADATA_PROGRAM_ID
  )
  const info = await connection.getAccountInfo(pda)
  if (!info?.data) return null
  const data = info.data
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const decoder = new TextDecoder()
  let offset = 1 + 32 + 32
  const readString = () => {
    const len = view.getUint32(offset, true)
    offset += 4
    const str = decoder.decode(data.subarray(offset, offset + len))
    offset += len
    return str.replace(/\0+$/g, '').trim()
  }
  const name = readString()
  const symbol = readString()
  return { name, symbol }
}

// SPL token lookup — the Solana counterpart of the ERC-20 name/symbol/
// decimals/balanceOf reads. owner may be null (preview mode: no balance).
// Supports both the classic token program and Token-2022 by using the
// mint account's owner as the token program id.
export const getSplTokenInfo = async (rpcUrl, mintAddress, owner) => {
  const connection = getSolConnection(rpcUrl)
  const mintPk = new PublicKey(mintAddress)

  const mintAccount = await connection.getAccountInfo(mintPk)
  if (!mintAccount) throw new Error('No account found at this address')
  const programId = mintAccount.owner
  if (!programId.equals(TOKEN_PROGRAM_ID) && !programId.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new Error('Account is not an SPL token mint')
  }
  const mint = unpackMint(mintPk, mintAccount, programId)

  let balance = null
  if (owner) {
    try {
      const ata = getAssociatedTokenAddressSync(mintPk, new PublicKey(owner), true, programId)
      const bal = await connection.getTokenAccountBalance(ata)
      balance = bal.value.uiAmountString ?? '0'
    } catch {
      balance = '0' // no token account yet
    }
  }

  let name = null
  let symbol = null
  try {
    const meta = await fetchMetaplexMetadata(connection, mintPk)
    name = meta?.name || null
    symbol = meta?.symbol || null
  } catch { /* metadata is optional */ }

  return {
    name: name || `${mintAddress.slice(0, 4)}…${mintAddress.slice(-4)}`,
    symbol: symbol || 'SPL',
    decimals: mint.decimals,
    balance,
    programId: programId.toBase58(),
  }
}

// Build the chunked native-SOL batch. lamports entries are bigint.
// Blockhash is applied at send time (sendSolanaBatch), not here, so a slow
// multi-chunk signing session can't outlive blockhash validity during build.
export const buildSolBatchTxs = ({ from, recipients, lamports }) => {
  const fromPk = new PublicKey(from)
  const txs = []
  for (let i = 0; i < recipients.length; i += SOL_CHUNK_SIZE) {
    const tx = new Transaction()
    recipients.slice(i, i + SOL_CHUNK_SIZE).forEach((recipient, j) => {
      tx.add(SystemProgram.transfer({
        fromPubkey: fromPk,
        toPubkey: new PublicKey(recipient),
        lamports: lamports[i + j],
      }))
    })
    tx.feePayer = fromPk
    txs.push(tx)
  }
  return txs
}

// Which recipients already have an associated token account for this mint.
// Batched 100 at a time (getMultipleAccountsInfo limit).
export const findMissingAtas = async (connection, mintPk, programId, recipients) => {
  const atas = recipients.map((r) =>
    getAssociatedTokenAddressSync(mintPk, new PublicKey(r), true, programId)
  )
  const missing = new Array(recipients.length).fill(false)
  for (let i = 0; i < atas.length; i += 100) {
    const infos = await connection.getMultipleAccountsInfo(atas.slice(i, i + 100))
    infos.forEach((info, j) => { missing[i + j] = info === null })
  }
  return { atas, missing }
}

// Build the chunked SPL batch. amountsInUnits entries are bigint (already
// scaled by the mint's decimals). Creates missing recipient token accounts
// in the same transaction (payer = sender).
export const buildSplBatchTxs = async ({ rpcUrl, from, mint, programId, decimals, recipients, amountsInUnits }) => {
  const connection = getSolConnection(rpcUrl)
  const fromPk = new PublicKey(from)
  const mintPk = new PublicKey(mint)
  const progPk = new PublicKey(programId)
  const sourceAta = getAssociatedTokenAddressSync(mintPk, fromPk, true, progPk)

  const { atas, missing } = await findMissingAtas(connection, mintPk, progPk, recipients)
  const missingCount = missing.filter(Boolean).length

  const txs = []
  let tx = new Transaction()
  let weight = 0
  const flush = () => {
    if (tx.instructions.length === 0) return
    tx.feePayer = fromPk
    txs.push(tx)
    tx = new Transaction()
    weight = 0
  }

  recipients.forEach((recipient, i) => {
    const cost = missing[i] ? 3 : 1
    if (weight + cost > SPL_TX_WEIGHT_CAPACITY) flush()
    if (missing[i]) {
      tx.add(createAssociatedTokenAccountInstruction(
        fromPk, atas[i], new PublicKey(recipient), mintPk, progPk
      ))
    }
    tx.add(createTransferCheckedInstruction(
      sourceAta, mintPk, atas[i], fromPk, amountsInUnits[i], decimals, [], progPk
    ))
    weight += cost
  })
  flush()

  return { txs, missingCount }
}

// Fee estimate in SOL for the confirmation modal.
// type 'native': base fee per chunk. type 'spl': base fee per chunk plus
// rent for every recipient token account that must be created.
export const estimateSolanaFees = async ({ rpcUrl, type, recipients, mint, programId }) => {
  if (type === 'native') {
    const txCount = Math.ceil(recipients.length / SOL_CHUNK_SIZE)
    return { feeSol: (txCount * LAMPORTS_PER_SIGNATURE) / 1e9, txCount, missingAtas: 0 }
  }
  const connection = getSolConnection(rpcUrl)
  const { missing } = await findMissingAtas(
    connection, new PublicKey(mint), new PublicKey(programId), recipients
  )
  const missingCount = missing.filter(Boolean).length
  // Reproduce the weight-based packing to count transactions
  let txCount = 0
  let weight = 0
  missing.forEach((m) => {
    const cost = m ? 3 : 1
    if (weight === 0 || weight + cost > SPL_TX_WEIGHT_CAPACITY) { txCount += 1; weight = 0 }
    weight += cost
  })
  const lamports = txCount * LAMPORTS_PER_SIGNATURE + missingCount * ATA_RENT_LAMPORTS
  return { feeSol: lamports / 1e9, txCount, missingAtas: missingCount }
}

// Chunk count shown pre-estimate for native sends
export const getSolTxCount = (recipientCount) => Math.ceil(recipientCount / SOL_CHUNK_SIZE)

// Sign and send a batch of transactions through the AppKit Solana provider.
// Single prompt via signAllTransactions when the wallet supports it;
// otherwise one wallet prompt per chunk. onProgress fires as each
// transaction is submitted, then the confirmations are awaited.
export const sendSolanaBatch = async ({ provider, rpcUrl, txs, onProgress }) => {
  const connection = getSolConnection(rpcUrl)
  const signatures = []

  if (txs.length > 1 && typeof provider.signAllTransactions === 'function') {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    txs.forEach((tx) => {
      tx.recentBlockhash = blockhash
      tx.lastValidBlockHeight = lastValidBlockHeight
    })
    const signed = await provider.signAllTransactions(txs)
    for (let i = 0; i < signed.length; i++) {
      const signature = await connection.sendRawTransaction(signed[i].serialize())
      signatures.push(signature)
      onProgress?.({ index: i, count: txs.length, signature })
    }
    await Promise.all(signatures.map((signature) =>
      connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
    ))
    return signatures
  }

  for (let i = 0; i < txs.length; i++) {
    // Fresh blockhash per chunk: sequential wallet prompts can take longer
    // than a single blockhash stays valid.
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    txs[i].recentBlockhash = blockhash
    txs[i].lastValidBlockHeight = lastValidBlockHeight
    const signature = await provider.sendTransaction(txs[i], connection)
    signatures.push(signature)
    onProgress?.({ index: i, count: txs.length, signature })
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
  }
  return signatures
}
