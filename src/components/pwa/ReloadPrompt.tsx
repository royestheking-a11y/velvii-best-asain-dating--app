import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

export const ReloadPrompt: React.FC = () => {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r);
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    React.useEffect(() => {
        if (offlineReady) {
            toast.success("App works offline!", {
                description: "Valvii is ready to be used offline.",
                duration: 4000,
                onDismiss: close
            });
        }
    }, [offlineReady]);

    React.useEffect(() => {
        if (needRefresh) {
            toast.info("New content available", {
                description: "A new version of Velvii is available.",
                action: {
                    label: "Reload",
                    onClick: () => updateServiceWorker(true)
                },
                duration: Infinity, // Keep open until clicked
                onDismiss: close
            });
        }
    }, [needRefresh, updateServiceWorker]);

    return null; // Headless component, uses Toaster
};
