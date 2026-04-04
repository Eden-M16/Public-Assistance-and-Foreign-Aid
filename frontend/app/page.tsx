"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  HandHeart, 
  MessageSquareQuote, 
  ShieldCheck, 
  Wallet, 
  Search, 
  Filter, 
  TrendingUp, 
  Activity, 
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Globe,
  Award,
  AlertCircle
} from "lucide-react";
import { getContract, getProvider } from "../lib/contract";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  
  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState("dashboard");
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

  const sidebarLinks = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "donations", label: "Make Donation", icon: HandHeart },
    { id: "requests", label: "Aid Requests", icon: MessageSquareQuote },
    ...(isOwner ? [{ id: "admin", label: "Admin Panel", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-10 hidden md:flex">
        <div className="p-8">
          <div className="flex items-center space-x-2 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200">
              A
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">AidChain</span>
          </div>
          
          <nav className="space-y-1">
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.id}
                  onClick={() => setActiveTab(link.id)}
                  className={cn(
                    "w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-200",
                    activeTab === link.id 
                      ? "bg-indigo-50 text-indigo-600 shadow-sm" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Icon size={20} />
                  <span>{link.label}</span>
                  {activeTab === link.id && (
                    <motion.div 
                      layoutId="sidebar-active"
                      className="ml-auto w-1 h-5 bg-indigo-600 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-100">
          <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Status</p>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-bold">Network Online</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time monitoring of all on-chain aid distributions.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 lg:p-12 pb-24">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 capitalize">
              {activeTab} Overview
            </h2>
            <p className="text-slate-500 font-medium">
              Manage and track decentralized assistance globally.
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200 flex">
              <button className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition">Support</button>
              <button className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition border-l border-slate-100">Docs</button>
            </div>
            
            {account ? (
              <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-200">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                  <Wallet size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wallet</span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {account.slice(0, 6)}...{account.slice(-4)}
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition transform hover:-translate-y-1 active:translate-y-0 flex items-center space-x-2"
              >
                <Wallet size={18} />
                <span>Connect</span>
              </button>
            )}
          </div>
        </header>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Total Contributions", val: `${totalDonated} ETH`, icon: TrendingUp, color: "indigo" },
                  { label: "Available Funds", val: `${contractBalance} ETH`, icon: Activity, color: "emerald" },
                  { label: "Impact Areas", val: requests.length, icon: Globe, color: "amber" },
                  { label: "Top Donors", val: donors.length, icon: Award, color: "rose" },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className={cn(
                      "absolute top-0 right-0 p-4 opacity-10 transition-transform group-hover:scale-110",
                      `text-${stat.color}-600`
                    )}>
                      <stat.icon size={64} />
                    </div>
                    <div className="relative space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-2xl font-black text-slate-900">{stat.val}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Middle Section: Impact & Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Global Impact Mock Map */}
                <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden h-[400px]">
                  <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                    <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/world-map.png')] bg-center bg-no-repeat bg-contain"></div>
                  </div>
                  <div className="relative h-full flex flex-col">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black">Global Impact</h3>
                        <p className="text-slate-400 text-sm font-medium">Tracing aid across borders</p>
                      </div>
                      <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md border border-white/5 flex items-center space-x-2">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                        <span className="text-xs font-bold uppercase">Live Activity</span>
                      </div>
                    </div>
                    
                    <div className="mt-auto grid grid-cols-3 gap-8">
                      <div>
                        <p className="text-3xl font-black text-indigo-400">{Math.round(progress)}%</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Efficiency Rate</p>
                      </div>
                      <div>
                        <p className="text-3xl font-black text-emerald-400">100%</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Transparency Score</p>
                      </div>
                      <div>
                        <p className="text-3xl font-black text-amber-400">{requests.filter(r => r.completed).length}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aid Cycles Finished</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Donors Card */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900">Top Donors</h3>
                    <Award className="text-amber-500" />
                  </div>
                  
                  <div className="space-y-4">
                    {donors.length === 0 ? (
                      <div className="text-center py-12 space-y-4">
                        <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                          <AlertCircle className="text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-400 font-medium">Be the first to donate!</p>
                      </div>
                    ) : (
                      donors.map((donor, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                          <div className="flex items-center space-x-4">
                            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-black text-slate-400 border border-slate-200">
                              {i + 1}
                            </span>
                            <div className="flex flex-col">
                              <span className="text-xs font-mono font-bold text-slate-600">{donor.address.slice(0, 6)}...{donor.address.slice(-4)}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Verified Contributor</span>
                            </div>
                          </div>
                          <span className="text-sm font-black text-indigo-600">{donor.amount} ETH</span>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <button className="w-full py-4 border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition uppercase tracking-widest">
                    View Hall of Fame
                  </button>
                </div>
              </div>

              {/* Recent Activity Section */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <Activity size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900">Recent Transactions</h3>
                  </div>
                  <button className="text-xs font-bold text-indigo-600 hover:underline">View All</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activities.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-400 font-medium">No transactions recorded yet.</div>
                  ) : (
                    activities.map((act, i) => (
                      <div key={i} className="flex space-x-4 p-4 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                          <ShieldCheck size={20} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900 line-clamp-1">{act.message}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">On-Chain Verified</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "donations" && (
            <motion.div
              key="donations"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto space-y-8 pt-12"
            >
              <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-xl space-y-8">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto mb-4">
                    <HandHeart size={32} />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900">Empower Change</h3>
                  <p className="text-slate-500 font-medium">Your contribution directly fuels global aid initiatives.</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">Amount to Donate</label>
                    <div className="relative group">
                      <input
                        type="number"
                        placeholder="0.0"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-8 py-5 text-2xl font-black focus:border-indigo-500 focus:bg-white transition outline-none"
                        value={donationAmount}
                        onChange={(e) => setDonationAmount(e.target.value)}
                      />
                      <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">ETH</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-slate-400">Gas Estimate</span>
                      <span className="text-slate-900">~0.00042 ETH</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-slate-400">Total</span>
                      <span className="text-indigo-600">{donationAmount || "0.0"} ETH</span>
                    </div>
                  </div>

                  <button
                    onClick={handleDonate}
                    disabled={loading || !donationAmount}
                    className="w-full bg-slate-900 text-white py-6 rounded-[1.5rem] font-black text-lg hover:bg-slate-800 disabled:bg-slate-200 transition shadow-xl shadow-slate-200 flex items-center justify-center space-x-3"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>Confirm Donation</span>
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "requests" && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              {/* Request Form & Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900">Need Help?</h3>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">Submit your request for transparent on-chain assistance.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Description</label>
                      <textarea
                        placeholder="What do you need assistance for?"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium focus:border-emerald-500 transition outline-none min-h-[100px]"
                        value={aidDescription}
                        onChange={(e) => setAidDescription(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Category</label>
                      <select
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none"
                        value={aidCategory}
                        onChange={(e) => setAidCategory(Number(e.target.value))}
                      >
                        {CATEGORY_LABELS.map((label, idx) => (
                          <option key={idx} value={idx}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Amount (ETH)</label>
                      <input
                        type="number"
                        placeholder="0.0"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-lg font-black focus:border-emerald-500 transition outline-none"
                        value={aidAmount}
                        onChange={(e) => setAidAmount(e.target.value)}
                      />
                    </div>

                    <button
                      onClick={handleRequestAid}
                      disabled={loading || !aidAmount || !aidDescription}
                      className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black hover:bg-emerald-700 disabled:bg-slate-200 transition shadow-lg shadow-emerald-100"
                    >
                      {loading ? "Submitting..." : "Send Request"}
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900">Explore Requests</h3>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search..."
                          className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <select 
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                      >
                        <option value="All">All Categories</option>
                        {CATEGORY_LABELS.map(label => <option key={label} value={label}>{label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto flex-1">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recipient</th>
                          <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                          <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                          <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRequests.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-24 text-center text-slate-400 font-medium">No requests found.</td>
                          </tr>
                        ) : (
                          filteredRequests.map((req) => (
                            <tr key={req.id} className="group hover:bg-slate-50 transition">
                              <td className="px-6 py-5">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-900">{req.recipient.slice(0, 6)}...{req.recipient.slice(-4)}</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[150px]">{req.description}</span>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <span className="px-2 py-1 bg-slate-100 text-[10px] font-black text-slate-500 rounded-lg uppercase tracking-tight">
                                  {req.category}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-sm font-black text-slate-900">{req.amountRequested} ETH</td>
                              <td className="px-6 py-5">
                                <div className={cn(
                                  "inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                  req.completed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                )}>
                                  <div className={cn("w-1 h-1 rounded-full", req.completed ? "bg-emerald-700" : "bg-amber-700")}></div>
                                  <span>{req.completed ? "Delivered" : "Pending"}</span>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "admin" && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-4">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900">Distribution Console</h3>
                    <p className="text-slate-500 text-sm font-medium">Approve and verify assistance requests for release.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recipient Address</th>
                        <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verification Details</th>
                        <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grant Amount</th>
                        <th className="px-8 py-5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {requests.filter(r => !r.completed).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-24 text-center text-slate-400 font-medium">All requests have been processed.</td>
                        </tr>
                      ) : (
                        requests.filter(r => !r.completed).map((req) => (
                          <tr key={req.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-8 py-6 text-sm font-mono font-bold text-indigo-600">{req.recipient}</td>
                            <td className="px-8 py-6">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-900 capitalize">{req.category}</p>
                                <p className="text-xs text-slate-500 font-medium line-clamp-1">{req.description}</p>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-lg font-black text-slate-900">{req.amountRequested} ETH</td>
                            <td className="px-8 py-6 text-center">
                              <button
                                onClick={() => handleApproveAid(req.id)}
                                disabled={loading}
                                className="bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-indigo-600 transition shadow-lg shadow-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                Release Grant
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 px-6 py-4 flex justify-between items-center z-20">
        {sidebarLinks.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.id}
              onClick={() => setActiveTab(link.id)}
              className={cn(
                "p-2 rounded-xl transition-colors",
                activeTab === link.id ? "bg-indigo-50 text-indigo-600" : "text-slate-400"
              )}
            >
              <Icon size={24} />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
