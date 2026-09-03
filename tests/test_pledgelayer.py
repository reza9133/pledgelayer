import pytest
import json
import hashlib
from unittest.mock import patch
from genlayer import *

from pledgelayer import PledgeLayerPlatform, _Recipient


def _h(content: str) -> str:
    """sha256 hex digest of the evidence body a test's mock_web will return."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


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
    return (str(address), int(value)) in transfers


def test_payout_and_surplus(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """Proves that overfunded surplus isn't stranded, the CEI pattern clears
    safely, and the creator/platform actually receive their split of the
    payout (not just that remaining_funds looks right internally)."""

    transfers = _record_transfers(direct_vm)

    # Charlie is the platform owner, Alice is the creator, Bob is the backer
    direct_vm.sender = direct_charlie
    contract = direct_deploy("pledgelayer.py", sdk_version="v0.2.12")

    # 1. Create a campaign (Goal = 10 Tokens, 1 Milestone at 100%, 30 days duration)
    direct_vm.sender = direct_alice
    cid = contract.create_campaign("Test Campaign", "Desc", 10, 30, ["M1"], ["M1 Desc"], [10000])

    # Test campaign count and milestone description view coverage
    assert contract.get_campaign_count() == 1
    m_view = contract.get_milestone(cid, u32(0))
    assert m_view.description == "M1 Desc"

    # 2. Overfund the campaign to test surplus (Bob sends 15 Tokens against a
    # 10-token goal) via the real payable call.
    _fund(direct_vm, contract, cid, direct_bob, 15 * 10**18)
    assert contract.get_contribution(cid, str(direct_bob)) == 15 * 10**18

    # 3. Submit Evidence URL, committing the sha256 hash of the deliverable
    # content ahead of time so validators can authenticate it at adjudication.
    direct_vm.sender = direct_alice
    contract.submit_milestone(cid, "https://github.com/my-repo/pull/1", _h("Merge branch main"))

    # 4. Mock Web Fetching & AI Adjudication & Approve
    direct_vm.mock_web(r".*", {"status": 200, "body": "Merge branch main"})
    direct_vm.mock_llm(r".*", json.dumps({"decision": "APPROVED", "detailed_feedback": "Looks solid"}))
    direct_vm.sender = direct_charlie
    contract.adjudicate_milestone(cid)

    # 5. Verify NO FUNDS STRANDED (Remaining funds must be perfectly 0)
    c = contract.get_campaign(cid)
    assert c.status == "COMPLETED"
    assert int(c.remaining_funds) == 0, "Error: Surplus funds were stranded in the contract!"

    total_paid = 15 * 10**18
    plat_fee = total_paid * 250 // 10000
    creator_payout = total_paid - plat_fee
    
    assert int(contract.get_pending_withdrawal(direct_alice)) == creator_payout
    assert int(contract.get_pending_withdrawal(direct_charlie)) == plat_fee

    # 6. Verify withdrawal pull mechanism for Creator and Platform Owner
    direct_vm.sender = direct_alice
    contract.withdraw()
    assert _sent_to(transfers, str(direct_alice), creator_payout), \
        f"Creator never received their {creator_payout} payout: {transfers}"
    assert int(contract.get_pending_withdrawal(direct_alice)) == 0

    direct_vm.sender = direct_charlie
    contract.withdraw()
    assert _sent_to(transfers, str(direct_charlie), plat_fee), \
        f"Platform never received its {plat_fee} fee: {transfers}"
    assert int(contract.get_pending_withdrawal(direct_charlie)) == 0


def test_indefinitely_underfunded_withdrawal(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Proves that a campaign stuck in FUNDING allows backers to safely
    withdraw without stranding, and that Bob actually gets his money back."""

    transfers = _record_transfers(direct_vm)

    contract = direct_deploy("pledgelayer.py", sdk_version="v0.2.12")

    direct_vm.sender = direct_alice
    cid = contract.create_campaign("Underfunded", "Desc", 10, 30, ["M1"], ["Desc"], [10000])

    # Bob funds half the goal (5 Tokens) via the real payable call.
    _fund(direct_vm, contract, cid, direct_bob, 5 * 10**18)
    assert contract.get_contribution(cid, str(direct_bob)) == 5 * 10**18

    # Assert it's stuck in funding
    assert contract.get_campaign(cid).status == "FUNDING"

    # Bob revokes his funding
    direct_vm.sender = direct_bob
    contract.revoke_funding(cid)
    
    # Bob withdraws his revoked funds
    direct_vm.sender = direct_bob
    contract.withdraw()

    # Verify funds were completely withdrawn and nothing is stranded
    c = contract.get_campaign(cid)
    assert int(c.total_funded) == 0
    assert int(c.remaining_funds) == 0

    # Verify Bob was actually sent his full 5 tokens back.
    assert _sent_to(transfers, str(direct_bob), 5 * 10**18), \
        f"Bob never received his revoked funding back: {transfers}"


def test_cancellation_and_cei_refunds(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Proves cancellation preserves balances, CEI prevents re-entrancy, and
    Bob's refund is an actual transfer, not just a cleared ledger entry."""

    transfers = _record_transfers(direct_vm)

    contract = direct_deploy("pledgelayer.py", sdk_version="v0.2.12")

    direct_vm.sender = direct_alice
    cid = contract.create_campaign("To Cancel", "Desc", 10, 30, ["M1"], ["Desc"], [10000])

    # Bob funds via the real payable call.
    _fund(direct_vm, contract, cid, direct_bob, 5 * 10**18)

    # Alice cancels
    direct_vm.sender = direct_alice
    contract.cancel_campaign(cid)
    assert contract.get_campaign(cid).status == "CANCELLED"

    # Bob claims refund
    direct_vm.sender = direct_bob
    contract.claim_refund(cid)
    
    # Bob withdraws
    direct_vm.sender = direct_bob
    contract.withdraw()

    c = contract.get_campaign(cid)
    assert int(c.remaining_funds) == 0
    contrib_key = f"{cid}_{str(direct_bob)}"
    assert contract.campaign_contributions[contrib_key] == 0

    assert _sent_to(transfers, str(direct_bob), 5 * 10**18), \
        f"Bob's cancellation refund was never actually sent: {transfers}"


def test_failed_campaign_partial_payout_refund(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, direct_accounts
):
    """Reproduces the multi-milestone scenario: a campaign that pays out
    one approved milestone and then FAILS on the next must refund each
    backer their *pro-rata* share of whatever is left in escrow."""

    transfers = _record_transfers(direct_vm)

    direct_vm.sender = direct_charlie
    contract = direct_deploy("pledgelayer.py", sdk_version="v0.2.12")

    eve = direct_accounts[0]

    direct_vm.sender = direct_alice
    cid = contract.create_campaign(
        "Two Milestones", "Desc", 10, 30, ["M1", "M2"], ["M1 Desc", "M2 Desc"], [3000, 7000]
    )

    # Eve funds 4 tokens, Bob funds 6 -- total_funded hits the 10-token goal
    _fund(direct_vm, contract, cid, eve, 4 * 10**18)
    _fund(direct_vm, contract, cid, direct_bob, 6 * 10**18)
    assert contract.get_campaign(cid).status == "ACTIVE"

    # Milestone 1 (30% of 10 tokens = 3) is submitted, web-fetched, and approved.
    direct_vm.sender = direct_alice
    contract.submit_milestone(cid, "https://example.com/evidence1", _h("Evidence 1"))
    direct_vm.mock_web(r".*", {"status": 200, "body": "Evidence 1"})
    direct_vm.mock_llm(r".*", json.dumps({"decision": "APPROVED", "detailed_feedback": "Solid"}))
    direct_vm.sender = direct_charlie
    contract.adjudicate_milestone(cid)

    c = contract.get_campaign(cid)
    assert c.status == "ACTIVE"
    assert int(c.remaining_funds) == 7 * 10**18, "Expected 7 tokens left in escrow after M1 payout"

    m1_payout = 3 * 10**18
    m1_fee = m1_payout * 250 // 10000
    assert _sent_to(transfers, str(direct_alice), m1_payout - m1_fee), \
        f"Creator never received the M1 payout: {transfers}"
    assert _sent_to(transfers, str(direct_charlie), m1_fee), \
        f"Platform never received the M1 fee: {transfers}"

    # Milestone 2 is rejected twice in a row -- campaign fails with the
    # 7-token remainder still owed to Bob and Eve.
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": "Evidence 2"})
    direct_vm.mock_llm(r".*", json.dumps({"decision": "REJECTED", "detailed_feedback": "Not enough evidence"}))

    direct_vm.sender = direct_alice
    contract.submit_milestone(cid, "https://example.com/evidence2-v1", _h("Evidence 2"))
    direct_vm.sender = direct_charlie
    contract.adjudicate_milestone(cid)
    assert contract.get_campaign(cid).status == "ACTIVE", "First rejection should not fail the campaign yet"

    direct_vm.sender = direct_alice
    contract.submit_milestone(cid, "https://example.com/evidence2-v2", _h("Evidence 2"))
    direct_vm.sender = direct_charlie
    contract.adjudicate_milestone(cid)

    c = contract.get_campaign(cid)
    assert c.status == "FAILED", "Second consecutive rejection should fail the campaign"
    assert int(c.remaining_funds) == 7 * 10**18, "Rejection must not itself move any funds"

    # Bob claims refund
    direct_vm.sender = direct_bob
    contract.claim_refund(cid)
    direct_vm.sender = direct_bob
    contract.withdraw()

    bob_refund = 4_200_000_000_000_000_000  # 6/10 of the 7-token pool
    assert _sent_to(transfers, str(direct_bob), bob_refund), \
        f"Bob's proportional refund was never sent: {transfers}"

    # Eve claims refund
    direct_vm.sender = eve
    contract.claim_refund(cid)
    direct_vm.sender = eve
    contract.withdraw()

    eve_refund = 2_800_000_000_000_000_000  # 4/10 of the 7-token pool
    assert _sent_to(transfers, str(eve), eve_refund), \
        f"Eve's proportional refund was never sent: {transfers}"

    # Together Bob + Eve's refunds exactly exhaust what was left
    c = contract.get_campaign(cid)
    assert int(c.remaining_funds) == 0, "Escrow should be fully drained after both proportional claims"

    bob_key = f"{cid}_{str(direct_bob)}"
    eve_key = f"{cid}_{str(eve)}"
    assert contract.campaign_contributions[bob_key] == 0
    assert contract.campaign_contributions[eve_key] == 0


def test_submit_milestone_rejects_bad_hash_format(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Proves the contract enforces a well-formed 64-char hex sha256 commitment
    at submission time instead of accepting arbitrary/missing hashes."""

    contract = direct_deploy("pledgelayer.py", sdk_version="v0.2.12")

    direct_vm.sender = direct_alice
    cid = contract.create_campaign("Hash Format", "Desc", 10, 30, ["M1"], ["Desc"], [10000])
    _fund(direct_vm, contract, cid, direct_bob, 10 * 10**18)

    direct_vm.sender = direct_alice
    with pytest.raises(Exception):
        contract.submit_milestone(cid, "https://example.com/e", "not-a-valid-hash")


def test_evidence_hash_mismatch_forces_rejection(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    """Proves evidence content is authenticated against the hash committed at
    submission time: if the content behind evidence_url no longer matches
    that commitment (e.g. swapped after submission), adjudication is forced
    to REJECTED deterministically -- even though the mocked LLM would have
    APPROVED it. This closes the gap where irreversible payouts rested on
    unauthenticated creator-supplied text."""

    contract = direct_deploy("pledgelayer.py", sdk_version="v0.2.12")

    direct_vm.sender = direct_alice
    cid = contract.create_campaign("Hash Mismatch", "Desc", 10, 30, ["M1"], ["Desc"], [10000])
    _fund(direct_vm, contract, cid, direct_bob, 10 * 10**18)

    # Alice commits to the hash of "Original Deliverable" ...
    direct_vm.sender = direct_alice
    contract.submit_milestone(cid, "https://example.com/e", _h("Original Deliverable"))

    # ... but by adjudication time the URL actually serves different content,
    # and the LLM mock would happily approve it.
    direct_vm.mock_web(r".*", {"status": 200, "body": "Swapped Deliverable"})
    direct_vm.mock_llm(r".*", json.dumps({"decision": "APPROVED", "detailed_feedback": "Looks great"}))

    direct_vm.sender = direct_charlie
    contract.adjudicate_milestone(cid)

    m = contract.get_milestone(cid, u32(0))
    assert m.status == "REJECTED"
    assert "hash" in m.ai_feedback.lower()

    c = contract.get_campaign(cid)
    assert c.status == "ACTIVE", "A single hash-mismatch rejection should not fail the campaign outright"
    assert int(c.remaining_funds) == 10 * 10**18, "No funds may move on a hash-authentication failure"


def test_abandonment_timeout(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Proves that a campaign that has passed its deadline without completion
    can be forced into FAILED via trigger_timeout, allowing proper refunds."""

    transfers = _record_transfers(direct_vm)
    contract = direct_deploy("pledgelayer.py", sdk_version="v0.2.12")

    direct_vm.sender = direct_alice
    cid = contract.create_campaign("Timeout Test", "Desc", 10, 1, ["M1"], ["Desc"], [10000])

    _fund(direct_vm, contract, cid, direct_bob, 10 * 10**18)
    assert contract.get_campaign(cid).status == "ACTIVE"

    from datetime import datetime, timezone
    now = int(datetime.now(timezone.utc).timestamp())
    future_time = datetime.fromtimestamp(now + 86400 * 2, timezone.utc).isoformat()
    direct_vm.warp(future_time)

    direct_vm.sender = direct_bob
    contract.trigger_timeout(cid)
    
    assert contract.get_campaign(cid).status == "FAILED"

    direct_vm.sender = direct_bob
    contract.claim_refund(cid)
    
    direct_vm.sender = direct_bob
    contract.withdraw()

    assert int(contract.get_campaign(cid).remaining_funds) == 0
    assert _sent_to(transfers, str(direct_bob), 10 * 10**18)
