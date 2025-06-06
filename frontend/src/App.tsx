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

      // ─── Step 3: Exchange the signed challenge for a Kavach JWT ───
      //
      //    kavach.getJWT(address, signedSignature) returns { JWT, error }.
      //    If `error` is non‐null, the JWT fetch failed.
      //
      setStatus("⏳ Retrieving Kavach JWT…");
      const { JWT, error } = await kavach.getJWT(address, signedSignature);
      if (error) {
        throw new Error("Failed to get JWT: " + JSON.stringify(error));
      }
      if (!JWT) {
        throw new Error("Kavach did not return a JWT.");
      }
      setStatus("✅ Obtained Kavach JWT");

      // ─── Step 4: Call textUploadEncrypted(...) with the JWT ────────
      //
      //    Signature argument for textUploadEncrypted is now the Kavach JWT,
      //    NOT the raw ECDSA signature. Because the JWT embeds your shards.
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
      const uploadResponse: any = await lighthouse.textUploadEncrypted(
        yourText,
        apiKey,
        address,         // MUST be your 0x… address
        JWT,             // Kavach JWT goes here (not raw signature)
        "land-metadata"  // a short “filename”/label so it isn’t undefined
      );

      // ─── Step 5: Check and read the IPFS CID ───────────────────────
      console.log("uploadResponse:", uploadResponse);
      if (!uploadResponse.data || typeof uploadResponse.data.Hash !== "string") {
        throw new Error(
          "Unexpected Lighthouse response: " + JSON.stringify(uploadResponse)
        );
      }
      const encryptedHash = uploadResponse.data.Hash;
      setStatus(`✅ Encrypted text CID: ${encryptedHash}`);
      console.log("Encrypted CID (browser):", encryptedHash);

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
