import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
    onComplete?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
    const [stage, setStage] = useState<'initial' | 'reveal' | 'exit'>('initial');

    useEffect(() => {
        // Sequence timing
        const sequence = async () => {
            // Hold 'initial' (Big V) for a big entrance - slightly faster for snappy feel
            await new Promise(r => setTimeout(r, 1000));

            // Switch to 'reveal' (Full Text)
            setStage('reveal');

            // Hold 'reveal' for a bit to read it
            await new Promise(r => setTimeout(r, 1500));

            // Exit
            setStage('exit');

            // Signal completion after exit animation
            setTimeout(() => {
                if (onComplete) onComplete();
            }, 500);
        };

        sequence();
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center overflow-hidden font-sans">
            {/* Background: Subtle animated mesh gradient for premium feel */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,237,213,0.3),_rgba(255,255,255,1))]" />

            <div className="relative z-10 flex items-center justify-center">
                <AnimatePresence mode='wait'>
                    <motion.div
                        className="flex items-center"
                        layout
                    >
                        {/* The "V" Logo Letter */}
                        <motion.span
                            layoutId="brand-v"
                            initial={{ scale: 3, opacity: 0, filter: 'blur(10px)' }}
                            animate={{
                                scale: stage === 'initial' ? 4 : 1,
                                opacity: 1,
                                filter: 'blur(0px)',
                                x: stage === 'initial' ? 0 : 0 // Handled by flex layout
                            }}
                            transition={{
                                duration: 1.0,
                                ease: [0.16, 1, 0.3, 1], // Apple-style Spring
                                layout: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
                            }}
                            className="text-[12rem] md:text-[20rem] font-black bg-gradient-to-br from-orange-500 to-pink-600 bg-clip-text text-transparent select-none leading-none tracking-tighter"
                            style={{ lineHeight: 0.8 }}
                        >
                            V
                        </motion.span>

                        {/* The rest of the letters "ELVII" */}
                        <div className="overflow-hidden flex">
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{
                                    width: stage === 'reveal' ? 'auto' : 0,
                                    opacity: stage === 'reveal' ? 1 : 0
                                }}
                                transition={{
                                    duration: 0.8,
                                    ease: [0.16, 1, 0.3, 1],
                                    delay: 0.1 // Slight delay after V starts moving
                                }}
                                className="flex items-center"
                            >
                                <span className="text-[12rem] md:text-[20rem] font-black bg-gradient-to-br from-orange-500 to-pink-600 bg-clip-text text-transparent select-none whitespace-nowrap pl-2 leading-none tracking-tighter" style={{ lineHeight: 0.8 }}>
                                    ELVII
                                </span>
                            </motion.div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Tagline - Only appears in 'reveal' stage */}
            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{
                    opacity: stage === 'reveal' ? 1 : 0,
                    y: stage === 'reveal' ? 0 : 10
                }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="absolute bottom-20 text-gray-400 font-medium tracking-[0.3em] text-xs uppercase"
            >
                Version 8.0
            </motion.p>
        </div>
    );
};
