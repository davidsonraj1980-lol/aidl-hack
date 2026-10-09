# RouteWise — Airport Cab-Pooling MVP (24-Hour Hackathon)

> **Core Value Proposition:** Match verified passengers who land on the **exact same flight** and are heading in the same direction within a **5km radius** so they can split a premium airport cab fare (e.g., Uber Premier / Toyota Innova Hycross), saving up to 75% on peak airport taxi surcharges.

---

## 🎨 UI & UX Design Philosophy (Inspired by WealthWise Reference)

The web app has been completely upgraded to mirror the high-polish, native-app feel of the reference design:
- **Smartphone Device Mockup:** Realistic iPhone chassis (`.device`), dynamic island notch (`.notch`), status bar (time `9:41`, battery, wifi), and dual outer bezels.
- **Editorial Typography:** Google Fonts `Fraunces` (warm, sophisticated serif for headings and pricing) paired with `Inter` and `JetBrains Mono` for flight & GPS data.
- **Bottom Navigation Bar (`.navbar`):**
  1. 🛫 **Pool:** Main MVP flow (Flight search, real-time radar sonar scan, boarding-pass match card, dynamic fare split).
  2. 🚖 **Cab & Bay:** Terminal 1 Cab Bay B4 map, vehicle specs (Innova Hycross 6-seater), driver rating, and ride OTP.
  3. 💬 **Flight Chat:** Interactive in-flight pool chat between matched passengers (Ananya, Rohan, and Vikram) to coordinate at Baggage Claim Belt 4.
  4. 🛡️ **Verified:** Passenger trust score (99.8%), digital boarding pass QR validator, and emergency airport security SOS.
- **Interactive Modals & Toasts:**
  - **UPI Split Modal:** Pay your ₹400 split fare via Google Pay, PhonePe, or Pay at Drop.
  - **PostGIS Inspector Modal:** Real-time view of the Supabase SQL stored procedure (`ST_DWithin` 5,000m) with credential configuration.
  - **Floating Toasts:** Smooth tactile feedback on all user actions.

---

## 🚀 Quick Start (Local Demo)

The local server is already running on port **3000**:
- **URL:** [http://localhost:3000](http://localhost:3000)

To start the server manually anytime:
```powershell
node server.js
# or
npx serve .
```

---

## 🗄️ Database & PostGIS Setup (`schema.sql`)

1. Open your [Supabase](https://supabase.com) project's **SQL Editor**.
2. Run [`schema.sql`](./schema.sql).
3. The script:
   - Enables `postgis` extension.
   - Creates `users` and `ride_requests` tables with `GEOGRAPHY(Point, 4326)` destination coordinates.
   - Sets up a GIST spatial index for fast 5km bounding calculations.
   - Sets up Row Level Security (RLS) policies.
   - Deploys the `match_riders(p_flight_number, p_lat, p_lng, p_user_id)` stored procedure.
   - Populates 4 mock verified passengers arriving on flight `6E-241` in Bengaluru.

---

## 🎤 60-Second Hackathon Pitch Script

1. **The Problem:** *"Landing at an airport late at night means paying ₹1,200 to ₹1,800 for an individual cab or waiting in long lines, even though dozens of passengers from your exact flight are heading to your neighborhood."*
2. **The Solution:** *"RouteWise matches verified passengers arriving on the exact same flight whose destinations are clustered within a 5-kilometer radius."*
3. **The Live Demo:**
   - Tap **"Find Flight Pool Members"** for flight **6E-241** arriving in Bengaluru.
   - The radar scanner fires our Supabase PostGIS `match_riders` RPC function using `ST_DWithin()`.
   - In seconds, it clusters Ananya (Domlur) and Rohan (Koramangala) who are within 3km of your Indiranagar drop.
   - The ₹1,200 Innova fare instantly splits to **₹400 per person**, saving each passenger 67%!
   - Tap **"Lock Cab & Pay via UPI"** to split on Google Pay and view the pickup bay instructions at Terminal 1 Bay B4.
