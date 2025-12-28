// hooks/useMessages.ts
// Messaging hooks for direct messages and broadcasts

import { useState, useEffect, useCallback, useRef } from 'react';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  artistName?: string;
  isVerified?: boolean;
}

interface Message {
  id: string;
  content: string;
  sender: User;
  createdAt: string;
  readAt?: string;
}

interface Conversation {
  id: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

interface Broadcast {
  id: string;
  title: string;
  content: string;
  audience: string;
  recipientCount: number;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
}

// Hook for direct messaging
export function useMessages(userId: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/messages?userId=${userId}`);
      const data = await res.json();

      if (res.ok) {
        setConversations(data.conversations || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return {
    conversations,
    loading,
    error,
    totalUnread,
    refresh: fetchConversations,
  };
}

// Hook for a single conversation
export function useConversation(userId: string | null, conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timer | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!userId || !conversationId) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/messages?userId=${userId}&conversationId=${conversationId}`
      );
      const data = await res.json();

      if (res.ok) {
        setMessages(data.messages || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [userId, conversationId]);

  useEffect(() => {
    fetchMessages();

    // Poll for new messages every 5 seconds
    pollingRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchMessages]);

  const sendMessage = useCallback(async (recipientId: string, content: string) => {
    if (!userId) return null;

    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: userId,
          recipientId,
          content,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Add message to local state
        setMessages(prev => [...prev, data.message]);
        return data;
      } else {
        setError(data.error);
        return null;
      }
    } catch (err) {
      setError('Failed to send message');
      return null;
    } finally {
      setSending(false);
    }
  }, [userId]);

  const markAsRead = useCallback(async () => {
    if (!userId || !conversationId) return;

    await fetch('/api/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, conversationId }),
    });
  }, [userId, conversationId]);

  return {
    messages,
    loading,
    sending,
    error,
    sendMessage,
    markAsRead,
    refresh: fetchMessages,
  };
}

// Hook for artist broadcasts
export function useBroadcasts(artistId: string | null) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBroadcasts = useCallback(async () => {
    if (!artistId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/messages/broadcast?artistId=${artistId}`);
      const data = await res.json();

      if (res.ok) {
        setBroadcasts(data.broadcasts || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  const sendBroadcast = useCallback(async (params: {
    content: string;
    title?: string;
    audience?: 'all' | 'token_holders' | 'premium' | 'early_access';
    actionUrl?: string;
    actionLabel?: string;
  }) => {
    if (!artistId) return null;

    setSending(true);
    try {
      const res = await fetch('/api/messages/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          ...params,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Refresh broadcasts list
        fetchBroadcasts();
        return data;
      } else {
        setError(data.error);
        return null;
      }
    } catch (err) {
      setError('Failed to send broadcast');
      return null;
    } finally {
      setSending(false);
    }
  }, [artistId, fetchBroadcasts]);

  return {
    broadcasts,
    loading,
    sending,
    error,
    sendBroadcast,
    refresh: fetchBroadcasts,
  };
}

// Hook for notifications
export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // TODO: Create notifications list endpoint
      // For now, this is a placeholder
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    // TODO: Implement mark as read
  }, []);

  const markAllAsRead = useCallback(async () => {
    // TODO: Implement mark all as read
  }, []);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}

// Hook for push notification subscription
export function usePushNotifications(userId: string | null) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('Error checking push subscription:', err);
    }
  };

  const subscribe = useCallback(async () => {
    if (!userId || !isSupported) return false;

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from environment
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not configured');
        return false;
      }

      // Convert VAPID key to Uint8Array
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Send subscription to server
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: subscription.toJSON(),
        }),
      });

      if (res.ok) {
        setIsSubscribed(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error subscribing to push:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return false;

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Notify server
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            endpoint: subscription.endpoint,
          }),
        });
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error('Error unsubscribing from push:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    isSupported,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
  };
}
