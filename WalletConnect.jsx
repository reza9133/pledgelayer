import React, { useState } from 'react';
import { ethers } from 'ethers';

const WalletConnect = () => {
    const [account, setAccount] = useState('');
    const [status, setStatus] = useState('Disconnected');

    const connectWallet = async () => {
        // Checking for MetaMask or Rabby injected providers
        if (window.ethereum) {
            try {
                setStatus('Connecting...');
                const providers = window.ethereum.providers || [window.ethereum];
                // Prioritize Rabby or fallback to MetaMask
                const provider = providers.find(p => p.isRabby) || window.ethereum;
                
                const accounts = await provider.request({ method: 'eth_requestAccounts' });
                if (accounts.length > 0) {
                    setAccount(accounts[0]);
                    setStatus('Connected');
                }
            } catch (error) {
                setStatus('Connection Failed');
                console.error("Wallet connection error:", error);
            }
        } else {
            setStatus('No Web3 Provider Found');
            alert('Please install MetaMask or Rabby Wallet.');
        }
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Web3 Authentication Module</h2>
            <p>Status: <strong>{status}</strong></p>
            {account && <p>Connected Address: {account}</p>}
            <button 
                onClick={connectWallet}
                style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}
            >
                Connect MetaMask / Rabby
            </button>
        </div>
    );
};

export default WalletConnect;
