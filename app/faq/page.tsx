"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import { ChevronDown, ChevronUp, HelpCircle, MessageCircle, Mail, ExternalLink } from "lucide-react";
import Link from "next/link";

const FAQ_DATA = [
  {
    category: "Getting Started",
    questions: [
      {
        q: "What is IXXXI Protocol?",
        a: "IXXXI is a next-generation music streaming platform that combines the best of Web3 technology with traditional streaming. Artists can tokenize their music, and listeners can stream, collect, and trade tracks while supporting their favorite creators directly."
      },
      {
        q: "Do I need a crypto wallet to use IXXXI?",
        a: "No! IXXXI supports both Web3 wallets (like Phantom and Solflare) and traditional email/password authentication. You can start streaming immediately with just an email address, then optionally connect a wallet later to access premium features."
      },
      {
        q: "How do I connect my wallet?",
        a: "Click the 'Connect Wallet' button in the header. We support Phantom, Solflare, and other Solana-compatible wallets. If you don't have a wallet yet, we can create an embedded wallet for you automatically."
      },
      {
        q: "Is IXXXI free to use?",
        a: "Yes! Basic streaming is free for all users. Premium features like token-gated content, trading, and exclusive releases require either a subscription or holding specific tokens."
      }
    ]
  },
  {
    category: "For Listeners",
    questions: [
      {
        q: "How does music trading work?",
        a: "Each track on IXXXI has an associated token. When you buy a track token, you're not just purchasing the song—you're investing in its success. As more people stream and trade the track, its value can increase."
      },
      {
        q: "What are token-gated tracks?",
        a: "Some artists release exclusive content that's only accessible to holders of their tokens. To listen, you need to hold a minimum amount of the required token in your wallet."
      },
      {
        q: "How do I earn rewards?",
        a: "Active listeners earn IXXXI tokens through various activities: streaming music, discovering new artists early, participating in the community, and referring friends. These tokens can be used for governance, premium access, or trading."
      },
      {
        q: "Can I listen offline?",
        a: "Premium subscribers can download tracks for offline listening. Downloaded content is encrypted and tied to your account for security."
      }
    ]
  },
  {
    category: "For Artists",
    questions: [
      {
        q: "How do I upload my music to IXXXI?",
        a: "Artists can apply through our Artist Portal. Once approved, you can upload tracks, set pricing, configure token-gating, and start earning immediately. We support all major audio formats."
      },
      {
        q: "What percentage do artists earn?",
        a: "Artists keep 90% of all streaming revenue and 85% of initial token sales. This is significantly higher than traditional streaming platforms. Ongoing token trading also generates royalties for artists."
      },
      {
        q: "Can I token-gate my music?",
        a: "Absolutely! You can require listeners to hold your artist token, any SPL token, or even specific NFTs to access exclusive content. This creates scarcity and rewards your most dedicated fans."
      },
      {
        q: "How do payouts work?",
        a: "Earnings are tracked in real-time on your dashboard. You can withdraw to your connected Solana wallet at any time with no minimum. We also support traditional payment methods for verified artists."
      }
    ]
  },
  {
    category: "Technical",
    questions: [
      {
        q: "What blockchain does IXXXI use?",
        a: "IXXXI is built on Solana for its high speed, low fees, and excellent developer ecosystem. Transactions settle in seconds and cost fractions of a penny."
      },
      {
        q: "Is my data secure?",
        a: "Yes. Audio streams are DRM-protected and cannot be downloaded or redistributed without authorization. Your wallet keys never leave your device, and we use industry-standard encryption for all data."
      },
      {
        q: "What if Solana goes down?",
        a: "While rare, if the Solana network experiences issues, streaming continues normally using our centralized infrastructure. Token trading and blockchain features would be temporarily unavailable until the network recovers."
      }
    ]
  }
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left hover:text-green-400 transition-colors"
      >
        <span className="font-medium text-white pr-4">{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-green-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="pb-4 text-gray-400 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
        {/* Header */}
        <div className="text-center mb-12">
          <HelpCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-gray-400 text-lg">
            Everything you need to know about IXXXI Protocol
          </p>
        </div>

        {/* FAQ Sections */}
        {FAQ_DATA.map((section) => (
          <div key={section.category} className="mb-10">
            <h2 className="text-xl font-bold text-green-400 mb-4 pb-2 border-b border-green-400/30">
              {section.category}
            </h2>
            <div>
              {section.questions.map((item, i) => (
                <FAQItem key={i} question={item.q} answer={item.a} />
              ))}
            </div>
          </div>
        ))}

        {/* Contact Section */}
        <div className="mt-12 bg-gray-900/50 border border-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Still have questions?</h2>
          <p className="text-gray-400 mb-6">
            Can&apos;t find what you&apos;re looking for? Our team is here to help.
          </p>
          <div className="flex flex-wrap gap-4">
            <a 
              href="mailto:support@ixxxi.io"
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email Support
            </a>
            <a 
              href="https://discord.gg/ixxxi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Join Discord
            </a>
            <Link 
              href="/whitepaper"
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Read Whitepaper
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
