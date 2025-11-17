const CarShareMinimal = artifacts.require("CarShareMinimal");
module.exports = async function (deployer, _network, accounts) {
  const insuranceVerifier = accounts[1];
  const arbitrator = accounts[2];
  const feeBps = 200; // 2%
  await deployer.deploy(CarShareMinimal, insuranceVerifier, arbitrator, feeBps);
};
