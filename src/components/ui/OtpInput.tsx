import React from 'react';
import { OTPInput, SlotProps } from 'input-otp';
import { cn } from '@/utils/helpers';

interface OtpInputProps {
    value: string;
    onChange: (value: string) => void;
    maxLength?: number;
}

export const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, maxLength = 6 }) => {
    return (
        <div className="flex justify-center">
            <OTPInput
                maxLength={maxLength}
                value={value}
                onChange={onChange}
                render={({ slots }) => (
                    <div className="flex gap-2 sm:gap-4">
                        {slots.map((slot, idx) => (
                            <Slot key={idx} {...slot} />
                        ))}
                    </div>
                )}
            />
        </div>
    );
};

// Premium Slot Design
function Slot(props: SlotProps) {
    return (
        <div
            className={cn(
                "relative w-12 h-14 sm:w-14 sm:h-16 text-2xl font-bold",
                "flex items-center justify-center",
                "transition-all duration-300",
                "border-2 rounded-lg bg-white",
                "text-gray-900",
                {
                    "border-gray-200": !props.isActive && !props.char,
                    "border-gray-400": !props.isActive && props.char,
                    "border-orange-500 ring-2 ring-orange-500/20 ring-offset-0": props.isActive,
                }
            )}
        >
            {props.char}
            {props.hasFakeCaret && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-0.5 h-8 bg-orange-500 animate-caret-blink" />
                </div>
            )}
        </div>
    );
}
