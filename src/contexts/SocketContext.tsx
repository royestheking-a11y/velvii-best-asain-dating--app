import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { useAuth } from './AuthContext';
import { CallModal } from '@/components/calling/CallModal';
import { toast } from 'sonner';
import { Maximize2, Mic, MicOff, PhoneOff } from 'lucide-react';
import { messages as apiMessages, matches as apiMatches } from '@/services/api';
import { addMessage, updateMessage, getMatchById, updateMatch } from '@/utils/storage';
import { generateId } from '@/utils/helpers';
import { Message } from '@/types';

interface SocketContextType {
    callUser: (userId: string, userName: string, userImage: string, matchId?: string, onMessageSent?: (msg: Message) => void) => void;
    acceptVoiceRequest: (targetUserId: string, matchId: string, requestId: string, onMessageUpdate?: (msg: Message) => void) => void;
    rejectVoiceRequest: (targetUserId: string, requestId: string, onMessageUpdate?: (msg: Message) => void) => void;
    socket: Socket | null;
    onlineUsers: { userId: string; socketId: string }[];
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Use environment variable or default to localhost, stripping /api if present
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const SOCKET_URL = API_URL.replace('/api', '');

const PUBLIC_VAPID_KEY = import.meta.env.VITE_PUBLIC_VAPID_KEY || 'BK5krt_bXkImA7h-U5i4PUxTqnp6ojLAe4QM0XhmSsp-5B8OZFRAPY2Nm9wQB9DVlc1-zaAdCIpsGL8OpEHphn4';

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Add MiniPlayer Component
const MiniCallPlayer = ({
    callerName,
    callerImage,
    status,
    duration,
    onMaximize,
    onEnd,
    isMuted,
    onToggleMute
}: any) => {
    // Format duration
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed bottom-24 right-4 z-[9999] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 flex items-center gap-4 w-80 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="relative">
                <img src={callerImage} className="w-12 h-12 rounded-full object-cover border-2 border-green-500" />
                <div className="absolute inset-0 rounded-full border-2 border-green-500 animate-ping opacity-75" />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold truncate">{callerName}</h4>
                <p className="text-green-400 text-xs font-mono">{status === 'connected' ? formatTime(duration) : status}</p>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={onToggleMute} className={`p-2 rounded-full ${isMuted ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                    {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button onClick={onEnd} className="p-2 rounded-full bg-red-500 text-white">
                    <PhoneOff size={16} />
                </button>
                <button onClick={onMaximize} className="p-2 rounded-full bg-slate-700 text-white hover:bg-slate-600">
                    <Maximize2 size={16} />
                </button>
            </div>
        </div>
    );
};

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<{ userId: string; socketId: string }[]>([]);

    // Call State
    const [callStatus, setCallStatus] = useState<'idle' | 'requesting' | 'incoming_request' | 'incoming' | 'outgoing' | 'connected'>('idle');
    const [isMinimized, setIsMinimized] = useState(false);

    // Timer
    const [callDuration, setCallDuration] = useState(0);
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (callStatus === 'connected') {
            interval = setInterval(() => setCallDuration(p => p + 1), 1000);
        } else {
            setCallDuration(0);
        }
        return () => clearInterval(interval);
    }, [callStatus]);

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [callerName, setCallerName] = useState('');
    const [callerImage, setCallerImage] = useState('');
    const [callerSignal, setCallerSignal] = useState<any>(null);
    const [otherUserId, setOtherUserId] = useState('');
    const [currentMatchId, setCurrentMatchId] = useState<string>('');

    const [isMuted, setIsMuted] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);

    // Refs
    const connectionRef = useRef<Peer.Instance | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const otherUserIdRef = useRef<string>('');
    const ringtoneRef = useRef<HTMLAudioElement | null>(null);

    // Update ref when state changes
    useEffect(() => {
        otherUserIdRef.current = otherUserId;
    }, [otherUserId]);

    // --- SOUND MANAGEMENT ---
    const playRingtone = (type: 'incoming' | 'outgoing') => {
        // Stop any existing sound first (Safety)
        stopRingtone();

        console.log(`[CallDebug] playRingtone triggered for: ${type}`);
        const audio = new Audio();

        if (type === 'incoming') {
            audio.src = 'https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3';
            audio.loop = true;
        } else {
            audio.src = 'https://assets.mixkit.co/active_storage/sfx/1361/1361-preview.mp3';
            audio.loop = true;
        }

        // Store reference BEFORE playing to ensure we can stop it even if play fails
        ringtoneRef.current = audio;

        audio.play().catch(e => {
            console.log("Audio play failed (interaction needed):", e);
            // If play fails, clear the ref so we don't think it's playing
            if (ringtoneRef.current === audio) {
                // But wait, we might want to keep it if it's just interaction block? 
                // No, usually best to just log.
            }
        });
    };

    const stopRingtone = () => {
        console.log("[CallDebug] stopRingtone called.");
        if (ringtoneRef.current) {
            console.log("[CallDebug] Stopping active ringtone...");
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
            ringtoneRef.current.src = ""; // Detach source
            ringtoneRef.current = null; // Clear ref
        }
    };

    const playSound = (type: 'end' | 'connect') => {
        const audio = new Audio();
        if (type === 'end') audio.src = 'https://assets.mixkit.co/active_storage/sfx/1364/1364-preview.mp3'; // Hang up click
        if (type === 'connect') audio.src = 'https://assets.mixkit.co/active_storage/sfx/1360/1360-preview.mp3'; // Pick up click
        audio.play().catch(() => { });
    };

    // REGISTER PUSH NOTIFICATIONS
    useEffect(() => {
        if (currentUser && 'serviceWorker' in navigator && 'PushManager' in window) {
            const registerPush = async () => {
                try {
                    const registration = await navigator.serviceWorker.ready;

                    // Check existing
                    let subscription = await registration.pushManager.getSubscription();

                    // If not subscribed, subscribe
                    if (!subscription) {
                        try {
                            subscription = await registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
                            });
                        } catch (subErr) {
                            console.error("Push Subscribe Failed (likely denied):", subErr);
                            return;
                        }
                    }

                    // Send to Server
                    if (subscription) {
                        // User requested to IGNORE subscription errors for now.
                        // await fetch(`${API_URL}/notifications/subscribe`, {
                        //     method: 'POST',
                        //     body: JSON.stringify({
                        //         subscription,
                        //         userId: currentUser.id,
                        //         userAgent: navigator.userAgent
                        //     }),
                        //     headers: {
                        //         'Content-Type': 'application/json'
                        //     }
                        // });
                        console.log("✅ Push Subscription (Skipped/Disabled)");
                    }

                } catch (err) {
                    console.error("Service Worker/Push Error:", err);
                }
            };

            registerPush();
        }
    }, [currentUser]);

    // Initialize Socket
    useEffect(() => {
        if (currentUser) {
            const newSocket = io(SOCKET_URL);
            setSocket(newSocket);

            newSocket.emit('add-user', currentUser.id);

            // --- PERMISSION EVENTS ---
            newSocket.on('voice-permission-requested', ({ from, name }) => {
                console.log("Voice permission requested (Legacy Event) from:", name);
                // NO UI: We rely on the chat message now.
            });

            newSocket.on('voice-permission-granted', ({ from }) => {
                console.log(`[CallDebug] Permission GRANTED by: ${from}`);
                // Debug Toast to see if we get a Socket ID or User ID
                toast.success(`Permission Granted by: ${from}`);

                // Ensure ID is stored as string and Namespaced
                if (currentUser?.id) {
                    localStorage.setItem(`voice_perm_${currentUser.id}_${String(from)}`, 'true');
                }
            });

            newSocket.on('voice-permission-denied', () => {
                toast.error("Voice call request declined.");
                if (otherUserIdRef.current && currentUser?.id) {
                    localStorage.removeItem(`voice_perm_${currentUser.id}_${otherUserIdRef.current}`);
                }
                setCallStatus('idle');
            });

            // --- CALL EVENTS ---
            newSocket.on('call-made', ({ signal, from, name, image }) => {
                setCallStatus('incoming');
                setCallerName(name || 'Unknown');
                setCallerImage(image || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'); // Generic Fallback
                setCallerSignal(signal);
                setOtherUserId(from);
                setIsMinimized(false);

                // Play Incoming Ringtone
                playRingtone('incoming');
            });

            newSocket.on('call-answered', ({ signal }) => {
                setCallAccepted(true);
                setCallStatus('connected');
                stopRingtone(); // Stop ringing
                // Removed playSound('connect')
                connectionRef.current?.signal(signal);
            });

            newSocket.on('ice-candidate', ({ candidate }) => {
                connectionRef.current?.addIceCandidate(candidate);
            });

            // Clean up when call is rejected remotely
            newSocket.on('call-rejected', () => {
                toast.error("Call Declined");
                leaveCall();
            });

            // Clean up when call is ended remotely (Hang up)
            newSocket.on('call-ended', () => {
                toast.info("Call Ended");
                // We need a version of leaveCall that doesn't re-emit 'end-call' to avoid loops
                // Or just call leaveCall, but ensure state check prevents loop
                // For simplicity, we can just reset state here manually to avoid "double logging" or loops

                stopRingtone();
                playSound('end');
                setCallEnded(true);
                connectionRef.current?.destroy();
                // stream?.getTracks().forEach(track => track.stop()); // Don't kill my own stream? Maybe yes.
                // Actually, usually good to stop everything.
                setCallStatus('idle');
                setIsMinimized(false);
                setStream(null);
            });

            // --- GLOBAL NOTIFICATION LISTENER ---
            newSocket.on('receive-notification', (notification: any) => {
                // Play specific sounds based on type
                if (notification.type === 'match') {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'); // Success Chime
                    audio.play().catch(() => { });
                    toast.success(notification.title, {
                        description: notification.message,
                        duration: 5000,
                        icon: '💖'
                    });
                } else if (notification.type === 'message') {
                    // Message sound is handled in receive-message usually, but if this is a generic alert:
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); // Blip
                    audio.play().catch(() => { });
                    toast.message(notification.title, { description: notification.message });
                }

                // BROWSER SYSTEM NOTIFICATION (Background Support)
                if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
                    try {
                        new Notification(notification.title, {
                            body: notification.message,
                            icon: '/pwa-192x192.png'
                        });
                    } catch (e) {
                        console.log("Notification failed", e);
                    }
                }
            });

            // --- GLOBAL MESSAGE LISTENER ---
            // This ensures we catch messages (like Missed Calls) even if not on the ChatPage
            newSocket.on('receive-message', (data: Message) => {
                // Save to storage
                addMessage(data);

                // Play Message Sound (Tantan-like quick pop)
                // Only play if not me (obviously)
                if (data.senderId !== currentUser.id) {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); // Pop sound
                    audio.play().catch(e => console.log('Audio autoplay blocked', e));

                    // Show Toast if NOT on the chat page for this user
                    // Simple check: if URL doesn't contain matchId (approximate)
                    if (!window.location.href.includes(data.matchId)) {
                        // Determine notification text - show friendly message for images
                        let notificationText = data.content;
                        if (data.type === 'image' || (data.content && data.content.includes('cloudinary.com'))) {
                            notificationText = 'Sent a photo 📷';
                        } else if (data.content.length > 30) {
                            notificationText = data.content.substring(0, 30) + '...';
                        }

                        toast.info("New Message", {
                            description: notificationText,
                            icon: '💬'
                        });

                        // BROWSER NOTIFICATION
                        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
                            try {
                                new Notification("New Message", {
                                    body: notificationText,
                                    icon: '/pwa-192x192.png'
                                });
                            } catch (e) { console.log("Notification error", e); }
                        }
                    }
                }
            });

            // --- GLOBAL MESSAGE UPDATE LISTENER ---
            // Handles Read Receipts and other updates
            newSocket.on('update-message', ({ messageId, updates }: any) => {
                console.log(`[Socket] Persisting update for ${messageId}`, updates);
                updateMessage(messageId, updates);
            });

            // Request Permission on Connect
            if ('Notification' in window && Notification.permission === 'default') {
                try {
                    Notification.requestPermission();
                } catch (e) {
                    console.log("Notification permission request failed", e);
                }
            }

            // Sync Online Users
            newSocket.on('get-users', (users: any) => {
                setOnlineUsers(users);
            });

            return () => {
                newSocket.disconnect();
                stopRingtone();
            };
        }
    }, [currentUser]);

    // Audio Stream Setup
    const getMedia = async () => {
        try {
            const currentStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            setStream(currentStream);
            return currentStream;
        } catch (err) {
            console.error('Failed to get media:', err);
            toast.error('Could not access microphone.');
            return null;
        }
    };

    // 0. START FLOW
    const callUser = async (userId: string, userName: string, userImage: string, matchId?: string, onMessageSent?: (msg: Message) => void) => {

        // ---------------------------------------------------------
        // ROBUSTNESS FIX: RECOVER MATCH ID IF MISSING (Google/State issue)
        // ---------------------------------------------------------
        let resolvedMatchId = matchId;
        if ((!resolvedMatchId || resolvedMatchId === 'unknown') && currentUser?.id && userId) {
            try {
                // Fetch matches to find the conversation ID
                const allMatches = await apiMatches.getAll(currentUser.id);
                // The API returns { match: Match, user: User, ... }
                const foundEntry = allMatches.find((entry: any) =>
                    entry.match?.user1Id === userId ||
                    entry.match?.user2Id === userId
                );

                if (foundEntry && foundEntry.match?.id) {
                    resolvedMatchId = foundEntry.match.id;
                    console.log(`[callUser] Recovered matchId: ${resolvedMatchId}`);
                    // Update state for next time
                    setCurrentMatchId(resolvedMatchId || '');
                }
            } catch (e) {
                console.error("[callUser] Failed to recover Match ID", e);
            }
        }
        // ---------------------------------------------------------

        // Check Local Permission (Persistence)
        // SECURITY FIX: Namespace permission with CURRENT USER ID to prevent leakage across sessions (Google Bypass)
        const permKey = `voice_perm_${currentUser?.id}_${userId}`;
        const hasLocalPermission = localStorage.getItem(permKey) === 'true';

        // Check Match Permission (Source of Truth)
        let hasMatchPermission = false;
        if (resolvedMatchId) {
            const match = getMatchById(resolvedMatchId);
            if (match?.voiceCallEnabled) {
                hasMatchPermission = true;
            }
        }

        // STRICTER CHECK: If strict flow needed, rely on match object if available
        // REVERTED: Using OR because local storage is updated immediately upon accept, 
        // while match object might be stale. We trust Local if it says true.
        const hasPermission = hasLocalPermission || hasMatchPermission;

        console.log(`[CallDebug] Permission Check for ${userId} -> MatchId: ${resolvedMatchId}, Allowed: ${hasPermission} (Local: ${hasLocalPermission}, Match: ${hasMatchPermission})`);

        if (hasPermission) {
            // ONLY set call state if we are ACTUALLY calling
            setCallerName(userName);
            setCallerImage(userImage);
            setOtherUserId(userId);
            if (resolvedMatchId) setCurrentMatchId(resolvedMatchId);
            setIsMinimized(false);

            startActualCall(userId);
        } else {
            // Dynamic Check: Maybe backend knows it's allowed (User B accepted) but local is stale
            let serverPerm = false;
            if (resolvedMatchId) {
                try {
                    console.log("[CallDebug] Checking server for match permission...");
                    const matchData = await apiMatches.getById(resolvedMatchId);
                    if (matchData && matchData.voiceCallEnabled) {
                        serverPerm = true;
                        console.log("[CallDebug] Server says YES! Validating local permission...");

                        // FIX: If server says yes, update Local Storage so next check is instant
                        // This fixes the "Google User" issue where local might be empty initially
                        const permKey = `voice_perm_${currentUser?.id}_${userId}`;
                        localStorage.setItem(permKey, 'true');

                        // Update local match cache
                        updateMatch(resolvedMatchId, { voiceCallEnabled: true });

                        // It's allowed! correct state and start
                        setCallerName(userName);
                        setCallerImage(userImage);
                        setOtherUserId(userId);
                        if (resolvedMatchId) setCurrentMatchId(resolvedMatchId);
                        setIsMinimized(false);

                        startActualCall(userId);
                        return;
                    }
                } catch (e) {
                    console.log("[CallDebug] Server check failed", e);
                }
            }

            console.log("[CallDebug] Permission missing. Sending request.");
            // NEW FLOW: Send Request Message
            const msg: Partial<Message> = {
                id: generateId(),
                matchId: matchId || 'unknown',
                senderId: currentUser?.id || '',
                receiverId: userId,
                type: 'call_request',
                content: "📞 Voice Call Request",
                isRead: false,
                isDelivered: true,
                createdAt: new Date().toISOString()
            };

            // PERSISTENCE FIX: Save to DB via API
            try {
                // We cast to Message because we need the full object for local addMessage
                addMessage(msg as Message);
                if (onMessageSent) onMessageSent(msg as Message);

                // API Call
                apiMessages.send(msg);

                // CRITICAL FIX: Emit to socket so receiver sees it INSTANTLY
                socket?.emit("send-message", {
                    ...msg,
                    to: userId, // Ensure 'to' is set for routing
                    isAI: false // Assumption for now
                });

                // REMOVED: request-voice-permission
                // User requirement: "doesn't need to send a call UI"
                // We strictly rely on the chat message.

            } catch (e) {
                console.error("Failed to save call request", e);
            }

            // NO INTRUSIVE MODAL FOR REQUESTS
            // We rely on the chat message to show the request.
            toast.success("Voice call request sent.");
        }
    };

    // 1. Start Actual Call (Outgoing)
    const startActualCall = async (userId: string) => {
        setCallStatus('outgoing');
        playRingtone('outgoing'); // Play Ringback

        const currentStream = await getMedia();
        if (!currentStream || !socket) return;

        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream: currentStream,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        peer.on('signal', (data) => {
            // Capture current user state safely
            const userPhoto = (currentUser?.photos && currentUser.photos.length > 0)
                ? currentUser.photos[0]
                : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

            console.log("[CallDebug] Emitting call-user. Image:", userPhoto);

            socket.emit('call-user', {
                userToCall: userId,
                signalData: data,
                from: currentUser?.id,
                name: currentUser?.fullName,
                image: userPhoto
            });
        });

        peer.on('stream', (userStream) => {
            playRemoteAudio(userStream);
        });

        connectionRef.current = peer;
    };

    // 2. Answer Call
    const answerCall = async () => {
        stopRingtone(); // Stop Incoming Ring
        // Removed playSound('connect') per user request for silence

        const currentStream = await getMedia();
        if (!currentStream || !socket) return;
        setCallAccepted(true);
        setCallStatus('connected');
        setIsMinimized(false);

        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: currentStream,
        });

        peer.on('signal', (data) => {
            socket.emit('answer-call', { signal: data, to: otherUserId });
        });

        peer.on('stream', (userStream) => {
            playRemoteAudio(userStream);
        });

        peer.signal(callerSignal);
        connectionRef.current = peer;
    };

    // Helper: Play Remote Audio
    const playRemoteAudio = (userStream: MediaStream) => {
        const audio = new Audio();
        audio.srcObject = userStream;
        audio.play();
        remoteAudioRef.current = audio;
    };

    // 3. Permission Response
    const acceptVoiceRequest = (targetUserId: string, matchId: string, requestId: string, onMessageUpdate?: (msg: Message) => void) => {
        // Send 'from' explicitly so server doesn't have to look it up
        socket?.emit('voice-permission-accepted', {
            from: currentUser?.id
        });
        if (currentUser?.id) {
            localStorage.setItem(`voice_perm_${currentUser.id}_${targetUserId}`, 'true');
        }

        // KEY FIX: Enable voice call on the Match object itself (Bidirectional)
        updateMatch(matchId, { voiceCallEnabled: true }); // Local update

        // PERSISTENCE FIX: Update DB via API
        // This ensures the other user pulls this status next time they load matches
        try {
            // We need to import matchesApi in this file first
            apiMatches.update(matchId, { voiceCallEnabled: true });
        } catch (e) { console.error("Failed to persist match voice enable", e); }

        const updateData: Partial<Message> = {
            type: 'call_accepted',
            content: "Voice Call accepted"
        };

        updateMessage(requestId, updateData);

        // PERSISTENCE FIX: Update DB
        apiMessages.update(requestId, updateData).catch(err => console.error("Failed to persist val accepted", err));

        socket?.emit("update-message", { messageId: requestId, updates: updateData, to: targetUserId });
        if (onMessageUpdate) onMessageUpdate(updateData as Message);
        setCallStatus('idle');
    };

    const rejectVoiceRequest = (targetUserId: string, requestId: string, onMessageUpdate?: (msg: Message) => void) => {
        socket?.emit('voice-permission-rejected', {
            to: targetUserId,
            from: currentUser?.id
        });

        const updateData: Partial<Message> = {
            type: 'call_declined',
            content: "Voice Call declined"
        };

        updateMessage(requestId, updateData);

        // PERSISTENCE FIX: Update DB
        apiMessages.update(requestId, updateData).catch(err => console.error("Failed to persist call declined", err));

        socket?.emit("update-message", { messageId: requestId, updates: updateData, to: targetUserId });
        if (onMessageUpdate) onMessageUpdate(updateData as Message);

        setCallStatus('idle');
        setIsMinimized(false);
    };

    // 4. Leave Call
    const leaveCall = async () => {
        stopRingtone(); // Ensure ringtone stops
        playSound('end');

        // Capture current state for async logic
        const _otherUserId = otherUserId;
        const _currentUser = currentUser;

        // Reset UI State IMMEDIATELY (Responsive)
        setCallAccepted(false);
        setCallEnded(true);
        connectionRef.current?.destroy();
        stream?.getTracks().forEach(track => track.stop());
        setStream(null);
        setCallStatus('idle');
        setIsMinimized(false);
        setCallDuration(0);

        // Clear refs
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
            remoteAudioRef.current = null;
        }

        // Logic (Async background)
        let resolvedMatchId = currentMatchId;

        // Recovery: If match ID is missing, try to find it
        if ((!resolvedMatchId || resolvedMatchId === 'unknown') && _currentUser && _otherUserId) {
            try {
                // Fetch matches to find the conversation ID
                const allMatches = await apiMatches.getAll(_currentUser.id);
                // The API returns { match: Match, user: User, ... }
                const foundEntry = allMatches.find((entry: any) =>
                    entry.match?.user1Id === _otherUserId ||
                    entry.match?.user2Id === _otherUserId
                );

                if (foundEntry && foundEntry.match?.id) {
                    resolvedMatchId = foundEntry.match.id;
                    console.log(`[leaveCall] Recovered matchId: ${resolvedMatchId}`);
                    // Update state for next time (even though call ended)
                    setCurrentMatchId(resolvedMatchId);
                }
            } catch (e) {
                console.error("[leaveCall] Failed to recover Match ID", e);
            }
        }

        // Fallback default
        if (!resolvedMatchId) resolvedMatchId = 'unknown';

        if (callStatus === 'connected') {
            const durationText = formatDuration(callDuration);
            const logMsg: Message = {
                id: generateId(),
                matchId: resolvedMatchId,
                senderId: _currentUser?.id || 'unknown',
                receiverId: _otherUserId,
                type: 'call_log',
                content: `Call ended • ${durationText}`,
                isRead: true,
                isDelivered: true,
                isSeen: false,
                deletedFor: [],
                isDeleted: false,
                createdAt: new Date().toISOString()
            };

            // Only save if we have valid IDs
            if (_currentUser?.id && _otherUserId) {
                // Save Locally
                addMessage(logMsg);
                apiMessages.send(logMsg).catch(e => console.error("Failed to save call log", e));

                // Log to Other User
                socket?.emit("send-message", {
                    ...logMsg,
                    text: logMsg.content
                });
            }

            // CRITICAL FIX: Tell the other user to hang up
            socket?.emit("end-call", { to: _otherUserId });
        }
        else if (callStatus === 'incoming') {
            // Rejected the call by ME (the callee)
            socket?.emit('reject-call', { to: _otherUserId });
        }
        else if (callStatus === 'outgoing' || callStatus === 'requesting') {
            // Cancelled by ME (the caller) -> Missed Call for THEM
            const missedMsg: Message = {
                id: generateId(),
                matchId: resolvedMatchId,
                senderId: _currentUser?.id || 'unknown',
                receiverId: _otherUserId,
                type: 'missed_call',
                content: "Missed Call",
                isRead: false,
                isDelivered: true,
                isSeen: false,
                deletedFor: [],
                isDeleted: false,
                createdAt: new Date().toISOString()
            };

            if (_currentUser?.id && _otherUserId) {
                // Save Locally
                addMessage(missedMsg);
                apiMessages.send(missedMsg).catch(e => console.error("Failed to save missed call", e));

                // Send to other user so they see the red icon
                socket?.emit("send-message", {
                    ...missedMsg,
                    text: missedMsg.content
                });
            }

            socket?.emit("end-call", { to: _otherUserId });
        }
    };

    // Utilities
    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // TIMEOUT LOGIC
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (callStatus === 'requesting' || callStatus === 'outgoing') {
            // 30s Timeout for Caller
            timeout = setTimeout(() => {
                toast.error("User is not answering...");
                stopRingtone();

                // Generate Missed Call Log
                const missedMsg: Message = {
                    id: generateId(),
                    matchId: currentMatchId || 'unknown',
                    senderId: currentUser?.id || '',
                    receiverId: otherUserId,
                    type: 'missed_call',
                    content: "Missed Call",
                    isRead: false,
                    isDelivered: true,
                    isSeen: false,
                    deletedFor: [],
                    isDeleted: false,
                    createdAt: new Date().toISOString()
                };

                // Save Locally for ME
                addMessage(missedMsg);

                // PERSISTENCE FIX: Save to DB
                apiMessages.send(missedMsg).catch(err => console.error("Failed to persist missed call", err));

                // Send to Other User
                socket?.emit("send-message", {
                    ...missedMsg,
                    text: "Missed Call"
                });

                setCallStatus('idle');
                connectionRef.current?.destroy();
                stream?.getTracks().forEach(track => track.stop());
                setStream(null);
            }, 30000);
        }
        return () => clearTimeout(timeout);
    }, [callStatus, otherUserId, socket, currentUser, currentMatchId]);

    // Button Handlers
    const toggleMute = () => {
        if (stream) {
            // Toggle all audio tracks
            stream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted); // Update state based on previous state
        }
    };

    const toggleSpeaker = async () => {
        // Note: setSinkId is experimental and only on some browsers
        setIsSpeakerOn(!isSpeakerOn);
        if (remoteAudioRef.current && (remoteAudioRef.current as any).setSinkId) {
            try {
                // Just logging for now as we don't have device IDs enum
                console.log("Attempting to switch audio output...");
            } catch (e) {
                console.error("Error switching speaker", e);
            }
        }
    };

    const toggleMinimize = () => {
        setIsMinimized(!isMinimized);
    };

    return (
        <SocketContext.Provider value={{
            callUser,
            acceptVoiceRequest,
            rejectVoiceRequest,
            socket,
            onlineUsers
        }}>
            {children}

            {/* Render Mini Player if Minimized */}
            {isMinimized && callStatus !== 'idle' && (
                <MiniCallPlayer
                    callerName={callerName}
                    callerImage={callerImage}
                    status={callStatus}
                    duration={callDuration}
                    onMaximize={() => setIsMinimized(false)}
                    onEnd={leaveCall}
                    isMuted={isMuted}
                    onToggleMute={toggleMute}
                />
            )}

            {/* Render Full Screen if NOT Minimized */}
            {!isMinimized && callStatus !== 'idle' && (
                <CallModal
                    status={callStatus}
                    callerName={callerName}
                    callerImage={callerImage}
                    onAnswer={answerCall}
                    onReject={leaveCall}
                    onEnd={leaveCall}
                    onAcceptRequest={() => acceptVoiceRequest(otherUserId, currentMatchId || 'unknown', 'legacy_request')}
                    onRejectRequest={() => rejectVoiceRequest(otherUserId, 'legacy_request')}
                    isMuted={isMuted}
                    onToggleMute={toggleMute}
                    onMinimize={toggleMinimize} // Now works
                />
            )}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};
