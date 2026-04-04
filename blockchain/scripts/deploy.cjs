const hre = require("hardhat");

async function main() {
  const PublicAssistance = await hre.ethers.getContractFactory("PublicAssistance");
  const publicAssistance = await PublicAssistance.deploy();

  await publicAssistance.waitForDeployment();

  console.log("PublicAssistance deployed to:", await publicAssistance.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
