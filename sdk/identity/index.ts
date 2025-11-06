export interface DID { did: string; pub: string; wallet: string; }
export const sign = async (payload: Uint8Array) => {
  // TODO: use wallet / Android Keystore
  return new Uint8Array([0]);
};
