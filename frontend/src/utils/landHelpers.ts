// frontend/src/utils/landHelpers.ts

import lighthouse from "@lighthouse-web3/sdk";
import kavach from "@lighthouse-web3/kavach";
import { ethers } from "ethers";
import LandNFTABI from "../../../artifacts/contracts/LandNFT.sol/LandNFT.json" with { type: "json" };

/**
 * encryptAndMint:
 *   1. metadata → JSON string → signer.signMessage → userSignature
 *   2. Kavach getAuthMessage(signerAddress) → challenge → signer.signMessage → signedAuth
 *   3. lighthouse.textUploadEncrypted(payload, apiKey, signerAddress, signedAuth, "label")
 *        → Under the hood, Lighthouse already has your public key (from registration),
 *          so it encrypts and returns a CID.
 *   4. Call mintLand(encryptedCID) on‐chain; minted to msg.sender, which is signerAddress.
 */
export async function encryptAndMint(
  metadata: Record<string, any>,
  signer: ethers.Signer
): Promise<{ cid: string; receipt: ethers.TransactionReceipt }> {
  if (!signer) {
    throw new Error("Connect your wallet first");
  }
  const userAddress = await signer.getAddress();
  console.log("encryptAndMint: User address:", userAddress);

  // 1) Sign metadata JSON
  const metadataString = JSON.stringify(metadata);
  console.log("encryptAndMint: Metadata JSON:", metadataString);
  const userSignature = await signer.signMessage(metadataString);
  console.log("encryptAndMint: User signature:", userSignature);

  // Combine into payload
  const payload = JSON.stringify({ data: metadata, signature: userSignature });
  console.log("encryptAndMint: Combined payload:", payload);

  // 2) Kavach challenge → sign
  const authResp = await kavach.getAuthMessage(userAddress);
  const challenge = authResp.message;
  console.log("encryptAndMint: Kavach challenge:", challenge);

  if (challenge == null) {
    throw new Error("Kavach challenge message is null");
  }
  const signedAuth = await signer.signMessage(challenge);
  console.log("encryptAndMint: Signed auth:", signedAuth);

  // 3) textUploadEncrypted (Lighthouse already has your public key from step 1)
  const apiKey = process.env.VITE_LIGHTHOUSE_API_KEY;
  if (!apiKey) {
    throw new Error("Set VITE_LIGHTHOUSE_API_KEY in .env");
  }
  console.log("encryptAndMint: Uploading & encrypting…");

  let encryptedCID: string;
  try {
    const uploadResp = await lighthouse.textUploadEncrypted(
      payload,
      apiKey,
      userAddress,
      signedAuth,
      "land-metadata"
    );
    console.log("encryptAndMint: Lighthouse upload response:", uploadResp);

    encryptedCID = uploadResp.data.Hash;
    if (!encryptedCID) {
      throw new Error(
        "encryptAndMint: No CID returned from Lighthouse:\n" +
        JSON.stringify(uploadResp, null, 2)
      );
    }
    console.log("encryptAndMint: Encrypted CID:", encryptedCID);
  } catch (err: any) {
    console.error("encryptAndMint: Error encrypting file:", err);
    if (err.response) {
      console.error("Axios error data:", err.response.data);
      console.error("Axios status:", err.response.status);
    }
    throw new Error("Encryption failed: " + err.message);
  }

  // 4) Mint on-chain
  const contractAddress = process.env.VITE_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("Set VITE_CONTRACT_ADDRESS in .env");
  }
  console.log("encryptAndMint: Minting to contract:", contractAddress);

  const landContract = new ethers.Contract(
    contractAddress,
    LandNFTABI.abi,
    signer
  );
  const tx = await landContract.mintLand(encryptedCID);
  console.log("encryptAndMint: mintLand tx sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("encryptAndMint: mintLand confirmed:", receipt.transactionHash);

  return { cid: encryptedCID, receipt };
}
