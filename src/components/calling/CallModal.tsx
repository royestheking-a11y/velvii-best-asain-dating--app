import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, MessageCircle, Volume2, VolumeX, ShieldCheck } from 'lucide-react';
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
    onMinimize
}) => {
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);

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

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (status === 'idle') return null;

    // Full Screen Call UI
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] bg-[#0F172A] flex flex-col items-center justify-between py-12 px-8 overflow-hidden"
            >
                {/* Dynamic Blurred Background */}
                <div
                    className="absolute inset-0 z-0 opacity-40 blur-3xl scale-110 pointer-events-none"
                    style={{
                        backgroundImage: `url(${callerImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                />
                <div className="absolute inset-0 z-0 bg-black/60 pointer-events-none" />

                {/* Top Controls */}
                <div className="w-full flex justify-between items-start pt-4 px-2">
                    <button onClick={onMinimize} className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
                        <MessageCircle className="w-6 h-6" />
                    </button>
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-widest font-bold mb-1">
                            <ShieldCheck className="w-3 h-3 text-green-500" />
                            End-to-End Encrypted
                        </div>
                    </div>
                    <div className="w-12" />
                </div>

                {/* Center Profile */}
                <div className="flex flex-col items-center relative z-10 -mt-10">
                    <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="relative mb-8"
                    >
                        {/* Animation for Calling/Ringing */}
                        {(status === 'outgoing' || status === 'ringing' || status === 'incoming') && (
                            <>
                                <div className="absolute inset-0 bg-white/10 rounded-full animate-ping duration-[2000ms]" />
                                <div className="absolute inset-0 bg-white/5 rounded-full animate-ping duration-[2000ms] delay-500" />
                            </>
                        )}
                        {status === 'connected' && (
                            <div className="absolute -inset-1 bg-green-500/20 rounded-full animate-pulse" />
                        )}

                        <div className="w-48 h-48 rounded-full border-4 border-[#1E293B] p-1 relative z-10 bg-[#0F172A] shadow-2xl">
                            <img src={callerImage} alt={callerName} className="w-full h-full rounded-full object-cover" />
                        </div>
                    </motion.div>

                    <h2 className="text-4xl font-bold text-white mb-4 tracking-tight text-center">{callerName}</h2>

                    {/* Status / Timer */}
                    <div className="text-center">
                        {status === 'connected' ? (
                            <div className="text-3xl font-mono font-medium text-white tracking-widest">
                                {formatTime(duration)}
                            </div>
                        ) : (
                            <p className="text-white/70 text-xl font-medium animate-pulse">
                                {status === 'requesting' && 'Requesting permission...'}
                                {status === 'outgoing' && 'Calling...'}
                                {status === 'ringing' && 'Ringing...'}
                                {status === 'incoming' && 'Incoming Call...'}
                            </p>
                        )}
                    </div>
                </div>

                {/* Bottom Controls */}
                <div className="w-full max-w-xs grid grid-cols-3 gap-6 items-center place-items-center mb-8 relative z-10">

                    {/* Mute */}
                    <div className="flex flex-col items-center gap-2">
                        <button
                            disabled={status !== 'connected'}
                            onClick={onToggleMute}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
                        >
                            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>
                        <span className="text-xs text-white/50 font-medium">Mute</span>
                    </div>

                    {/* End Call / Answer (Central Button) */}
                    <div className="flex flex-col items-center gap-2 -mt-4 transform scale-110">
                        {status === 'incoming' ? (
                            <div className="flex gap-6">
                                <button
                                    onClick={onReject}
                                    className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/40 hover:scale-110 transition-transform"
                                >
                                    <PhoneOff className="w-7 h-7" />
                                </button>
                                <button
                                    onClick={onAnswer}
                                    className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-500/40 hover:scale-110 transition-transform animate-pulse"
                                >
                                    <Phone className="w-7 h-7" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={onEnd}
                                className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-xl shadow-red-500/30 hover:scale-105 transition-all text-black"
                            >
                                <PhoneOff className="w-8 h-8 text-white" />
                            </button>
                        )}
                    </div>

                    {/* Speaker */}
                    <div className="flex flex-col items-center gap-2">
                        <button
                            disabled={status !== 'connected'}
                            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isSpeakerOn ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
                        >
                            {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <Volume2 className="w-6 h-6 opacity-80" />}
                        </button>
                        <span className="text-xs text-white/50 font-medium">Speaker</span>
                    </div>
                </div>

            </motion.div>
        </AnimatePresence>
    );
};
