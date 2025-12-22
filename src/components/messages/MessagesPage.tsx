import React, { useState, useEffect } from 'react';
import { Search, Trash2, Phone, PhoneIncoming, CheckCircle2, XCircle, Image as ImageIcon, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { User, Match } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { matches as apiMatches, actions as apiActions } from '@/services/api';
import { formatTimeAgo } from '@/utils/helpers';
import { toast } from 'sonner';

import { useNavigate } from 'react-router-dom';

export const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { socket, onlineUsers } = useSocket();

  const [newMatches, setNewMatches] = useState<Array<{ match: Match; user: User }>>([]);
  const [conversations, setConversations] = useState<Array<{ match: Match; user: User; lastMessage: any }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [whoLikesYouCount, setWhoLikesYouCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  // Handle Socket Updates - Real-time message updates from OTHER users
  useEffect(() => {
    if (socket && currentUser) {
      // Handle new incoming messages - update lastMessage in conversations
      const handleNewMessage = (data: any) => {
        console.log('[MessagesPage] Received socket message:', data);
        updateConversationWithMessage(data);
      };

      // Handle message updates (delete, read receipts, type changes)
      const handleMessageUpdate = ({ messageId, updates }: any) => {
        console.log('[MessagesPage] Socket message update:', messageId, updates);
        updateConversationWithMessageUpdate(messageId, updates);
      };

      socket.on('receive-message', handleNewMessage);
      socket.on('update-message', handleMessageUpdate);

      return () => {
        socket.off('receive-message', handleNewMessage);
        socket.off('update-message', handleMessageUpdate);
      };
    }
  }, [socket, currentUser]);

  // Handle LOCAL message events (for messages YOU create - call logs, missed calls, etc.)
  useEffect(() => {
    const handleLocalMessageAdded = (e: CustomEvent) => {
      console.log('[MessagesPage] Local message added:', e.detail);
      updateConversationWithMessage(e.detail);
    };

    const handleLocalMessageUpdated = (e: CustomEvent) => {
      console.log('[MessagesPage] Local message updated:', e.detail);
      const { messageId, updates } = e.detail;
      updateConversationWithMessageUpdate(messageId, updates);
    };

    window.addEventListener('message-added', handleLocalMessageAdded as EventListener);
    window.addEventListener('message-updated', handleLocalMessageUpdated as EventListener);

    return () => {
      window.removeEventListener('message-added', handleLocalMessageAdded as EventListener);
      window.removeEventListener('message-updated', handleLocalMessageUpdated as EventListener);
    };
  }, []);

  // Helper: Update conversation with a new message
  const updateConversationWithMessage = (data: any) => {
    setConversations(prev => {
      const matchIndex = prev.findIndex(c => c.match.id === data.matchId);

      if (matchIndex >= 0) {
        const updated = [...prev];
        updated[matchIndex] = {
          ...updated[matchIndex],
          lastMessage: data
        };
        // Re-sort by latest message
        return updated.sort((a, b) =>
          new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
        );
      } else {
        // New conversation - do a full reload
        loadData();
        return prev;
      }
    });
  };

  // Helper: Update conversation with message updates
  const updateConversationWithMessageUpdate = (messageId: string, updates: any) => {
    setConversations(prev => {
      return prev.map(conv => {
        if (conv.lastMessage?.id === messageId || conv.lastMessage?._id === messageId) {
          return {
            ...conv,
            lastMessage: {
              ...conv.lastMessage,
              ...updates
            }
          };
        }
        return conv;
      });
    });
  };

  const loadData = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      // 1. Load Matches (Rich object from new backend route)
      const matchesData: any[] = await apiMatches.getAll(currentUser.id);

      // 2. Load Likes (Who Likes Me)
      const likesData = await apiActions.getLikes(currentUser.id);
      setWhoLikesYouCount(likesData.length);

      // Process Matches
      const validMatches = matchesData.filter(m => m.user);

      // Separate New vs Conversations
      const newMatchesList = validMatches
        .filter(m => !m.lastMessage)
        .sort((a, b) => new Date(b.match.createdAt).getTime() - new Date(a.match.createdAt).getTime());

      const conversationsList = validMatches
        .filter(m => m.lastMessage)
        .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());

      setNewMatches(newMatchesList);
      setConversations(conversationsList);
    } catch (error) {
      console.error("Failed to load messages", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMatch = (matchId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteId(matchId);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      // Simulate delete API call or implement if available
      // await apiMatches.delete(deleteId);
      toast.success('Conversation deleted locally');
      // Optimistic update
      setConversations(prev => prev.filter(c => c.match.id !== deleteId));
      setNewMatches(prev => prev.filter(c => c.match.id !== deleteId));
      setDeleteId(null);
    }
  };

  const filteredNewMatches = newMatches.filter((m) =>
    m.user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConversations = conversations.filter((m) =>
    m.user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentUser) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="h-full bg-white flex flex-col relative">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 sticky top-0 bg-white z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Matches <span className="text-gray-400 text-lg font-medium">({newMatches.length + conversations.length})</span></h1>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search matches..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-200 transition-all"
          />
        </div>
      </div>

      {/* Content - Scrollable Area */}
      <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">

        {/* Who Likes You */}
        {whoLikesYouCount > 0 && (
          <motion.button
            onClick={() => navigate('/app/likes')}
            className="w-full px-6 py-4 flex items-center gap-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center overflow-hidden">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600" />
              </div>
              {/* Badge */}
              <div className="absolute -top-1 -right-1 w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white">
                +{whoLikesYouCount}
              </div>
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-medium mb-1">Someone liked you!</h3>
              <p className="text-sm text-gray-500">Tap to respond</p>
            </div>
            <div className="px-5 py-2 bg-orange-500 text-white rounded-full font-medium">
              Reveal
            </div>
          </motion.button>
        )}

        {/* New Matches Section */}
        {filteredNewMatches.length > 0 && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-xs font-bold text-orange-500 mb-3 uppercase tracking-wider">New Matches</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {filteredNewMatches.map(({ match, user }) => (
                <motion.button
                  key={match.id}
                  onClick={() => navigate(`/app/chat/${match.id}`, { state: { user } })}
                  className="flex flex-col items-center gap-2 min-w-[72px]"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="relative w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-orange-400 to-pink-500">
                    <img
                      src={user.photos[0]}
                      alt={user.fullName}
                      className="w-full h-full rounded-full object-cover border-2 border-white"
                    />
                    {onlineUsers.some(u => u.userId === user.id) && (
                      <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-700 truncate w-full text-center">
                    {user.fullName.split(' ')[0]}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Conversations Section */}
        <div className="p-0">
          {(filteredConversations.length > 0 || (filteredNewMatches.length === 0 && !searchQuery)) && (
            <h2 className="px-6 pt-4 pb-2 text-xs font-bold text-gray-900 uppercase tracking-wider">Messages</h2>
          )}

          {filteredConversations.map(({ match, user, lastMessage }) => {
            const hasUnread = !lastMessage.isRead && lastMessage.senderId !== currentUser.id;
            const timeAgo = formatTimeAgo(lastMessage.createdAt);

            return (
              <motion.button
                key={match.id}
                onClick={() => navigate(`/app/chat/${match.id}`, { state: { user } })}
                className="w-full px-6 py-4 flex items-center gap-4 border-b border-gray-100 hover:bg-gray-50 transition-colors group"
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={user.photos[0]}
                    alt={user.fullName}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  {onlineUsers.some(u => u.userId === user.id) && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                  )}
                  {hasUnread && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white">
                      1
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <h3 className="font-medium mb-1">{user.fullName.split(' ')[0]}</h3>
                  <p className={`text-sm truncate ${hasUnread ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {lastMessage.senderId === currentUser.id && 'You: '}
                    {lastMessage.type === 'text' ? (
                      <span className="text-gray-600 truncate">{lastMessage.content}</span>
                    ) : lastMessage.type === 'image' ? (
                      <span className="text-purple-600 font-medium flex items-center gap-1">
                        <ImageIcon size={14} className="fill-current" /> Photo
                      </span>
                    ) : lastMessage.type === 'call_request' ? (
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        <PhoneIncoming size={14} className="fill-current" /> Call Request
                      </span>
                    ) : lastMessage.type === 'call_accepted' ? (
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle2 size={14} /> Call Accepted
                      </span>
                    ) : lastMessage.type === 'call_declined' ? (
                      <span className="text-red-500 font-medium flex items-center gap-1">
                        <XCircle size={14} /> Call Declined
                      </span>
                    ) : lastMessage.type === 'missed_call' ? (
                      <span className="text-red-600 font-bold flex items-center gap-1">
                        <PhoneIncoming size={14} className="rotate-[135deg]" /> Missed Call
                      </span>
                    ) : lastMessage.type === 'call_log' ? (
                      <span className="text-gray-500 flex items-center gap-1">
                        <Phone size={14} /> {lastMessage.content}
                      </span>
                    ) : (
                      <span className="text-purple-600 font-medium">{lastMessage.content || 'Attachment'}</span>
                    )}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {timeAgo}
                  </div>
                  <div
                    onClick={(e) => handleDeleteMatch(match.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </div>
                </div>
              </motion.button>
            );
          })}

          {filteredConversations.length === 0 && filteredNewMatches.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center mb-6 relative"
              >
                <div className="absolute inset-0 bg-orange-100 rounded-full animate-ping opacity-20" />
                <img
                  src="https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?q=80&w=3786&auto=format&fit=crop"
                  alt="No Matches"
                  className="w-full h-full object-cover rounded-full opacity-0"
                /> {/* Preload hack if needed, or just use Icon */}
                <Flame className="w-10 h-10 text-orange-500 relative z-10" />
              </motion.div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2">Start Your Love Story</h3>
              <p className="text-gray-500 mb-8 max-w-xs mx-auto leading-relaxed">
                You haven't matched with anyone yet. Start swiping to meet new people nearby!
              </p>

              <button
                onClick={() => navigate('/app')}
                className="px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold rounded-full shadow-lg shadow-orange-500/30 hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
              >
                <Flame className="w-5 h-5" />
                Start Swiping
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-center mb-2">Delete Conversation?</h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              This will permanently remove this conversation.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};