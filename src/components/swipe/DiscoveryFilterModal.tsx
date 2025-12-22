import React, { useState } from 'react';
import { X, Check, MapPin, Calendar, Heart, Shield, Users, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ManualSingleSlider } from '@/components/ui/manual-single-slider';

interface FilterState {
    distance: number[];
    ageRange: [number, number];
    gender: 'male' | 'female' | 'everyone';
    verifiedOnly: boolean;
    hasBio: boolean;
    onlineNow: boolean;
}

interface DiscoveryFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: FilterState) => void;
    initialFilters: FilterState;
}

interface ToggleProps {
    value: boolean;
    onChange: (value: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ value, onChange }) => {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(!value);
            }}
            className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${value ? 'bg-orange-500' : 'bg-gray-300'}`}
        >
            <motion.div
                className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                animate={{
                    left: value ? '24px' : '4px',
                }}
                transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                }}
            />
        </button>
    );
};

export const DiscoveryFilterModal: React.FC<DiscoveryFilterModalProps> = ({
    isOpen,
    onClose,
    onApply,
    initialFilters
}) => {
    const [filters, setFilters] = useState<FilterState>(initialFilters);

    // Sync state when opening
    React.useEffect(() => {
        if (isOpen) {
            setFilters(initialFilters);
        }
    }, [isOpen, initialFilters]);

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleClear = () => {
        setFilters({
            distance: [50],
            ageRange: [18, 50],
            gender: 'everyone',
            verifiedOnly: false,
            hasBio: false,
            onlineNow: false
        });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Premium Header */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 flex-shrink-0 bg-white z-20">
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-orange-500 to-pink-600 bg-clip-text text-transparent">
                                Smart Filters
                            </h2>
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                            >
                                Clear
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-12">

                            {/* Show Me (Gender) */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Users className="w-5 h-5 text-purple-500" />
                                    <h3 className="text-base font-bold text-gray-900">Show Me</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {['male', 'female', 'everyone'].map((g) => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setFilters(prev => ({ ...prev, gender: g as any }))}
                                            className={`py-3 px-3 rounded-xl text-sm font-bold transition-all cursor-pointer border ${filters.gender === g
                                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-md transform scale-[1.02]'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-200 hover:bg-purple-50'
                                                }`}
                                        >
                                            {g === 'male' ? 'Men' : g === 'female' ? 'Women' : 'Everyone'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            {/* Distance Slider (Manual) */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-orange-500" />
                                        <h3 className="text-base font-bold text-gray-900">Maximum Distance</h3>
                                    </div>
                                    <span className="text-orange-600 font-bold bg-orange-50 px-3 py-1 rounded-full text-sm">
                                        {filters.distance[0]} km
                                    </span>
                                </div>
                                <ManualSingleSlider
                                    value={filters.distance[0]}
                                    min={1}
                                    max={200}
                                    onChange={(val) => setFilters(prev => ({ ...prev, distance: [val] }))}
                                />
                            </div>

                            <Separator />

                            {/* Age Range Slider */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-pink-500" />
                                        <h3 className="text-base font-bold text-gray-900">Age Range</h3>
                                    </div>
                                    <span className="text-pink-600 font-bold bg-pink-50 px-3 py-1 rounded-full text-sm">
                                        {filters.ageRange[0]} - {filters.ageRange[1]}
                                    </span>
                                </div>
                                <Slider
                                    defaultValue={[18, 50]}
                                    value={filters.ageRange}
                                    min={18}
                                    max={100}
                                    step={1}
                                    minStepsBetweenThumbs={1}
                                    onValueChange={(val) => setFilters(prev => ({ ...prev, ageRange: val as [number, number] }))}
                                    className="py-4"
                                />
                            </div>

                            <Separator />

                            {/* Toggles Section */}
                            <div className="space-y-4">
                                {/* Verified Only */}
                                <div
                                    className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100 relative overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => setFilters(prev => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))}
                                >
                                    <div className="flex items-center gap-3 select-none flex-1 relative z-10">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 shadow-sm">
                                            <Shield className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">Verified Photos</h3>
                                            <p className="text-xs text-gray-500 font-medium mt-0.5">Only show verified profiles</p>
                                        </div>
                                    </div>
                                    <div className="relative z-20 pointer-events-none">
                                        <Toggle
                                            value={!!filters.verifiedOnly}
                                            onChange={(val) => setFilters(prev => ({ ...prev, verifiedOnly: val }))}
                                        />
                                    </div>
                                </div>

                                {/* Online Now */}
                                <div
                                    className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100 relative overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => setFilters(prev => ({ ...prev, onlineNow: !prev.onlineNow }))}
                                >
                                    <div className="flex items-center gap-3 select-none flex-1 relative z-10">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 shadow-sm">
                                            <Zap className="w-5 h-5 fill-current" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">Active Recently</h3>
                                            <p className="text-xs text-gray-500 font-medium mt-0.5">Online within last 24h</p>
                                        </div>
                                    </div>
                                    <div className="relative z-20 pointer-events-none">
                                        <Toggle
                                            value={!!filters.onlineNow}
                                            onChange={(val) => setFilters(prev => ({ ...prev, onlineNow: val }))}
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-6 pb-10 sm:pb-6 border-t border-gray-100 bg-white shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-10">
                            <Button
                                type="button"
                                onClick={handleApply}
                                className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white shadow-xl shadow-orange-500/20 transform hover:scale-[1.02] transition-all"
                            >
                                Apply Filters
                            </Button>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
