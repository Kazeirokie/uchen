import React, { useState } from 'react';
import { ethers } from 'ethers';
import lighthouse from '@lighthouse-web3/sdk';
import kavach from '@lighthouse-web3/kavach';

// Must be set here (or replace with import.meta.env.VITE_... if using .env)
const LIGHTHOUSE_API_KEY = "01eba46e.2c8d8ac61ba3451aaa26945e075c88b8";
const CONTRACT_ADDRESS   = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export default function ReEncrypt() {
  const [oldCid, setOldCid]             = useState('');
  const [status, setStatus]             = useState('Idle');

  // Simplified Kavach challenge signer
  async function signAuthMessage(address: string, signer: ethers.Signer) {
    const authResp = await kavach.getAuthMessage(address);
    if (typeof authResp.message !== 'string') {
      throw new Error('No Kavach auth challenge found');
    }
    return signer.signMessage(authResp.message);
  }

  async function Decrypt() {
    try {
      if (!window.ethereum) {
        setStatus('❌ MetaMask not found');
        return;
      }

      // --- Gov connect & decrypt ---
      setStatus('⏳ Connecting Wallet…');
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer   = await provider.getSigner();
      const govAddr  = await signer.getAddress();
      setStatus(`✅ Gov: ${govAddr}`);

      setStatus('⏳ Signing Challenge…');
      const govAuthSig = await signAuthMessage(govAddr, signer);

      setStatus('⏳ Fetching decryption key…');
      const fetchResp = await lighthouse.fetchEncryptionKey(oldCid, govAddr, govAuthSig);
      const fileKey   = fetchResp.data.key;

      if (typeof fileKey !== 'string') {
        throw new Error('Decryption key is not a string');
      }

      setStatus('⏳ Decrypting old payload…');
      const decryptResult = await lighthouse.decryptFile(oldCid, fileKey);
      let arrayBuf: ArrayBuffer;
      if (decryptResult instanceof ArrayBuffer) arrayBuf = decryptResult;
      else if (ArrayBuffer.isView(decryptResult)) arrayBuf = decryptResult.buffer;
      else if (typeof (decryptResult as any).arrayBuffer === 'function') {
        arrayBuf = await (decryptResult as any).arrayBuffer();
      } else {
        throw new Error('Unexpected decryptFile return');
      }
      const payload = JSON.parse(new TextDecoder().decode(arrayBuf));

      console.log('Decrypted payload:', payload);

    } catch (err: any) {
      console.error(err);
      setStatus('❌ Error: ' + (err.message || String(err)));
    }
  }

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h2>Decrypt</h2>

      <label style={{ display: 'block', margin: '0.5rem 0' }}>
        Old Encrypted CID:
        <input
          type="text"
          value={oldCid}
          onChange={e => setOldCid(e.target.value)}
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </label>

      <button
        onClick={Decrypt}
        style={{ marginTop: '1rem', padding: '0.75rem 1.5rem' }}
      >
        Re-encrypt & Update
      </button>

      <p style={{ marginTop: '1rem' }}><strong>Status:</strong> {status}</p>
    </div>
  );
}
