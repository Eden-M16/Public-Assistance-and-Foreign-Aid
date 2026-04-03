# Public Assistance and Foreign Aid on Blockchain

A transparent and decentralized platform for public assistance and foreign aid distribution using Ethereum smart contracts and a modern Next.js frontend.

## 🚀 Features

- **Decentralized Donations**: Securely donate ETH to a public assistance fund.
- **Aid Requests**: Transparently request aid with descriptions and amounts.
- **On-chain Accountability**: All transactions and aid distributions are recorded on the blockchain.
- **Admin Approval**: Secure approval process for aid distribution (restricted to the contract owner).
- **Real-time Stats**: Track total donations and current contract balance.
- **Modern UI**: Clean and responsive interface built with Next.js and Tailwind CSS.

## 🛠 Tech Stack

- **Smart Contract**: Solidity, Hardhat
- **Frontend**: Next.js 15+, TypeScript, Tailwind CSS
- **Web3 Library**: Ethers.js
- **Network**: Local Hardhat Node (Development)

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MetaMask](https://metamask.io/) browser extension

### 1. Smart Contract Setup

```bash
# Navigate to the blockchain directory
cd blockchain

# Install dependencies
npm install

# Start a local Hardhat node
npx hardhat node
```

### 2. Deploy the Contract

In a new terminal:

```bash
# Deploy the contract to the local network
cd blockchain
npx hardhat run scripts/deploy.cjs --network localhost
```

**Note:** After deployment, copy the contract address and update it in `frontend/lib/contract.ts`.

### 3. Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## 📄 License

MIT
