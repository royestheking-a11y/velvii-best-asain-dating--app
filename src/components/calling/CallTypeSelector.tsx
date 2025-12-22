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
                className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
                onClick={onClose}
            >
                {/* Dark Backdrop */}
                <div className="absolute inset-0 bg-black/70" />

                {/* Modal - Solid White Background */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="relative inline-block mb-3">
                            <div className="w-16 h-16 rounded-full border-2 border-orange-400 p-0.5 mx-auto">
                                <img
                                    src={userImage}
                                    alt={userName}
                                    className="w-full h-full rounded-full object-cover"
                                />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-white rounded-full" />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm mb-1">Call with</p>
                        <h2 className="text-gray-900 text-lg font-bold">{userName}</h2>
                    </div>

                    {/* Call Type Options */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                        {/* Voice Call */}
                        <button
                            onClick={onSelectVoice}
                            className="bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 hover:border-emerald-300 rounded-2xl p-5 flex flex-col items-center gap-2 transition-all duration-200"
                        >
                            <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center shadow-md text-white">
                                <Phone className="w-6 h-6" />
                            </div>
                            <span className="text-gray-800 font-semibold text-sm">Voice</span>
                            <span className="text-gray-500 text-xs">Audio only</span>
                        </button>

                        {/* Video Call */}
                        <button
                            onClick={onSelectVideo}
                            className="bg-orange-50 hover:bg-orange-100 border-2 border-orange-200 hover:border-orange-300 rounded-2xl p-5 flex flex-col items-center gap-2 transition-all duration-200"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-md">
                                <Video className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-gray-800 font-semibold text-sm">Video</span>
                            <span className="text-gray-500 text-xs">Camera on</span>
                        </button>
                    </div>

                    {/* Cancel Button */}
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
