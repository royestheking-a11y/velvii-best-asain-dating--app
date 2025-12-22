import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, MessageCircle, Volume2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CallModalProps {
    status: 'idle' | 'requesting' | 'incoming_request' | 'incoming' | 'outgoing' | 'ringing' | 'connected';
    callerName: string;
    callerImage: string;
    onAnswer: () => void;
    onReject: () => void;
    onEnd: () => void;
    onAcceptRequest: () => void;
    onRejectRequest: () => void;
    isMuted: boolean;
    onToggleMute: () => void;
    onMinimize?: () => void;
    // Video call props
    isVideoCall?: boolean;
    isCameraOn?: boolean;
    onToggleCamera?: () => void;
    localStream?: MediaStream | null;
    remoteStream?: MediaStream | null;
}

export const CallModal: React.FC<CallModalProps> = ({
    status,
    callerName,
    callerImage,
    onAnswer,
    onReject,
    onEnd,
    onAcceptRequest,
    onRejectRequest,
    isMuted,
    onToggleMute,
    onMinimize,
    isVideoCall = false,
    isCameraOn = true,
    onToggleCamera,
    localStream,
    remoteStream
}) => {
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Timer Logic
    const [duration, setDuration] = useState(0);
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === 'connected') {
            interval = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } else {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [status]);

    // Handle local video stream
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.muted = true;
            localVideoRef.current.play().catch(() => { });
        }
    }, [localStream]);

    // Handle remote video stream
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => { });
        }
    }, [remoteStream]);

    // Listen for remote video stream event
    useEffect(() => {
        const handleRemoteStream = (e: CustomEvent) => {
            console.log('[CallModal] Received remote video stream');
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = e.detail;
                remoteVideoRef.current.play().catch(() => { });
            }
        };

        window.addEventListener('remote-video-stream', handleRemoteStream as EventListener);
        return () => {
            window.removeEventListener('remote-video-stream', handleRemoteStream as EventListener);
        };
    }, []);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (status === 'idle') return null;

    const showVideoUI = isVideoCall && status === 'connected';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col overflow-hidden"
            >
                {/* Video Call - Remote Video Background */}
                {showVideoUI && (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}

                {/* Voice Call / Pre-connected Background */}
                {!showVideoUI && (
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-900" />
                )}

                {/* Overlay for video calls */}
                {showVideoUI && (
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
                )}

                {/* Local Video PIP */}
                {showVideoUI && (
                    <div className="absolute top-16 right-4 z-20 w-24 h-32 rounded-2xl overflow-hidden border-2 border-white/30 shadow-xl bg-black">
                        {isCameraOn ? (
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                <VideoOff className="w-6 h-6 text-white/50" />
                            </div>
                        )}
                    </div>
                )}

                {/* Top Bar */}
                <div className="relative z-10 flex justify-between items-start pt-12 px-4">
                    <button
                        onClick={onMinimize}
                        className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center"
                    >
                        <MessageCircle className="w-5 h-5" />
                    </button>
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 text-white/70 text-xs">
                            <ShieldCheck className="w-3 h-3 text-green-400" />
                            <span>Encrypted</span>
                        </div>
                        {isVideoCall && (
                            <div className="flex items-center gap-1 text-orange-400 text-xs mt-1">
                                <Video className="w-3 h-3" />
                                <span>Video Call</span>
                            </div>
                        )}
                    </div>
                    <div className="w-10" />
                </div>

                {/* Center Content */}
                <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
                    {/* Profile Picture - Always show except during connected video call */}
                    {!showVideoUI && (
                        <>
                            <div className="relative mb-6">
                                {/* Pulse animation for ringing/incoming */}
                                {(status === 'outgoing' || status === 'ringing' || status === 'incoming') && (
                                    <>
                                        <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
                                        <div className="absolute inset-0 bg-white/10 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
                                    </>
                                )}
                                {status === 'connected' && (
                                    <div className="absolute -inset-1 bg-green-500/30 rounded-full animate-pulse" />
                                )}
                                <div className="w-36 h-36 rounded-full border-4 border-white/20 p-1 relative z-10 bg-slate-800">
                                    <img src={callerImage} alt={callerName} className="w-full h-full rounded-full object-cover" />
                                </div>
                            </div>

                            <h2 className="text-3xl font-bold text-white mb-3 text-center">{callerName}</h2>

                            {/* Status Text */}
                            {status === 'connected' ? (
                                <div className="text-2xl font-mono text-white">
                                    {formatTime(duration)}
                                </div>
                            ) : (
                                <p className="text-white/70 text-lg animate-pulse">
                                    {status === 'requesting' && 'Requesting...'}
                                    {status === 'outgoing' && (isVideoCall ? 'Video Calling...' : 'Calling...')}
                                    {status === 'ringing' && 'Ringing...'}
                                    {status === 'incoming' && (isVideoCall ? 'Incoming Video Call...' : 'Incoming Call...')}
                                </p>
                            )}
                        </>
                    )}

                    {/* Video Call Connected - Name & Timer overlay */}
                    {showVideoUI && (
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">{callerName}</h2>
                            <div className="text-xl font-mono text-white/90 drop-shadow-lg">
                                {formatTime(duration)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Controls - Fixed with safe area */}
                <div className="relative z-10 pb-8 pt-4 px-4 bg-gradient-to-t from-black/60 to-transparent">
                    {status === 'incoming' ? (
                        /* Incoming Call - Answer/Reject */
                        <div className="flex justify-center gap-8">
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={onReject}
                                    className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg"
                                >
                                    <PhoneOff className="w-7 h-7" />
                                </button>
                                <span className="text-white/70 text-xs">Decline</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={onAnswer}
                                    className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg animate-pulse"
                                >
                                    {isVideoCall ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
                                </button>
                                <span className="text-white/70 text-xs">Accept</span>
                            </div>
                        </div>
                    ) : (
                        /* Outgoing/Connected - Control buttons */
                        <div className="flex justify-center items-end gap-4">
                            {/* Mute Button */}
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={onToggleMute}
                                    disabled={status !== 'connected'}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted
                                            ? 'bg-white text-black'
                                            : 'bg-white/20 text-white'
                                        } ${status !== 'connected' ? 'opacity-50' : ''}`}
                                >
                                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                </button>
                                <span className="text-white/70 text-xs">Mute</span>
                            </div>

                            {/* Camera Button - Video calls only */}
                            {isVideoCall && (
                                <div className="flex flex-col items-center gap-2">
                                    <button
                                        onClick={onToggleCamera}
                                        disabled={status !== 'connected'}
                                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${!isCameraOn
                                                ? 'bg-white text-black'
                                                : 'bg-white/20 text-white'
                                            } ${status !== 'connected' ? 'opacity-50' : ''}`}
                                    >
                                        {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                                    </button>
                                    <span className="text-white/70 text-xs">Camera</span>
                                </div>
                            )}

                            {/* End Call Button - Larger, centered */}
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={onEnd}
                                    className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg"
                                >
                                    <PhoneOff className="w-7 h-7" />
                                </button>
                                <span className="text-white/70 text-xs">End</span>
                            </div>

                            {/* Speaker Button */}
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                                    disabled={status !== 'connected'}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isSpeakerOn
                                            ? 'bg-white text-black'
                                            : 'bg-white/20 text-white'
                                        } ${status !== 'connected' ? 'opacity-50' : ''}`}
                                >
                                    <Volume2 className="w-5 h-5" />
                                </button>
                                <span className="text-white/70 text-xs">Speaker</span>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
