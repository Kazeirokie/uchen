import React, { useState } from 'react';
import { ethers } from 'ethers';
import lighthouse from '@lighthouse-web3/sdk';
import kavach from '@lighthouse-web3/kavach';

// Must be set here (or replace with import.meta.env.VITE_... if using .env)
const LIGHTHOUSE_API_KEY = "01eba46e.2c8d8ac61ba3451aaa26945e075c88b8";
const CONTRACT_ADDRESS   = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export default function ReEncrypt() {
  const [oldCid, setOldCid]             = useState('');
  const [tokenId, setTokenId]           = useState('0');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [status, setStatus]             = useState('Idle');

  // Sign a Kavach challenge for a given address
  async function signAuthMessage(address: string, signer: ethers.Signer) {
    const authResp = await kavach.getAuthMessage(address);
    if (typeof authResp.message !== 'string') {
      throw new Error('No Kavach auth challenge found');
    }
    return signer.signMessage(authResp.message);
  }

  async function transferAccess() {
    try {
      if (!window.ethereum) {
        setStatus('❌ MetaMask not found');
        return;
      }
      // Connect Gov
      setStatus('⏳ Connecting Gov wallet…');
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const govSigner = await provider.getSigner();
      const govAddr   = await govSigner.getAddress();
      setStatus(`✅ Gov: ${govAddr}`);

      // Gov signs challenge
      setStatus('⏳ Signing Gov challenge…');
      const govAuthSig = await signAuthMessage(govAddr, govSigner);

      // Transfer shards to Buyer and reset access
      setStatus('⏳ Transferring shard ownership…');
      const buyerAddr = buyerAddress.trim() || govAddr;  // default to Gov if none provided
      const transferResp = await kavach.transferOwnership(
        govAddr,
        oldCid,
        buyerAddr,
        govAuthSig,
        true // resetSharedTo
      );
      if ((transferResp as any).error) {
        throw new Error('Failed to transfer ownership: ' + (transferResp as any).error);
      }
      setStatus('✅ Shard ownership transferred & old access revoked');

      // Optionally update on-chain to keep same CID (not strictly necessary if unchanged)
      setStatus('⏳ Updating tokenURI to same CID…');
      const abi = ['function updateTokenURI(uint256,string)'];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, govSigner);
      await (await contract.updateTokenURI(Number(tokenId), oldCid)).wait();
      setStatus(`✅ tokenURI confirmed: ${oldCid}`);

    } catch (err: any) {
      console.error(err);
      setStatus('❌ Error: ' + (err.message || String(err)));
    }
  }

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h2>Transfer & Revoke Land Metadata Access</h2>

      <label style={{ display: 'block', margin: '0.5rem 0' }}>
        Encrypted CID to transfer:
        <input
          type="text"
          value={oldCid}
          onChange={e => setOldCid(e.target.value)}
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </label>

      <label style={{ display: 'block', margin: '0.5rem 0' }}>
        Token ID:
        <input
          type="number"
          value={tokenId}
          onChange={e => setTokenId(e.target.value)}
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </label>

      <label style={{ display: 'block', margin: '0.5rem 0' }}>
        Buyer Address (0x…):
        <input
          type="text"
          value={buyerAddress}
          onChange={e => setBuyerAddress(e.target.value)}
          style={{ width: '100%', padding: '0.5rem' }}
          placeholder="0x... (account to transfer shards to)"
        />
      </label>

      <button
        onClick={transferAccess}
        style={{ marginTop: '1rem', padding: '0.75rem 1.5rem' }}
      >
        Transfer & Revoke Access
      </button>

      <p style={{ marginTop: '1rem' }}><strong>Status:</strong> {status}</p>
    </div>
  );
}
