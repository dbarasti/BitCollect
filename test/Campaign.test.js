const Campaign = artifacts.require('./Campaign');
const truffleAssert = require('truffle-assertions');


let campaignContract;
const campaignDeadline = 1591862999; //~11 june 2020

contract('Campaign', accounts => {
  const organizers = accounts.slice(0, 3);
  const beneficiaries = accounts.slice(3, 5);
  const donor = accounts[5];

  //Is it ok to recreate a contract for each test?
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
      const campaignStatus = await campaignContract.status();
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
  });
});