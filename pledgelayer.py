# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
PledgeLayer Platform - Complete Intelligent Contract
===================================================
Implemented Pull-Payment pattern for native transfers, 
str-keys for Calldata compatibility, secure LLM validator handling,
CEI pattern, evidence web fetching, evidence hash-binding (deterministic
authentication of fetched evidence against a hash the creator commits at
submission time, checked before any LLM judgment runs), abandonment
timeouts, campaign counting, and campaign description view.
"""

from genlayer import *
from dataclasses import dataclass
import json
import hashlib
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# 1. Native Transfer Interface
# ---------------------------------------------------------------------------
@gl.evm.contract_interface
class _Recipient:
    class View:
        pass
    class Write:
        pass

# ---------------------------------------------------------------------------
# 2. Top-Level Non-Deterministic AI Module (Consensus Wrapper)
# ---------------------------------------------------------------------------
def _evaluate_milestone_nondet(m_title: str, m_desc: str, evidence_url: str, expected_hash: str) -> dict:
    def leader_fn():
        try:
            res = gl.nondet.web.get(evidence_url)
            raw_bytes = res.body
            fetched_content = raw_bytes.decode('utf-8')[:15000]
        except Exception as e:
            return {
                "decision": "REJECTED",
                "detailed_feedback": f"Failed to fetch evidence URL: {str(e)}"
            }

        # Bounded, deterministic authentication check: the creator commits a
        # sha256 hash of the deliverable content at submission time
        # (submit_milestone). Every validator independently re-fetches the
        # evidence and must see content matching that committed hash before
        # any subjective LLM judgment is allowed to run. This stops
        # after-the-fact swaps of the evidence content and stops payouts
        # from resting solely on unauthenticated creator-supplied text.
        actual_hash = hashlib.sha256(raw_bytes).hexdigest()
        if actual_hash != expected_hash:
            return {
                "decision": "REJECTED",
                "detailed_feedback": (
                    "Evidence content hash does not match the hash committed "
                    "at submission time. The content at the evidence URL may "
                    "have been altered after submission."
                )
            }

        prompt = f"""
        You are an elite, impartial Web3 Adjudicator.
        Evaluate the submitted milestone deliverable against its requirements.

        --- CONTEXT ---
        Title: {m_title}
        Requirements: {m_desc}
        Evidence URL: {evidence_url}

        --- FETCHED EVIDENCE CONTENT ---
        {fetched_content}

        Evaluate based on Completeness, Quality, and Security.
        Output ONLY a JSON object strictly matching this schema:
        {{
            "decision": "APPROVED",
            "detailed_feedback": "Concise reasoning."
        }}
        (Use "REJECTED" for the decision if the criteria are not adequately met).
        """
        raw = gl.nondet.exec_prompt(prompt, response_format="json")
        if not isinstance(raw, dict) or raw.get("decision") not in ("APPROVED", "REJECTED"):
            raise gl.vm.UserError("LLM returned a malformed adjudication result")
        return raw

    def validator_fn(leader_result) -> bool:
        if not isinstance(leader_result, gl.vm.Return):
            return False
        try:
            validator_data = leader_fn()
        except Exception:
            return False
        return leader_result.calldata.get("decision") == validator_data.get("decision")

    return gl.vm.run_nondet_unsafe(leader_fn, validator_fn)


# ---------------------------------------------------------------------------
# 3. Persistent Storage & View Dataclasses
# ---------------------------------------------------------------------------
@allow_storage
@dataclass
class Campaign:
    campaign_id: str
    creator: Address
    title: str
    description: str
    funding_goal: u256
    total_funded: u256
    remaining_funds: u256
    current_milestone_index: u32
    milestone_count: u32
    status: str
    deadline: u256

@allow_storage
@dataclass
class Milestone:
    campaign_id: str
    index: u32
    title: str
    description: str
    ratio_bps: u32
    status: str
    evidence_url: str
    evidence_hash: str
    rejection_count: u32
    ai_feedback: str

@dataclass
class CampaignView:
    exists: bool
    campaign_id: str
    creator: str
    title: str
    description: str
    funding_goal: u256
    total_funded: u256
    remaining_funds: u256
    current_milestone_index: u32
    milestone_count: u32
    status: str
    deadline: u256

@dataclass
class MilestoneView:
    exists: bool
    index: u32
    title: str
    description: str 
    ratio_bps: u32
    status: str
    evidence_url: str
    evidence_hash: str
    rejection_count: u32
    ai_feedback: str

# ---------------------------------------------------------------------------
# 4. Contract Implementation
# ---------------------------------------------------------------------------
class PledgeLayerPlatform(gl.Contract):
    platform_owner: Address
    platform_fee_bps: u32
    next_campaign_id: u32
    
    campaigns: TreeMap[str, Campaign]
    campaign_ids: DynArray[str]
    campaign_milestones: TreeMap[str, Milestone]
    campaign_contributions: TreeMap[str, u256]
    pending_withdrawals: TreeMap[str, u256]

    def __init__(self):
        self.platform_owner = gl.message.sender_address
        self.platform_fee_bps = u32(250)
        self.next_campaign_id = u32(1)

    def _get_campaign_or_raise(self, cid: str) -> Campaign:
        c = self.campaigns.get(cid, None)
        if c is None:
            raise gl.vm.UserError("Campaign does not exist")
        return c

    def _add_withdrawal(self, account: str, amount: int) -> None:
        if amount > 0:
            prev = self.pending_withdrawals.get(account, u256(0))
            self.pending_withdrawals[account] = u256(int(prev) + amount)

    # =====================================================================
    # WRITE METHODS
    # =====================================================================
    @gl.public.write
    def create_campaign(
        self, title: str, description: str, funding_goal_whole_tokens: u32, duration_days: u32,
        milestone_titles: list[str], milestone_descriptions: list[str], milestone_ratios_bps: list[u32]
    ) -> str:
        title = str(title)
        description = str(description)
        
        if int(funding_goal_whole_tokens) == 0:
            raise gl.vm.UserError("Funding goal must be at least 1 token")
        if int(duration_days) == 0:
            raise gl.vm.UserError("Duration must be at least 1 day")
        if len(title) == 0:
            raise gl.vm.UserError("Title cannot be empty")
            
        funding_goal = u256(int(funding_goal_whole_tokens) * (10**18))
        m_count = len(milestone_titles)
        
        if m_count == 0 or len(milestone_descriptions) != m_count or len(milestone_ratios_bps) != m_count:
            raise gl.vm.UserError("Milestone array sizes mismatch or empty")
            
        total_ratio = sum([int(u32(r)) for r in milestone_ratios_bps])
        if total_ratio != 10000:
            raise gl.vm.UserError("Milestone ratios must sum to exactly 10000 bps")

        cid = str(self.next_campaign_id)
        self.next_campaign_id = u32(int(self.next_campaign_id) + 1)
        
        now = int(datetime.now(timezone.utc).timestamp())
        deadline = u256(now + int(duration_days) * 86400)

        self.campaigns[cid] = Campaign(
            campaign_id=cid, creator=gl.message.sender_address, title=title, description=description,
            funding_goal=funding_goal, total_funded=u256(0), remaining_funds=u256(0),
            current_milestone_index=u32(0), milestone_count=u32(m_count), status="FUNDING",
            deadline=deadline
        )
        self.campaign_ids.append(cid)

        for i in range(m_count):
            m_key = f"{cid}_{i}"
            self.campaign_milestones[m_key] = Milestone(
                campaign_id=cid, index=u32(i), title=str(milestone_titles[i]),
                description=str(milestone_descriptions[i]), ratio_bps=u32(milestone_ratios_bps[i]),
                status="PENDING", evidence_url="", evidence_hash="", rejection_count=u32(0), ai_feedback=""
            )
            
        return cid

    @gl.public.write.payable
    def fund_campaign(self, campaign_id: str) -> None:
        cid = str(campaign_id)
        deposit = u256(gl.message.value)
        backer = str(gl.message.sender_address)

        c = self._get_campaign_or_raise(cid)
        if c.status != "FUNDING":
            raise gl.vm.UserError("Campaign is not accepting funds")
        if deposit == u256(0):
            raise gl.vm.UserError("Must send a positive amount")

        contrib_key = f"{cid}_{backer}"
        prev_contrib = self.campaign_contributions.get(contrib_key, u256(0))
        self.campaign_contributions[contrib_key] = u256(int(prev_contrib) + int(deposit))

        new_total = u256(int(c.total_funded) + int(deposit))
        new_status = "ACTIVE" if int(new_total) >= int(c.funding_goal) else "FUNDING"

        self.campaigns[cid] = Campaign(
            campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
            funding_goal=c.funding_goal, total_funded=new_total, 
            remaining_funds=u256(int(c.remaining_funds) + int(deposit)),
            current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, 
            status=new_status, deadline=c.deadline
        )

    @gl.public.write
    def trigger_timeout(self, campaign_id: str) -> None:
        cid = str(campaign_id)
        c = self._get_campaign_or_raise(cid)
        
        if c.status not in ["FUNDING", "ACTIVE"]:
            raise gl.vm.UserError("Campaign is not in a state that can time out")
            
        now = int(datetime.now(timezone.utc).timestamp())
        if now <= int(c.deadline):
            raise gl.vm.UserError("Deadline has not passed yet")
            
        self.campaigns[cid] = Campaign(
            campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
            funding_goal=c.funding_goal, total_funded=c.total_funded, remaining_funds=c.remaining_funds,
            current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, 
            status="FAILED", deadline=c.deadline
        )

    @gl.public.write
    def revoke_funding(self, campaign_id: str) -> None:
        cid = str(campaign_id)
        player = str(gl.message.sender_address)
        c = self._get_campaign_or_raise(cid)
        
        if c.status != "FUNDING":
            raise gl.vm.UserError("Can only revoke funds during the FUNDING phase")

        contrib_key = f"{cid}_{player}"
        user_contrib = self.campaign_contributions.get(contrib_key, u256(0))
        if user_contrib == u256(0):
            raise gl.vm.UserError("No contribution found")

        self.campaign_contributions[contrib_key] = u256(0)
        self.campaigns[cid] = Campaign(
            campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
            funding_goal=c.funding_goal, 
            total_funded=u256(int(c.total_funded) - int(user_contrib)), 
            remaining_funds=u256(int(c.remaining_funds) - int(user_contrib)),
            current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, 
            status=c.status, deadline=c.deadline
        )
        self._add_withdrawal(player, int(user_contrib))

    @gl.public.write
    def cancel_campaign(self, campaign_id: str) -> None:
        cid = str(campaign_id)
        c = self._get_campaign_or_raise(cid)
        
        if gl.message.sender_address != c.creator:
            raise gl.vm.UserError("Unauthorized: Only creator can cancel")
        if c.status != "FUNDING":
            raise gl.vm.UserError("Campaign can only be cancelled during FUNDING phase")

        self.campaigns[cid] = Campaign(
            campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
            funding_goal=c.funding_goal, total_funded=c.total_funded, remaining_funds=c.remaining_funds,
            current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, 
            status="CANCELLED", deadline=c.deadline
        )

    @gl.public.write
    def submit_milestone(self, campaign_id: str, evidence_url: str, evidence_hash: str) -> None:
        cid = str(campaign_id)
        url = str(evidence_url)
        ehash = str(evidence_hash).lower()
        c = self._get_campaign_or_raise(cid)
        
        if gl.message.sender_address != c.creator:
            raise gl.vm.UserError("Unauthorized")
        if c.status != "ACTIVE":
            raise gl.vm.UserError("Campaign is not ACTIVE")
        if len(url) == 0 or not url.startswith("http"):
            raise gl.vm.UserError("Valid Evidence URL is required")
        if len(ehash) != 64 or any(ch not in "0123456789abcdef" for ch in ehash):
            raise gl.vm.UserError(
                "evidence_hash must be the 64-char hex sha256 digest of the "
                "deliverable content being linked to by evidence_url"
            )

        m_key = f"{cid}_{int(c.current_milestone_index)}"
        m = self.campaign_milestones.get(m_key, None)
        
        if m is None or m.status not in ["PENDING", "REJECTED"]:
            raise gl.vm.UserError("Invalid milestone state")

        self.campaign_milestones[m_key] = Milestone(
            campaign_id=m.campaign_id, index=m.index, title=m.title, description=m.description,
            ratio_bps=m.ratio_bps, status="SUBMITTED", evidence_url=url, evidence_hash=ehash,
            rejection_count=m.rejection_count, ai_feedback=m.ai_feedback
        )

    @gl.public.write
    def adjudicate_milestone(self, campaign_id: str) -> None:
        cid = str(campaign_id)
        c = self._get_campaign_or_raise(cid)
        
        if c.status != "ACTIVE":
            raise gl.vm.UserError("Campaign is not ACTIVE")

        m_key = f"{cid}_{int(c.current_milestone_index)}"
        m = self.campaign_milestones.get(m_key, None)
        
        if m is None or m.status != "SUBMITTED":
            raise gl.vm.UserError("Milestone not awaiting adjudication")

        result = _evaluate_milestone_nondet(
            str(m.title), str(m.description), str(m.evidence_url), str(m.evidence_hash)
        )
        decision = result.get("decision", "REJECTED")
        feedback = result.get("detailed_feedback", "No feedback provided")

        if decision == "APPROVED":
            new_idx = u32(int(c.current_milestone_index) + 1)
            is_final = int(new_idx) == int(c.milestone_count)
            
            if is_final:
                actual_payout = int(c.remaining_funds)
            else:
                target = (int(c.total_funded) * int(m.ratio_bps)) // 10000
                rem_funds = int(c.remaining_funds)
                actual_payout = target if target < rem_funds else rem_funds
            
            plat_fee = (actual_payout * int(self.platform_fee_bps)) // 10000
            creator_payout = actual_payout - plat_fee
            
            self.campaign_milestones[m_key] = Milestone(
                campaign_id=m.campaign_id, index=m.index, title=m.title, description=m.description, 
                ratio_bps=m.ratio_bps, status="APPROVED", evidence_url=m.evidence_url, 
                evidence_hash=m.evidence_hash, rejection_count=m.rejection_count, ai_feedback=str(feedback)
            )
            
            self.campaigns[cid] = Campaign(
                campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
                funding_goal=c.funding_goal, total_funded=c.total_funded, 
                remaining_funds=u256(int(c.remaining_funds) - actual_payout),
                current_milestone_index=new_idx, milestone_count=c.milestone_count, 
                status="COMPLETED" if is_final else "ACTIVE", deadline=c.deadline
            )
            
            self._add_withdrawal(str(c.creator), creator_payout)
            self._add_withdrawal(str(self.platform_owner), plat_fee)
                
        else:
            new_rejects = u32(int(m.rejection_count) + 1)
            new_status = "FAILED" if int(new_rejects) >= 2 else "ACTIVE"
            
            self.campaign_milestones[m_key] = Milestone(
                campaign_id=m.campaign_id, index=m.index, title=m.title, description=m.description, 
                ratio_bps=m.ratio_bps, status="REJECTED", evidence_url=m.evidence_url, 
                evidence_hash=m.evidence_hash, rejection_count=new_rejects, ai_feedback=str(feedback)
            )
            
            self.campaigns[cid] = Campaign(
                campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
                funding_goal=c.funding_goal, total_funded=c.total_funded, remaining_funds=c.remaining_funds,
                current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, 
                status=new_status, deadline=c.deadline
            )

    @gl.public.write
    def claim_refund(self, campaign_id: str) -> None:
        cid = str(campaign_id)
        player = str(gl.message.sender_address)
        
        c = self._get_campaign_or_raise(cid)
        if c.status not in ["FAILED", "CANCELLED"]:
            raise gl.vm.UserError("Refunds not available")

        contrib_key = f"{cid}_{player}"
        user_contrib = self.campaign_contributions.get(contrib_key, u256(0))
        if user_contrib == u256(0):
            raise gl.vm.UserError("No claimable contribution found")

        total_funded = int(c.total_funded)
        remaining = int(c.remaining_funds)

        if total_funded <= 0 or remaining <= 0:
            raise gl.vm.UserError("No escrow remaining to refund")

        r_amount = (int(user_contrib) * remaining) // total_funded

        if r_amount > remaining:
            raise gl.vm.UserError("Invalid refund math")

        self.campaign_contributions[contrib_key] = u256(0)
        self.campaigns[cid] = Campaign(
            campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
            funding_goal=c.funding_goal,
            total_funded=u256(total_funded - int(user_contrib)),
            remaining_funds=u256(remaining - r_amount),
            current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, 
            status=c.status, deadline=c.deadline
        )

        self._add_withdrawal(player, r_amount)

    @gl.public.write
    def withdraw(self) -> None:
        """Allows users (creators, backers, platform) to pull their pending funds."""
        player = str(gl.message.sender_address)
        amount = int(self.pending_withdrawals.get(player, u256(0)))
        
        if amount == 0:
            raise gl.vm.UserError("No funds to withdraw")
            
        self.pending_withdrawals[player] = u256(0)
        _Recipient(Address(player)).emit_transfer(value=u256(amount))

    # =====================================================================
    # VIEW METHODS
    # =====================================================================
    @gl.public.view
    def get_campaign(self, campaign_id: str) -> CampaignView:
        try:
            cid = str(campaign_id)
            c = self.campaigns.get(cid, None)
            if c is None:
                return CampaignView(False, "", "", "", "", u256(0), u256(0), u256(0), u32(0), u32(0), "", u256(0))
            return CampaignView(
                exists=True, campaign_id=c.campaign_id, creator=str(c.creator), title=c.title,
                description=c.description,
                funding_goal=c.funding_goal, total_funded=c.total_funded, remaining_funds=c.remaining_funds,
                current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, 
                status=c.status, deadline=c.deadline
            )
        except Exception:
            return CampaignView(False, "", "", "", "", u256(0), u256(0), u256(0), u32(0), u32(0), "", u256(0))

    @gl.public.view
    def get_milestone(self, campaign_id: str, milestone_index: u32) -> MilestoneView:
        try:
            m_key = f"{str(campaign_id)}_{int(u32(milestone_index))}"
            m = self.campaign_milestones.get(m_key, None)
            if m is None:
                return MilestoneView(False, u32(0), "", "", u32(0), "", "", "", u32(0), "")
                
            return MilestoneView(
                exists=True, index=m.index, title=m.title, description=m.description, ratio_bps=m.ratio_bps,
                status=m.status, evidence_url=m.evidence_url, evidence_hash=m.evidence_hash,
                rejection_count=m.rejection_count, ai_feedback=m.ai_feedback
            )
        except Exception:
            return MilestoneView(False, u32(0), "", "", u32(0), "", "", "", u32(0), "")
            
    @gl.public.view
    def get_pending_withdrawal(self, account: str) -> u256:
        return self.pending_withdrawals.get(str(account), u256(0))

    @gl.public.view
    def get_campaign_count(self) -> u32:
        return u32(len(self.campaign_ids))
        
    @gl.public.view
    def get_contribution(self, campaign_id: str, account: str) -> u256:
        contrib_key = f"{str(campaign_id)}_{str(account)}"
        return self.campaign_contributions.get(contrib_key, u256(0))
