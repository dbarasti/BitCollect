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

    it('should allow to withdraw a prize when a milestone is reached', async () => {
      campaignContract = await Campaign.new(organizers, beneficiaries, campaignDeadline, {
        from: organizers[0]
      });

      // setting the milestones
      const milestones = [100000000, 5000000000, 10000000000000];
      await campaignContract.setMilestones(milestones, {
        from: organizers[1]
      })

      await rewarderContract.addCampaign(campaignContract.address);


      // activating the campaign
      const organizerQuota = 50;
      organizers.forEach(async organizer => {
        await campaignContract.initialize([50, 50], {
          from: organizer,
          value: organizerQuota
        });
      });

      // donating enough to reach the first milestone
      await campaignContract.donate([10, 90], {
        from: donor,
        value: 200000000
      });

      const balanceBefore = await web3.eth.getBalance(campaignContract.address);
      await rewarderContract.claimReward(campaignContract.address);
      const balanceAfter = await web3.eth.getBalance(campaignContract.address);
      assert(balanceAfter > balanceBefore, "expected campaign to receive money");
    })
  })

});