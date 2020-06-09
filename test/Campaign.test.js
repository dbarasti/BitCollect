const Campaign = artifacts.require('./Campaign');

contract('Campaign', accounts => {
  it('initializes with correct value', async () => {
    const campaignContract = await Campaign.deployed();
    const value = await campaignContract.get();
    assert.equal(value, 'myValue');
  })
})