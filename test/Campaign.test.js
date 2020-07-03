const Campaign = artifacts.require('./Campaign');
const CampaignRewarder = artifacts.require('./CampaignRewarder');
const truffleAssert = require('truffle-assertions');
require("./utils.js");


let campaignContract;
let rewarderContract;
const campaignDeadline = 2538374999; //~2050

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

contract('Campaign', accounts => {
  const organizers = accounts.slice(0, 3);
  const beneficiaries = accounts.slice(3, 5);
  const donor = accounts[5];

  beforeEach(async () => {
    campaignContract = await Campaign.new(organizers, beneficiaries, campaignDeadline, {
      from: accounts[0]
    });
  });

  describe('test contract creation', () => {
    it('should deploy contract', async () => {
      assert(campaignContract !== undefined, 'Campaign contract should be defined');
    })

    it('should have at least one organizer', async () => {
      const firstOrganizer = await campaignContract.organizers(1);
      assert(firstOrganizer !== undefined);
    })
    it('should retrieve of all organizers', async () => {
      const organizers = await campaignContract.getOrganizers();
      assert(organizers !== undefined);
    });

    it('should have at least one beneficiary', async () => {
      const firstBeneficiary = await campaignContract.beneficiaries(1);
      assert(firstBeneficiary !== undefined);
    });

    it('should retrieve of all beneficiaries', async () => {
      const beneficiaries = await campaignContract.getBeneficiaries();
      assert(beneficiaries !== undefined);
    });

    it('should have a deadline', async () => {
      const deadline = await campaignContract.deadline();
      assert(deadline == campaignDeadline);
    })

  });

  describe('test contract activation', () => {
    it('should refuse initial funding by non-organizers', async () => {
      await truffleAssert.reverts(campaignContract.initialize([50, 50], {
        from: donor,
        value: 5000000000000
      }), "Operation not allowed by non-organizer");
    });

    it('should accept initial funding by organizers', async () => {
      await campaignContract.initialize([50, 50], {
        from: organizers[0],
        value: 500000000
      })
      const hasFunded = await campaignContract.hasFunded({
        from: organizers[0]
      })
      assert.equal(hasFunded, true, 'state of organizer should have changed')
    });

    it('should refuse incomplete distributions', async () => {
      await truffleAssert.reverts(campaignContract.initialize([50], {
        from: organizers[0],
        value: 5000000
      }), "Distributions don't match the beneficiaries");
    })

    it('should refuse initial funding with 0 wei', async () => {
      await truffleAssert.reverts(campaignContract.initialize([50, 50], {
        from: organizers[0],
        value: 0
      }), "Initial funding must be > 0");
    });

    it('should refuse initial funding sent twice', async () => {
      await campaignContract.initialize([50, 50], {
        from: organizers[0],
        value: 500000000
      });
      await truffleAssert.reverts(campaignContract.initialize([50, 50], {
        from: organizers[0],
        value: 5000
      }), "Initial funding already sent");
    });

    it('shuld enter ONGOING status after all organizers send funds', async () => {
      organizers.forEach(async organizer => {
        await campaignContract.initialize([50, 50], {
          from: organizer,
          value: 500000000
        });
      });
      const campaignStatus = await campaignContract.getStatus();
      assert.equal(campaignStatus, 1, "status is not set to ONGOING (val=1)")
    });
  })

  describe('test donations', () => {
    it('should refuse donations before organizer/s fund the campaign', async () => {
      await truffleAssert.reverts(campaignContract.donate([60, 40], {
        from: donor,
        value: 5000000000000
      }), "Can't accept donations. Organizers must fund the Campaign first");
    });

    it('should allow a donor to split amount among beneficiaries', async () => {
      const organizerQuota = 500000000;
      let totalQuota = 0;
      organizers.forEach(async organizer => {
        await campaignContract.initialize([50, 50], {
          from: organizer,
          value: organizerQuota
        });
        totalQuota += organizerQuota;
      });

      await campaignContract.donate([60, 40], {
        from: donor,
        value: 5000000000000
      });
      let balance = await web3.eth.getBalance(campaignContract.address)
      assert.equal(balance, 5000000000000 + totalQuota, 'contract balance is not as expected');
      const firstBeneficiaryAmount = await campaignContract.beneficiaryAmount(beneficiaries[0]);
      const secondBeneficiaryAmount = await campaignContract.beneficiaryAmount(beneficiaries[1]);
      assert.equal(firstBeneficiaryAmount, 3000000000000 + totalQuota / 2, 'amount for first beneficiary is no as expected')
      assert.equal(secondBeneficiaryAmount, 2000000000000 + totalQuota / 2, 'amount for second beneficiary is no as expected')
    })

    it('should keep track of donors\' donations', async () => {
      const organizerQuota = 500000000;
      organizers.forEach(async organizer => {
        await campaignContract.initialize([50, 50], {
          from: organizer,
          value: organizerQuota
        });
      });

      await campaignContract.donate([60, 40], {
        from: donor,
        value: 5000000000000
      });
      const numberOfDonations = await campaignContract.donationsOf(donor);
      assert.equal(numberOfDonations, 1, "donations of donor should have been one")
    });

    it('should refuse initializations after deadline', async () => {
      pastTimestamp = 1591690199;
      campaignContract = await Campaign.new(organizers, beneficiaries, pastTimestamp, {
        from: accounts[0]
      });

      const organizerQuota = 500000000;
      await truffleAssert.reverts(campaignContract.initialize([50, 50], {
        from: organizers[0],
        value: organizerQuota
      }), "Campaign has expired");
    })

    it('should refuse donation after deadline', async () => {
      nearTimestamp = Math.round(Date.now() / 1000) + 1; //one second from now
      campaignContract = await Campaign.new(organizers, beneficiaries, nearTimestamp, {
        from: accounts[0]
      });
      const organizerQuota = 500000000;
      organizers.forEach(async organizer => {
        await campaignContract.initialize([50, 50], {
          from: organizer,
          value: organizerQuota
        });
      });
      await sleep(2500);
      await truffleAssert.reverts(campaignContract.donate([60, 40], {
        from: donor,
        value: 5000000000000
      }), "Campaign has expired");
    })
  });

  describe('test withdraw', () => {
    it('should allow a beneficiary to withdraw its amount', async () => {
      nearTimestamp = Math.round(Date.now() / 1000) + 2;
      campaignContract = await Campaign.new(organizers, beneficiaries, nearTimestamp, {
        from: accounts[0]
      });

      const organizerQuota = 500000000;
      let totalQuota = 0;
      organizers.forEach(async organizer => {
        await campaignContract.initialize([50, 50], {
          from: organizer,
          value: organizerQuota
        });
        totalQuota += organizerQuota;
      });

      await campaignContract.donate([60, 40], {
        from: donor,
        value: 5000000000000
      });

      await sleep(2000);

      const contractBalanceBefore = await web3.eth.getBalance(campaignContract.address);
      await campaignContract.withdraw({
        from: beneficiaries[0]
      });
      const contractBalanceAfter = await web3.eth.getBalance(campaignContract.address);
      const expected = Math.round(parseFloat(contractBalanceAfter) + parseFloat(totalQuota) / 2 + 3000000000000);
      assert.equal(expected, contractBalanceBefore, "withdraw is not as expected")

      //try to withdraw again
      await truffleAssert.reverts(campaignContract.withdraw({
        from: beneficiaries[0]
      }), "Error. No amount available or beneficiary non-existing");
    });

    it('should refuse withdraw if campaign is not CONCLUDED', async () => {
      nearTimestamp = Math.round(Date.now() / 1000) + 3;
      campaignContract = await Campaign.new(organizers, beneficiaries, nearTimestamp, {
        from: accounts[0]
      });

      const organizerQuota = 500000000;
      organizers.forEach(async organizer => {
        await campaignContract.initialize([50, 50], {
          from: organizer,
          value: organizerQuota
        });
      });

      await campaignContract.donate([60, 40], {
        from: donor,
        value: 5000000000000
      });

      //campaign hasn't expired yet
      await truffleAssert.reverts(campaignContract.withdraw({
        from: beneficiaries[0]
      }), "Operation not permitted. Campaign is not concluded");
    });
  });

  describe('test deactivation', () => {
    it('should allow deactivation after withdraw is completed', async () => {
      nearTimestamp = Math.round(Date.now() / 1000) + 1;
      campaignContract = await Campaign.new(organizers, beneficiaries, nearTimestamp, {
        from: accounts[0]
      });

      const organizerQuota = 500000000;
      organizers.forEach(async organizer => {
        await campaignContract.initialize([50, 50], {
          from: organizer,
          value: organizerQuota
        });
      });
      await sleep(1500);
      await campaignContract.withdraw({
        from: beneficiaries[0]
      });

      await truffleAssert.reverts(campaignContract.deactivate({
        from: organizers[0]
      }), "Operation not permitted. Beneficiaries didn't withdraw");

      await campaignContract.withdraw({
        from: beneficiaries[1]
      });

      await campaignContract.deactivate({
        from: organizers[0]
      })
      assert.equal(await campaignContract.getStatus(), 4, "status is not set to DISABLED (val=4)")
    })

    it('should disallow non-organizers to deactivate the contract', async () => {
      await truffleAssert.reverts(campaignContract.deactivate({
        from: donor
      }), "Operation not allowed by non-organizer");
    })
  });

  describe('test rewards', () => {
    it('should allow campaign organizers to specify rewards', async () => {
      amounts = [1000000000000, 1000000000000000, 5000000000000000];
      rewards = ["ABC123", "DEF123", "GHI123"];
      const res = await campaignContract.setRewards(amounts, rewards, {
        from: organizers[0]
      });
      truffleAssert.eventEmitted(res, 'reward_set');
    })

    it('should refuse to specify rewards twice', async () => {
      amounts = [1000000000000, 1000000000000000, 5000000000000000];
      rewards = ["ABC123", "DEF123", "GHI123"];
      await campaignContract.setRewards(amounts, rewards, {
        from: organizers[0]
      });
      await truffleAssert.reverts(campaignContract.setRewards(amounts, rewards, {
        from: organizers[0]
      }), "Rewards not set. Configuration already present");
    })

    it('should refuse to non-organizers to specify rewards', async () => {
      amounts = [1000000000000, 1000000000000000, 5000000000000000];
      rewards = ["ABC123", "DEF123", "GHI123"];
      await truffleAssert.reverts(campaignContract.setRewards(amounts, rewards, {
        from: donor
      }), 'Operation not allowed by non-organizer');
    })

    it('should refuse to accept different-sized parameters', async () => {
      amounts = [1000000000000, 1000000000000000, 5000000000000000];
      rewards = ["ABC123", "DEF123"];
      await truffleAssert.reverts(campaignContract.setRewards(amounts, rewards, {
        from: organizers[0]
      }), "Rewards not set. Parameter sizes do not match");
    });

    it('should refuse to return rewards if donation is not large enough', async () => {
      amounts = [1000000000000, 1000000000000000, 5000000000000000];
      let rewards = ["ABC123", "DEF123", "GHI123"];
      await campaignContract.setRewards(amounts, rewards);

      const organizerQuota = 500000000;
      organizers.forEach(async organizer => {
        await campaignContract.initialize([50, 50], {
          from: organizer,
          value: organizerQuota
        });
      });

      await campaignContract.donate([10, 90], {
        from: donor,
        value: 1000000
      });

      await truffleAssert.reverts(campaignContract.claimRewards({
        from: donor
      }), "Cannot claim rewards. None are present");
    })

    it('should return rewards after a donation large enough', async () => {
      amounts = [1000000000000, 1000000000000000, 5000000000000000];
      let rewards = ["ABC123", "DEF123", "GHI123"];
      await campaignContract.setRewards(amounts, rewards);

      const organizerQuota = 500000000;
      organizers.forEach(async organizer => {
        await campaignContract.initialize([50, 50], {
          from: organizer,
          value: organizerQuota
        });
      });

      await campaignContract.donate([10, 90], {
        from: donor,
        value: 1000000000000000
      });

      let obtainedRewards = await campaignContract.claimRewards({
        from: donor
      });
      assert(obtainedRewards.equals(['ABC123', 'DEF123']), "unexpected rewards");
    })
  });

  describe('test milestones', () => {
    it('should allow an organizer to specify milestones', async () => {
      rewarderContract = await CampaignRewarder.new();
      const milestones = [100000000, 500000000, 10000000000000];
      await campaignContract.setMilestones(milestones, rewarderContract.address, {
        from: organizers[0]
      })
    })

    it('should refuse to specify milestones twice', async () => {
      rewarderContract = await CampaignRewarder.new();
      const milestones = [100000000, 500000000, 10000000000000];
      await campaignContract.setMilestones(milestones, rewarderContract.address, {
        from: organizers[0]
      });

      await truffleAssert.reverts(campaignContract.setMilestones(milestones, rewarderContract.address, {
        from: organizers[0]
      }), "Milestones not set. Configuration already present");
    })

    it('should disallow non-organizers to specify milestones', async () => {
      rewarderContract = await CampaignRewarder.new();
      const milestones = [100000000, 500000000, 10000000000000];
      await truffleAssert.reverts(campaignContract.setMilestones(milestones, rewarderContract.address, {
        from: donor
      }), "Operation not allowed by non-organizer");
    })

    /*
    Every time the campaign reaches a milestone
    the deadline is prolonged, and the smart contract is
    able to withdraw from a third-party smart contract an
    amount as a reward for its success.
    */
    it('should extend the deadline and collect reward after reaching a milestone', async () => {
      rewarderContract = await CampaignRewarder.new();
      await web3.eth.sendTransaction({
        from: accounts[9],
        value: 1000000000,
        to: rewarderContract.address
      });
      rewarderContract.addCampaign(campaignContract.address);

      const milestones = [100000000, 500000000, 10000000000000];
      await campaignContract.setMilestones(milestones, rewarderContract.address, {
        from: organizers[1]
      })

      // activating the campaign
      const organizerQuota = 50;
      organizers.forEach(async organizer => {
        await campaignContract.initialize([50, 50], {
          from: organizer,
          value: organizerQuota
        });
      });

      let deadlineBefore = await campaignContract.deadline();

      // donating enough to reach the first milestone
      let res = await campaignContract.donate([10, 90], {
        from: donor,
        value: 200000000
      });

      let deadlineAfter = await campaignContract.deadline();
      assert(deadlineAfter > deadlineBefore, "deadline should have been postponed");


      deadlineBefore = await campaignContract.deadline();

      // donating enough to reach the second milestone
      await campaignContract.donate([10, 90], {
        from: donor,
        value: 300000000
      });

      deadlineAfter = await campaignContract.deadline();
      assert(deadlineAfter > deadlineBefore, "deadline should have been postponed for the second milestone");
      const balanceAfterSecondDonation = await web3.eth.getBalance(campaignContract.address);
      assert(parseFloat(balanceAfterSecondDonation) > 200000150, "expected campaign to receive money");
    })

    it("should not reach same milestone twice", async () => {
      rewarderContract = await CampaignRewarder.new();
      await web3.eth.sendTransaction({
        from: accounts[9],
        value: 1000000000,
        to: rewarderContract.address
      });
      rewarderContract.addCampaign(campaignContract.address);

      // setting the milestones
      const milestones = [100000000, 5000000000, 10000000000000];
      await campaignContract.setMilestones(milestones, rewarderContract.address, {
        from: organizers[1]
      })


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
      const deadlineAfterFirstDonation = await campaignContract.deadline();
      const balanceAfterFirstDonation = await web3.eth.getBalance(campaignContract.address);
      // donating againg, although not enough to reach the second milestone
      await campaignContract.donate([10, 90], {
        from: donor,
        value: 1000
      });

      const deadlineAfterSecondDonation = await campaignContract.deadline();
      const balanceAfterSecondDonation = await web3.eth.getBalance(campaignContract.address);

      // deadline should not be postponed
      assert.equal(deadlineAfterFirstDonation.toString(), deadlineAfterSecondDonation.toString(), "deadline shouldn't have been postponed");
      assert.equal(balanceAfterSecondDonation, parseFloat(balanceAfterFirstDonation) + 1000, "balance shouldn't have changed");
    })
  });
});