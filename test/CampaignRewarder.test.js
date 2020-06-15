const CampaignRewarder = artifacts.require('./CampaignRewarder');
const Campaign = artifacts.require('./Campaign');
const truffleAssert = require('truffle-assertions');

let rewarderContract;
const campaignDeadline = 2538374999; //~2050


contract('CampaignRewarder', accounts => {
  const organizers = accounts.slice(0, 3);
  const beneficiaries = accounts.slice(3, 5);
  const donor = accounts[5];
  beforeEach(async () => {
    rewarderContract = await CampaignRewarder.new();
    await web3.eth.sendTransaction({
      from: accounts[9],
      value: 1000000000,
      to: rewarderContract.address
    })
  });

  describe('test contract creation', () => {
    it('should deploy contract', async () => {
      assert(rewarderContract !== undefined, 'Rewarder contract should be defined');
    })
  });

  describe('test campaign handling', () => {
    it('should allow owner of rewarder to add a campaign', async () => {
      campaignContract = await Campaign.new(organizers, beneficiaries, campaignDeadline, {
        from: accounts[0]
      });
      await rewarderContract.addCampaign(campaignContract.address, {
        from: accounts[0]
      });
    })

    it('should refuse non-owner request to add a campaign', async () => {
      campaignContract = await Campaign.new(organizers, beneficiaries, campaignDeadline, {
        from: accounts[0]
      });
      await truffleAssert.reverts(rewarderContract.addCampaign(campaignContract.address, {
        from: donor
      }), "Operation not allowed. You're not the owner");
    })
  })

});