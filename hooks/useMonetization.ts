// hooks/useMonetization.ts
// Hooks for subscription, tipping, crowdfunding, merch, and events

import { useState, useEffect, useCallback } from 'react';

// ============ SUBSCRIPTION ============

interface SubscriptionTier {
  id: string;
  name: string;
  price?: number;
  priceSOL?: number;
  priceUSDC?: number;
  interval: string | null;
  features: string[];
  limits: {
    playsPerDay: number;
    audioQuality: string;
    offlineDownloads: number;
    skipLimit: number;
    earlyAccessDays?: number;
  };
}

interface Subscription {
  id: string;
  tier: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export function useSubscription(userId: string | null) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/subscription?userId=${userId}`);
      const data = await res.json();
      if (res.ok) {
        setSubscription(data.subscription);
        setTier(data.tier);
        setIsActive(data.isActive);
        setDaysRemaining(data.daysRemaining);
      }
    } catch (err) {
      console.error('Fetch subscription error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const subscribe = useCallback(async (tierId: string, currency: 'SOL' | 'USDC', txSignature?: string) => {
    if (!userId) return null;
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier: tierId, currency, txSignature }),
      });
      const data = await res.json();
      if (res.ok) { fetchSubscription(); return data; }
      return { error: data.error };
    } catch (err) { return { error: 'Failed to subscribe' }; }
  }, [userId, fetchSubscription]);

  const cancel = useCallback(async () => {
    if (!userId) return false;
    try {
      const res = await fetch('/api/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'cancel' }),
      });
      if (res.ok) { fetchSubscription(); return true; }
      return false;
    } catch (err) { return false; }
  }, [userId, fetchSubscription]);

  const reactivate = useCallback(async () => {
    if (!userId) return false;
    try {
      const res = await fetch('/api/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'reactivate' }),
      });
      if (res.ok) { fetchSubscription(); return true; }
      return false;
    } catch (err) { return false; }
  }, [userId, fetchSubscription]);

  return {
    subscription, tier, isActive, daysRemaining, loading,
    subscribe, cancel, reactivate, refresh: fetchSubscription,
  };
}

export function useSubscriptionTiers() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTiers = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/subscription?action=tiers');
        const data = await res.json();
        if (res.ok) setTiers(data.tiers || []);
      } catch (err) {
        console.error('Fetch tiers error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTiers();
  }, []);

  return { tiers, loading };
}

// ============ TIPPING ============

interface Tip {
  id: string;
  amount: number;
  currency: string;
  message?: string;
  createdAt: string;
  artist?: { id: string; name: string; avatarUrl?: string };
  sender?: { id: string; username: string; avatarUrl?: string };
  track?: { id: string; title: string; coverUrl?: string };
}

export function useTipping(userId: string | null) {
  const [sentTips, setSentTips] = useState<Tip[]>([]);
  const [totalSent, setTotalSent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchSentTips = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tip?userId=${userId}&type=sent`);
      const data = await res.json();
      if (res.ok) {
        setSentTips(data.tips || []);
        setTotalSent(data.totalSent || 0);
      }
    } catch (err) {
      console.error('Fetch tips error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchSentTips(); }, [fetchSentTips]);

  const sendTip = useCallback(async (params: {
    artistId: string;
    amount: number;
    currency?: 'SOL' | 'USDC';
    message?: string;
    trackId?: string;
    txSignature?: string;
    isAnonymous?: boolean;
  }) => {
    if (!userId) return null;
    setSending(true);
    try {
      const res = await fetch('/api/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: userId, ...params }),
      });
      const data = await res.json();
      if (res.ok) { fetchSentTips(); return data; }
      return { error: data.error };
    } catch (err) {
      return { error: 'Failed to send tip' };
    } finally {
      setSending(false);
    }
  }, [userId, fetchSentTips]);

  return { sentTips, totalSent, loading, sending, sendTip, refresh: fetchSentTips };
}

export function useArtistTips(artistId: string | null) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const [topSupporters, setTopSupporters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTips = useCallback(async () => {
    if (!artistId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tip?artistId=${artistId}`);
      const data = await res.json();
      if (res.ok) {
        setTips(data.tips || []);
        setTotalReceived(data.totalReceived || 0);
        setTopSupporters(data.topSupporters || []);
      }
    } catch (err) {
      console.error('Fetch artist tips error:', err);
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => { fetchTips(); }, [fetchTips]);

  return { tips, totalReceived, topSupporters, loading, refresh: fetchTips };
}

// ============ CROWDFUNDING ============

interface Campaign {
  id: string;
  title: string;
  description?: string;
  goalAmount: number;
  amountRaised: number;
  percentFunded: number;
  currency: string;
  endDate: string;
  daysRemaining: number;
  coverUrl?: string;
  status: string;
  artist: { id: string; name: string; avatarUrl?: string; isVerified: boolean };
  tiers?: CampaignTier[];
  backerCount?: number;
}

interface CampaignTier {
  id: string;
  name: string;
  amount: number;
  description?: string;
  rewards?: string;
  maxBackers?: number;
  sold?: number;
  available?: number;
  isSoldOut?: boolean;
}

export function useCrowdfunding() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCampaigns = useCallback(async (options?: { artistId?: string; status?: string; featured?: boolean }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (options?.artistId) params.append('artistId', options.artistId);
      if (options?.status) params.append('status', options.status);
      if (options?.featured) params.append('featured', 'true');
      
      const res = await fetch(`/api/crowdfund?${params}`);
      const data = await res.json();
      if (res.ok) setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error('Fetch campaigns error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  return { campaigns, loading, fetchCampaigns };
}

export function useCampaign(campaignId: string | null) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recentBackers, setRecentBackers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pledging, setPledging] = useState(false);

  const fetchCampaign = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/crowdfund?campaignId=${campaignId}`);
      const data = await res.json();
      if (res.ok) {
        setCampaign(data.campaign);
        setRecentBackers(data.recentBackers || []);
      }
    } catch (err) {
      console.error('Fetch campaign error:', err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  const pledge = useCallback(async (params: {
    userId: string;
    tierId?: string;
    amount: number;
    txSignature?: string;
    isAnonymous?: boolean;
    message?: string;
  }) => {
    if (!campaignId) return null;
    setPledging(true);
    try {
      const res = await fetch('/api/crowdfund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pledge', campaignId, ...params }),
      });
      const data = await res.json();
      if (res.ok) { fetchCampaign(); return data; }
      return { error: data.error };
    } catch (err) {
      return { error: 'Failed to pledge' };
    } finally {
      setPledging(false);
    }
  }, [campaignId, fetchCampaign]);

  return { campaign, recentBackers, loading, pledging, pledge, refresh: fetchCampaign };
}

// ============ MERCHANDISE ============

interface MerchItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  currency: string;
  images?: string;
  artist: { id: string; name: string; avatarUrl?: string };
  variants: MerchVariant[];
  isLimited: boolean;
  tokenGated: boolean;
}

interface MerchVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes?: string;
}

export function useMerch(options?: { artistId?: string; category?: string }) {
  const [items, setItems] = useState<MerchItem[]>([]);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (options?.artistId) params.append('artistId', options.artistId);
      if (options?.category) params.append('category', options.category);
      
      const res = await fetch(`/api/merch?${params}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Fetch merch error:', err);
    } finally {
      setLoading(false);
    }
  }, [options?.artistId, options?.category]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return { items, categories, loading, refresh: fetchItems };
}

export function useMerchItem(itemId: string | null) {
  const [item, setItem] = useState<MerchItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    const fetchItem = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/merch?itemId=${itemId}`);
        const data = await res.json();
        if (res.ok) setItem(data.item);
      } catch (err) {
        console.error('Fetch item error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [itemId]);

  return { item, loading };
}

export function useMerchCart() {
  const [cart, setCart] = useState<{ itemId: string; variantId: string; quantity: number }[]>([]);
  const [ordering, setOrdering] = useState(false);

  const addToCart = (itemId: string, variantId: string, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.variantId === variantId);
      if (existing) {
        return prev.map(i => i.variantId === variantId ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { itemId, variantId, quantity }];
    });
  };

  const removeFromCart = (variantId: string) => {
    setCart(prev => prev.filter(i => i.variantId !== variantId));
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) return removeFromCart(variantId);
    setCart(prev => prev.map(i => i.variantId === variantId ? { ...i, quantity } : i));
  };

  const clearCart = () => setCart([]);

  const placeOrder = async (userId: string, shippingAddress: any, txSignature?: string) => {
    if (cart.length === 0) return { error: 'Cart is empty' };
    setOrdering(true);
    try {
      const res = await fetch('/api/merch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'order',
          userId,
          items: cart,
          shippingAddress,
          txSignature,
        }),
      });
      const data = await res.json();
      if (res.ok) { clearCart(); return data; }
      return { error: data.error };
    } catch (err) {
      return { error: 'Failed to place order' };
    } finally {
      setOrdering(false);
    }
  };

  return {
    cart,
    itemCount: cart.reduce((sum, i) => sum + i.quantity, 0),
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    placeOrder,
    ordering,
  };
}

// ============ EVENTS ============

interface Event {
  id: string;
  title: string;
  description?: string;
  type: string;
  venue?: string;
  address?: string;
  city?: string;
  country?: string;
  startDate: string;
  endDate?: string;
  timezone: string;
  coverUrl?: string;
  status: string;
  artist: { id: string; name: string; avatarUrl?: string; isVerified: boolean };
  ticketTiers: TicketTier[];
  startingPrice?: number;
  ticketsSold?: number;
}

interface TicketTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  description?: string;
  perks?: string;
  sold?: number;
  available?: number;
  isSoldOut?: boolean;
}

interface Ticket {
  id: string;
  ticketCode: string;
  qrCode: string;
  status: string;
  event: Event;
  tier: TicketTier;
}

export function useEvents(options?: { artistId?: string; type?: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (options?.artistId) params.append('artistId', options.artistId);
      if (options?.type) params.append('type', options.type);
      
      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      if (res.ok) setEvents(data.events || []);
    } catch (err) {
      console.error('Fetch events error:', err);
    } finally {
      setLoading(false);
    }
  }, [options?.artistId, options?.type]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return { events, loading, refresh: fetchEvents };
}

export function useEvent(eventId: string | null) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events?eventId=${eventId}`);
      const data = await res.json();
      if (res.ok) setEvent(data.event);
    } catch (err) {
      console.error('Fetch event error:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  const purchaseTicket = useCallback(async (params: {
    userId: string;
    tierId: string;
    quantity?: number;
    txSignature?: string;
    attendeeName?: string;
    attendeeEmail?: string;
  }) => {
    if (!eventId) return null;
    setPurchasing(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purchase', eventId, ...params }),
      });
      const data = await res.json();
      if (res.ok) { fetchEvent(); return data; }
      return { error: data.error };
    } catch (err) {
      return { error: 'Failed to purchase ticket' };
    } finally {
      setPurchasing(false);
    }
  }, [eventId, fetchEvent]);

  return { event, loading, purchasing, purchaseTicket, refresh: fetchEvent };
}

export function useMyTickets(userId: string | null) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/events?userId=${userId}`);
        const data = await res.json();
        if (res.ok) setTickets(data.tickets || []);
      } catch (err) {
        console.error('Fetch tickets error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, [userId]);

  const upcomingTickets = tickets.filter(t => new Date(t.event.startDate) > new Date());
  const pastTickets = tickets.filter(t => new Date(t.event.startDate) <= new Date());

  return { tickets, upcomingTickets, pastTickets, loading };
}
