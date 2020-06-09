const Campaign = artifacts.require("./Campaign.sol");

const campaignDeadline = Date.now();

module.exports = function (deployer, network, accounts) {
  deployer.deploy(Campaign, accounts.slice(0, 3), accounts.slice(3, 5), campaignDeadline, {
    from: accounts[0]
  });
};