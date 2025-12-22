const router = require('express').Router();
const PushSubscription = require('../models/PushSubscription');
const webpush = require('web-push');

// Subscribe Route
router.post('/subscribe', async (req, res) => {
    try {
        const { subscription, userId, userAgent } = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Invalid subscription object' });
        }

        // Save or Update subscription
        // Using upsert to prevent duplicates for same endpoint
        await PushSubscription.findOneAndUpdate(
            { endpoint: subscription.endpoint },
            {
                userId,
                endpoint: subscription.endpoint,
                keys: subscription.keys,
                userAgent: userAgent || 'unknown',
                createdAt: new Date()
            },
            { upsert: true, new: true }
        );

        console.log(`[PUSH] User ${userId} subscribed.`);
        res.status(201).json({ message: 'Subscribed successfully' });
    } catch (err) {
        console.error("Subscription Error:", err);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

// Admin/Manual Send Route (For Testing)
router.post('/send', async (req, res) => {
    try {
        const { userId, title, message, url } = req.body;

        const subscriptions = await PushSubscription.find({ userId });
        if (!subscriptions.length) {
            return res.status(404).json({ error: 'No subscriptions found for user' });
        }

        const notificationPayload = JSON.stringify({
            title: title || 'Velvii Notification',
            body: message || 'You have a new update!',
            icon: '/pwa-192x192.png',
            url: url || '/'
        });

        const promises = subscriptions.map(sub =>
            webpush.sendNotification(
                { endpoint: sub.endpoint, keys: sub.keys },
                notificationPayload
            ).catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log(`[PUSH] Subscription expired/invalid for ${sub._id}. Removing.`);
                    return PushSubscription.findByIdAndDelete(sub._id);
                }
                console.error("[PUSH] Send Error:", err);
            })
        );

        await Promise.all(promises);
        res.status(200).json({ message: `Attempted push to ${subscriptions.length} devices.` });

    } catch (err) {
        console.error("Push Send Error:", err);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

module.exports = router;
