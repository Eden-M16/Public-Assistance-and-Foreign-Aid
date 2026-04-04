import { ethers } from "ethers";
import PublicAssistanceABI from "./PublicAssistance.json";

export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const getContract = (signerOrProvider: ethers.Signer | ethers.Provider) => {
  return new ethers.Contract(CONTRACT_ADDRESS, PublicAssistanceABI, signerOrProvider);
};

export const getProvider = () => {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return new ethers.BrowserProvider((window as any).ethereum);
  }
  return new ethers.JsonRpcProvider("http://localhost:8545");
};
