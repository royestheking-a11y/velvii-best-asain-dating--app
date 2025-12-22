# 🚀 Deployment Guide: Velvii Premium Dating App

This guide walks you through deploying your **Frontend to Vercel** and **Backend to Render**, while keeping everything connected (MongoDB, Cloudinary, Socket.io, WebRTC).

---

## ✅ Prerequisites

Ensure you have the following ready:
1.  **GitHub Repository**: Your code must be pushed to GitHub (make sure the repo is public or you grant access).
2.  **MongoDB Atlas URI**: Your database connection string.
3.  **Cloudinary Keys**: Cloud Name, API Key, API Secret.
4.  **Google AI Keys**: (Optional if hardcoded, but recommended)

---

## 1️⃣ Backend Deployment (Render)

We deploy the server first so we can get the API URL.

1.  **Sign in to [Render](https://render.com/)**.
2.  Click **New +** -> **Web Service**.
3.  Connect your **GitHub Repository**.
4.  **Configure the Service**:
    *   **Name**: `velvii-backend` (or similar)
    *   **Region**: Choose one close to your users (e.g., Singapore/Ohio).
    *   **Branch**: `main` (or master)
    *   **Root Directory**: `.` (Leave empty or dot)
    *   **Runtime**: `Node`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node server/index.js`
5.  **Environment Variables** (Scroll down to "Advanced" or "Environment Variables"):
    Add the following keys:
    *   `MONGO_URI`: `mongodb+srv://...` (Your full connection string)
    *   `FRONTEND_URL`: `https://your-vercel-app.vercel.app` (You don't have this yet, so put `*` for now, or come back and update it later. **Recommendation: Put `*` initially to test**).
    *   `PORT`: `3000` (Render sets this automatically, but good to know).
6.  **Click "Create Web Service"**.
7.  **Wait for Deployment**: valid logs should show "SERVER RUNNING on port..." and "MongoDB Connected".
8.  **Copy the Backend URL**: It will look like `https://velvii-backend.onrender.com`.

---

## 2️⃣ Frontend Deployment (Vercel)

Now we deploy the React/Vite frontend.

1.  **Sign in to [Vercel](https://vercel.com/)**.
2.  Click **"Add New..."** -> **Project**.
3.  Import your **GitHub Repository**.
4.  **Configure Project**:
    *   **Framework Preset**: Vite (should detect auto).
    *   **Root Directory**: `.` (Leave default).
5.  **Environment Variables**:
    *   **Name**: `VITE_API_URL`
    *   **Value**: `https://velvii-backend.onrender.com/api` (Paste your Render URL and add `/api` at the end).
    *   *Note: logic in app creates Socket URL by removing `/api`, so it connects to `https://velvii-backend.onrender.com` automatically.*
6.  **Click "Deploy"**.
7.  **Wait**: Vercel will build and assign a domain (e.g., `velvii-dating-app.vercel.app`).

---

## 3️⃣ Final Connections

1.  **Update Backend CORS** (Important for Security):
    *   Go back to **Render Dashboard** -> Environment Variables.
    *   Update `FRONTEND_URL` to your actual Vercel domain (e.g., `https://velvii-dating-app.vercel.app`).
    *   **Redeploy** Render (Manual Deploy -> Clear Cache & Deploy usually safest).

2.  **Verify Connections**:
    *   Open Vercel App URL.
    *   **Smart Cache**: First load might show Splash. Reload -> Should be instant/skip splash.
    *   **Login**: Try logging in. It should talk to Render -> MongoDB.
    *   **Images**: Upload a photo. Should go to Cloudinary.
    *   **Realtime**: Open app in two different browsers (Incognito). Send a message. It should appear instantly via Socket.io.

---

## 🛑 Troubleshooting

*   **"Network Error" / CORS Error**:
    *   Check if `FRONTEND_URL` in Render matches your Vercel URL exactly (no trailing slash usually).
    *   Check browser console (F12).
*   **Socket not connecting**:
    *   Ensure `VITE_API_URL` in Vercel is https (not http).
*   **Render "Build Failed"**:
    *   Check "Logs". If it says "module not found", I might have missed adding it to `package.json` (I added `@google/generative-ai` and `dotenv` for you already).

---

## ⚡ Performance Note
Render Free Tier spins down after inactivity (15 mins). The first request might take 50 seconds to wake up.
*   **Solution**: Upgrade to Render Starter ($7/mo) OR use a service like `cron-job.org` to ping your backend URL every 10 minutes to keep it awake.
