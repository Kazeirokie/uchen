// src/App.tsx

import React, { useState } from "react";
import { ethers } from "ethers";
import lighthouse from "@lighthouse-web3/sdk";
import kavach from "@lighthouse-web3/kavach";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }

  interface ImportMetaEnv {
    VITE_LIGHTHOUSE_API_KEY: string;
    // add other env variables here if needed
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export default function App() {
  const [status, setStatus] = useState("Idle");
  // Make sure you have VITE_LIGHTHOUSE_API_KEY in your .env, and restart Vite after editing.
  const apiKey = import.meta.env.VITE_LIGHTHOUSE_API_KEY as string;

  async function encryptHardcodedText() {
    if (!window.ethereum) {
      setStatus("❌ Please install MetaMask");
      return;
    }
    if (!apiKey) {
      setStatus("❌ Please set VITE_LIGHTHOUSE_API_KEY in .env");
      return;
    }


    try {
      // ─── Step 1: Connect to MetaMask ──────────────────────────────
      setStatus("⏳ Connecting to MetaMask…");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer   = await provider.getSigner();
      const address  = await signer.getAddress();
      setStatus(`✅ Connected as ${address}`);

      // ─── Step 2: Ask Kavach for a challenge and sign it ────────────
      setStatus("⏳ Fetching Kavach challenge…");
      const authResp = await kavach.getAuthMessage(address);
      const challenge: string = authResp.message!;
      setStatus("🖊 Signing Kavach challenge…");
      const signedSignature: string = await signer.signMessage(challenge);
      setStatus("✅ Kavach challenge signed");

     

      // ─── Step 4: Call textUploadEncrypted(...) with the signed challenge ───
      //
      //    Lighthouse expects the raw ECDSA signature from the Kavach
      //    challenge along with your uncompressed public key. The JWT
      //    returned above can be saved for later use, but
      //    textUploadEncrypted should receive the signed challenge itself.
      //
      const yourText = JSON.stringify({
        StreetNumber:  123,
        StreetName:    "Main St",
        Region:        "Westside",
        City:          "Metropolis",
        State:         "CA",
        timestamp:     Math.floor(Date.now() / 1000),
      });

      setStatus("⏳ Encrypting & uploading text…");
      // Derive the uncompressed public key (0x04… hex) for encryption
      // ethers.js does not provide getPublicKey() on JsonRpcSigner, so we use the address to recover the public key from the signature
      // This requires ethers v6+. If using v5, you need a different approach.
      const recoveredPubKey = ethers.SigningKey.recoverPublicKey(
        ethers.hashMessage(challenge),
        signedSignature
      );
      // const publicKey = recoveredPubKey; // This will be the uncompressed 0x04… key
      // console.log("Recovered public key:", publicKey);
      console.log("Public key (uncompressed):", address);
      console.log("Signed signature:", signedSignature);
// Browser-only: recover & pass your uncompressed ECIES key
const signature = await signer.signMessage(challenge)
const publicKey = ethers.SigningKey.recoverPublicKey(
  ethers.hashMessage(challenge),
  signature
)

const uploadResponse = await lighthouse.textUploadEncrypted(
  yourText,
  apiKey,
  address,    // ← full 0x04… key is required in the browser
  signature,    // ← Kavach signature
  "land-metadata"
)
      setStatus("✅ Text encrypted and uploaded");

      // ─── Step 5: Extract the IPFS CID from the response ──────────────
      const ipfsHash = uploadResponse.data[0].Hash; // This is the CID of your encrypted text
      console.log("Upload response:", uploadResponse);
      console.log("IPFS Hash:", ipfsHash);
      setStatus("✅ Encrypted CID: " + ipfsHash);

console.log("Extracted CID:", ipfsHash);  // should now log your Qm… hash




      // At this point you have an IPFS CID that is ECIES‐encrypted for “address.”
      // If you later want to decrypt, you’d call
      //    await lighthouse.decryptCID(encryptedHash, address, signedSignature or JWT).

    } catch (err) {
      console.error("encryptHardcodedText error:", err);
      if ((err as any).response) {
        console.error("→ HTTP status:", (err as any).response.status);
        console.error("→ Response body:", (err as any).response.data);
      }
      setStatus("❌ Error encrypting file: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Browser Encryption with Lighthouse + Kavach (JWT)</h1>
      <p>Status: {status}</p>
      <button
        onClick={encryptHardcodedText}
        style={{
          marginTop: 16,
          padding: "8px 16px",
          backgroundColor: "#238636",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        Encrypt Hard‐coded Text
      </button>
    </div>
  );
}
