# IXXXI Protocol - Build Blueprint

## 🎯 Vision
Spotify meets Uniswap. Stream music, support artists, invest in culture.

---

## ✅ PHASE 1: Foundation (COMPLETE)
- [x] Next.js 14 + TypeScript setup
- [x] Prisma schema (10 models)
- [x] Solana wallet integration
- [x] 3D Globe visualization
- [x] Command palette
- [x] Toast notifications
- [x] Basic auth flow

## ✅ PHASE 2: Web2.5 UX (COMPLETE)
- [x] Email verification login
- [x] Embedded wallet creation
- [x] Modern header with dropdown
- [x] User-friendly language (no crypto jargon)
- [x] TV Mode with globe

## 🔄 PHASE 3: Content & Playback (IN PROGRESS)
- [ ] Audio upload to IPFS/Arweave
- [ ] Waveform visualization
- [ ] Queue management
- [ ] Offline caching (PWA)
- [ ] DRM/content protection
- [ ] Music video player

## 📋 PHASE 4: Social Features
- [ ] Artist follow system
- [ ] Track likes
- [ ] Playlists (create/share)
- [ ] Activity feed
- [ ] Comments on tracks
- [ ] Share to social media

## 📋 PHASE 5: Token Economics
- [ ] $IXXXI token contract (Solana)
- [ ] Staking on tracks
- [ ] Revenue distribution
- [ ] Artist verification staking
- [ ] Tier system (free/holder/premium/whale)
- [ ] Referral rewards

## 📋 PHASE 6: Discovery
- [ ] Search (tracks, artists, playlists)
- [ ] Genre browsing
- [ ] Location-based discovery (globe)
- [ ] Trending tracks
- [ ] Recommended for you
- [ ] Radio mode

## 📋 PHASE 7: Artist Tools
- [ ] Analytics dashboard (detailed)
- [ ] Release scheduling
- [ ] Fan messaging
- [ ] Merch integration
- [ ] Concert/event tickets
- [ ] Splits (collaborator payments)

## 📋 PHASE 8: Mobile & Scale
- [ ] PWA optimization
- [ ] Push notifications
- [ ] React Native app
- [ ] CDN for audio delivery
- [ ] PostgreSQL migration
- [ ] Redis caching

---

## 🔧 Technical Debt
- [ ] Add comprehensive tests
- [ ] Error boundaries
- [ ] Rate limiting on all APIs
- [ ] Logging/monitoring (Sentry)
- [ ] API documentation (OpenAPI)

---

## 🚀 Deploy Checklist
1. Push to GitHub
2. Connect to Vercel
3. Add environment variables:
   - `DATABASE_URL` (PostgreSQL)
   - `WALLET_ENCRYPTION_KEY`
   - `NEXT_PUBLIC_SOLANA_NETWORK`
   - `NEXT_PUBLIC_SOLANA_RPC`
4. Deploy!

---

## 📝 Current Sprint Tasks

### Priority 1 (This Week)
1. Connect real audio upload (IPFS via web3.storage)
2. Implement waveform generation
3. Add track queue system
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
