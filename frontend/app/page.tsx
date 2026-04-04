"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { getContract, getProvider } from "../lib/contract";

enum Category { Medical, Education, Disaster, Food, Other }
const CATEGORY_LABELS = ["Medical", "Education", "Disaster", "Food", "Other"];

export default function Home() {
  const [account, setAccount] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [totalDonated, setTotalDonated] = useState("0");
  const [contractBalance, setContractBalance] = useState("0");
  const [requests, setRequests] = useState<any[]>([]);
  const [donors, setDonors] = useState<any[]>([]);
  const [donationAmount, setDonationAmount] = useState("");
  const [aidDescription, setAidDescription] = useState("");
  const [aidAmount, setAidAmount] = useState("");
  const [aidCategory, setAidCategory] = useState<Category>(Category.Other);
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");

  useEffect(() => {
    checkConnection();
    fetchData();
  }, []);

  async function checkConnection() {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0].address);
        checkOwner(accounts[0].address);
      }
    }
  }

  async function connectWallet() {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
        checkOwner(accounts[0]);
      } catch (error) {
        console.error("User denied account access");
      }
    } else {
      alert("Please install MetaMask!");
    }
  }

  async function checkOwner(userAddress: string) {
    const provider = getProvider();
    const contract = getContract(provider);
    const owner = await contract.owner();
    setIsOwner(owner.toLowerCase() === userAddress.toLowerCase());
  }

  async function fetchData() {
    try {
      const provider = getProvider();
      const contract = getContract(provider);

      const donated = await contract.totalDonated();
      const balance = await contract.getContractBalance();
      const reqCount = await contract.getRequestsCount();
      const donorCount = await contract.getDonorsCount();

      setTotalDonated(ethers.formatEther(donated));
      setContractBalance(ethers.formatEther(balance));

      // Fetch Donors
      const donorList = [];
      for (let i = 0; i < Number(donorCount); i++) {
        const donorAddress = await contract.donors(i);
        const amount = await contract.donations(donorAddress);
        donorList.push({
          address: donorAddress,
          amount: ethers.formatEther(amount)
        });
      }
      setDonors(donorList.sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5));

      // Fetch Requests
      const reqs = [];
      const activityLog = [];
      for (let i = 0; i < Number(reqCount); i++) {
        const req = await contract.requests(i);
        reqs.push({
          id: i,
          recipient: req.recipient,
          description: req.description,
          amountRequested: ethers.formatEther(req.amountRequested),
          amountReceived: ethers.formatEther(req.amountReceived),
          category: CATEGORY_LABELS[Number(req.category)],
          completed: req.completed,
        });
        if (req.completed) {
          activityLog.push({
            type: 'AidSent',
            message: `Aid of ${ethers.formatEther(req.amountReceived)} ETH sent to ${req.recipient.slice(0, 6)}...${req.recipient.slice(-4)}`,
            time: 'Completed'
          });
        }
      }
      setRequests(reqs.reverse());
      setActivities(activityLog.slice(-5).reverse());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  async function handleDonate() {
    if (!account) return alert("Connect wallet first!");
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = getContract(signer);

      const tx = await contract.donate({
        value: ethers.parseEther(donationAmount),
      });
      await tx.wait();
      alert("Donation successful!");
      setDonationAmount("");
      fetchData();
    } catch (error) {
      console.error("Donation failed:", error);
      alert("Donation failed!");
    }
    setLoading(false);
  }

  async function handleRequestAid() {
    if (!account) return alert("Connect wallet first!");
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = getContract(signer);

      const tx = await contract.requestAid(
        aidDescription,
        ethers.parseEther(aidAmount),
        aidCategory
      );
      await tx.wait();
      alert("Aid request submitted!");
      setAidDescription("");
      setAidAmount("");
      fetchData();
    } catch (error) {
      console.error("Aid request failed:", error);
      alert("Aid request failed!");
    }
    setLoading(false);
  }

  async function handleApproveAid(requestId: number) {
    if (!isOwner) return alert("Only owner can approve!");
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = getContract(signer);

      const tx = await contract.approveAid(requestId);
      await tx.wait();
      alert("Aid approved and sent!");
      fetchData();
    } catch (error) {
      console.error("Approval failed:", error);
      alert("Approval failed! Make sure the contract has enough balance.");
    }
    setLoading(false);
  }

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          req.recipient.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "All" || req.category === filterCategory;
    const matchesStatus = filterStatus === "All" || 
                          (filterStatus === "Completed" && req.completed) || 
                          (filterStatus === "Pending" && !req.completed);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const progress = Number(totalDonated) > 0 ? (Number(contractBalance) / Number(totalDonated)) * 100 : 0;

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Public Assistance & Foreign Aid</h1>
            <p className="text-slate-500 font-medium">Transparent, Secure, and Decentralized Aid Distribution</p>
          </div>
          <div className="mt-6 md:mt-0">
            {account ? (
              <div className="flex items-center space-x-3 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-slate-700 font-mono text-sm">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition transform hover:-translate-y-1 active:translate-y-0"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Content (Forms & Requests) */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Action Forms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Donate Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-100 p-2 rounded-lg">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Make a Donation</h2>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.0 ETH"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition outline-none"
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ETH</span>
                  </div>
                  <button
                    onClick={handleDonate}
                    disabled={loading || !donationAmount}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-slate-300 transition shadow-lg shadow-indigo-100"
                  >
                    {loading ? "Processing..." : "Donate Now"}
                  </button>
                </div>
              </div>

              {/* Request Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-emerald-100 p-2 rounded-lg">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Request Assistance</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Brief description of need"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition outline-none"
                      value={aidDescription}
                      onChange={(e) => setAidDescription(e.target.value)}
                    />
                    <select
                      className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      value={aidCategory}
                      onChange={(e) => setAidCategory(Number(e.target.value))}
                    >
                      {CATEGORY_LABELS.map((label, idx) => (
                        <option key={idx} value={idx}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.0 ETH"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition outline-none"
                      value={aidAmount}
                      onChange={(e) => setAidAmount(e.target.value)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ETH</span>
                  </div>
                  <button
                    onClick={handleRequestAid}
                    disabled={loading || !aidAmount || !aidDescription}
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 disabled:bg-slate-300 transition shadow-lg shadow-emerald-100"
                  >
                    Submit Request
                  </button>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
              <div className="flex-1 relative">
                <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <input
                  type="text"
                  placeholder="Search by description or address..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <select 
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  {CATEGORY_LABELS.map(label => <option key={label} value={label}>{label}</option>)}
                </select>
                <select 
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="All">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Requests List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">Active Aid Requests</h2>
                <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-slate-500 border border-slate-200 uppercase tracking-wider">
                  {filteredRequests.length} Requests Found
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Recipient</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Purpose</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      {isOwner && <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Admin</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={isOwner ? 6 : 5} className="px-6 py-12 text-center text-slate-400 font-medium">No aid requests match your filters.</td>
                      </tr>
                    ) : (
                      filteredRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                              {req.recipient.slice(0, 6)}...{req.recipient.slice(-4)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md capitalize">
                              {req.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{req.description}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{req.amountRequested} ETH</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${req.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {req.completed ? 'Distributed' : 'Awaiting Review'}
                            </span>
                          </td>
                          {isOwner && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              {!req.completed && (
                                <button
                                  onClick={() => handleApproveAid(req.id)}
                                  disabled={loading}
                                  className="text-indigo-600 hover:text-indigo-900 font-bold text-sm underline decoration-2 underline-offset-4 disabled:text-slate-300"
                                >
                                  Approve Aid
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar (Stats & Activity) */}
          <div className="space-y-8">
            {/* Stats Dashboard */}
            <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>
              
              <div className="space-y-6 relative">
                <div>
                  <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-1">Total Contributions</p>
                  <p className="text-4xl font-black">{totalDonated} <span className="text-xl font-normal text-slate-400">ETH</span></p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="text-emerald-400">Current Balance</span>
                    <span className="text-slate-400">{Math.round(progress)}% of Total</span>
                  </div>
                  <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-2xl font-bold">{contractBalance} <span className="text-sm font-normal text-slate-400">ETH Available</span></p>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-800 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{requests.length}</p>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Total Requests</p>
                </div>
                <div className="text-center border-l border-slate-800">
                  <p className="text-2xl font-bold">{requests.filter(r => r.completed).length}</p>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Aids Sent</p>
                </div>
              </div>
            </div>

            {/* Top Donors Leaderboard */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                <span>Top Contributors</span>
              </h3>
              <div className="space-y-4">
                {donors.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No donations yet.</p>
                ) : (
                  donors.map((donor, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                        <span className="text-xs font-mono text-slate-600">{donor.address.slice(0, 6)}...{donor.address.slice(-4)}</span>
                      </div>
                      <span className="text-sm font-bold text-indigo-600">{donor.amount} ETH</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                <span>On-Chain Activity</span>
              </h3>
              <div className="space-y-6">
                {activities.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No recent distributions found.</p>
                ) : (
                  activities.map((act, i) => (
                    <div key={i} className="flex space-x-4">
                      <div className="flex-shrink-0 mt-1">
                        <div className="bg-emerald-50 p-2 rounded-lg">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900 leading-tight">{act.type}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{act.message}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{act.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Info */}
            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
              <h4 className="text-indigo-900 font-bold text-sm mb-2 italic">Why Blockchain?</h4>
              <p className="text-indigo-700 text-xs leading-relaxed">
                By using Ethereum, we ensure that every wei of donation is trackable and aid distribution is verifiable by the public. No intermediaries, just direct impact.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
