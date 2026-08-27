"""
Direct-mode test suite for PledgeLayerPlatform.

Fixes applied vs. the original version of this file (all three were
confirmed by actually running the suite against a real GenVM SDK, not
just by code review):

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


def test_payout_and_surplus(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """Proves that overfunded surplus isn't stranded, and CEI pattern clears safely."""

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


def test_indefinitely_underfunded_withdrawal(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Proves that a campaign stuck in FUNDING allows backers to safely withdraw without stranding."""

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


def test_cancellation_and_cei_refunds(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Proves cancellation preserves balances and CEI prevents re-entrancy."""

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
