'use client';

import { Github, Twitter, Scale, Bot, ShieldCheck, Cpu } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12 py-6">
      <section className="space-y-4 text-center">
        <p className="eyebrow text-brass-400">Protocol Specification</p>
        <h1 className="font-display text-4xl italic tracking-tight text-paper-100">
          About PledgeLayer
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-paper-400">
          On-chain crowdfunding secured by GenLayer&rsquo;s decentralized AI consensus. No committees,
          no centralized disputes &mdash; just verified evidence and autonomous adjudication.
        </p>
      </section>

      <section className="ledger-card space-y-6 p-6 sm:p-8">
        <h2 className="font-display text-2xl text-paper-100">How It Works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-brass-500/40 bg-brass-500/10 text-brass-400">
              <Cpu size={18} />
            </span>
            <h3 className="font-display text-base text-paper-100">1. Milestone Payouts</h3>
            <p className="text-xs text-paper-400 leading-relaxed">
              Campaigns are divided into strict milestones with exact percentage ratios. Funds stay locked in smart contract escrow.
            </p>
          </div>
          <div className="space-y-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-brass-500/40 bg-brass-500/10 text-brass-400">
              <Bot size={18} />
            </span>
            <h3 className="font-display text-base text-paper-100">2. AI Adjudication</h3>
            <p className="text-xs text-paper-400 leading-relaxed">
              Creators submit evidence. Independent LLM nodes on GenLayer evaluate deliverables against requirements under consensus.
            </p>
          </div>
          <div className="space-y-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-brass-500/40 bg-brass-500/10 text-brass-400">
              <ShieldCheck size={18} />
            </span>
            <h3 className="font-display text-base text-paper-100">3. Safe Escrow</h3>
            <p className="text-xs text-paper-400 leading-relaxed">
              Funds release automatically upon approval. If a campaign fails or cancels, backers can claim proportional refunds safely.
            </p>
          </div>
        </div>
      </section>

      <section className="ledger-card flex flex-col items-center gap-6 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-brass-500/40 bg-brass-500/10 text-brass-400">
          <Scale size={22} />
        </span>
        <div className="space-y-2">
          <h2 className="font-display text-xl text-paper-100">Open Source & Connected</h2>
          <p className="text-sm text-paper-400 max-w-md mx-auto">
            Explore the smart contract logic, contribute to the frontend codebase, or reach out to the creator.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <a
            href="https://github.com/reza9133/pledgelayer"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <Github size={16} /> GitHub Repository
          </a>
          <a
            href="https://x.com/amirhp771"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <Twitter size={16} /> Twitter / X
          </a>
        </div>
      </section>

      <footer className="text-center font-mono text-xs text-paper-400 pt-4 border-t border-ink-600">
        Designed & Developed with precision by <span className="text-brass-400">Amir</span>
      </footer>
    </div>
  );
}
