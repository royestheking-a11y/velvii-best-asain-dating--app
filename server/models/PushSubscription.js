const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
    },
    userAgent: { type: String, default: 'unknown' }
}, { timestamps: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
