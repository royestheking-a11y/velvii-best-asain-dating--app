import React, { useState, useEffect } from 'react';
import { Sparkles, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { users as usersApi, actions as actionsApi, matches as matchesApi } from '@/services/api';
import { calculateDistance } from '@/utils/helpers';
import { UserCard } from './UserCard';
import { MatchModal } from './MatchModal';
import { toast } from 'sonner';
import { DiscoveryFilterModal } from './DiscoveryFilterModal';
import { getFilterPreferences } from '@/utils/storage';


import { useNavigate } from 'react-router-dom';

export const SwipePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, updateCurrentUser } = useAuth();
  const { socket } = useSocket();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchState, setMatchState] = useState<{ id: string; user: User } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'like' | 'dislike' | 'superlike' | null>(null);

  // Filter State
  const [showFilters, setShowFilters] = useState(false);

  // Initialize filters based on Saved Prefs OR User Profile
  const savedPrefs = getFilterPreferences();

  const [filters, setFilters] = useState({
    distance: [savedPrefs?.maxDistance || 50],
    ageRange: savedPrefs?.ageRange || [18, 50],
    // IMPORTANT: Default to saved pref first, then user profile 'interestedIn', THEN strict opposite gender
    gender: savedPrefs?.gender || (
      currentUser?.interestedIn === 'men' ? 'male'
        : currentUser?.interestedIn === 'women' ? 'female'
          : currentUser?.gender === 'male' ? 'female' // Default for Male -> Female
            : 'male' // Default for Female -> Male
    ),
    verifiedOnly: savedPrefs?.verifiedOnly || false,
    hasBio: false,
    onlineNow: false
  });

  // Note: Local simple undo not implemented with API yet for simplicity in v1 standard migration.
  // We can re-implement undo by keeping a local stack, but API actions are permanent.
  const [lastSwipeAction, setLastSwipeAction] = useState<'like' | 'dislike' | 'superlike' | null>(null);

  // Initial load & Sync with Profile Changes
  useEffect(() => {
    if (currentUser) {
      // Sync: If profile 'interestedIn' changes, update the filter state to match
      setFilters(prev => {
        const profileGender = currentUser.interestedIn === 'men' ? 'male'
          : currentUser.interestedIn === 'women' ? 'female'
            : currentUser.gender === 'male' ? 'female'
              : 'male';

        if (prev.gender !== profileGender && prev.gender !== 'everyone') {
          // Only auto-switch if they haven't explicitly set 'everyone' via filter
          return { ...prev, gender: profileGender };
        }
        return prev;
      });

      // NOTE: loadUsers() is NOT called here anymore.
      // The second useEffect (depends on filters) will handle loading.
    }
  }, [currentUser]); // Reload when currentUser changes (e.g. settings updated externally)

  // Reload when filters change locally
  useEffect(() => {
    if (currentUser) loadUsers();
  }, [filters]);

  // Sync with global filter settings (e.g. changed in SettingsPage)
  useEffect(() => {
    const handleFilterUpdate = () => {
      const newPrefs = getFilterPreferences();
      if (newPrefs) {
        setFilters(prev => ({
          ...prev,
          distance: [newPrefs.maxDistance],
          ageRange: newPrefs.ageRange,
          gender: newPrefs.gender,
          verifiedOnly: newPrefs.verifiedOnly,
          // Maintain local-only state if not present in prefs (though prefs usually has all)
          onlineNow: newPrefs.onlineOnly || false // Map onlineOnly to onlineNow
        }));
      }
    };

    window.addEventListener('filter-preferences-updated', handleFilterUpdate);
    return () => window.removeEventListener('filter-preferences-updated', handleFilterUpdate);
  }, []);


  const loadUsers = async () => {
    if (!currentUser) return;

    setIsLoading(true);

    try {
      // Parallelize Fetching for Performance
      const [allUsers, mySwipes, likesReceived, myMatches] = await Promise.all([
        usersApi.getAll(),
        actionsApi.getSwipes(currentUser.id),
        actionsApi.getLikes(currentUser.id),
        matchesApi.getAll(currentUser.id) // Fetch existing matches
      ]);

      const swipedUserIds = new Set(mySwipes.map((s: any) => s.targetUserId));

      // Explicitly add Matched Users to swiped list (Double safety)
      // Matches structure usually has { user: { id: ... } } or similar depending on API
      myMatches.forEach((m: any) => {
        if (m.user && (m.user.id || m.user._id)) {
          swipedUserIds.add(m.user.id || m.user._id);
        }
      });

      const likedMeUserIds = new Set(likesReceived.map((l: any) =>
        // Handle both populated user object or raw ID if API changes
        l.user ? l.user.id || l.user._id : l.fromUserId
      ));

      // Separate AI and Real users
      const distinctAiUsers = allUsers.filter(u => u.isAI);
      const distinctRealUsers = allUsers.filter(u => !u.isAI);

      console.log("[SWIPE_DEBUG] All Users Fetched:", allUsers.length);
      console.log("[SWIPE_DEBUG] AI Users:", distinctAiUsers.length);
      console.log("[SWIPE_DEBUG] Real Users:", distinctRealUsers.length);

      // AI Logic: ONLY Show Opposite Gender & Unswiped
      let targetAiGender: 'male' | 'female' = 'female';
      if (currentUser.gender === 'female') targetAiGender = 'male';
      else if (currentUser.gender === 'male') targetAiGender = 'female';
      // If user gender is undefined or other, maybe default to mixed? For now assume binary strict as requested.

      const relevantAiUsers = distinctAiUsers.filter(u =>
        u.gender === targetAiGender && !swipedUserIds.has(u.id)
      );
      // We show ALL relevant AI users available (the request implies 3 exist, we show all if unswiped)
      const selectedAiUsers = relevantAiUsers;
      console.log("[SWIPE_DEBUG] Relevant AI Users (Gender Logic):", relevantAiUsers.length);

      // Real User Logic (Filter & Sort)
      const filteredRealUsers = distinctRealUsers.filter((user) => {
        if (user.id === currentUser.id) return false;
        if (swipedUserIds.has(user.id)) return false;

        // --- Privacy Check: Only Show to People I've Liked ---
        if (user.settings?.privacy?.onlyShowToLiked && !likedMeUserIds.has(user.id)) {
          return false;
        }

        // --- Apply Filters ---

        // Gender
        if (filters.gender !== 'everyone' && filters.gender !== user.gender) return false;
        // If 'everyone' is selected, we do NOT filter by gender at all. 
        // This overrides the profile 'interestedIn' setting for discovery mode.

        // Verified
        if (filters.verifiedOnly && !user.isVerified) return false;

        // Has Bio
        if (filters.hasBio && !user.bio) return false;

        // Active Recently (Online Now)
        if (filters.onlineNow && !user.isOnline) return false;

        // Age Calculation
        if (user.dateOfBirth) {
          const dob = new Date(user.dateOfBirth);
          const ageDiffMs = Date.now() - dob.getTime();
          const ageDate = new Date(ageDiffMs); // miliseconds from epoch
          const age = Math.abs(ageDate.getUTCFullYear() - 1970);
          if (age < filters.ageRange[0] || age > filters.ageRange[1]) return false;
        }

        return true;
      });

      // Calculate distances
      const usersWithDist = filteredRealUsers.map(u => {
        const dist = currentUser.location?.coordinates && u.location?.coordinates
          ? calculateDistance(
            currentUser.location.coordinates.lat,
            currentUser.location.coordinates.lng,
            u.location.coordinates.lat,
            u.location.coordinates.lng
          )
          : 99999;
        return { user: u, dist };
      });

      // Filter by Distance
      const distFiltered = usersWithDist.filter(u => u.dist <= filters.distance[0]);

      // Sort by distance
      distFiltered.sort((a, b) => a.dist - b.dist);
      const sortedRealUsers = distFiltered.map(item => item.user);

      // Combine: AI First, then Real
      setUsers([...selectedAiUsers, ...sortedRealUsers]);
      setCurrentIndex(0);

    } catch (error) {
      console.error("Failed to load users", error);
      toast.error("Could not load profiles");
    } finally {
      setIsLoading(false);
    }
  };




  const handleSwipe = async (action: 'like' | 'dislike' | 'superlike') => {
    if (swipeDirection) return;
    if (!currentUser || currentIndex >= users.length) return;

    if (action === 'superlike' && !currentUser.isPremium) {
      toast.error('Super Likes are available for Premium members only!', {
        description: 'Upgrade to stand out from the crowd ⭐️',
        icon: '👑'
      });
      return;
    }

    setSwipeDirection(action);
    const targetUser = users[currentIndex];

    // Optimistic UI updates
    const nextIndex = currentIndex + 1;
    // Note: We don't wait for API to animate card off

    try {
      // 1. Record Swipe Action
      await actionsApi.swipe(currentUser.id, targetUser.id, action);

      // 2. If Like/Superlike, record Like and check Match
      if (action === 'like' || action === 'superlike') {
        const { match } = await actionsApi.like(currentUser.id, targetUser.id, action);

        if (match) {
          // Match Found!
          // Notify via socket
          if (socket) {
            socket.emit('send-notification', {
              to: targetUser.id,
              notification: {
                type: 'match',
                title: "It's a Match! 💖",
                message: `You and ${currentUser.fullName} liked each other!`,
                matchId: match.id
              }
            });
          }

          // Show Modal
          setTimeout(() => {
            setMatchState({ id: match.id, user: targetUser });
          }, 400);
        }
      }

      // Update local user stats (simple increment, real sync happens on reload/updates)
      updateCurrentUser({ swipeCount: (currentUser.swipeCount || 0) + 1 });

    } catch (error) {
      console.error("Swipe Action Failed", error);
      // Silently fail or simple toast? UI already animated.
    }

    // Move to next card
    setTimeout(() => {
      setCurrentIndex(nextIndex);
      setSwipeDirection(null);
      setLastSwipeAction(action);
    }, 200);
  };

  const handleUndo = async () => {
    if (!currentUser) return;

    // Check Premium for Undo (optional, usually premium)
    // if (!currentUser.isPremium) {
    //   toast.error('Undo is a Premium feature!', { icon: '👑' });
    //   return;
    // }

    if (currentIndex <= 0) {
      toast.info("Nothing to undo!");
      return;
    }

    try {
      const prevIndex = currentIndex - 1;
      // Optimistically update UI
      setCurrentIndex(prevIndex);
      setSwipeDirection(null);
      setLastSwipeAction(null); // Clear local track

      // Call API
      await actionsApi.undoLastSwipe(currentUser.id);
      toast.success("Rewind successful! ↺");

    } catch (error) {
      console.error("Undo failed", error);
      toast.error("Could not undo last action");
      // Revert UI if needed, but for now simple error toast
    }
  };

  const handleBoost = () => {
    if (!currentUser?.isPremium) {
      toast.error('Boost is a Premium feature!', {
        description: 'Upgrade to be seen by more people 🚀',
        icon: '👑'
      });
      return;
    }

    toast.custom((t) => (
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 rounded-xl shadow-xl flex items-center gap-3 text-white border border-white/20 min-w-[300px]">
        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-lg">Boost Activated!</h3>
          <p className="text-sm text-white/90">You're visible to more people nearby 🚀</p>
        </div>
      </div>
    ), { duration: 3000 });
  };

  const currentCard = users[currentIndex];
  // Calculate hasMore including current card
  const hasMore = currentIndex < users.length;

  if (!currentUser) {
    return (
      <div className="relative h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const cardVariants = {
    enter: ({ index }: { index: number }) => ({
      scale: 1 - index * 0.05,
      y: index * 10,
      zIndex: 10 - index,
      opacity: index < 2 ? 1 : 0.5,
      x: 0,
      rotate: 0,
    }),
    center: ({ index }: { index: number }) => ({
      scale: 1 - index * 0.05,
      y: index * 10,
      zIndex: 10 - index,
      opacity: index < 2 ? 1 : 0.5,
      x: 0,
      rotate: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut" as const
      }
    }),
    exit: ({ direction }: { direction: 'like' | 'dislike' | 'superlike' | null }) => ({
      x: direction === 'dislike' ? -800 : direction === 'like' ? 800 : 0,
      y: direction === 'superlike' ? -800 : 0,
      rotate: direction === 'dislike' ? -20 : direction === 'like' ? 20 : 0,
      opacity: 0,
      transition: { duration: 0.4, ease: "easeIn" as const }
    })
  };

  return (
    <div className="relative h-full bg-gray-50 overflow-hidden">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-pink-600 bg-clip-text text-transparent">
            VELVII
          </div>
        </div>

        <button
          onClick={() => setShowFilters(true)}
          className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm hover:shadow-md hover:border-orange-500 hover:text-orange-500 transition-all active:scale-95"
        >
          <div className="relative">
            <Filter className="w-5 h-5" />
            {/* Active Indicator if filters are non-default? Keeping simple for now, or maybe if verifiedOnly is on? */}
            {filters.verifiedOnly && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white" />
            )}
          </div>
        </button>
      </div>

      {/* Cards Container */}
      <div className="relative w-full h-full pt-20 pb-24">
        {hasMore ? (
          <div className="relative w-full h-full max-w-md mx-auto sm:max-w-none">
            <AnimatePresence custom={{ direction: swipeDirection }}>
              {/* Show next 3 cards in stack */}
              {users.slice(currentIndex, currentIndex + 3).map((user, index) => {
                const uniqueKey = user.id;

                return (
                  <motion.div
                    key={uniqueKey}
                    custom={{ index, direction: swipeDirection }}
                    variants={cardVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="absolute inset-0"
                  >
                    <UserCard
                      user={user}
                      active={index === 0}
                      onLike={() => {
                        console.log('Like clicked'); // Debug
                        handleSwipe('like');
                      }}
                      onDislike={() => handleSwipe('dislike')}
                      onSuperLike={() => handleSwipe('superlike')}
                      onUndo={handleUndo}
                      onBoost={handleBoost}
                      canUndo={!!lastSwipeAction}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full sm:pt-20">
            {/* Pulsing Circle Animation */}
            <div className="relative w-96 h-96 flex items-center justify-center mb-8">
              {/* Pulsing Circles */}
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className={`absolute rounded-full bg-orange-${100 + i * 100}`}
                  animate={{
                    scale: [1, 1.6 + i * 0.4, 1],
                    opacity: [0.55 - i * 0.1, 0, 0.55 - i * 0.1],
                  }}
                  transition={{
                    duration: 2 + i * 0.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.3,
                  }}
                  style={{ width: 180 + i * 20, height: 180 + i * 20 }}
                />
              ))}

              {/* Center Circle */}
              <motion.button
                onClick={loadUsers}
                whileTap={{ scale: 0.95 }}
                className="relative w-44 h-44 rounded-full bg-white shadow-2xl overflow-hidden border-4 border-orange-500 z-10 cursor-pointer group"
              >
                {currentUser?.photos?.[0] ? (
                  <img
                    src={currentUser.photos[0]}
                    alt={currentUser.fullName}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                    <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                  <svg className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              </motion.button>
            </div>

            <h2 className="text-2xl mb-3 text-center">No More Profiles</h2>
            <p className="text-gray-500 text-center mb-2">Check back later for more people in your area</p>
            <p className="text-sm text-orange-500 text-center">Tap your photo to refresh</p>
          </div>
        )}
      </div>



      {/* Match Modal */}
      <AnimatePresence>
        {matchState && (
          <MatchModal
            matchedUser={matchState.user}
            onClose={() => setMatchState(null)}
            onSendMessage={() => {
              if (matchState) {
                navigate(`/app/chat/${matchState.id}`, { state: { user: matchState.user } });
                setMatchState(null);
              } else {
                toast.error("Unable to start chat. Please try from messages.");
                setMatchState(null);
              }
            }}
          />
        )}
      </AnimatePresence>

      <DiscoveryFilterModal
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        initialFilters={filters}
        onApply={(newFilters) => {
          setFilters(newFilters);
        }}
      />
    </div >
  );
};