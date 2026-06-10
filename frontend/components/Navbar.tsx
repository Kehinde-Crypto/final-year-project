'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/products', label: 'Products' },
  { href: '/actors', label: 'Actors' },
  { href: '/transfers', label: 'Transfers' },
  { href: '/chat', label: 'AI Chat' },
];

export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-xl font-bold text-gray-900">
            Supply Chain KG
          </Link>
          <div className="flex gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isConnected ? (
            <>
              <span className="text-sm text-gray-600 font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <button
                onClick={() => disconnect()}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}