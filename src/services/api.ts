import axios from 'axios';
import { User, Match, Message, SwipeAction, Feedback, Broadcast } from '@/types';

// Use environment variable or default to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add interceptor to include token if we had one (simulated auth for now)
// api.interceptors.request.use((config) => { ... });

export const auth = {
    login: async (email: string, password: string): Promise<User> => {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    },
    signup: async (userData: any): Promise<User> => {
        const response = await api.post('/auth/signup', userData);
        return response.data;
    },
    me: async (): Promise<User> => {
        const response = await api.get('/auth/me');
        return response.data;
    }
};

// Smart Cache Utility
const smartFetch = async <T>(key: string, fetchFn: () => Promise<T>, ttl = 5 * 60 * 1000): Promise<T> => {
    const cached = localStorage.getItem(`cache_${key}`);
    const now = Date.now();

    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isFresh = now - timestamp < ttl;

        // If fresh, return immediately. If stale, return cached but trigger background update.
        if (isFresh) return data;

        // Background update if stale
        fetchFn().then(newData => {
            localStorage.setItem(`cache_${key}`, JSON.stringify({ data: newData, timestamp: now }));
            // Optional: Dispatch event to notify UI of update if needed, but for now allow simple SWR
        }).catch(err => console.error("Background fetch failed", err));

        return data; // Return stale date immediately for speed
    }

    // No cache, fetch normally
    const data = await fetchFn();
    try {
        localStorage.setItem(`cache_${key}`, JSON.stringify({ data, timestamp: now }));
    } catch (e) {
        console.warn(`[Cache] Failed to cache key "${key}" - Storage Full?`, e);
        // Optional: Attempt to clear generic old keys if critical
        try {
            // Clear some generic large caches to free space
            localStorage.removeItem('cache_admin_users_list');
            localStorage.removeItem('cache_users_feed');
        } catch (cleanupErr) { /* ignore */ }
    }
    return data;
};

export const users = {
    getAll: async (): Promise<User[]> => {
        // Use smart caching for feed
        return smartFetch('users_feed', async () => {
            const response = await api.get('/users');
            return response.data;
        });
    },
    getRecentVisitors: async (): Promise<User[]> => {
        // Uncached fetch for "Who Sees Me" simulation
        const response = await api.get('/users?limit=20'); // Fetch enough for simulation
        return response.data;
    },
    getById: async (id: string): Promise<User> => {
        return smartFetch(`user_${id}`, async () => {
            const response = await api.get(`/users/${id}`);
            return response.data;
        }, 60 * 1000); // 1 minute cache for individual profiles
    },
    create: async (userData: Partial<User>): Promise<User> => {
        const response = await api.post('/users', userData);
        return response.data;
    },
    update: async (id: string, updates: Partial<User>): Promise<User> => {
        // Invalidate cache on update
        localStorage.removeItem(`cache_user_${id}`);
        localStorage.removeItem(`cache_users_feed`);
        const response = await api.put(`/users/${id}`, updates);
        return response.data;
    },
    uploadPhoto: async (id: string, formData: FormData): Promise<{ url: string }> => {
        const response = await api.post(`/users/${id}/photos`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        localStorage.removeItem(`cache_user_${id}`); // Invalidate
        return response.data;
    },
    verify: async (data: { userId: string, selfieUrl: string }): Promise<any> => {
        const response = await api.post('/users/verify', data);
        localStorage.removeItem(`cache_verification_${data.userId}`); // Invalidate cache on new submission
        return response.data;
    },
    getVerificationStatus: async (userId: string): Promise<any> => {
        // Smart cache with 5 minute TTL
        return smartFetch(`verification_${userId}`, async () => {
            const response = await api.get(`/users/${userId}/verification`);
            return response.data;
        }, 5 * 60 * 1000);
    }
};

export const matches = {
    getAll: async (userId: string): Promise<any[]> => {
        // Returns { match, user, lastMessage }[]
        // Disable caching for real-time accuracy, or use very short TTL
        // For standard chat apps, matches/conversations should be fresh.
        const response = await api.get(`/matches/${userId}`);
        return response.data;
    },
    getById: async (matchId: string): Promise<any> => {
        return smartFetch(`match_${matchId}`, async () => {
            const response = await api.get(`/matches/single/${matchId}`);
            return response.data;
        });
    },
    update: async (matchId: string, updates: any): Promise<any> => {
        const response = await api.put(`/matches/${matchId}`, updates);
        return response.data;
    },
    delete: async (matchId: string): Promise<void> => {
        await api.delete(`/matches/${matchId}`);
    }
};

export const messages = {
    getHistory: async (matchId: string): Promise<Message[]> => {
        // Use smartFetch for instant load, then update in background
        return smartFetch(`messages_${matchId}`, async () => {
            const response = await api.get(`/messages/${matchId}?t=${Date.now()}`);
            return response.data;
        }, 1000); // Very short fresh time, mostly rely on stale-while-revalidate
    },
    send: async (messageData: Partial<Message>): Promise<Message> => {
        const response = await api.post('/messages', messageData);
        // Invalidate message cache for this match
        if (messageData.matchId) {
            localStorage.removeItem(`cache_messages_${messageData.matchId}`);
        }
        return response.data;
    },
    markAsRead: async (matchId: string, userId: string): Promise<void> => {
        await api.post(`/messages/${matchId}/read`, { userId });
    },
    update: async (id: string, updates: Partial<Message>): Promise<Message> => {
        const response = await api.put(`/messages/${id}`, updates);
        return response.data;
    },
    delete: async (id: string): Promise<Message> => {
        const response = await api.delete(`/messages/${id}`);
        return response.data;
    }
};

export const actions = {
    swipe: async (userId: string, targetUserId: string, action: 'like' | 'dislike' | 'superlike'): Promise<SwipeAction> => {
        const response = await api.post('/actions/swipe', { userId, targetUserId, action });
        // Invalidate relevant caches
        localStorage.removeItem(`cache_swipes_${userId}`);
        if (action === 'like' || action === 'superlike') {
            localStorage.removeItem(`cache_likes_${targetUserId}`); // Hard to know other user's cache key but good practice
        }
        return response.data;
    },
    like: async (fromUserId: string, toUserId: string, type: 'like' | 'superlike'): Promise<{ like: any, match: Match | null }> => {
        const response = await api.post('/actions/like', { fromUserId, toUserId, type });
        return response.data;
    },
    undoLastSwipe: async (userId: string): Promise<any> => {
        const response = await api.post('/actions/undo', { userId });
        // Invalidate relevant caches
        localStorage.removeItem(`cache_swipes_${userId}`);
        return response.data;
    },
    getLikes: async (userId: string): Promise<any[]> => {
        const response = await api.get(`/actions/likes/${userId}`);
        return response.data;
    },
    getSwipes: async (userId: string): Promise<any[]> => {
        const response = await api.get(`/actions/swipes/${userId}`);
        return response.data;
    },
    report: async (data: { reporterId: string, reportedUserId: string, reason: string, details: string }): Promise<any> => {
        const response = await api.post('/actions/report', data);
        return response.data;
    },
    submitFeedback: async (data: { userId: string, type: string, message: string, rating?: number }): Promise<any> => {
        const response = await api.post('/actions/feedback', data);
        return response.data;
    }
};

export const admin = {
    getStats: async (): Promise<any> => {
        // Admin stats can benefit significantly from caching
        return smartFetch('admin_stats', async () => {
            const response = await api.get('/admin/stats');
            return response.data;
        }, 2 * 60 * 1000); // 2 min
    },
    getAllUsers: async (): Promise<User[]> => {
        return smartFetch('admin_users_list', async () => {
            const response = await api.get('/admin/users');
            return response.data;
        }, 2 * 60 * 1000);
    },
    createUser: async (userData: Partial<User>): Promise<User> => {
        const response = await api.post('/admin/users', userData);
        localStorage.removeItem('cache_admin_users_list');
        return response.data;
    },
    updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
        const response = await api.patch(`/admin/users/${id}`, updates);
        // Invalidate admin list cache
        localStorage.removeItem('cache_admin_users_list');
        localStorage.removeItem(`cache_user_${id}`);
        return response.data;
    },
    deleteUser: async (id: string): Promise<void> => {
        await api.delete(`/admin/users/${id}`);
        localStorage.removeItem('cache_admin_users_list');
    },
    // Broadcasts
    sendBroadcast: async (data: { title: string, message: string, type: string, targetAudience: string }): Promise<any> => {
        const response = await api.post('/admin/broadcast', data);
        return response.data;
    },
    // Feedback
    getFeedback: async (): Promise<Feedback[]> => {
        return smartFetch('admin_feedback', async () => {
            const response = await api.get('/admin/feedback');
            return response.data;
        });
    },
    updateFeedback: async (id: string, updates: Partial<Feedback>): Promise<Feedback> => {
        const response = await api.patch(`/admin/feedback/${id}`, updates);
        localStorage.removeItem('cache_admin_feedback');
        return response.data;
    },
    // Verification
    getVerificationRequests: async (): Promise<any[]> => {
        return smartFetch('admin_verifications', async () => {
            const response = await api.get('/admin/verification-requests');
            return response.data;
        });
    },
    reviewVerification: async (id: string, status: 'approved' | 'rejected'): Promise<any> => {
        const response = await api.post(`/admin/verification-requests/${id}/review`, { status });
        localStorage.removeItem('cache_admin_verifications');
        return response.data;
    },
    // Packages
    getPackages: async (): Promise<any[]> => {
        return smartFetch('admin_packages', async () => {
            const response = await api.get('/admin/packages');
            return response.data;
        });
    },
    updatePackage: async (id: string, updates: any): Promise<any> => {
        const response = await api.patch(`/admin/packages/${id}`, updates);
        localStorage.removeItem('cache_admin_packages'); // Invalidate
        return response.data;
    },
    // Reports
    getReports: async (): Promise<any[]> => {
        return smartFetch('admin_reports', async () => {
            const response = await api.get('/admin/reports');
            return response.data;
        });
    },
    updateReport: async (id: string, updates: any): Promise<any> => {
        const response = await api.patch(`/admin/reports/${id}`, updates);
        localStorage.removeItem('cache_admin_reports');
        return response.data;
    },
    // Media
    uploadImage: async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append('photo', file);
        const response = await api.post('/admin/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.url;
    }
};

export const subscriptions = {
    create: async (data: { userId: string, plan: string, price: number, duration: string }): Promise<any> => {
        const response = await api.post('/users/subscribe', data);
        return response.data;
    }
};

// Generic upload for images (returns Cloudinary URL)
export const upload = {
    image: async (base64Data: string): Promise<string> => {
        const response = await api.post('/upload', { image: base64Data });
        return response.data.url;
    }
};

export default api;
