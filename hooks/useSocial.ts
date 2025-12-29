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

// ============ MENTIONS ============

interface Mention {
  id: string;
  mentionedBy: {
    id: string;
    username: string;
    avatarUrl?: string;
    artist?: { name: string; isVerified: boolean };
  };
  comment?: {
    id: string;
    content: string;
    track?: { id: string; title: string; coverUrl?: string };
  };
  readAt?: string;
  createdAt: string;
}

export function useMentions(userId: string | null) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchMentions = useCallback(async (unreadOnly = false) => {
    if (!userId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ userId });
      if (unreadOnly) params.append('unread', 'true');
      
      const res = await fetch(`/api/social/mentions?${params}`);
      const data = await res.json();

      if (res.ok) {
        setMentions(data.mentions || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Fetch mentions error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions]);

  const markAsRead = useCallback(async (mentionIds?: string[]) => {
    if (!userId) return;

    await fetch('/api/social/mentions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, mentionIds }),
    });

    fetchMentions();
  }, [userId, fetchMentions]);

  return { mentions, unreadCount, loading, markAsRead, refresh: fetchMentions };
}

export function extractMentions(text: string): string[] {
  const regex = /@([a-zA-Z0-9_]+)/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.substring(1)))];
}

// ============ STORIES ============

interface StoryUser {
  id: string;
  username: string;
  avatarUrl?: string;
  artistName?: string;
  isVerified: boolean;
}

interface Story {
  id: string;
  type: 'image' | 'video' | 'track' | 'text';
  mediaUrl?: string;
  caption?: string;
  trackId?: string;
  createdAt: string;
  expiresAt: string;
  viewed?: boolean;
}

interface StoryFeedItem {
  user: StoryUser;
  storyCount: number;
  hasUnviewed: boolean;
  previewUrl?: string;
}

export function useStories(viewerId: string | null) {
  const [feed, setFeed] = useState<StoryFeedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFeed = useCallback(async () => {
    if (!viewerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/social/stories?viewerId=${viewerId}&type=feed`);
      const data = await res.json();
      if (res.ok) setFeed(data.storyFeed || []);
    } catch (err) {
      console.error('Fetch stories error:', err);
    } finally {
      setLoading(false);
    }
  }, [viewerId]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  return {
    feed,
    loading,
    refresh: fetchFeed,
    hasUnviewedStories: feed.some(f => f.hasUnviewed),
  };
}

export function useUserStories(userId: string | null, viewerId?: string | null) {
  const [stories, setStories] = useState<Story[]>([]);
  const [user, setUser] = useState<StoryUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchStories = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId, type: 'user' });
      if (viewerId) params.append('viewerId', viewerId);
      const res = await fetch(`/api/social/stories?${params}`);
      const data = await res.json();
      if (res.ok) {
        setStories(data.stories || []);
        setUser(data.user || null);
      }
    } catch (err) {
      console.error('Fetch user stories error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, viewerId]);

  useEffect(() => { fetchStories(); setCurrentIndex(0); }, [fetchStories]);

  const markViewed = useCallback(async (storyId: string) => {
    if (!viewerId) return;
    await fetch('/api/social/stories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId, viewerId }),
    });
  }, [viewerId]);

  const next = useCallback(() => {
    if (currentIndex < stories.length - 1) { setCurrentIndex(p => p + 1); return true; }
    return false;
  }, [currentIndex, stories.length]);

  const previous = useCallback(() => {
    if (currentIndex > 0) { setCurrentIndex(p => p - 1); return true; }
    return false;
  }, [currentIndex]);

  return {
    stories, user, loading,
    currentStory: stories[currentIndex] || null,
    currentIndex, totalStories: stories.length,
    next, previous, markViewed, refresh: fetchStories,
  };
}

export function useMyStories(userId: string | null) {
  const [stories, setStories] = useState<(Story & { viewCount: number; isExpired: boolean })[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  const fetchStories = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/social/stories?userId=${userId}&type=own`);
      const data = await res.json();
      if (res.ok) setStories(data.stories || []);
    } catch (err) {
      console.error('Fetch my stories error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  const createStory = useCallback(async (params: {
    type: 'image' | 'video' | 'track' | 'text';
    mediaUrl?: string;
    caption?: string;
    trackId?: string;
  }) => {
    if (!userId) return null;
    setPosting(true);
    try {
      const res = await fetch('/api/social/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...params }),
      });
      const data = await res.json();
      if (res.ok) { fetchStories(); return data.story; }
      return null;
    } catch (err) {
      console.error('Create story error:', err);
      return null;
    } finally {
      setPosting(false);
    }
  }, [userId, fetchStories]);

  const deleteStory = useCallback(async (storyId: string) => {
    if (!userId) return false;
    try {
      const res = await fetch('/api/social/stories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId, userId }),
      });
      if (res.ok) { fetchStories(); return true; }
      return false;
    } catch (err) {
      console.error('Delete story error:', err);
      return false;
    }
  }, [userId, fetchStories]);

  return {
    stories, loading, posting, createStory, deleteStory, refresh: fetchStories,
    activeCount: stories.filter(s => !s.isExpired).length,
  };
}

// ============ COLLABORATIVE PLAYLISTS ============

interface Collaborator {
  id: string;
  user: { id: string; username: string; avatarUrl?: string };
  role: string;
  canAdd: boolean;
  canRemove: boolean;
  canReorder: boolean;
}

export function usePlaylistCollaborators(playlistId: string | null) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [owner, setOwner] = useState<any>(null);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchCollaborators = useCallback(async () => {
    if (!playlistId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/playlist/collaborate?playlistId=${playlistId}`);
      const data = await res.json();
      if (res.ok) {
        setCollaborators(data.collaborators || []);
        setOwner(data.owner);
        setIsCollaborative(data.isCollaborative);
      }
    } catch (err) {
      console.error('Fetch collaborators error:', err);
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useEffect(() => { fetchCollaborators(); }, [fetchCollaborators]);

  const inviteCollaborator = useCallback(async (ownerId: string, inviteeId: string, permissions?: any) => {
    if (!playlistId) return false;
    try {
      const res = await fetch('/api/playlist/collaborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId, ownerId, inviteeId, ...permissions }),
      });
      if (res.ok) { fetchCollaborators(); return true; }
      return false;
    } catch (err) { return false; }
  }, [playlistId, fetchCollaborators]);

  const removeCollaborator = useCallback(async (userId: string, collaboratorUserId?: string) => {
    if (!playlistId) return false;
    try {
      const res = await fetch('/api/playlist/collaborate', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId, userId, collaboratorUserId }),
      });
      if (res.ok) { fetchCollaborators(); return true; }
      return false;
    } catch (err) { return false; }
  }, [playlistId, fetchCollaborators]);

  return {
    collaborators, owner, isCollaborative, loading,
    inviteCollaborator, removeCollaborator, refresh: fetchCollaborators,
  };
}