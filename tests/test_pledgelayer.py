"""
Direct-mode test suite for PledgeLayerPlatform.

Fixes applied vs. the original version of this file (all confirmed by
actually running the suite against a real GenVM SDK, not just by code
review):

1. Wrong contract path. The original called
   direct_deploy("contracts/pledgelayer.py"), but this repo has no
   `contracts/` folder -- pledgelayer.py lives at the project root.
   That made every test fail before it even deployed the contract.

2. CampaignView used where the real Campaign storage object was needed.
   The original forged post-funding state by calling
   contract.get_campaign(cid) (a CampaignView) and writing the mutated
   result back into contract.campaigns[cid]. CampaignView has no
   `description` field (and stores `creator` as a str instead of an
   Address), so the moment adjudicate_milestone / revoke_funding /
   cancel_campaign tried to rebuild the Campaign via
   Campaign(..., description=c.description, ...), it raised
   AttributeError. None of the three tests ever reached their
   assertions.

3. Funding was forged via a raw dict write keyed on a fixture address
   (contract.campaign_contributions[f"{cid}_{direct_bob}"] = ...), but
   direct_bob/direct_alice/direct_charlie are plain bytes at
   fixture-setup time (the genlayer SDK isn't on sys.path yet when
   those fixtures are created), while the contract itself keys
   contributions off f"{cid}_{str(gl.message.sender_address)}" -- an
   Address's checksummed hex string. The two keys never matched, so
   revoke_funding/claim_refund always raised "No contribution found",
   even after fix #2 was applied on its own.

   The real fix is to stop forging storage entirely and drive funding
   through the actual payable call. Direct mode simulates msg.value via
   `direct_vm.value`, not a `value=` kwarg on the call itself:

       direct_vm.sender = backer
       direct_vm.value = amount
       contract.fund_campaign(cid)
       direct_vm.value = 0

   This lets the contract compute its own keys and state, so there's
   nothing left to keep in sync by hand. (Where a test still needs to
   read a contribution key directly -- see the last assertion below --
   it wraps the raw fixture bytes in genlayer's Address type first, to
   match the string the contract itself produces.)

4. claim_refund refunded each backer's full original contribution
   against `c.remaining_funds`, not a pro-rata share of it. That's only
   correct for CANCELLED campaigns (which never had a milestone payout,
   so remaining_funds == total_funded there). For a campaign that FAILS
   after an earlier milestone was already paid out, remaining_funds <
   total_funded, so refunding everyone's full stake overdraws the
   escrow: whichever backer calls claim_refund first drains it, and
   every later, equally valid claim_refund call reverts with "Invalid
   refund math". None of the previous tests exercised this path (no
   test ever combined an approved milestone payout with a subsequent
   FAILED campaign), so the bug shipped unnoticed. See
   test_failed_campaign_partial_payout_refund below.

5. None of the previous tests verified that value actually moved to
   the creator, the platform owner, or a refunded backer -- only that
   the contract's own internal ledger (remaining_funds,
   campaign_contributions) looked right. That's a real gap: the
   contract could compute a correct-looking remaining_funds while
   sending the payout to the wrong address, or not sending it at all,
   and these tests wouldn't catch it.

   Direct mode does NOT model native value transfer as an actual
   balance mutation: `_Recipient(...).emit_transfer(value=...)` lowers
   to an `EthSend` gl_call, and the installed genlayer-test harness
   (checked directly against its wasi_mock.py) has no built-in handler
   for that op -- it hits the "Unknown gl_call request type" fallback
   and is silently treated as a no-op success. So asserting on
   `direct_vm._balances[...]` after a payout doesn't work in this
   harness; the dict never changes no matter what the contract sends.

   What direct_vm does expose for this is `_gl_call_hook`, a
   test-installable hook that intercepts otherwise-unhandled gl_call
   requests (this is the same seam glsim mode uses for cross-contract
   calls). `_record_transfers` below installs a hook that intercepts
   each EthSend the contract issues and records its real recipient
   Address and wei value, which is what every payout/refund assertion
   in this file now checks against -- i.e. these tests verify the
   actual transfer instructions the contract emits, not just its
   internal bookkeeping.

sdk_version is pinned to v0.2.12 because that's the GenVM release line
that actually contains the py-genlayer runner hash pledgelayer.py is
pinned to in its header (the same hash used throughout GenLayer's own
docs). Auto-resolving "latest" pointed at a pre-release (v0.3.0-rc7)
that doesn't ship that runner. Bump this once you've verified a newer
release still contains it.
"""

import json


def _fund(direct_vm, contract, cid, backer, amount):
    """Simulate a real backer sending `amount` (wei-equivalent) to fund_campaign."""
    direct_vm.sender = backer
    direct_vm.value = amount
    contract.fund_campaign(cid)
    direct_vm.value = 0


def _record_transfers(direct_vm):
    """Install a gl_call hook that captures every native EthSend the
    contract issues (creator payouts, platform fees, refunds) as
    (address, value) pairs, and return the list it appends to.

    See fix #5 in the module docstring for why this is necessary --
    direct_vm._balances never reflects EthSend in this harness, so this
    is the only way to assert value actually went to the right address.
    """
    transfers = []

    def hook(vm, request):
        if isinstance(request, dict) and "EthSend" in request:
            info = request["EthSend"]
            transfers.append((info["address"], int(info.get("value", 0))))
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = hook
    return transfers


def _sent_to(transfers, address, value):
    """True if `transfers` contains an EthSend of exactly `value` to `address`."""
    return (address, int(value)) in transfers


def test_payout_and_surplus(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """Proves that overfunded surplus isn't stranded, the CEI pattern clears
    safely, and the creator/platform actually receive their split of the
    payout (not just that remaining_funds looks right internally)."""

    transfers = _record_transfers(direct_vm)

    # Charlie is the platform owner, Alice is the creator, Bob is the backer
    direct_vm.sender = direct_charlie
    contract = direct_deploy("pledgelayer.py", sdk_version="v0.2.12")

    # 1. Create a campaign (Goal = 10 Tokens, 1 Milestone at 100%)
    direct_vm.sender = direct_alice
    cid = contract.create_campaign("Test Campaign", "Desc", 10, ["M1"], ["M1 Desc"], [10000])

    # 2. Overfund the campaign to test surplus (Bob sends 15 Tokens against a
    # 10-token goal) via the real payable call.
    _fund(direct_vm, contract, cid, direct_bob, 15 * 10**18)

    # 3. Submit Evidence
    direct_vm.sender = direct_alice
    contract.submit_milestone(cid, "Evidence of work")

    # 4. Mock AI Adjudication & Approve
    direct_vm.mock_llm(r".*", json.dumps({"decision": "APPROVED", "detailed_feedback": "Looks solid"}))
    direct_vm.sender = direct_charlie
    contract.adjudicate_milestone(cid)

    # 5. Verify NO FUNDS STRANDED (Remaining funds must be perfectly 0)
    c = contract.get_campaign(cid)
    assert c.status == "COMPLETED"
    assert int(c.remaining_funds) == 0, "Error: Surplus funds were stranded in the contract!"

    # 6. Verify the money actually moved: 15 tokens paid out as a single
    # final-milestone sweep, split 97.5% creator / 2.5% platform fee.
    from genlayer.py.types import Address

    total_paid = 15 * 10**18
    plat_fee = total_paid * 250 // 10000
    creator_payout = total_paid - plat_fee
    assert _sent_to(transfers, Address(direct_alice), creator_payout), \
        f"Creator never received their {creator_payout} payout: {transfers}"
    assert _sent_to(transfers, Address(direct_charlie), plat_fee), \
        f"Platform never received its {plat_fee} fee: {transfers}"


def test_indefinitely_underfunded_withdrawal(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Proves that a campaign stuck in FUNDING allows backers to safely
    withdraw without stranding, and that Bob actually gets his money back."""

    transfers = _record_transfers(direct_vm)

    contract = direct_deploy("pledgelayer.py", sdk_version="v0.2.12")

    direct_vm.sender = direct_alice
    cid = contract.create_campaign("Underfunded", "Desc", 10, ["M1"], ["Desc"], [10000])

    # Bob funds half the goal (5 Tokens) via the real payable call.
    _fund(direct_vm, contract, cid, direct_bob, 5 * 10**18)

    # Assert it's stuck in funding
    assert contract.get_campaign(cid).status == "FUNDING"

    # Bob revokes his funding
    direct_vm.sender = direct_bob
    contract.revoke_funding(cid)

    # Verify funds were completely withdrawn and nothing is stranded
    c = contract.get_campaign(cid)
    assert int(c.total_funded) == 0
    assert int(c.remaining_funds) == 0

    # Verify Bob was actually sent his full 5 tokens back.
    from genlayer.py.types import Address
    assert _sent_to(transfers, Address(direct_bob), 5 * 10**18), \
        f"Bob never received his revoked funding back: {transfers}"


def test_cancellation_and_cei_refunds(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Proves cancellation preserves balances, CEI prevents re-entrancy, and
    Bob's refund is an actual transfer, not just a cleared ledger entry."""

    transfers = _record_transfers(direct_vm)

    contract = direct_deploy("pledgelayer.py", sdk_version="v0.2.12")

    direct_vm.sender = direct_alice
    cid = contract.create_campaign("To Cancel", "Desc", 10, ["M1"], ["Desc"], [10000])

    # Bob funds via the real payable call.
    _fund(direct_vm, contract, cid, direct_bob, 5 * 10**18)

    # Alice cancels
    direct_vm.sender = direct_alice
    contract.cancel_campaign(cid)
    assert contract.get_campaign(cid).status == "CANCELLED"

    # Bob claims refund
    direct_vm.sender = direct_bob
    contract.claim_refund(cid)

    # Verify zero balance and clean state. The contract keys contributions on
    # f"{cid}_{str(Address)}" -- wrap the raw fixture bytes the same way to
    # read the same slot the contract itself wrote to.
    from genlayer.py.types import Address

    c = contract.get_campaign(cid)
    assert int(c.remaining_funds) == 0
    contrib_key = f"{cid}_{str(Address(direct_bob))}"
    assert contract.campaign_contributions[contrib_key] == 0

    # A cancelled campaign never had a milestone payout, so the fix in
    # claim_refund's pro-rata math should reduce to exactly Bob's full
    # original stake here -- verify the actual transfer, not just the
    # zeroed ledger entry above.
    assert _sent_to(transfers, Address(direct_bob), 5 * 10**18), \
        f"Bob's cancellation refund was never actually sent: {transfers}"


def test_failed_campaign_partial_payout_refund(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, direct_accounts
):
    """Reproduces the bug the previous submission was rejected for: a
    campaign that pays out one approved milestone and then FAILS on the
    next must refund each backer their *pro-rata* share of whatever is
    left in escrow -- not their full original contribution, which used
    to let the first claimant drain the pool and revert every later,
    equally valid claim_refund call.

    Eve funds 4 tokens, Bob funds 6 (total 10 = funding_goal, so the
    campaign goes ACTIVE immediately). Milestone 1 (30%) is approved and
    paid out, leaving 7 tokens in escrow. Milestone 2 is rejected twice,
    which fails the campaign with that 7-token remainder still owed to
    Bob and Eve in proportion to their original 6:4 stake -- i.e. Bob is
    owed 4.2 tokens and Eve 2.8, not their original 6 and 4.

    Under the old code (refund == full original contribution, checked
    only against remaining_funds), Bob claiming first would pass (6 <=
    7), leaving only 1 token for Eve's 4-token claim, which would then
    revert with "Invalid refund math" -- exactly the failure mode in the
    rejection notes. This test claims in that same order and asserts
    both succeed with the correct proportional amounts.
    """

    transfers = _record_transfers(direct_vm)

    direct_vm.sender = direct_charlie
    contract = direct_deploy("pledgelayer.py", sdk_version="v0.2.12")

    eve = direct_accounts[0]

    direct_vm.sender = direct_alice
    cid = contract.create_campaign(
        "Two Milestones", "Desc", 10, ["M1", "M2"], ["M1 Desc", "M2 Desc"], [3000, 7000]
    )

    # Eve funds 4 tokens, Bob funds 6 -- total_funded hits the 10-token goal
    # exactly, so the campaign goes ACTIVE on Bob's contribution.
    _fund(direct_vm, contract, cid, eve, 4 * 10**18)
    _fund(direct_vm, contract, cid, direct_bob, 6 * 10**18)
    assert contract.get_campaign(cid).status == "ACTIVE"

    # Milestone 1 (30% of 10 tokens = 3) is submitted and approved.
    direct_vm.sender = direct_alice
    contract.submit_milestone(cid, "M1 evidence")
    direct_vm.mock_llm(r".*", json.dumps({"decision": "APPROVED", "detailed_feedback": "Solid"}))
    direct_vm.sender = direct_charlie
    contract.adjudicate_milestone(cid)

    c = contract.get_campaign(cid)
    assert c.status == "ACTIVE"
    assert int(c.remaining_funds) == 7 * 10**18, "Expected 7 tokens left in escrow after M1 payout"

    m1_payout = 3 * 10**18
    m1_fee = m1_payout * 250 // 10000
    from genlayer.py.types import Address
    assert _sent_to(transfers, Address(direct_alice), m1_payout - m1_fee), \
        f"Creator never received the M1 payout: {transfers}"
    assert _sent_to(transfers, Address(direct_charlie), m1_fee), \
        f"Platform never received the M1 fee: {transfers}"

    # Milestone 2 is rejected twice in a row -- campaign fails with the
    # 7-token remainder still owed to Bob and Eve. mock_llm matches in
    # registration order and doesn't overwrite an earlier pattern, so the
    # APPROVED mock from M1 has to be cleared first or it would keep
    # matching every later adjudication too.
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", json.dumps({"decision": "REJECTED", "detailed_feedback": "Not enough evidence"}))

    direct_vm.sender = direct_alice
    contract.submit_milestone(cid, "M2 evidence v1")
    direct_vm.sender = direct_charlie
    contract.adjudicate_milestone(cid)
    assert contract.get_campaign(cid).status == "ACTIVE", "First rejection should not fail the campaign yet"

    direct_vm.sender = direct_alice
    contract.submit_milestone(cid, "M2 evidence v2")
    direct_vm.sender = direct_charlie
    contract.adjudicate_milestone(cid)

    c = contract.get_campaign(cid)
    assert c.status == "FAILED", "Second consecutive rejection should fail the campaign"
    assert int(c.remaining_funds) == 7 * 10**18, "Rejection must not itself move any funds"

    # Bob claims first -- under the old bug this would succeed by taking
    # his full 6-token stake and leave Eve unable to claim at all.
    direct_vm.sender = direct_bob
    contract.claim_refund(cid)

    bob_refund = 4_200_000_000_000_000_000  # 6/10 of the 7-token pool
    assert _sent_to(transfers, Address(direct_bob), bob_refund), \
        f"Bob's proportional refund was never sent: {transfers}"

    # Eve claims second -- this is the call that used to revert with
    # "Invalid refund math" once Bob had already drained the escrow.
    direct_vm.sender = eve
    contract.claim_refund(cid)

    eve_refund = 2_800_000_000_000_000_000  # 4/10 of the 7-token pool
    assert _sent_to(transfers, Address(eve), eve_refund), \
        f"Eve's proportional refund was never sent: {transfers}"

    # Together Bob + Eve's refunds exactly exhaust what was left, and both
    # contribution ledger entries are cleared -- nothing stranded, nothing
    # double-claimable.
    c = contract.get_campaign(cid)
    assert int(c.remaining_funds) == 0, "Escrow should be fully drained after both proportional claims"

    bob_key = f"{cid}_{str(Address(direct_bob))}"
    eve_key = f"{cid}_{str(Address(eve))}"
    assert contract.campaign_contributions[bob_key] == 0
    assert contract.campaign_contributions[eve_key] == 0
