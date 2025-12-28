// hooks/useSocial.ts
// React hooks for social features

import { useState, useCallback, useEffect } from 'react';

// ============ Types ============
interface UserPreview {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  wallet: string;
  artist?: {
    id: string;
    name: string;
    isVerified: boolean;
  } | null;
  followedAt?: Date;
}

interface TrackPreview {
  id: string;
  title: string;
  ticker: string;
  coverUrl: string | null;
  duration: number;
  playCount: number;
  artist: {
    id: string;
    name: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  likedAt?: Date;
}

interface Comment {
  id: string;
  content: string;
  timestamp: string | null;
  user: UserPreview;
  likeCount: number;
  replyCount: number;
  isEdited: boolean;
  createdAt: Date;
}

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  trackCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ActivityItem {
  id: string;
  type: 'new_track' | 'like' | 'follow' | 'playlist' | 'comment';
  actor: UserPreview;
  target?: {
    type: 'track' | 'user' | 'playlist';
    id: string;
    title?: string;
    name?: string;
    coverUrl?: string;
  };
  timestamp: Date;
}

// ============ useFollow ============
export function useFollow(targetUserId: string, currentUserId?: string) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check follow status
  const checkStatus = useCallback(async () => {
    if (!currentUserId || !targetUserId) return;

    try {
      const res = await fetch(
        `/api/social/follow?userId=${currentUserId}&targetId=${targetUserId}&type=status`
      );
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.isFollowing);
      }
    } catch (err) {
      console.error('Failed to check follow status:', err);
    }
  }, [currentUserId, targetUserId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Follow user
  const follow = useCallback(async () => {
    if (!currentUserId || !targetUserId || loading) return false;

    setLoading(true);
    try {
      const res = await fetch('/api/social/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerId: currentUserId,
          followingId: targetUserId,
        }),
      });

      if (res.ok) {
        setIsFollowing(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to follow:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUserId, targetUserId, loading]);

  // Unfollow user
  const unfollow = useCallback(async () => {
    if (!currentUserId || !targetUserId || loading) return false;

    setLoading(true);
    try {
      const res = await fetch('/api/social/follow', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerId: currentUserId,
          followingId: targetUserId,
        }),
      });

      if (res.ok) {
        setIsFollowing(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to unfollow:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUserId, targetUserId, loading]);

  // Toggle follow
  const toggle = useCallback(async () => {
    return isFollowing ? await unfollow() : await follow();
  }, [isFollowing, follow, unfollow]);

  return { isFollowing, loading, follow, unfollow, toggle, refresh: checkStatus };
}

// ============ useFollowers ============
export function useFollowers(userId: string, type: 'followers' | 'following' = 'followers') {
  const [users, setUsers] = useState<UserPreview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetch_ = useCallback(async (nextCursor?: string) => {
    if (!userId) return;

    setLoading(true);
    try {
      let url = `/api/social/follow?userId=${userId}&type=${type}`;
      if (nextCursor) url += `&cursor=${nextCursor}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const list = data[type] || [];
        
        if (nextCursor) {
          setUsers(prev => [...prev, ...list]);
        } else {
          setUsers(list);
        }
        
        setTotal(data.total);
        setHasMore(!!data.nextCursor);
        setCursor(data.nextCursor);
      }
    } catch (err) {
      console.error(`Failed to fetch ${type}:`, err);
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const loadMore = useCallback(() => {
    if (hasMore && cursor) fetch_(cursor);
  }, [hasMore, cursor, fetch_]);

  return { users, total, loading, hasMore, loadMore, refresh: () => fetch_() };
}

// ============ useLike ============
export function useLike(trackId: string, userId?: string) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Check like status
  const checkStatus = useCallback(async () => {
    if (!userId || !trackId) return;

    try {
      const res = await fetch(
        `/api/social/like?userId=${userId}&trackId=${trackId}&type=status`
      );
      if (res.ok) {
        const data = await res.json();
        setIsLiked(data.isLiked);
      }
    } catch (err) {
      console.error('Failed to check like status:', err);
    }
  }, [userId, trackId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Like track
  const like = useCallback(async () => {
    if (!userId || !trackId || loading) return false;

    setLoading(true);
    try {
      const res = await fetch('/api/social/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, trackId }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsLiked(true);
        setLikeCount(data.likeCount);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to like:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, trackId, loading]);

  // Unlike track
  const unlike = useCallback(async () => {
    if (!userId || !trackId || loading) return false;

    setLoading(true);
    try {
      const res = await fetch('/api/social/like', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, trackId }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsLiked(false);
        setLikeCount(data.likeCount);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to unlike:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, trackId, loading]);

  // Toggle like
  const toggle = useCallback(async () => {
    return isLiked ? await unlike() : await like();
  }, [isLiked, like, unlike]);

  return { isLiked, likeCount, loading, like, unlike, toggle, refresh: checkStatus };
}

// ============ useLikedTracks ============
export function useLikedTracks(userId: string) {
  const [tracks, setTracks] = useState<TrackPreview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetch_ = useCallback(async (nextCursor?: string) => {
    if (!userId) return;

    setLoading(true);
    try {
      let url = `/api/social/like?userId=${userId}&type=list`;
      if (nextCursor) url += `&cursor=${nextCursor}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        
        if (nextCursor) {
          setTracks(prev => [...prev, ...data.likes]);
        } else {
          setTracks(data.likes);
        }
        
        setTotal(data.total);
        setHasMore(!!data.nextCursor);
        setCursor(data.nextCursor);
      }
    } catch (err) {
      console.error('Failed to fetch liked tracks:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const loadMore = useCallback(() => {
    if (hasMore && cursor) fetch_(cursor);
  }, [hasMore, cursor, fetch_]);

  return { tracks, total, loading, hasMore, loadMore, refresh: () => fetch_() };
}

// ============ useComments ============
export function useComments(trackId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetch_ = useCallback(async (nextCursor?: string) => {
    if (!trackId) return;

    setLoading(true);
    try {
      let url = `/api/social/comment?trackId=${trackId}`;
      if (nextCursor) url += `&cursor=${nextCursor}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        
        if (nextCursor) {
          setComments(prev => [...prev, ...data.comments]);
        } else {
          setComments(data.comments);
        }
        
        setTotal(data.total);
        setHasMore(!!data.nextCursor);
        setCursor(data.nextCursor);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [trackId]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  // Add comment
  const addComment = useCallback(async (
    userId: string,
    content: string,
    timestamp?: string,
    parentId?: string
  ) => {
    try {
      const res = await fetch('/api/social/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, trackId, content, timestamp, parentId }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments(prev => [data.comment, ...prev]);
        setTotal(prev => prev + 1);
        return data.comment;
      }
      return null;
    } catch (err) {
      console.error('Failed to add comment:', err);
      return null;
    }
  }, [trackId]);

  // Delete comment
  const deleteComment = useCallback(async (commentId: string, userId: string) => {
    try {
      const res = await fetch('/api/social/comment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, userId }),
      });

      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setTotal(prev => prev - 1);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete comment:', err);
      return false;
    }
  }, []);

  const loadMore = useCallback(() => {
    if (hasMore && cursor) fetch_(cursor);
  }, [hasMore, cursor, fetch_]);

  return { 
    comments, 
    total, 
    loading, 
    hasMore, 
    loadMore, 
    addComment, 
    deleteComment,
    refresh: () => fetch_() 
  };
}

// ============ usePlaylists ============
export function usePlaylists(userId: string) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/playlist?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.playlists);
      }
    } catch (err) {
      console.error('Failed to fetch playlists:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  // Create playlist
  const createPlaylist = useCallback(async (
    name: string,
    description?: string,
    isPublic = false
  ) => {
    try {
      const res = await fetch('/api/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name, description, isPublic }),
      });

      if (res.ok) {
        const data = await res.json();
        setPlaylists(prev => [data.playlist, ...prev]);
        return data.playlist;
      }
      return null;
    } catch (err) {
      console.error('Failed to create playlist:', err);
      return null;
    }
  }, [userId]);

  // Delete playlist
  const deletePlaylist = useCallback(async (playlistId: string) => {
    try {
      const res = await fetch('/api/playlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId, userId }),
      });

      if (res.ok) {
        setPlaylists(prev => prev.filter(p => p.id !== playlistId));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete playlist:', err);
      return false;
    }
  }, [userId]);

  return { playlists, loading, createPlaylist, deletePlaylist, refresh: fetch_ };
}

// ============ useActivityFeed ============
export function useActivityFeed(userId: string) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetch_ = useCallback(async (nextCursor?: string) => {
    if (!userId) return;

    setLoading(true);
    try {
      let url = `/api/social/activity?userId=${userId}`;
      if (nextCursor) url += `&cursor=${nextCursor}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        
        if (nextCursor) {
          setActivities(prev => [...prev, ...data.activities]);
        } else {
          setActivities(data.activities);
        }
        
        setHasMore(!!data.nextCursor);
        setCursor(data.nextCursor);
      }
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const loadMore = useCallback(() => {
    if (hasMore && cursor) fetch_(cursor);
  }, [hasMore, cursor, fetch_]);

  return { activities, loading, hasMore, loadMore, refresh: () => fetch_() };
}
