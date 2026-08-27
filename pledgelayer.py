# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
PledgeLayer Platform - Complete Intelligent Contract
===================================================
Implemented native transfers, CEI pattern, and full stranded-funds prevention.
"""

from genlayer import *
from dataclasses import dataclass
import json

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
def _evaluate_milestone_nondet(m_title: str, m_desc: str, m_evidence_text: str) -> dict:
    prompt = f"""
    You are an elite, impartial Web3 Adjudicator.
    Evaluate the submitted milestone deliverable against its requirements.

    --- CONTEXT ---
    Title: {m_title}
    Requirements: {m_desc}

    --- SUBMITTED EVIDENCE ---
    {m_evidence_text}

    Evaluate based on Completeness, Quality, and Security.
    Output ONLY a JSON object strictly matching this schema:
    {{
        "decision": "APPROVED",
        "detailed_feedback": "Concise reasoning."
    }}
    (Use "REJECTED" for the decision if the criteria are not adequately met).
    """

    def leader_fn():
        raw = gl.nondet.exec_prompt(prompt, response_format="json")
        if not isinstance(raw, dict) or raw.get("decision") not in ("APPROVED", "REJECTED"):
            raise gl.vm.UserError("LLM returned a malformed adjudication result")
        return raw

    def validator_fn(leader_result) -> bool:
        if not isinstance(leader_result, gl.vm.Return):
            return False
        validator_data = leader_fn()
        leader_data = leader_result.calldata
        return leader_data.get("decision") == validator_data.get("decision")

    return gl.vm.run_nondet_unsafe(leader_fn, validator_fn)


# ---------------------------------------------------------------------------
# 3. Persistent Storage & View Dataclasses
# ---------------------------------------------------------------------------
@allow_storage
@dataclass
class Campaign:
    campaign_id: u32
    creator: Address
    title: str
    description: str
    funding_goal: u256
    total_funded: u256
    remaining_funds: u256
    current_milestone_index: u32
    milestone_count: u32
    status: str

@allow_storage
@dataclass
class Milestone:
    campaign_id: u32
    index: u32
    title: str
    description: str
    ratio_bps: u32
    status: str
    evidence_text: str
    rejection_count: u32
    ai_feedback: str

@dataclass
class CampaignView:
    exists: bool
    campaign_id: u32
    creator: str
    title: str
    funding_goal: u256
    total_funded: u256
    remaining_funds: u256
    current_milestone_index: u32
    milestone_count: u32
    status: str

@dataclass
class MilestoneView:
    exists: bool
    index: u32
    title: str
    ratio_bps: u32
    status: str
    evidence_text: str
    rejection_count: u32
    ai_feedback: str


# ---------------------------------------------------------------------------
# 4. Contract Implementation
# ---------------------------------------------------------------------------
class PledgeLayerPlatform(gl.Contract):
    platform_owner: Address
    platform_fee_bps: u32
    next_campaign_id: u32
    
    campaigns: TreeMap[u32, Campaign]
    campaign_ids: DynArray[u32]
    
    campaign_milestones: TreeMap[str, Milestone]
    campaign_contributions: TreeMap[str, u256]

    def __init__(self):
        self.platform_owner = gl.message.sender_address
        self.platform_fee_bps = u32(250)
        self.next_campaign_id = u32(1)

    def _get_campaign_or_raise(self, cid: u32) -> Campaign:
        c = self.campaigns.get(cid, None)
        if c is None:
            raise gl.vm.UserError("Campaign does not exist")
        return c

    # =====================================================================
    # WRITE METHODS
    # =====================================================================
    @gl.public.write
    def create_campaign(
        self, title: str, description: str, funding_goal_whole_tokens: u32, 
        milestone_titles: list[str], milestone_descriptions: list[str], milestone_ratios_bps: list[u32]
    ) -> u32:
        title = str(title)
        description = str(description)
        
        if int(funding_goal_whole_tokens) == 0:
            raise gl.vm.UserError("Funding goal must be at least 1 token")
        if len(title) == 0:
            raise gl.vm.UserError("Title cannot be empty")
            
        funding_goal = u256(int(funding_goal_whole_tokens) * (10**18))
        
        m_count = len(milestone_titles)
        if m_count == 0 or len(milestone_descriptions) != m_count or len(milestone_ratios_bps) != m_count:
            raise gl.vm.UserError("Milestone array sizes mismatch or empty")
            
        total_ratio = sum([int(u32(r)) for r in milestone_ratios_bps])
        if total_ratio != 10000:
            raise gl.vm.UserError("Milestone ratios must sum to exactly 10000 bps")

        cid = self.next_campaign_id
        self.next_campaign_id = u32(int(cid) + 1)

        self.campaigns[cid] = Campaign(
            campaign_id=cid, creator=gl.message.sender_address, title=title, description=description,
            funding_goal=funding_goal, total_funded=u256(0), remaining_funds=u256(0),
            current_milestone_index=u32(0), milestone_count=u32(m_count), status="FUNDING"
        )
        self.campaign_ids.append(cid)

        for i in range(m_count):
            m_key = f"{int(cid)}_{i}"
            self.campaign_milestones[m_key] = Milestone(
                campaign_id=cid, index=u32(i), title=str(milestone_titles[i]),
                description=str(milestone_descriptions[i]), ratio_bps=u32(milestone_ratios_bps[i]),
                status="PENDING", evidence_text="", rejection_count=u32(0), ai_feedback=""
            )
            
        return cid

    @gl.public.write.payable
    def fund_campaign(self, campaign_id: u32) -> None:
        cid = u32(campaign_id)
        deposit = u256(gl.message.value)
        backer = gl.message.sender_address

        c = self._get_campaign_or_raise(cid)
        if c.status != "FUNDING":
            raise gl.vm.UserError("Campaign is not accepting funds")
        if deposit == u256(0):
            raise gl.vm.UserError("Must send a positive amount")

        contrib_key = f"{int(cid)}_{str(backer)}"
        prev_contrib = self.campaign_contributions.get(contrib_key, u256(0))
        self.campaign_contributions[contrib_key] = u256(int(prev_contrib) + int(deposit))

        new_total = u256(int(c.total_funded) + int(deposit))
        new_status = "ACTIVE" if int(new_total) >= int(c.funding_goal) else "FUNDING"

        self.campaigns[cid] = Campaign(
            campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
            funding_goal=c.funding_goal, total_funded=new_total, 
            remaining_funds=u256(int(c.remaining_funds) + int(deposit)),
            current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, status=new_status
        )

    @gl.public.write
    def revoke_funding(self, campaign_id: u32) -> None:
        """Allows backers to withdraw funds if the campaign is indefinitely underfunded (stuck in FUNDING)."""
        cid = u32(campaign_id)
        player = gl.message.sender_address
        c = self._get_campaign_or_raise(cid)
        
        if c.status != "FUNDING":
            raise gl.vm.UserError("Can only revoke funds during the FUNDING phase")

        contrib_key = f"{int(cid)}_{str(player)}"
        user_contrib = self.campaign_contributions.get(contrib_key, u256(0))
        if user_contrib == u256(0):
            raise gl.vm.UserError("No contribution found")

        # CEI: Apply Effects First
        self.campaign_contributions[contrib_key] = u256(0)
        self.campaigns[cid] = Campaign(
            campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
            funding_goal=c.funding_goal, 
            total_funded=u256(int(c.total_funded) - int(user_contrib)), 
            remaining_funds=u256(int(c.remaining_funds) - int(user_contrib)),
            current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, status=c.status
        )

        # CEI: Interaction
        _Recipient(Address(str(player))).emit_transfer(value=user_contrib)

    @gl.public.write
    def cancel_campaign(self, campaign_id: u32) -> None:
        cid = u32(campaign_id)
        c = self._get_campaign_or_raise(cid)
        
        if gl.message.sender_address != c.creator:
            raise gl.vm.UserError("Unauthorized: Only creator can cancel")
        if c.status != "FUNDING":
            raise gl.vm.UserError("Campaign can only be cancelled during FUNDING phase")

        self.campaigns[cid] = Campaign(
            campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
            funding_goal=c.funding_goal, total_funded=c.total_funded, remaining_funds=c.remaining_funds,
            current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, status="CANCELLED"
        )

    @gl.public.write
    def submit_milestone(self, campaign_id: u32, evidence_text: str) -> None:
        cid = u32(campaign_id)
        text = str(evidence_text)
        c = self._get_campaign_or_raise(cid)
        
        if gl.message.sender_address != c.creator:
            raise gl.vm.UserError("Unauthorized")
        if c.status != "ACTIVE":
            raise gl.vm.UserError("Campaign is not ACTIVE")
        if len(text) == 0:
            raise gl.vm.UserError("Evidence text cannot be empty")

        m_key = f"{int(cid)}_{int(c.current_milestone_index)}"
        m = self.campaign_milestones.get(m_key, None)
        
        if m is None or m.status not in ["PENDING", "REJECTED"]:
            raise gl.vm.UserError("Invalid milestone state")

        self.campaign_milestones[m_key] = Milestone(
            campaign_id=m.campaign_id, index=m.index, title=m.title, description=m.description,
            ratio_bps=m.ratio_bps, status="SUBMITTED", evidence_text=text, 
            rejection_count=m.rejection_count, ai_feedback=m.ai_feedback
        )

    @gl.public.write
    def adjudicate_milestone(self, campaign_id: u32) -> None:
        cid = u32(campaign_id)
        c = self._get_campaign_or_raise(cid)
        
        if c.status != "ACTIVE":
            raise gl.vm.UserError("Campaign is not ACTIVE")

        m_key = f"{int(cid)}_{int(c.current_milestone_index)}"
        m = self.campaign_milestones.get(m_key, None)
        
        if m is None or m.status != "SUBMITTED":
            raise gl.vm.UserError("Milestone not awaiting adjudication")

        result = _evaluate_milestone_nondet(str(m.title), str(m.description), str(m.evidence_text))
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
            
            # CEI: Apply Effects First
            self.campaign_milestones[m_key] = Milestone(
                campaign_id=m.campaign_id, index=m.index, title=m.title, description=m.description, 
                ratio_bps=m.ratio_bps, status="APPROVED", evidence_text=m.evidence_text, 
                rejection_count=m.rejection_count, ai_feedback=str(feedback)
            )
            
            self.campaigns[cid] = Campaign(
                campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
                funding_goal=c.funding_goal, total_funded=c.total_funded, 
                remaining_funds=u256(int(c.remaining_funds) - actual_payout),
                current_milestone_index=new_idx, milestone_count=c.milestone_count, status="COMPLETED" if is_final else "ACTIVE"
            )
            
            # CEI: Interactions (Native Transfers)
            if creator_payout > 0:
                _Recipient(Address(str(c.creator))).emit_transfer(value=u256(creator_payout))
            if plat_fee > 0:
                _Recipient(Address(str(self.platform_owner))).emit_transfer(value=u256(plat_fee))
                
        else:
            new_rejects = u32(int(m.rejection_count) + 1)
            new_status = "FAILED" if int(new_rejects) >= 2 else "ACTIVE"
            
            self.campaign_milestones[m_key] = Milestone(
                campaign_id=m.campaign_id, index=m.index, title=m.title, description=m.description, 
                ratio_bps=m.ratio_bps, status="REJECTED", evidence_text=m.evidence_text, 
                rejection_count=new_rejects, ai_feedback=str(feedback)
            )
            
            self.campaigns[cid] = Campaign(
                campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
                funding_goal=c.funding_goal, total_funded=c.total_funded, remaining_funds=c.remaining_funds,
                current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, status=new_status
            )

    @gl.public.write
    def claim_refund(self, campaign_id: u32) -> None:
        cid = u32(campaign_id)
        player = gl.message.sender_address
        
        c = self._get_campaign_or_raise(cid)
        if c.status not in ["FAILED", "CANCELLED"]:
            raise gl.vm.UserError("Refunds not available")

        contrib_key = f"{int(cid)}_{str(player)}"
        user_contrib = self.campaign_contributions.get(contrib_key, u256(0))
        if user_contrib == u256(0):
            raise gl.vm.UserError("No claimable contribution found")

        # Fixed: Direct full refund of user contribution in CANCELLED/FAILED states
        r_amount = int(user_contrib)
        
        if r_amount <= 0 or r_amount > int(c.remaining_funds):
            raise gl.vm.UserError("Invalid refund math")

        # CEI: Apply Effects First
        self.campaign_contributions[contrib_key] = u256(0)
        self.campaigns[cid] = Campaign(
            campaign_id=c.campaign_id, creator=c.creator, title=c.title, description=c.description,
            funding_goal=c.funding_goal, total_funded=c.total_funded, 
            remaining_funds=u256(int(c.remaining_funds) - r_amount),
            current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, status=c.status
        )

        # CEI: Interactions (Native Transfer)
        _Recipient(Address(str(player))).emit_transfer(value=u256(r_amount))

    # =====================================================================
    # VIEW METHODS
    # =====================================================================
    @gl.public.view
    def get_campaign(self, campaign_id: u32) -> CampaignView:
        try:
            cid = u32(campaign_id)
            c = self.campaigns.get(cid, None)
            if c is None:
                return CampaignView(False, u32(0), "", "", u256(0), u256(0), u256(0), u32(0), u32(0), "")
            return CampaignView(
                exists=True, campaign_id=c.campaign_id, creator=str(c.creator), title=c.title,
                funding_goal=c.funding_goal, total_funded=c.total_funded, remaining_funds=c.remaining_funds,
                current_milestone_index=c.current_milestone_index, milestone_count=c.milestone_count, status=c.status
            )
        except Exception:
            return CampaignView(False, u32(0), "", "", u256(0), u256(0), u256(0), u32(0), u32(0), "")

    @gl.public.view
    def get_milestone(self, campaign_id: u32, milestone_index: u32) -> MilestoneView:
        try:
            m_key = f"{int(u32(campaign_id))}_{int(u32(milestone_index))}"
            m = self.campaign_milestones.get(m_key, None)
            if m is None:
                return MilestoneView(False, u32(0), "", u32(0), "", "", u32(0), "")
                
            return MilestoneView(
                exists=True, index=m.index, title=m.title, ratio_bps=m.ratio_bps,
                status=m.status, evidence_text=m.evidence_text, 
                rejection_count=m.rejection_count, ai_feedback=m.ai_feedback
            )
        except Exception:
            return MilestoneView(False, u32(0), "", u32(0), "", "", u32(0), "")
