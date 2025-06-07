// scripts/mintLand.js

// ------------------------
// Use Node’s built-in WebCrypto (requires Node v18+)
// ------------------------
const { webcrypto } = require("crypto");
globalThis.crypto = webcrypto;

// ------------------------
// Main script
// ------------------------
require("dotenv").config();
const lighthouse = require("@lighthouse-web3/sdk");
const kavach     = require("@lighthouse-web3/kavach");
const { ethers } = require("hardhat");
// Note: We rely on Hardhat’s injected ethers v6 (from hardhat-toolbox).
//       Do NOT `require("ethers")` directly.

async function signAuthMessage(ethAddress, wallet) {
  // (1) Ask Kavach for an auth challenge using the Ethereum address
  const authResponse = await kavach.getAuthMessage(ethAddress);

  // (2) Extract the challenge string (either authResponse.data.message or authResponse.message)
  let challengeMessage;
  if (authResponse?.data && typeof authResponse.data.message === "string") {
    challengeMessage = authResponse.data.message;
  } else if (typeof authResponse.message === "string") {
    challengeMessage = authResponse.message;
  } else {
    throw new Error(
      "Invalid Kavach auth response. Expected a message string.\n" +
      "Full response:\n" +
      JSON.stringify(authResponse, null, 2)
    );
  }

  // (3) Use Gov’s wallet to sign the challenge string
  return await wallet.signMessage(challengeMessage);
}

async function main() {
  // ==== A) Build Gov’s Wallet from .env + connect to Hardhat’s provider ====
  const rawKey = process.env.GOV_PRIVATE_KEY;
  if (!rawKey) {
    throw new Error("Please set GOV_PRIVATE_KEY in your .env");
  }

  // Create a Wallet using Hardhat’s provider
  const govWallet  = new ethers.Wallet(rawKey, ethers.provider);
  const govAddress = await govWallet.getAddress();
  console.log("Gov address (from .env):", govAddress);

  // ==== C) Attach to deployed LandNFT contract with govWallet as signer ====
  const LAND_CONTRACT_ADDR = process.env.CONTRACT_ADDRESS;
  const LandNFT = await ethers.getContractAt(
    "LandNFT",
    LAND_CONTRACT_ADDR,
    govWallet
  );

  // ==== D) Build + sign the “land metadata” payload (no client-side hashing) ====
  const metadata = {
    StreetNumber:    0,
    StreetName:     "",
    Region:  "",
    City:      "",
    State:  "",
    timestamp: Math.floor(Date.now() / 1000),
  };

  // 1) Serialize metadata to a JSON string
  const metadataString = JSON.stringify(metadata);

  // 2) Have govWallet sign the raw JSON string
  const govSignature = await govWallet.signMessage(metadataString);

  // 3) Combine JSON + signature into a single payload
  const payload = JSON.stringify({
    data:      metadata,
    signature: govSignature,
  });
  console.log("Payload to upload:", payload);

  // ==== E) Upload & Encrypt via Lighthouse.textUploadEncrypted ====
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) {
    throw new Error("Please set LIGHTHOUSE_API_KEY in your .env");
  }
  console.log("Using LIGHTHOUSE_API_KEY prefix:", apiKey.slice(0, 6) + "...");

  // Sign Kavach’s auth challenge using Gov’s Ethereum address
  let signedAuthMsg;
  try {
    signedAuthMsg = await signAuthMessage(govAddress, govWallet);
  } catch (e) {
    console.error("❌ Failed to get/sign Kavach auth message:", e);
    process.exit(1);
  }

  console.log("Uploading & encrypting metadata for Gov only…");

  // Debug logs
  console.log("Payload:", payload);
  console.log("GovAddress (for saveShards):", govAddress);
  console.log("GovPubkey (for encryption):", govPubkey);
  console.log("SignedAuthMsg:", signedAuthMsg);

  let encryptedCID;
  try {
    // ── Pass govAddress (not govPubkey) into textUploadEncrypted as the “address” param ──
    // textUploadEncrypted(text, apiKey, address, signedMessage, name)
    const uploadResponse = await lighthouse.textUploadEncrypted(
      payload,
      apiKey,
      govAddress,    // ← use the Ethereum address here for saveShards
      signedAuthMsg,
      "land-meta-gov"
    );
    // The SDK returns { data: [ { Hash: "<cid>" } ] }
    encryptedCID = uploadResponse.data[0].Hash;
    console.log("✅ Encrypted CID (Gov-only):", encryptedCID);
  } catch (e) {
    console.error("❌ Error encrypting/uploading file:", e);
    console.error(
      "\n• Ensure Node v18+ (with crypto.webcrypto).\n" +
      "• Verify GOV_PRIVATE_KEY and LIGHTHOUSE_API_KEY are correct."
    );
    process.exit(1);
  }

  // ==== F) Mint the LandNFT (tokenId = 0) to Gov, setting tokenURI = CID ====
  console.log("Minting LandNFT to Gov with tokenURI =", encryptedCID);
  const mintTx = await LandNFT.mintLand(encryptedCID);
  await mintTx.wait();
  console.log("✅ Mint complete. Gov owns tokenId 0.");
  console.log("All done. LandNFT tokenId 0 minted with that encrypted metadata.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Uncaught error in main:", err);
    process.exit(1);
  });
