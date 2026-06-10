import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { hardhat, sepolia } from 'wagmi/chains';

/**
 * RainbowKit + wagmi configuration
 * 
 * getDefaultConfig() automatically sets up connectors for:
 * - MetaMask
 * - Coinbase Wallet
 * - WalletConnect (supports Trust Wallet, Rainbow, etc.)
 * - Browser injected wallets
 * 
 * Get your WalletConnect projectId from: https://cloud.walletconnect.com
 */
export const config = getDefaultConfig({
  appName: 'LEDGER CORE',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [hardhat, sepolia],
  ssr: true,
});