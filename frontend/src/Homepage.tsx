import React, { useState } from 'react';
import { ethers } from 'ethers';
import lighthouse from '@lighthouse-web3/sdk';
import kavach from '@lighthouse-web3/kavach';

// Constants (replace with your .env values)
const LIGHTHOUSE_API_KEY = "01eba46e.2c8d8ac61ba3451aaa26945e075c88b8";
const CONTRACT_ADDRESS   = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export default function ReEncrypt() {
  const [status, setStatus] = useState('Idle');
  const [oldCid, setOldCid] = useState('');
  const [encryptedCid, setEncryptedCid] = useState('');
  const [decryptedPayload, setDecryptedPayload] = useState<any>(null);
  const [lands, setLands] = useState<{ id: string; uri: string }[]>([]);

  // Metadata inputs
  const [streetNumber, setStreetNumber] = useState('');
  const [streetName, setStreetName]     = useState('');
  const [region, setRegion]             = useState('');
  const [city, setCity]                 = useState('');
  const [stateVal, setStateVal]         = useState('');

  // Transfer inputs
  const [transferCid, setTransferCid] = useState('');
  const [transferBuyerAddress, setTransferBuyerAddress] = useState('');

  // Sign Kavach challenge
  async function signAuthMessage(address: string, signer: ethers.Signer): Promise<string> {
    const authResp = await kavach.getAuthMessage(address);
    if (typeof authResp.message !== 'string') throw new Error('No Kavach auth challenge found');
    return signer.signMessage(authResp.message);
  }

 // Encrypt metadata & mint NFT
  async function encryptAndMint() {
    try {
      if (!window.ethereum) throw new Error('MetaMask not found');
      setStatus('⏳ Connecting wallet…');
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer   = await provider.getSigner();
      const govAddr  = await signer.getAddress();

      setStatus('⏳ Signing Kavach challenge…');
      const challenge = (await kavach.getAuthMessage(govAddr)).message!;
      const signature = await signer.signMessage(challenge);

      const metadata = {
        StreetNumber: Number(streetNumber),
        StreetName:   streetName,
        Region:       region,
        City:         city,
        State:        stateVal,
        timestamp:    Math.floor(Date.now() / 1000),
      };

      setStatus('⏳ Encrypting & uploading metadata…');
      const pubKey = ethers.SigningKey.recoverPublicKey(
        ethers.hashMessage(challenge),
        signature
      );
      const uploadResp: any = await lighthouse.textUploadEncrypted(
        JSON.stringify(metadata),
        LIGHTHOUSE_API_KEY,
        govAddr,
        signature,
        'land-metadata'
      );
      const cid = Array.isArray(uploadResp.data)
        ? uploadResp.data[0].Hash
        : uploadResp.data.Hash;
      setEncryptedCid(cid);
      setStatus(`✅ Metadata encrypted: ${cid}`);

      setStatus('⏳ Minting Land NFT…');
      const abi = [
        'function mintLand(string) public',
        'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
        'function balanceOf(address) view returns (uint256)',
        'function tokenURI(uint256) view returns (string)',
      ];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
      const tx = await contract.mintLand(cid);
      await tx.wait();

      // Derive tokenId by fetching new balance and subtracting one
      const balance = await contract.balanceOf(govAddr);
      const tokenId = (balance - 1n).toString();

    setStatus(`⏳ Fetching tokenURI for ID ${tokenId}…`);
    const uri = await contract.tokenURI(tokenId);
    setLands(prev => [{ id: tokenId, uri }, ...prev]);
    setStatus(`✅ Minted Land ${tokenId} with URI ${uri}`);

    } catch (err: any) {
      console.error(err);
      if (err.code === 'CALL_EXCEPTION' && err.reason) {
        setStatus(`❌ Transaction reverted: ${err.reason}`);
      } else {
        setStatus('❌ Encrypt/Mint error: ' + (err.message || String(err)));
      }
    }
  }

  // Decrypt by CID
  async function decryptCid() {
    try {
      if (!window.ethereum) throw new Error('MetaMask not found');
      setStatus('⏳ Connecting wallet…');
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer   = await provider.getSigner();
      const addr     = await signer.getAddress();

      setStatus('⏳ Signing Kavach challenge…');
      const signature = await signAuthMessage(addr, signer);

      setStatus('⏳ Fetching decryption key…');
      const fetchResp = await lighthouse.fetchEncryptionKey(oldCid, addr, signature);
      const fileKey = fetchResp.data.key;

      setStatus('⏳ Downloading & decrypting…');
      const decryptResult = await lighthouse.decryptFile(oldCid, fileKey as string);
      let buf: ArrayBuffer;
      if (decryptResult instanceof ArrayBuffer) buf = decryptResult;
      else if (ArrayBuffer.isView(decryptResult)) buf = decryptResult.buffer;
      else if ((decryptResult as any).arrayBuffer) buf = await (decryptResult as any).arrayBuffer();
      else throw new Error('Unexpected decryptFile return');
      const payload = JSON.parse(new TextDecoder().decode(buf));
      setDecryptedPayload(payload);
      setStatus('✅ Decryption successful');
    } catch (err: any) {
      console.error(err);
      setStatus('❌ Decrypt error: ' + (err.message || String(err)));
    }
  }

  // Transfer ownership of shards
  async function transferAccess() {
    try {
      if (!window.ethereum) throw new Error('MetaMask not found');
      setStatus('⏳ Connecting wallet…');
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer   = await provider.getSigner();
      const govAddr  = await signer.getAddress();

      setStatus('⏳ Signing Kavach challenge…');
      const sig = await signAuthMessage(govAddr, signer);
      const buyerAddr = transferBuyerAddress.trim() || govAddr;

      setStatus('⏳ Transferring shards…');
      const resp = await kavach.transferOwnership(govAddr, transferCid, buyerAddr, sig, true);
      if ((resp as any).error) throw new Error('Transfer failed: ' + resp.error);
      setStatus('✅ Transfer & revoke successful');
    } catch (err: any) {
      console.error(err);
      setStatus('❌ Transfer error: ' + (err.message || String(err)));
    }
  }

// New ERC-721 on-chain enumeration
async function fetchMyLands() {
  try {
    setStatus('⏳ Fetching your lands…');
    if (!window.ethereum) throw new Error('MetaMask not found');
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum as any);
    const signer   = await provider.getSigner();
    const user     = await signer.getAddress();

    // ERC-721 Enumerable methods
    const abi = [
      'function balanceOf(address) view returns (uint256)',
      'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)',
      'function tokenURI(uint256) view returns (string)'
    ];
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

    // Get count and iterate
    const balanceBN = await contract.balanceOf(user);
    const balance   = Number(balanceBN);
    const list: { id: string; uri: string }[] = [];
    for (let i = 0; i < balance; i++) {
      const tokenId = await contract.tokenOfOwnerByIndex(user, i);
      const uri     = await contract.tokenURI(tokenId);
      list.push({ id: tokenId.toString(), uri });
    }

    setLands(list);
    setStatus(`✅ Found ${list.length} land(s)`);
  } catch (err: any) {
    console.error(err);
    setStatus('❌ Fetch lands error: ' + (err.message || String(err)));
  }
}


  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h2>Land NFT Dashboard</h2>

      <section style={{ marginBottom: 24 }}>
        <h3>Encrypt & Mint New Land</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input placeholder="Street Number" value={streetNumber} onChange={e => setStreetNumber(e.target.value)} style={{ padding: 8 }} />
          <input placeholder="Street Name"   value={streetName}   onChange={e => setStreetName(e.target.value)}   style={{ padding: 8 }} />
          <input placeholder="Region"        value={region}       onChange={e => setRegion(e.target.value)}         style={{ padding: 8 }} />
          <input placeholder="City"          value={city}         onChange={e => setCity(e.target.value)}           style={{ padding: 8 }} />
          <input placeholder="State"         value={stateVal}     onChange={e => setStateVal(e.target.value)}       style={{ padding: 8 }} />
        </div>
        <button onClick={encryptAndMint} style={{ marginTop: 8, padding: '8px 16px' }}>
          Encrypt & Mint
        </button>
        {encryptedCid && <p><strong>CID:</strong> {encryptedCid}</p>}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3>Decrypt by CID</h3>
        <input
          type="text"
          placeholder="Enter CID to decrypt"
          value={oldCid}
          onChange={e => setOldCid(e.target.value)}
          style={{ width: '100%', marginBottom: 8, padding: 8 }}
        />
        <button onClick={decryptCid} style={{ padding: '8px 16px' }}>
          Decrypt
        </button>
        {decryptedPayload && (
          <pre style={{ background: '#f0f0f0', padding: 8, marginTop: 8 }}>
            {JSON.stringify(decryptedPayload, null, 2)}
          </pre>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3>Transfer Shard Ownership</h3>
        <input
          type="text"
          placeholder="CID to transfer"
          value={transferCid}
          onChange={e => setTransferCid(e.target.value)}
          style={{ width: '100%', marginBottom: 8, padding: 8 }}
        />
        <input
          type="text"
          placeholder="New owner address (optional)"
          value={transferBuyerAddress}
          onChange={e => setTransferBuyerAddress(e.target.value)}
          style={{ width: '100%', marginBottom: 8, padding: 8 }}
        />
        <button onClick={transferAccess} style={{ padding: '8px 16px' }}>
          Transfer & Revoke
        </button>
      </section>

      <section>
        <h3>Your Lands</h3>
        <button onClick={fetchMyLands} style={{ padding: '8px 16px', marginBottom: 8 }}>
          Fetch My Lands
        </button>
        {lands.length > 0 ? (
          <ul>
            {lands.map(land => (
              <li key={land.id} style={{ margin: '4px 0' }}>
                <strong>ID:</strong> {land.id}<br />
                <strong>URI:</strong> <a href={land.uri} target="_blank" rel="noreferrer">{land.uri}</a>
              </li>
            ))}
          </ul>
        ) : (<p>No lands loaded yet.</p>)}
      </section>

      <p style={{ marginTop: 24 }}><strong>Status:</strong> {status}</p>
    </div>
  );
}
