import React from 'react';
import { Phone, Video, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CallTypeSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectVoice: () => void;
    onSelectVideo: () => void;
    userName: string;
    userImage: string;
}

export const CallTypeSelector: React.FC<CallTypeSelectorProps> = ({
    isOpen,
    onClose,
    onSelectVoice,
    onSelectVideo,
    userName,
    userImage
}) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
                onClick={onClose}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-sm bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-3xl p-8 shadow-2xl border border-white/10"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="relative inline-block mb-4">
                            <div className="w-20 h-20 rounded-full border-2 border-orange-500/50 p-0.5 mx-auto">
                                <img
                                    src={userImage}
                                    alt={userName}
                                    className="w-full h-full rounded-full object-cover"
                                />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-[#1E293B] flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                        </div>
                        <p className="text-white/60 text-sm mb-1">Call with</p>
                        <h2 className="text-white text-xl font-bold">{userName}</h2>
                    </div>

                    {/* Call Type Options */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        {/* Voice Call */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onSelectVoice}
                            className="group relative bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 hover:from-emerald-500/30 hover:to-emerald-600/20 border border-emerald-500/30 rounded-2xl p-6 flex flex-col items-center gap-3 transition-all duration-300"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <Phone className="w-7 h-7 text-white" />
                            </div>
                            <span className="text-white font-semibold">Voice</span>
                            <span className="text-white/50 text-xs">Audio only</span>
                        </motion.button>

                        {/* Video Call */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onSelectVideo}
                            className="group relative bg-gradient-to-br from-orange-500/20 to-orange-600/10 hover:from-orange-500/30 hover:to-orange-600/20 border border-orange-500/30 rounded-2xl p-6 flex flex-col items-center gap-3 transition-all duration-300"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                                <Video className="w-7 h-7 text-white" />
                            </div>
                            <span className="text-white font-semibold">Video</span>
                            <span className="text-white/50 text-xs">Camera on</span>
                        </motion.button>
                    </div>

                    {/* Cancel Button */}
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium transition-colors"
                    >
                        Cancel
                    </button>

                    {/* Decorative Elements */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent rounded-full" />
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
