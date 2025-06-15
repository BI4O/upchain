"use client";

import { useState, useEffect } from "react";
import { 
  createWalletClient, 
  http, 
  createPublicClient,
  parseEther,
  formatEther,
  getContract,
  toFunctionSelector,
  encodeFunctionData
} from "viem";
import { sepolia } from "viem/chains";

// Import contract ABIs
import SimpleDelegateContract from "./contracts/simpleDelegateContract.json";
import BankContract from "./contracts/bank.json";
import TokenContract from "./contracts/token.json";

interface WindowWithOKXWallet extends Window {
  okxwallet?: {
    request: (params: { method: string; params?: any[] }) => Promise<any>;
    on: (event: string, handler: (data: any) => void) => void;
    removeListener: (event: string, handler: (data: any) => void) => void;
  };
}

declare const window: WindowWithOKXWallet;

const TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS as `0x${string}`;
const SIMPLE_DELEGATE_ADDRESS = process.env.NEXT_PUBLIC_DELEGATE_CONTRACT_ADDRESS as `0x${string}`;
const TOKENBANK_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_BANK_CONTRACT_ADDRESS as `0x${string}`;

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<string>("0");
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [bankBalance, setBankBalance] = useState<string>("0");
  const [depositAmount, setDepositAmount] = useState<string>("100");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [walletClient, setWalletClient] = useState<any>(null);
  const [publicClient, setPublicClient] = useState<any>(null);

  // Initialize clients and set mounted state
  useEffect(() => {
    setMounted(true);
    const client = createPublicClient({
      chain: sepolia,
      transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL)
    });
    setPublicClient(client);
  }, []);

  // Check if OKX Wallet is installed
  const isOKXWalletInstalled = () => {
    return mounted && typeof window !== "undefined" && window.okxwallet;
  };

  // Connect to OKX Wallet
  const connectWallet = async () => {
    if (!isOKXWalletInstalled()) {
      setMessage("Please install OKX Wallet extension");
      return;
    }

    try {
      setIsLoading(true);
      
      // Request account access
      const accounts = await window.okxwallet!.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        const userAccount = accounts[0];
        setAccount(userAccount);
        setIsConnected(true);

        // Create wallet client with OKX provider
        const client = createWalletClient({
          chain: sepolia,
          transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL!)
        });
        setWalletClient(client);

        // Get balances
        await updateBalances(userAccount);
        setMessage("Successfully connected to OKX Wallet!");
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setMessage("Failed to connect wallet");
    } finally {
      setIsLoading(false);
    }
  };

  // Update balances
  const updateBalances = async (userAccount: string) => {
    if (!publicClient) return;

    try {
      // Get ETH balance
      const ethBal = await publicClient.getBalance({
        address: userAccount as `0x${string}`
      });
      setEthBalance(formatEther(ethBal));

      // Get Token balance (note: using wei directly, not ether conversion)
      const tokenBal = await publicClient.readContract({
        address: TOKEN_CONTRACT_ADDRESS as `0x${string}`,
        abi: TokenContract,
        functionName: 'balanceOf',
        args: [userAccount]
      });
      setTokenBalance((tokenBal as bigint).toString());

      // Get Token symbol
      const symbol = await publicClient.readContract({
        address: TOKEN_CONTRACT_ADDRESS as `0x${string}`,
        abi: TokenContract,
        functionName: 'symbol'
      });
      setTokenSymbol(symbol as string);

      // Get bank balance (Token balance in wei)
      const bankBal = await publicClient.readContract({
        address: TOKENBANK_ADDRESS as `0x${string}`,
        abi: BankContract,
        functionName: 'balances',
        args: [userAccount]
      });
      setBankBalance((bankBal as bigint).toString());
    } catch (error) {
      console.error("Error updating balances:", error);
    }
  };

  // Check if account is already authorized (has delegate contract code)
  const checkAccountStatus = async () => {
    if (!publicClient || !account) return false;
    
    try {
      const code = await publicClient.getBytecode({ address: account as `0x${string}` });
      return typeof code === 'string' && code.length > 0;
    } catch (error) {
      console.error("Error checking account status:", error);
      return false;
    }
  };

  // Deposit Token to bank using EIP-7702 + delegate contract
  const depositTokenToBank = async () => {
    if (!walletClient || !account) {
      setMessage("Please connect your wallet first");
      return;
    }

    if (!depositAmount || BigInt(depositAmount) <= 0) {
      setMessage("Please enter a valid deposit amount");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("Preparing Token deposit transaction...");

      // Use the simpler approveAndDeposit function which handles both approve and deposit
      const approveAndDepositData = encodeFunctionData({
        abi: SimpleDelegateContract,
        functionName: 'approveAndDeposit',
        args: [TOKEN_CONTRACT_ADDRESS, TOKENBANK_ADDRESS, BigInt(depositAmount)],
      });

      // Send transaction through OKX Wallet
      const hash = await window.okxwallet!.request({
        method: 'eth_sendTransaction',
        params: [{
          from: account,
          to: SIMPLE_DELEGATE_ADDRESS,
          data: approveAndDepositData,
        }]
      });

      setMessage(`Transaction sent! Hash: ${hash}`);
      
      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === "success") {
        setMessage(`Successfully deposited ${depositAmount} ${tokenSymbol} tokens!`);
        await updateBalances(account);
        setDepositAmount(""); // Clear input after successful deposit
      } else {
        setMessage("Transaction failed");
      }

    } catch (error) {
      console.error("Token deposit failed:", error);
      setMessage("Token deposit failed: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setIsConnected(false);
    setAccount("");
    setEthBalance("0");
    setTokenBalance("0");
    setTokenSymbol("");
    setBankBalance("0");
    setDepositAmount("100");
    setWalletClient(null);
    setMessage("");
  };

  // Prevent hydration mismatch by not rendering wallet-dependent UI until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              EIP-7702 + OKX Wallet Demo
            </h1>
            <p className="text-gray-600">
              Loading...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            EIP-7702 + OKX Wallet Demo
          </h1>
          <p className="text-gray-600">
            Account Abstraction using OKX Wallet and EIP-7702 Authorization
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Wallet Connection</h2>
          
          {!isConnected ? (
            <div className="text-center">
              {!isOKXWalletInstalled() ? (
                <div>
                  <p className="text-red-600 mb-4">OKX Wallet not detected</p>
                  <a 
                    href="https://www.okx.com/web3" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
                  >
                    Install OKX Wallet
                  </a>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={isLoading}
                  className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {isLoading ? "Connecting..." : "Connect OKX Wallet"}
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="font-semibold text-gray-700">Account</h3>
                  <p className="text-sm font-mono break-all">{account}</p>
                </div>
                                 <div className="bg-gray-50 p-4 rounded">
                   <h3 className="font-semibold text-gray-700">ETH Balance</h3>
                   <p className="text-sm">{ethBalance} ETH</p>
                 </div>
                 <div className="bg-gray-50 p-4 rounded">
                   <h3 className="font-semibold text-gray-700">Token Balance</h3>
                   <p className="text-sm">{tokenBalance} {tokenSymbol}</p>
                 </div>
                 <div className="bg-gray-50 p-4 rounded">
                   <h3 className="font-semibold text-gray-700">Bank Token Balance</h3>
                   <p className="text-sm">{bankBalance} {tokenSymbol}</p>
                 </div>
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="font-semibold text-gray-700">Network</h3>
                  <p className="text-sm">Sepolia Testnet</p>
                </div>
              </div>
              
              <button
                onClick={disconnectWallet}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {isConnected && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">EIP-7702 Operations</h2>
            
                         <div className="space-y-4">
               <div>
                 <h3 className="text-lg font-medium mb-2">Token Deposit to Bank</h3>
                 <p className="text-gray-600 mb-3">
                   Deposit tokens to the bank contract using EIP-7702 + delegate contract (approve + deposit in one transaction)
                 </p>
                 
                 <div className="mb-3">
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Deposit Amount (in wei)
                   </label>
                   <input
                     type="number"
                     value={depositAmount}
                     onChange={(e) => setDepositAmount(e.target.value)}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                     placeholder="Enter amount in wei (e.g., 100)"
                     disabled={isLoading}
                   />
                   <p className="text-xs text-gray-500 mt-1">
                     Your token balance: {tokenBalance} {tokenSymbol}
                   </p>
                 </div>
                 
                 <button
                   onClick={depositTokenToBank}
                   disabled={isLoading || !depositAmount || BigInt(depositAmount || "0") <= 0}
                   className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 disabled:opacity-50"
                 >
                   {isLoading ? "Processing..." : `Deposit ${depositAmount || "0"} ${tokenSymbol}`}
                 </button>
               </div>
             </div>
          </div>
        )}

        {message && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Status</h3>
            <p className={`${message.includes("fail") || message.includes("error") ? "text-red-600" : "text-green-600"}`}>
              {message}
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Contract Addresses</h3>
          <div className="space-y-2 text-sm">
                         <div>
               <span className="font-medium">Bank Contract:</span>
               <span className="ml-2 font-mono text-gray-600">{TOKENBANK_ADDRESS}</span>
             </div>
            <div>
              <span className="font-medium">Delegate Contract:</span>
              <span className="ml-2 font-mono text-gray-600">{SIMPLE_DELEGATE_ADDRESS}</span>
            </div>
          </div>  
        </div>
      </div>
    </div>
  );
}
