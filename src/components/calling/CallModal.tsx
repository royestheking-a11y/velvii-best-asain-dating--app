import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, MessageCircle, Volume2, ShieldCheck, ChevronDown, Camera, SwitchCamera } from 'lucide-react';
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
    onSwitchCamera?: () => void;
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
    onSwitchCamera,
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
    }, [localStream, status]); // Added status to ensure retry on connection

    // Handle remote video stream
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => { });
        }
    }, [remoteStream, status]);

    // Force refresh streams if they exist but aren't playing (Mobile Safari fix)
    useEffect(() => {
        const checkStreams = setInterval(() => {
            if (localVideoRef.current && localStream && localVideoRef.current.paused) {
                localVideoRef.current.play().catch(() => { });
            }
            if (remoteVideoRef.current && remoteStream && remoteVideoRef.current.paused) {
                remoteVideoRef.current.play().catch(() => { });
            }
        }, 2000);
        return () => clearInterval(checkStreams);
    }, [localStream, remoteStream]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (status === 'idle') return null;

    const isVideoMode = isVideoCall;
    const isConnected = status === 'connected';

    // WhatsApp Style Layout
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                className="fixed inset-0 z-[9999] text-white overflow-hidden flex flex-col"
                style={{ backgroundColor: '#0f172a' }} // Force solid background color
            >
                {/* --- LAYER 1: BACKGROUND / REMOTE VIDEO --- */}
                <div className="absolute inset-0 z-0">
                    {/* Remote Video (Only if connected & video mode & stream exists) */}
                    {isVideoMode && isConnected && remoteStream && (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    )}

                    {/* Dark Background + Avatar (If not connected OR voice mode OR waiting for stream) */}
                    {(!isVideoMode || !isConnected || !remoteStream) && (
                        <div className="w-full h-full flex flex-col items-center pt-24 bg-[#0b141a]">
                            <div className="relative mb-6">
                                {(status === 'ringing' || status === 'incoming' || status === 'outgoing') && (
                                    <>
                                        <div className="absolute inset-0 bg-white/10 rounded-full animate-ping duration-[2000ms]" />
                                        <div className="absolute inset-0 bg-white/5 rounded-full animate-ping duration-[2000ms] delay-500" />
                                    </>
                                )}
                                <img
                                    src={callerImage}
                                    alt={callerName}
                                    className="w-32 h-32 rounded-full object-cover border-2 border-white/20 relative z-10"
                                />
                            </div>
                            <h2 className="text-2xl font-semibold mb-2">{callerName}</h2>
                            <p className="text-white/60 text-lg flex items-center gap-2">
                                {status === 'connected' ? (remoteStream ? formatTime(duration) : 'Connecting video...') : (
                                    <>
                                        {status === 'outgoing' && 'Calling...'}
                                        {status === 'ringing' && 'Ringing...'}
                                        {status === 'incoming' && 'Incoming video call...'}
                                        {status === 'requesting' && 'Connecting...'}
                                    </>
                                )}
                            </p>
                        </div>
                    )}
                </div>

                {/* --- LAYER 2: LOCAL VIDEO PIP --- */}
                {/* WhatsApp style: Vertical rectangle, bottom right (usually) */}
                {isVideoMode && (
                    <motion.div
                        drag
                        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                        className="absolute bottom-32 right-4 z-20 w-32 h-48 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border border-white/10"
                    >
                        {isCameraOn ? (
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                <VideoOff className="w-8 h-8 text-white/40" />
                            </div>
                        )}
                    </motion.div>
                )}

                {/* --- LAYER 3: TOP HEADER --- */}
                <div className="absolute top-0 left-0 right-0 z-30 pt-12 pb-4 px-4 bg-gradient-to-b from-black/60 to-transparent flex justify-between items-start">
                    <button onClick={onMinimize} className="p-2">
                        <ChevronDown className="w-8 h-8 text-white" />
                    </button>

                    {isVideoMode && isConnected && (
                        <div className="flex flex-col items-center">
                            <h3 className="font-semibold text-lg shadow-black drop-shadow-md">{callerName}</h3>
                            <span className="text-sm text-white/80 shadow-black drop-shadow-md">{formatTime(duration)}</span>
                        </div>
                    )}

                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1 text-[10px] text-white/60 mb-1 bg-black/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                            <ShieldCheck className="w-3 h-3" />
                            <span>End-to-end encrypted</span>
                        </div>
                    </div>
                </div>

                {/* --- LAYER 4: BOTTOM CONTROLS --- */}
                <div
                    className="absolute bottom-0 left-0 right-0 z-30 px-6 py-8 rounded-t-3xl"
                    style={{ backgroundColor: '#0f172a' }}
                >

                    {/* INCOMING CALL UI */}
                    {status === 'incoming' ? (
                        <div className="flex flex-col items-center gap-8">
                            <p className="text-white/70">Swipe up to accept</p>
                            <div className="flex w-full justify-between px-8">
                                <div className="flex flex-col items-center gap-2">
                                    <button onClick={onReject} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mb-2">
                                        <PhoneOff className="w-8 h-8 fill-current" />
                                    </button>
                                    <span className="text-sm text-white/60">Decline</span>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <button onClick={onAnswer} className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mb-2 animate-bounce">
                                        <Video className="w-8 h-8 fill-current" />
                                    </button>
                                    <span className="text-sm text-white/60">Accept</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* CONNECTED / CALLING UI */
                        <div className="flex justify-between items-center px-2">
                            {/* Speaker */}
                            <button
                                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                                className={`p-3 rounded-full ${isSpeakerOn ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                            >
                                <Volume2 className="w-6 h-6" />
                            </button>

                            {/* Video Toggle */}
                            {isVideoMode && (
                                <button
                                    onClick={onToggleCamera}
                                    className={`p-3 rounded-full ${!isCameraOn ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                                >
                                    {isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                                </button>
                            )}

                            {/* Mute */}
                            <button
                                onClick={onToggleMute}
                                className={`p-3 rounded-full ${isMuted ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                            >
                                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </button>

                            {/* Flip Camera */}
                            {isVideoMode && (
                                <button
                                    onClick={onSwitchCamera}
                                    className={`p-3 rounded-full ${onSwitchCamera ? 'bg-white/10 text-white cursor-pointer hover:bg-white/20' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
                                    disabled={!onSwitchCamera}
                                >
                                    <SwitchCamera className="w-6 h-6" />
                                </button>
                            )}

                            {/* End Call (Prominent) */}
                            <button
                                onClick={onEnd}
                                className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/20"
                            >
                                <PhoneOff className="w-7 h-7 fill-current" />
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence >
    );
};
