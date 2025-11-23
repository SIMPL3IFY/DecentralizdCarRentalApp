// test/carshare.test.js
// Run: npx truffle test
// Dev deps recommended: npm i -D truffle-assertions chai

const truffleAssert = require("truffle-assertions");
const { assert } = require("chai");

const CarRental = artifacts.require("CarRental");

contract("CarRental", (accounts) => {
    const [
        platform,
        insuranceVerifier,
        arbitrator,
        listingOwner,
        renter,
        stranger,
    ] = accounts;

    const DAILY_PRICE = web3.utils.toWei("0.05", "ether"); // 0.05
    const DEPOSIT = web3.utils.toWei("0.5", "ether"); // 0.5
    const FEE_BPS = 200; // 2%

    // helpers
    async function latest() {
        const b = await web3.eth.getBlock("latest");
        return Number(b.timestamp);
    }

    async function deployFresh() {
        return await CarRental.new(insuranceVerifier, arbitrator, FEE_BPS, {
            from: platform,
        });
    }

    async function registerBoth(cs) {
        await cs.register({ from: listingOwner });
        await cs.register({ from: renter });
    }

    async function createAndVerifyListing(cs) {
        await cs.createListing(
            DAILY_PRICE,
            DEPOSIT,
            "ipfs://insurance.pdf",
            "Toyota",
            "Camry",
            2020,
            "New York, NY",
            {
                from: listingOwner,
            }
        );
        await cs.verifyInsurance(0, true, { from: insuranceVerifier });
    }

    function bn(x) {
        return web3.utils.toBN(x);
    }

    async function getStartEnd(days = 3) {
        const t = await latest();
        const start = t + 86400; // +1 day
        const end = start + 86400 * days;
        return { start, end };
    }

    async function request(cs, listingId = 0, days = 3) {
        const { start, end } = await getStartEnd(days);
        const rentalCost = bn(DAILY_PRICE).mul(bn(days));
        const escrow = rentalCost.add(bn(DEPOSIT)); // 0.65 for 3 days
        const tx = await cs.requestBooking(listingId, start, end, {
            from: renter,
            value: escrow,
        });
        const bookingId = tx.logs
            .find((l) => l.event === "BookingRequested")
            .args.bookingId.toNumber();
        return { bookingId, rentalCost, escrow, start, end };
    }

    async function approve(cs, bookingId) {
        await cs.approveBooking(bookingId, { from: listingOwner });
    }

    async function activate(cs, bookingId) {
        await cs.confirmPickup(bookingId, "ipfs://renter_pickup", {
            from: renter,
        });
        await cs.confirmPickup(bookingId, "ipfs://owner_pickup", {
            from: listingOwner,
        });
    }

    async function completeNoDispute(cs, bookingId) {
        await cs.confirmReturn(bookingId, "ipfs://renter_return", {
            from: renter,
        });
        await cs.confirmReturn(bookingId, "ipfs://owner_return", {
            from: listingOwner,
        });
    }

    describe("Happy path", () => {
        it("settles fees and balances, then withdraw works", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);

            const { bookingId, rentalCost } = await request(cs);
            await approve(cs, bookingId);
            await activate(cs, bookingId);

            const ownerBefore = await cs.balances(listingOwner);
            const renterBefore = await cs.balances(renter);
            const platformBefore = await cs.balances(platform);
            assert(
                ownerBefore.eq(bn(0)) &&
                    renterBefore.eq(bn(0)) &&
                    platformBefore.eq(bn(0))
            );

            await completeNoDispute(cs, bookingId);

            const fee = rentalCost.mul(bn(FEE_BPS)).div(bn(10000)); // 0.003
            const ownerNet = rentalCost.sub(fee); // 0.147
            const renterBack = bn(DEPOSIT); // 0.5

            assert((await cs.balances(listingOwner)).eq(ownerNet));
            assert((await cs.balances(renter)).eq(renterBack));
            assert((await cs.balances(platform)).eq(fee));

            // withdraw
            const loBal0 = bn(await web3.eth.getBalance(listingOwner));
            const rBal0 = bn(await web3.eth.getBalance(renter));
            const pBal0 = bn(await web3.eth.getBalance(platform));

            const w1 = await cs.withdraw({ from: listingOwner });
            const gas1 = bn(w1.receipt.gasUsed).mul(
                bn((await web3.eth.getTransaction(w1.tx)).gasPrice)
            );
            const w2 = await cs.withdraw({ from: renter });
            const gas2 = bn(w2.receipt.gasUsed).mul(
                bn((await web3.eth.getTransaction(w2.tx)).gasPrice)
            );
            const w3 = await cs.withdraw({ from: platform });
            const gas3 = bn(w3.receipt.gasUsed).mul(
                bn((await web3.eth.getTransaction(w3.tx)).gasPrice)
            );

            const loBal1 = bn(await web3.eth.getBalance(listingOwner));
            const rBal1 = bn(await web3.eth.getBalance(renter));
            const pBal1 = bn(await web3.eth.getBalance(platform));

            assert(loBal1.eq(loBal0.add(ownerNet).sub(gas1)));
            assert(rBal1.eq(rBal0.add(renterBack).sub(gas2)));
            assert(pBal1.eq(pBal0.add(fee).sub(gas3)));

            assert((await cs.balances(listingOwner)).isZero());
            assert((await cs.balances(renter)).isZero());
            assert((await cs.balances(platform)).isZero());
        });
    });

    describe("Owner rejects & renter cancels", () => {
        it("reject from Requested pushes full refund", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId, escrow } = await request(cs);

            const rBal0 = bn(await web3.eth.getBalance(renter));
            const tx = await cs.rejectBooking(bookingId, {
                from: listingOwner,
            });
            const gas = bn(tx.receipt.gasUsed).mul(
                bn((await web3.eth.getTransaction(tx.tx)).gasPrice)
            );
            const rBal1 = bn(await web3.eth.getBalance(renter));

            assert(rBal1.eq(rBal0.add(escrow))); // push refund not via withdraw
        });

        it("cancel from Requested and Approved refunds renter", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);

            // Requested
            let x = await request(cs);
            let r0 = bn(await web3.eth.getBalance(renter));
            const tx1 = await cs.cancelBeforeActive(x.bookingId, {
                from: renter,
            });
            const gas1 = bn(tx1.receipt.gasUsed).mul(
                bn((await web3.eth.getTransaction(tx1.tx)).gasPrice)
            );
            let r1 = bn(await web3.eth.getBalance(renter));
            // Balance delta = refund - gas cost
            assert(r1.eq(r0.add(x.escrow).sub(gas1)));

            // Approved
            x = await request(cs);
            await approve(cs, x.bookingId);
            r0 = bn(await web3.eth.getBalance(renter));
            const tx2 = await cs.cancelBeforeActive(x.bookingId, {
                from: renter,
            });
            const gas2 = bn(tx2.receipt.gasUsed).mul(
                bn((await web3.eth.getTransaction(tx2.tx)).gasPrice)
            );
            r1 = bn(await web3.eth.getBalance(renter));
            assert(r1.eq(r0.add(x.escrow).sub(gas2)));
        });

        it("cancel reverts after Active", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);
            await approve(cs, bookingId);
            await activate(cs, bookingId);
            await truffleAssert.reverts(
                cs.cancelBeforeActive(bookingId, { from: renter }),
                "cannot cancel"
            );
        });
    });

    describe("Disputes", () => {
        it("arbitrator split credited; fee on ownerPayout only", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);
            await approve(cs, bookingId);
            await activate(cs, bookingId);

            await cs.openDispute(bookingId, { from: renter });

            const ownerPayout = web3.utils.toWei("0.25", "ether");
            const renterPayout = web3.utils.toWei("0.40", "ether");
            await cs.resolveDispute(bookingId, ownerPayout, renterPayout, {
                from: arbitrator,
            });

            const fee = bn(ownerPayout).mul(bn(FEE_BPS)).div(bn(10000)); // 0.005
            assert(
                (await cs.balances(listingOwner)).eq(bn(ownerPayout).sub(fee))
            );
            assert((await cs.balances(renter)).eq(bn(renterPayout)));
            assert((await cs.balances(platform)).eq(fee));
        });

        it("reverts if split != escrow", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);
            await approve(cs, bookingId);
            await activate(cs, bookingId);
            await cs.openDispute(bookingId, { from: renter });

            await truffleAssert.reverts(
                cs.resolveDispute(
                    bookingId,
                    web3.utils.toWei("0.30", "ether"),
                    web3.utils.toWei("0.30", "ether"),
                    { from: arbitrator }
                ),
                "must split escrow"
            );
        });

        it("resolveDispute only works on disputed bookings", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);
            await approve(cs, bookingId);
            await activate(cs, bookingId);

            // Try to resolve non-disputed booking
            await truffleAssert.reverts(
                cs.resolveDispute(
                    bookingId,
                    web3.utils.toWei("0.25", "ether"),
                    web3.utils.toWei("0.40", "ether"),
                    { from: arbitrator }
                ),
                "not disputed"
            );
        });

        it("openDispute only from valid statuses", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);

            // Cannot open dispute from Requested
            await truffleAssert.reverts(
                cs.openDispute(bookingId, { from: renter }),
                "bad status"
            );

            await approve(cs, bookingId);
            await activate(cs, bookingId);
            await completeNoDispute(cs, bookingId);

            // Cannot open dispute from Completed
            await truffleAssert.reverts(
                cs.openDispute(bookingId, { from: renter }),
                "bad status"
            );

            // Test rejected booking
            const { bookingId: bookingId2 } = await request(cs);
            await cs.rejectBooking(bookingId2, { from: listingOwner });
            await truffleAssert.reverts(
                cs.openDispute(bookingId2, { from: renter }),
                "bad status"
            );

            // Test cancelled booking
            const { bookingId: bookingId3 } = await request(cs);
            await cs.cancelBeforeActive(bookingId3, { from: renter });
            await truffleAssert.reverts(
                cs.openDispute(bookingId3, { from: renter }),
                "bad status"
            );

            // Test already disputed booking
            const { bookingId: bookingId4 } = await request(cs);
            await approve(cs, bookingId4);
            await activate(cs, bookingId4);
            await cs.openDispute(bookingId4, { from: renter });
            await truffleAssert.reverts(
                cs.openDispute(bookingId4, { from: renter }),
                "bad status"
            );
        });
    });

    describe("Ratings", () => {
        it("only after completion; one-time each side", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);
            await approve(cs, bookingId);
            await activate(cs, bookingId);
            await completeNoDispute(cs, bookingId);

            await cs.rateOwner(bookingId, 5, { from: renter });
            await cs.rateRenter(bookingId, 4, { from: listingOwner });

            let ro = await cs.rateOwnerScore(bookingId);
            let rr = await cs.rateRenterScore(bookingId);
            assert(ro.set && rr.set);
            assert.equal(ro.value.toNumber(), 5);
            assert.equal(rr.value.toNumber(), 4);

            await truffleAssert.reverts(
                cs.rateOwner(bookingId, 5, { from: renter }),
                "rated"
            );
        });

        it("only renter can rate owner; only owner can rate renter", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);
            await approve(cs, bookingId);
            await activate(cs, bookingId);
            await completeNoDispute(cs, bookingId);

            // Owner cannot rate themselves
            await truffleAssert.reverts(
                cs.rateOwner(bookingId, 5, { from: listingOwner }),
                "only renter"
            );

            // Renter cannot rate themselves
            await truffleAssert.reverts(
                cs.rateRenter(bookingId, 5, { from: renter }),
                "only car owner"
            );
        });
    });

    describe("Access control & validation", () => {
        it("only listing owner can approve/reject", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);

            await truffleAssert.reverts(
                cs.approveBooking(bookingId, { from: renter }),
                "not car owner"
            );
            await truffleAssert.reverts(
                cs.rejectBooking(bookingId, { from: renter }),
                "not car owner"
            );
        });

        it("insurance must be valid before request", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await cs.createListing(
                DAILY_PRICE,
                DEPOSIT,
                "uri",
                "Honda",
                "Civic",
                2021,
                "Los Angeles, CA",
                {
                    from: listingOwner,
                }
            ); // id 0
            await cs.verifyInsurance(0, false, { from: insuranceVerifier });

            const { start, end } = await getStartEnd(3);
            const wrongEscrow = web3.utils.toWei("0.65", "ether");
            await truffleAssert.reverts(
                cs.requestBooking(0, start, end, {
                    from: renter,
                    value: wrongEscrow,
                }),
                "insurance not valid"
            );
        });

        it("only insurance verifier can verify insurance", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await cs.createListing(
                DAILY_PRICE,
                DEPOSIT,
                "uri",
                "Ford",
                "Focus",
                2022,
                "Chicago, IL",
                {
                    from: listingOwner,
                }
            );

            await truffleAssert.reverts(
                cs.verifyInsurance(0, true, { from: renter }),
                "not insurance"
            );
            await truffleAssert.reverts(
                cs.verifyInsurance(0, true, { from: listingOwner }),
                "not insurance"
            );
            await truffleAssert.reverts(
                cs.verifyInsurance(0, true, { from: stranger }),
                "not insurance"
            );
        });

        it("insurance verifier cannot create listings", async () => {
            const cs = await deployFresh();
            await cs.register({ from: insuranceVerifier });
            await truffleAssert.reverts(
                cs.createListing(
                    DAILY_PRICE,
                    DEPOSIT,
                    "uri",
                    "Tesla",
                    "Model S",
                    2023,
                    "San Francisco, CA",
                    {
                        from: insuranceVerifier,
                    }
                ),
                "insurance verifier cannot create listings"
            );
        });

        it("arbitrator cannot create listings", async () => {
            const cs = await deployFresh();
            await cs.register({ from: arbitrator });
            await truffleAssert.reverts(
                cs.createListing(
                    DAILY_PRICE,
                    DEPOSIT,
                    "uri",
                    "BMW",
                    "X5",
                    2024,
                    "Miami, FL",
                    {
                        from: arbitrator,
                    }
                ),
                "arbitrator cannot create listings"
            );
        });

        it("insurance verifier cannot book cars", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await cs.register({ from: insuranceVerifier });
            await createAndVerifyListing(cs);
            const { start, end } = await getStartEnd(3);
            const escrow = bn(DAILY_PRICE).mul(bn(3)).add(bn(DEPOSIT));
            await truffleAssert.reverts(
                cs.requestBooking(0, start, end, {
                    from: insuranceVerifier,
                    value: escrow,
                }),
                "insurance verifier cannot book cars"
            );
        });

        it("arbitrator cannot book cars", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await cs.register({ from: arbitrator });
            await createAndVerifyListing(cs);
            const { start, end } = await getStartEnd(3);
            const escrow = bn(DAILY_PRICE).mul(bn(3)).add(bn(DEPOSIT));
            await truffleAssert.reverts(
                cs.requestBooking(0, start, end, {
                    from: arbitrator,
                    value: escrow,
                }),
                "arbitrator cannot book cars"
            );
        });

        it("owner cannot book own listing", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { start, end } = await getStartEnd(3);
            const escrow = bn(DAILY_PRICE).mul(bn(3)).add(bn(DEPOSIT));
            await truffleAssert.reverts(
                cs.requestBooking(0, start, end, {
                    from: listingOwner,
                    value: escrow,
                }),
                "cannot book own listing"
            );
        });

        it("unregistered user cannot request booking", async () => {
            const cs = await deployFresh();
            await cs.register({ from: listingOwner });
            await createAndVerifyListing(cs);

            const { start, end } = await getStartEnd(3);
            await truffleAssert.reverts(
                cs.requestBooking(0, start, end, {
                    from: renter, // not registered
                    value: web3.utils.toWei("0.65", "ether"),
                }),
                "register first"
            );
        });

        it("escrow must match exactly", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { start, end } = await getStartEnd(3);
            const underpay = web3.utils.toWei("0.649", "ether");
            await truffleAssert.reverts(
                cs.requestBooking(0, start, end, {
                    from: renter,
                    value: underpay,
                }),
                "incorrect escrow"
            );
        });

        it("daysBetween floors and requires end > start", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);

            const t = await latest();
            const start = t + 86400;

            // equal end
            await truffleAssert.reverts(
                cs.requestBooking(0, start, start, {
                    from: renter,
                    value: web3.utils.toWei("0.65", "ether"),
                }),
                "end>start"
            );

            // 1 day + 12h floors to 1 day → escrow should be 0.55
            const end2 = start + 86400 + 43200;
            await truffleAssert.reverts(
                cs.requestBooking(0, start, end2, {
                    from: renter,
                    value: web3.utils.toWei("0.65", "ether"),
                }),
                "incorrect escrow"
            );

            await cs.requestBooking(0, start, end2, {
                from: renter,
                value: web3.utils.toWei("0.55", "ether"),
            });
        });

        it("withdraw reverts on zero", async () => {
            const cs = await deployFresh();
            await truffleAssert.reverts(
                cs.withdraw({ from: stranger }),
                "nothing to withdraw"
            );
        });

        it("set roles and fee bounds", async () => {
            const cs = await deployFresh();
            await cs.setRoles(
                "0x000000000000000000000000000000000000dEaD",
                "0x000000000000000000000000000000000000bEEF",
                { from: platform }
            );
            await cs.setPlatformFee(1000, { from: platform });
            await truffleAssert.reverts(
                cs.setPlatformFee(1001, { from: platform }),
                "fee too high"
            );
        });

        it("pickup requires Approved; return requires Active/ReturnPending", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);

            await truffleAssert.reverts(
                cs.confirmPickup(bookingId, "x", { from: renter }),
                "not approved"
            );

            await approve(cs, bookingId);
            await truffleAssert.reverts(
                cs.confirmReturn(bookingId, "x", { from: renter }),
                "not active"
            );
        });

        it("pickup confirmation from invalid statuses fails", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);

            // From Requested - should fail
            await truffleAssert.reverts(
                cs.confirmPickup(bookingId, "x", { from: renter }),
                "not approved"
            );

            await approve(cs, bookingId);
            await activate(cs, bookingId);
            // From Active - should work (already tested), but after completion should fail
            await completeNoDispute(cs, bookingId);

            // From Completed - should fail
            await truffleAssert.reverts(
                cs.confirmPickup(bookingId, "x", { from: renter }),
                "not approved"
            );
        });

        it("return confirmation from invalid statuses fails", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);

            // From Requested - should fail
            await truffleAssert.reverts(
                cs.confirmReturn(bookingId, "x", { from: renter }),
                "not active"
            );

            await approve(cs, bookingId);
            // From Approved - should fail
            await truffleAssert.reverts(
                cs.confirmReturn(bookingId, "x", { from: renter }),
                "not active"
            );

            await activate(cs, bookingId);
            await completeNoDispute(cs, bookingId);
            // From Completed - should fail
            await truffleAssert.reverts(
                cs.confirmReturn(bookingId, "x", { from: renter }),
                "not active"
            );

            // Test rejected booking
            const { bookingId: bookingId2 } = await request(cs);
            await cs.rejectBooking(bookingId2, { from: listingOwner });
            await truffleAssert.reverts(
                cs.confirmReturn(bookingId2, "x", { from: renter }),
                "not active"
            );
        });

        it("only arbitrator can resolve disputes", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);
            await approve(cs, bookingId);
            await activate(cs, bookingId);
            await cs.openDispute(bookingId, { from: renter });
            await truffleAssert.reverts(
                cs.resolveDispute(
                    bookingId,
                    web3.utils.toWei("0.25", "ether"),
                    web3.utils.toWei("0.40", "ether"),
                    { from: renter }
                ),
                "not arbitrator"
            );
        });

        // Note: Arbitrator cannot create listings or book cars, so the previous
        // conflict-of-interest tests are no longer applicable. The restrictions
        // are now enforced at the createListing and requestBooking level.

        it("non-parties cannot confirm pickup/return", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);
            await approve(cs, bookingId);
            await truffleAssert.reverts(
                cs.confirmPickup(bookingId, "x", { from: stranger }),
                "not party"
            );
            await activate(cs, bookingId);
            await truffleAssert.reverts(
                cs.confirmReturn(bookingId, "y", { from: stranger }),
                "not party"
            );
        });

        it("only owner can set roles/fees", async () => {
            const cs = await deployFresh();
            await truffleAssert.reverts(
                cs.setRoles(accounts[8], accounts[9], { from: renter }),
                "not contract owner"
            );
            await truffleAssert.reverts(
                cs.setPlatformFee(500, { from: renter }),
                "not contract owner"
            );
        });

        it("only listing owner can edit/toggle listing", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            await truffleAssert.reverts(
                cs.editListing(
                    0,
                    DAILY_PRICE,
                    DEPOSIT,
                    "x",
                    "Chevrolet",
                    "Malibu",
                    2023,
                    "Phoenix, AZ",
                    {
                        from: renter,
                    }
                ),
                "not car owner"
            );
            await truffleAssert.reverts(
                cs.setListingActive(0, false, { from: renter }),
                "not car owner"
            );
        });

        it("cannot register twice", async () => {
            const cs = await deployFresh();
            await cs.register({ from: renter });
            await truffleAssert.reverts(
                cs.register({ from: renter }),
                "already"
            );
        });

        it("cannot create listing with zero daily price", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await truffleAssert.reverts(
                cs.createListing(
                    0,
                    DEPOSIT,
                    "uri",
                    "Tesla",
                    "Model 3",
                    2023,
                    "San Francisco, CA",
                    { from: listingOwner }
                ),
                "bad price"
            );
        });

        it("cannot edit listing with zero daily price", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            await truffleAssert.reverts(
                cs.editListing(
                    0,
                    0,
                    DEPOSIT,
                    "uri",
                    "BMW",
                    "X5",
                    2024,
                    "Miami, FL",
                    { from: listingOwner }
                ),
                "bad price"
            );
        });
    });

    // ===== Additional coverage =====
    describe("Listings admin & activity", () => {
        it("owner can toggle listing active; inactive blocks request", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            await cs.setListingActive(0, false, { from: listingOwner });
            const { start, end } = await getStartEnd(3);
            await truffleAssert.reverts(
                cs.requestBooking(0, start, end, {
                    from: renter,
                    value: web3.utils.toWei("0.65", "ether"),
                }),
                "listing inactive"
            );
            await cs.setListingActive(0, true, { from: listingOwner });
            await cs.requestBooking(0, start, end, {
                from: renter,
                value: web3.utils.toWei("0.65", "ether"),
            });
        });

        it("editListing updates escrow math for new requests", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            // change daily price to 0.06 ether
            await cs.editListing(
                0,
                web3.utils.toWei("0.06", "ether"),
                DEPOSIT,
                "uri2",
                "Mercedes",
                "C-Class",
                2023,
                "Seattle, WA",
                { from: listingOwner }
            );
            const { start, end } = await getStartEnd(3);
            // 3 * 0.06 + 0.5 = 0.68
            await truffleAssert.reverts(
                cs.requestBooking(0, start, end, {
                    from: renter,
                    value: web3.utils.toWei("0.65", "ether"),
                }),
                "incorrect escrow"
            );
            await cs.requestBooking(0, start, end, {
                from: renter,
                value: web3.utils.toWei("0.68", "ether"),
            });
        });
    });

    describe("Status gating & ratings bounds", () => {
        it("approve only from Requested; reject only from Requested", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);
            await approve(cs, bookingId);
            await truffleAssert.reverts(
                cs.approveBooking(bookingId, { from: listingOwner }),
                "bad status"
            );
            await truffleAssert.reverts(
                cs.rejectBooking(bookingId, { from: listingOwner }),
                "bad status"
            );
        });

        it("rating bounds enforce 1..5 and Completed status", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            const { bookingId } = await request(cs);
            await approve(cs, bookingId);
            await activate(cs, bookingId);
            await completeNoDispute(cs, bookingId);
            await truffleAssert.reverts(
                cs.rateOwner(bookingId, 0, { from: renter }),
                "1..5"
            );
            await truffleAssert.reverts(
                cs.rateRenter(bookingId, 6, { from: listingOwner }),
                "1..5"
            );
        });
    });

    describe("Dispute entry points", () => {
        it("can open dispute from Approved and ReturnPending", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);
            // Approved
            let x = await request(cs);
            await approve(cs, x.bookingId);
            await cs.openDispute(x.bookingId, { from: renter });

            // ReturnPending
            x = await request(cs);
            await approve(cs, x.bookingId);
            await activate(cs, x.bookingId);
            await cs.confirmReturn(x.bookingId, "uri", { from: renter }); // sets ReturnPending
            await cs.openDispute(x.bookingId, { from: listingOwner });
        });
    });

    describe("Multiple listings and bookings", () => {
        it("owner can create multiple listings", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);

            await cs.createListing(
                DAILY_PRICE,
                DEPOSIT,
                "uri1",
                "Audi",
                "A4",
                2022,
                "Boston, MA",
                {
                    from: listingOwner,
                }
            );
            await cs.createListing(
                web3.utils.toWei("0.06", "ether"),
                DEPOSIT,
                "uri2",
                "Volkswagen",
                "Jetta",
                2021,
                "Portland, OR",
                { from: listingOwner }
            );
            await cs.createListing(
                DAILY_PRICE,
                DEPOSIT,
                "uri3",
                "Nissan",
                "Altima",
                2020,
                "Denver, CO",
                {
                    from: listingOwner,
                }
            );

            const listing0 = await cs.listings(0);
            const listing1 = await cs.listings(1);
            const listing2 = await cs.listings(2);

            assert.equal(listing0.carOwner, listingOwner);
            assert.equal(listing1.carOwner, listingOwner);
            assert.equal(listing2.carOwner, listingOwner);
            assert(listing0.dailyPrice.eq(bn(DAILY_PRICE)));
            assert(
                listing1.dailyPrice.eq(bn(web3.utils.toWei("0.06", "ether")))
            );
        });

        it("multiple bookings can be created for same listing", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);

            const { bookingId: bookingId1 } = await request(cs, 0, 2);
            const { bookingId: bookingId2 } = await request(cs, 0, 3);
            const { bookingId: bookingId3 } = await request(cs, 0, 1);

            const booking1 = await cs.bookings(bookingId1);
            const booking2 = await cs.bookings(bookingId2);
            const booking3 = await cs.bookings(bookingId3);

            assert.equal(booking1.listingId.toNumber(), 0);
            assert.equal(booking2.listingId.toNumber(), 0);
            assert.equal(booking3.listingId.toNumber(), 0);
            assert.equal(booking1.renter, renter);
            assert.equal(booking2.renter, renter);
            assert.equal(booking3.renter, renter);
        });

        it("listing edits do not affect existing bookings", async () => {
            const cs = await deployFresh();
            await registerBoth(cs);
            await createAndVerifyListing(cs);

            const { bookingId, rentalCost } = await request(cs);
            const bookingBefore = await cs.bookings(bookingId);

            // Edit listing after booking is created
            await cs.editListing(
                0,
                web3.utils.toWei("0.10", "ether"), // double the price
                web3.utils.toWei("1.0", "ether"), // double the deposit
                "new_uri",
                "Lexus",
                "RX",
                2024,
                "Austin, TX",
                { from: listingOwner }
            );

            const bookingAfter = await cs.bookings(bookingId);
            // Booking should still have original values
            assert(bookingAfter.rentalCost.eq(bookingBefore.rentalCost));
            assert(bookingAfter.deposit.eq(bookingBefore.deposit));
            assert(bookingAfter.rentalCost.eq(rentalCost));
            assert(bookingAfter.deposit.eq(bookingBefore.deposit));
        });
    });
});
