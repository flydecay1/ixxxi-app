"use client";

import React from "react";
import Header from "@/components/Header";
import { FileText, ArrowRight, ExternalLink, Download, BookOpen } from "lucide-react";
import Link from "next/link";

const WHITEPAPER_SECTIONS = [
  {
    id: "abstract",
    title: "Abstract",
    content: `IXXXI Protocol represents a paradigm shift in music streaming and distribution. By leveraging Solana's high-performance blockchain, we create a transparent, artist-centric ecosystem where creators maintain ownership, listeners become stakeholders, and value flows directly between participants without intermediaries.

Our protocol introduces Music Tokens—fungible assets representing ownership stakes in individual tracks. These tokens enable a new model of music consumption where streaming, trading, and collecting converge into a unified experience.`
  },
  {
    id: "problem",
    title: "1. The Problem",
    content: `The music industry's current economic model is fundamentally broken:

**For Artists:**
- Average per-stream payout: $0.003-0.004
- Complex royalty structures with 30-60 day payment delays
- Loss of ownership rights through label deals
- Limited direct connection with fans

**For Listeners:**
- No ownership of music despite subscription fees
- No way to support artists beyond streaming
- Limited access to exclusive content
- No participation in artist success

**Market Size:**
The global music streaming market is valued at $30+ billion, yet artists receive less than 15% of total revenue. IXXXI Protocol captures this value and redistributes it fairly.`
  },
  {
    id: "solution",
    title: "2. The IXXXI Solution",
    content: `IXXXI Protocol introduces a three-layer architecture:

**Layer 1: Streaming Infrastructure**
- High-quality audio streaming with DRM protection
- Global CDN for low-latency playback
- Cross-platform compatibility (web, mobile, TV)

**Layer 2: Tokenization Engine**
- Each track mints a unique SPL token on Solana
- Supply, pricing, and distribution controlled by artists
- Automatic royalty distribution on every transaction

**Layer 3: Exchange Protocol**
- Integrated AMM (Automated Market Maker) for track trading
- Liquidity pools enable instant buy/sell
- Price discovery through market dynamics`
  },
  {
    id: "tokenomics",
    title: "3. Tokenomics",
    content: `**IXXXI Governance Token**
- Total Supply: 1,000,000,000 IXXXI
- Utility: Platform governance, fee discounts, staking rewards
- Distribution:
  - 40% Community rewards & ecosystem
  - 25% Team & advisors (4-year vesting)
  - 20% Treasury
  - 10% Private sale
  - 5% Public sale

**Music Tokens**
- Created per-track by artists
- Variable supply set by creator
- Trading fees: 2.5% (split: 85% artist, 15% protocol)

**Revenue Sharing**
- Streaming: 90% to artist, 10% protocol
- Token sales: 85% to artist, 15% protocol
- Secondary trading: 85% to artist royalty, 15% protocol`
  },
  {
    id: "technology",
    title: "4. Technology Stack",
    content: `**Blockchain: Solana**
- 65,000 TPS capacity
- Sub-second finality
- $0.00025 average transaction cost

**Smart Contracts**
- Track Token Program (SPL Token standard)
- Exchange Program (Constant Product AMM)
- Royalty Distribution Program
- Access Control Program (Token-gating)

**Infrastructure**
- Next.js frontend with React
- Edge-deployed API routes
- PostgreSQL for metadata
- IPFS/Arweave for permanent storage
- CloudFlare CDN for streaming`
  },
  {
    id: "roadmap",
    title: "5. Roadmap",
    content: `**Phase 1: Foundation (Q4 2024)**
- ✅ Core streaming platform
- ✅ Wallet integration
- ✅ Basic token-gating
- ✅ Artist onboarding

**Phase 2: Exchange (Q1 2025)**
- Track tokenization
- AMM exchange launch
- Mobile apps (iOS/Android)
- Creator analytics dashboard

**Phase 3: Ecosystem (Q2 2025)**
- IXXXI governance token launch
- DAO governance activation
- Cross-chain bridges
- Label & distributor integrations

**Phase 4: Scale (Q3-Q4 2025)**
- 1M+ active users target
- Major artist partnerships
- Live event ticketing
- Music NFT marketplace`
  },
  {
    id: "team",
    title: "6. Team & Advisors",
    content: `**Core Team**
- Experienced builders from Spotify, SoundCloud, Solana Labs
- Combined 50+ years in music tech and blockchain
- Backed by leading Web3 investors

**Advisors**
- Industry veterans from major labels
- DeFi protocol founders
- Music rights and licensing experts

**Partners**
- Solana Foundation
- Major indie distributors
- Web3 music collectives`
  },
  {
    id: "conclusion",
    title: "7. Conclusion",
    content: `IXXXI Protocol reimagines the relationship between artists and listeners. By tokenizing music and creating liquid markets, we enable:

- **Artists** to capture fair value and build direct relationships with fans
- **Listeners** to become stakeholders in the music they love
- **The industry** to evolve toward transparency and efficiency

The future of music is decentralized, and IXXXI Protocol is building the infrastructure to make it happen.

Join us in revolutionizing the music industry.`
  }
];

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
        {/* Header */}
        <div className="text-center mb-12">
          <FileText className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-2">IXXXI Protocol</h1>
          <p className="text-xl text-gray-400 mb-4">Technical Whitepaper v1.0</p>
          <p className="text-sm text-gray-500">Last updated: December 2024</p>
        </div>

        {/* Download/Navigation */}
        <div className="flex flex-wrap gap-4 mb-12 p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
          <a 
            href="#"
            className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
          <div className="flex-1" />
          <div className="text-sm text-gray-500">
            Estimated read time: 15 minutes
          </div>
        </div>

        {/* Table of Contents */}
        <div className="mb-12 p-6 bg-gray-900/30 border border-gray-800 rounded-lg">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-green-400" />
            Table of Contents
          </h2>
          <nav className="space-y-2">
            {WHITEPAPER_SECTIONS.map((section, i) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                {section.title}
              </a>
            ))}
          </nav>
        </div>

        {/* Content Sections */}
        {WHITEPAPER_SECTIONS.map((section) => (
          <section 
            key={section.id} 
            id={section.id}
            className="mb-12 scroll-mt-8"
          >
            <h2 className="text-2xl font-bold text-green-400 mb-4 pb-2 border-b border-green-400/30">
              {section.title}
            </h2>
            <div className="prose prose-invert prose-green max-w-none">
              {section.content.split('\n\n').map((paragraph, i) => (
                <p key={i} className="text-gray-300 leading-relaxed mb-4 whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}

        {/* Footer CTA */}
        <div className="mt-16 text-center p-8 bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/30 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Ready to Build the Future of Music?</h2>
          <p className="text-gray-400 mb-6">
            Join thousands of artists and listeners already on IXXXI Protocol
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/signup"
              className="px-6 py-3 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
            >
              Get Started
            </Link>
            <Link 
              href="/artist/apply"
              className="px-6 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
            >
              Apply as Artist
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
