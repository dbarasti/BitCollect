const CampaignRewarder = artifacts.require('./CampaignRewarder');
const Campaign = artifacts.require('./Campaign');
const truffleAssert = require('truffle-assertions');

let rewarderContract;

contract('CampaignRewarder', accounts => {
  before(async () => {
    rewarderContract = await CampaignRewarder.deployed();
    console.log("address of deployed contract: " + rewarderContract.address);
    console.log("address of benefactor: " + accounts[9])
    await web3.eth.sendTransaction({
      from: accounts[9],
      value: 1000000000,
      to: rewarderContract.address
    })
    let balance = await web3.eth.getBalance(rewarderContract.address);
    console.log("balance: " + balance);
  });

  describe('test contract creation', () => {
    it('should deploy contract', async () => {
      assert(rewarderContract !== undefined, 'Rewarder contract should be defined');
    })
  });

});