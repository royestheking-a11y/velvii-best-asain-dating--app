import React from 'react';

interface ManualSingleSliderProps {
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    className?: string;
}

export const ManualSingleSlider: React.FC<ManualSingleSliderProps> = ({
    value,
    min,
    max,
    onChange,
    className = ''
}) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className={`relative h-8 flex items-center ${className}`}>
            {/* Track Background */}
            <div className="w-full h-1 bg-gray-200 rounded-full" />

            {/* Active Track */}
            <div
                className="absolute h-1 bg-orange-500 rounded-full left-0 z-10"
                style={{ width: `${percentage}%` }}
            />

            {/* Slider Input (Invisible but controls interaction) */}
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
            />

            {/* Visual Thumb */}
            <div
                className="absolute w-5 h-5 bg-orange-500 rounded-full shadow-md pointer-events-none z-20 top-1/2 -translate-y-1/2 border-2 border-white"
                style={{
                    left: `calc(${percentage}% - 10px)`
                }}
            />
        </div>
    );
};
