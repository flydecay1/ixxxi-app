# IXXXI Protocol - Build Blueprint v1.0.0

## 🎯 Vision
Spotify meets Uniswap. Stream music, support artists, invest in culture.

---

## ✅ COMPLETED VERSIONS

### v0.1.0 - v0.3.0: Foundation
- [x] Next.js 14 + TypeScript setup
- [x] Prisma schema with PostgreSQL (Railway)
- [x] Solana wallet integration (@solana/wallet-adapter)
- [x] 3D Globe visualization (three.js)
- [x] Command palette (cmdk)
- [x] Toast notifications
- [x] Email verification login
- [x] Modern header with dropdown

### v0.4.0: UI Features
- [x] Theme system (10 themes)
- [x] Bloomberg Terminal component
- [x] TV Mode with globe
- [x] Trading page
- [x] Premiere system
- [x] Charts page
- [x] User profiles

### v0.5.0: Audio Infrastructure
- [x] Cloudflare R2 storage integration
- [x] Audio upload API with validation
- [x] Streaming endpoint with quality presets
- [x] DRM/content protection (watermarking, encryption)
- [x] Play tracking with analytics
- [x] Artist dashboard API

### v0.6.0: Web3 Integration
- [x] NFT minting (Metaplex)
- [x] Solana Pay (SOL/USDC payments)
- [x] Artist SPL tokens
- [x] On-chain royalty splits
- [x] Tier verification system

### v0.7.0: Social Features
- [x] Follow/unfollow system
- [x] Track likes with toggle
- [x] Comments with replies
- [x] Playlist CRUD
- [x] Activity feed (following)

### v0.8.0: Premium Features
- [x] Listening history tracking
- [x] Personalized recommendations
- [x] Offline downloads (tier-gated)
- [x] Early access releases
- [x] Exclusive content gating

### v0.9.0: Analytics & Insights
- [x] Artist dashboard analytics
- [x] Real-time metrics API
- [x] Revenue tracking
- [x] Audience insights
- [x] Platform analytics (admin)

### v1.0.0: Launch Readiness
- [x] Comprehensive health monitoring
- [x] Rate limiting middleware
- [x] Security headers (XSS, CORS)
- [x] Cron jobs (stats sync, cleanup)
- [x] API documentation

### v1.1.0: Search & Discovery
- [x] Full-text search API (tracks, artists, playlists, users)
- [x] Genre browsing with metadata
- [x] Radio mode (seed-based playlist generation)
- [x] Search hooks (useSearch, useGenres, useRadio, useTrending)

### v1.2.0: PWA & Mobile
- [x] PWA manifest with app shortcuts
- [x] Service worker (offline caching, background sync)
- [x] Offline fallback page
- [x] Share target for audio files

### v1.3.0: Messaging & Notifications
- [x] Direct messaging (user-to-user)
- [x] Artist broadcast messaging
- [x] Push notification subscription
- [x] Notification templates (releases, follows, earnings)
- [x] Redis caching layer

---

## 🚀 NEXT: v1.4.0+ Roadmap

### v1.4.0: Enhanced Player
- [x] Queue management (add, reorder, clear)
- [x] Shuffle and repeat modes
- [x] Crossfade between tracks
- [x] Lyrics display (synced)
- [x] Equalizer presets (12 built-in)

### v1.5.0: Artist Tools
- [x] Batch upload (albums/EPs)
- [x] Release scheduling & management
- [x] Revenue withdrawal (SOL/USDC)
- [x] Collaboration invites

### v1.6.0: Social v2
- [x] Direct mentions (@username)
- [x] Shared playlists (collaborative)
- [x] Stories/highlights (24h ephemeral)
- [ ] Live streaming integration
- [ ] Fan clubs

### v1.7.0: Monetization
- [ ] Subscription tiers
- [ ] Tipping/donations
- [ ] Crowdfunding for releases
- [ ] Merch integration
- [ ] Event ticketing

---

## 🛠️ API Reference

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/email` | POST | Send magic link email |
| `/api/auth/verify` | GET | Verify magic link token |
| `/api/signup` | POST | Register new user |
| `/api/login` | POST | Login user |

### Users
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user` | GET | Get user profile |
| `/api/user` | PATCH | Update user profile |
| `/api/user/history` | GET/POST/DELETE | Listening history |
| `/api/user/stats` | GET | User statistics |
| `/api/user/tier` | GET | Token tier status |
| `/api/user/transactions` | GET | Transaction history |

### Artists
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/artist` | GET/POST | Artist profile CRUD |
| `/api/artist/apply` | POST | Apply for artist status |
| `/api/artist/dashboard` | GET | Artist analytics |
| `/api/artist/token` | POST | Create fan token |

### Tracks
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tracks` | GET | List tracks |
| `/api/tracks/[id]` | GET/PATCH/DELETE | Track CRUD |
| `/api/track` | GET | Single track by ticker |
| `/api/track/play` | POST | Record play |
| `/api/upload` | POST | Upload audio file |
| `/api/stream/[token]` | GET | Stream audio |
| `/api/download` | GET/POST/DELETE | Offline downloads |

### Social
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/social/follow` | GET/POST/DELETE | Follow system |
| `/api/social/like` | GET/POST/DELETE | Track likes |
| `/api/social/comment` | GET/POST/PATCH/DELETE | Comments |
| `/api/social/activity` | GET | Activity feed |
| `/api/playlist` | GET/POST/PATCH/DELETE | Playlists |
| `/api/playlist/tracks` | POST/DELETE | Playlist tracks |

### Web3
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/nft/mint` | POST | Mint track NFT |
| `/api/purchase` | POST | Buy track/NFT |
| `/api/gate` | GET | Check token gate |

### Premium
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recommendations` | GET | Personalized recommendations |
| `/api/early-access` | GET/POST/DELETE | Early access releases |
| `/api/exclusive` | GET/POST/PATCH | Exclusive content |
| `/api/premiere/[id]` | GET | Premiere details |

### Analytics
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/artist` | GET | Artist dashboard |
| `/api/analytics/realtime` | GET | Live metrics |
| `/api/analytics/revenue` | GET | Revenue tracking |
| `/api/analytics/audience` | GET | Audience insights |
| `/api/analytics/platform` | GET | Platform stats (admin) |

### System
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET/POST | Health checks |
| `/api/cron/sync-stats` | GET | Sync daily stats |
| `/api/cron/cleanup` | GET | Database cleanup |

### Search & Discovery
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search` | GET | Full-text search |
| `/api/genres` | GET | Browse genres |
| `/api/radio` | GET | Generate radio playlist |

### Messaging
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messages` | GET/POST/PATCH/DELETE | Direct messages |
| `/api/messages/broadcast` | GET/POST | Artist broadcasts |
| `/api/notifications/subscribe` | POST/DELETE | Push subscriptions |
| `/api/notifications/send` | POST | Send push notification |

### Social v2
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/social/mentions` | GET/POST/PATCH | @mentions system |
| `/api/playlist/collaborate` | GET/POST/DELETE | Collaborative playlists |
| `/api/social/stories` | GET/POST/PATCH/DELETE | Ephemeral stories (24h) |

---

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, custom themes
- **Database**: PostgreSQL (Railway)
- **ORM**: Prisma 5.20
- **Storage**: Cloudflare R2
- **Blockchain**: Solana, Metaplex
- **Deployment**: Railway (auto-deploy from GitHub)

### Token Tiers
| Tier | Tokens | Audio Quality | Benefits |
|------|--------|---------------|----------|
| Free | 0 | 128kbps | 10 plays/day |
| Holder | 100+ | 256kbps | Ad-free, 5% discount |
| Premium | 1,000+ | 320kbps | Unlimited, offline, early access |
| Whale | 10,000+ | FLAC/Lossless | All features, VIP, governance |

### Database Models
- User, Artist, Track, Play
- Follow, Like, Comment
- Playlist, PlaylistTrack, PlaylistCollaborator
- Purchase, Transaction
- Download, DailyStats, Stake
- Message, Broadcast, Notification, PushSubscription
- Release, Withdrawal, Collaboration
- Mention, Story, StoryView

---

## 🔗 Links
- **Production**: https://ixxxi-app-production.up.railway.app
- **GitHub**: https://github.com/flydecay1/ixxxi-app
- **Database**: Railway PostgreSQL

---

## 📊 Metrics to Track
- Daily Active Users (DAU)
- Total Plays / Unique Listeners
- Revenue (purchases, platform fees)
- Artist Growth (new artists, verifications)
- Token Holder Distribution
- Completion Rate (% tracks finished)
4. Build playlist CRUD

### Priority 2 (Next Week)
1. Artist follow/unfollow
2. Track likes
3. Activity feed
4. Search functionality

---

## 🤖 AI Instructions

When building new features:
1. Check this blueprint for context
2. Follow existing patterns in codebase
3. Use Prisma schema as source of truth
4. Always run `npm run build` after changes
5. Test with `npm run dev`

### Code Style
- TypeScript strict mode
- Tailwind for styling
- Framer Motion for animations
- React Query for data fetching (when added)
- Zod for validation (when added)

### File Structure
```
app/
  api/          # API routes
  [page]/       # Page routes
components/     # Shared components
context/        # React contexts
hooks/          # Custom hooks
lib/            # Utilities
prisma/         # Database schema
public/         # Static assets
```
