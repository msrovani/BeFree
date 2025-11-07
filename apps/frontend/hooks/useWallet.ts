import { useState } from 'react';

export interface WalletState {
  address?: string;
  network: string;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | undefined>();
  const [connected, setConnected] = useState(false);
  const network = 'befree-holo-testnet';

  const connect = () => {
    setAddress('0xBFR3E...J4RB45');
    setConnected(true);
  };

  const disconnect = () => {
    setConnected(false);
    setAddress(undefined);
  };

  return {
    address,
    network,
    connected,
    connect,
    disconnect,
  };
}
