import React, { useState } from 'react';
import { ethers } from 'ethers';
import lighthouse from '@lighthouse-web3/sdk';
import kavach from '@lighthouse-web3/kavach';

// Constants (replace with your .env or keep hardcoded for demo)
const LIGHTHOUSE_API_KEY = "01eba46e.2c8d8ac61ba3451aaa26945e075c88b8";
const CONTRACT_ADDRESS   = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export default function ReEncrypt() {
  const [oldCid, setOldCid]             = useState('');
  const [tokenId, setTokenId]           = useState('0');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [status, setStatus]             = useState('Idle');
  const [lands, setLands]               = useState<{ id: string; uri: string }[]>([]);

  // Generic signer for Kavach challenges
  async function signAuthMessage(address: string, signer: ethers.Signer): Promise<string> {
    const authResp = await kavach.getAuthMessage(address);
    if (typeof authResp.message !== 'string') {
      throw new Error('No Kavach challenge found');
    }
    return signer.signMessage(authResp.message);
  }

  // Transfer ownership & revoke old shards
  async function transferAccess() {
    try {
      setStatus('⏳ Connecting as Gov...');
      if (!window.ethereum) throw new Error('MetaMask not found');
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const govSigner = await provider.getSigner();
      const govAddr   = await govSigner.getAddress();

      setStatus('⏳ Signing Gov challenge...');
      const govSig = await signAuthMessage(govAddr, govSigner);

      setStatus('⏳ Transferring shards...');
      const buyer = buyerAddress.trim() || govAddr;
      const resp = await kavach.transferOwnership(govAddr, oldCid, buyer, govSig, true);
      if ((resp as any).error) throw new Error('Transfer failed: ' + resp.error);
      setStatus('✅ Shards transferred & old access revoked');

      setStatus('⏳ Confirming on-chain URI...');
      const abi = ['function updateTokenURI(uint256,string)'];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, govSigner);
      await (await contract.updateTokenURI(Number(tokenId), oldCid)).wait();
      setStatus(`✅ NFT tokenURI kept as ${oldCid}`);
    } catch (err: any) {
      console.error(err);
      setStatus('❌ ' + (err.message || err));
    }
  }

  // Fetch lands owned by connected account
  async function fetchMyLands() {
    try {
      setStatus('⏳ Fetching your lands...');
      if (!window.ethereum) throw new Error('MetaMask not found');
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer   = await provider.getSigner();
      const user     = await signer.getAddress();

      // ERC-721 standard functions
      const abi = [
        'function balanceOf(address) view returns (uint256)',
        'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)',
        'function tokenURI(uint256) view returns (string)'
      ];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

      const balance = await contract.balanceOf(user);
      const count = balance;
      const list: { id: string; uri: string }[] = [];
      for (let i = 0; i < count; i++) {
        const id = (await contract.tokenOfOwnerByIndex(user, i)).toString();
        const uri = await contract.tokenURI(id);
        list.push({ id, uri });
      }
      setLands(list);
      setStatus(`✅ Found ${list.length} land(s)`);
    } catch (err: any) {
      console.error(err);
      setStatus('❌ ' + (err.message || err));
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h2>Land Management Dashboard</h2>
      <div style={{ marginBottom: 24 }}>
        <h3>Transfer & Revoke Metadata Access</h3>
        <input
          placeholder="CID to transfer"
          value={oldCid}
          onChange={e => setOldCid(e.target.value)}
          style={{ width: '100%', marginBottom: 8, padding: 8 }}
        />
        <input
          type="number"
          placeholder="Token ID"
          value={tokenId}
          onChange={e => setTokenId(e.target.value)}
          style={{ width: '100%', marginBottom: 8, padding: 8 }}
        />
        <input
          placeholder="Buyer address (optional)"
          value={buyerAddress}
          onChange={e => setBuyerAddress(e.target.value)}
          style={{ width: '100%', marginBottom: 8, padding: 8 }}
        />
        <button onClick={transferAccess} style={{ padding: '8px 16px' }}>
          Transfer & Revoke Access
        </button>
      </div>

      <div>
        <h3>Your Lands</h3>
        <button onClick={fetchMyLands} style={{ padding: '8px 16px', marginBottom: 8 }}>
          Fetch My Lands
        </button>
        {lands.length > 0 ? (
          <ul>
            {lands.map(land => (
              <li key={land.id} style={{ margin: '4px 0' }}>
                <strong>ID:</strong> {land.id} <br />
                <strong>URI:</strong> <a href={land.uri} target="_blank" rel="noreferrer">
                  {land.uri}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p>No lands loaded yet.</p>
        )}
      </div>

      <p style={{ marginTop: 24 }}><strong>Status:</strong> {status}</p>
    </div>
  );
}
