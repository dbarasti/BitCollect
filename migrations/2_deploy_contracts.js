const Campaign = artifacts.require("./Campaign.sol");
const CampaignRewarder = artifacts.require('./CampaignRewarder');

const campaignDeadline = 2538374999; //~2050

module.exports = function (deployer, network, accounts) {
  deployer.deploy(Campaign, accounts.slice(0, 3), accounts.slice(3, 5), campaignDeadline, {
    from: accounts[0]
  });
  deployer.deploy(CampaignRewarder);
};