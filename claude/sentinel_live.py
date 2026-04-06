import requests
import json
import datetime
import time
from datetime import date, timedelta
import sys
import threading
from flask import Flask, request, jsonify

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
app = Flask(__name__)

# [CORRECTED] Points to your Local Mac Node.js
API_BASE_URL = "https://www.market-pulse.io/api/bridge"
API_KEY = "Spanking123*"
PORT = 5000  # The port this server will listen on
# ==========================================
# 🛠️ HELPER FUNCTIONS
# ==========================================

def log(msg):
    """Simple logger with timestamp."""
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}")

def get_context(hotel_id):
    """Step 1: Fetch commercial reality for a specific hotel."""
    url = f"{API_BASE_URL}/context/{hotel_id}"
    headers = {"x-api-key": API_KEY}
    
    log(f"   📡 Fetching context for {hotel_id}...")
    try:
        # [FIX] Increased timeout to 120s to handle heavy DB queries
        res = requests.get(url, headers=headers, timeout=120)
        res.raise_for_status()
        payload = res.json()
        return payload.get("data", payload)
    except Exception as e:
        log(f"   ❌ Context Fetch Failed: {e}")
        return None

def send_decisions(decisions, mode=None):
    """Step 4: Upload decisions to the Bridge API."""
    url = f"{API_BASE_URL}/decisions"
    if mode:
        url += f"?mode={mode}"
    headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}

    log(f"   📤 Uploading {len(decisions)} decisions (mode={mode or 'autopilot'})...")
    try:
        res = requests.post(url, headers=headers, json=decisions, timeout=120)
        res.raise_for_status()
        log("   ✅ Upload Successful!")
        return True
    except requests.exceptions.RequestException as e:
        error_details = e.response.text if e.response is not None else str(e)
        log(f"   ❌ Upload Failed: HTTP {e.response.status_code if e.response else 'Unknown'} | Details: {error_details}")
        return False
# ==========================================
# 🧠 SENTINEL CORE LOGIC
# ==========================================

def calculate_optimal_rate(day_data, config, constraints, market_data):
    """
    SENTINEL LOGIC v4 (Stateful: Stopwatch + Velocity + Seasonality)
    """
    stay_date_str = day_data['stay_date'].split("T")[0]
    stay_date = datetime.datetime.strptime(stay_date_str, "%Y-%m-%d").date()
    today = date.today()
    lead_time = (stay_date - today).days

    # 1. Lead Time Check
    if lead_time < 0: return None 

    # --- Seasonality ---
    season_map = config.get('seasonality', {})
    month_key = str(stay_date.month)
    season_tier = season_map.get(month_key, "mid").lower()

    # Define Asymmetric Aggression Multipliers (Proportional Ratchet)
    season_rules = {
        "low":  {"up": 1.0, "down": 1.5}, 
        "mid":  {"up": 1.25, "down": 1.0}, 
        "high": {"up": 1.5, "down": 0.5}  
    }
    
    current_season = season_rules.get(season_tier, season_rules["mid"])
    up_aggression = current_season["up"]
    down_aggression = current_season["down"]

    # --- System State ---
    current_rate = float(day_data.get('rate', 0) or 0)

    # --- Constraints ---
    min_rates_map = config.get('min_rates', {})
    daily_min_rates_map = config.get('daily_min_rates', {})
    month_slug = stay_date.strftime('%b').lower()
    raw_min = min_rates_map.get(month_slug, min_rates_map.get('default', 60.00))
    monthly_min = float(raw_min) if raw_min else 60.00

    # Daily override takes precedence over monthly default
    daily_override = daily_min_rates_map.get(stay_date_str)
    if daily_override is not None:
        min_rate = float(daily_override)
    else:
        min_rate = monthly_min

    # --- HYBRID MAX RATE LOOKUP (OPTIMIZED) ---
    max_rate_map = constraints.get('optimized_max_rate_map', {})
    if not max_rate_map:
        for row in constraints.get('max_rates', []):
            if row.get('max_price') is not None:
                d_key = row['stay_date'].split('T')[0]
                max_rate_map[d_key] = float(row['max_price'])

    dynamic_max = max_rate_map.get(stay_date_str)
    if dynamic_max is None: dynamic_max = 999.00
    if dynamic_max <= min_rate: dynamic_max = min_rate + 20.00

    # --- Day of Week Adjustments (Applied to Min Rate) ---
    dow = stay_date.weekday()
    dow_multiplier = 1.0
    if dow in [4, 5]: dow_multiplier = 1.20   # Fri/Sat
    elif dow == 6: dow_multiplier = 0.95      # Sun

    min_rate *= dow_multiplier

    # --- Last-Minute Floor (LMF) Logic ---
    lmf = config.get('last_minute_floor', {})
    is_lmf_active = str(lmf.get('enabled', '')).lower() == 'true' or lmf.get('enabled') is True
    
    if is_lmf_active:
        try:
            lmf_days = int(str(lmf.get('days', 0)))
            lmf_limit_rate = float(str(lmf.get('rate', 0)))
            lmf_dow = lmf.get('dow', []) 
            
            dow_map = {0: 'mon', 1: 'tue', 2: 'wed', 3: 'thu', 4: 'fri', 5: 'sat', 6: 'sun'}
            current_day = dow_map.get(dow)
            
            if lead_time <= lmf_days and current_day in lmf_dow:
                min_rate = lmf_limit_rate
                log(f"      ✅ LMF ACTIVE: Floor set to {min_rate} for {stay_date_str}")
        except Exception as e:
            log(f"   ⚠️ LMF Error: {e}")

    effective_min = min_rate
    
    # --- BASE RATE ANCHOR (Event Aware) ---
    peak_dates = config.get('peak_dates', {})
    event_multiplier = peak_dates.get(stay_date_str)
    is_event_day = False
    
    if event_multiplier:
        base_rate = effective_min * float(event_multiplier)
        is_event_day = True
        log(f"      🎪 EVENT DETECTED: {stay_date_str} | Multiplier: {event_multiplier}x | Base: £{base_rate:.2f}")
    else:
        # Standard Seasonality Base
        if season_tier == "low":
            base_rate = effective_min
        else:
            base_rate = effective_min * 1.50

    # --- Get Target Occupancy ---
    active_curve_list = None
    for curve in constraints.get('pace_curves', []):
        if curve.get('season_tier', '').lower() == season_tier:
            active_curve_list = curve.get('curve_data', [])
            break
            
    target_occupancy_pct = 50.0 
    if active_curve_list and isinstance(active_curve_list, list):
        idx = lead_time if lead_time < len(active_curve_list) else -1
        try: target_occupancy_pct = float(active_curve_list[idx])
        except: target_occupancy_pct = 50.0

    # --- Market Velocity & Position ---
    rooms_sold = 0
    pickup_24h = 0
    capacity = int(config.get('capacity', 13))

    velocity_map = market_data.get('optimized_velocity_map', {})
    daily_stats = velocity_map.get(stay_date_str)

    if daily_stats:
        rooms_sold = int(float(daily_stats.get('rooms_sold') or 0))
        pickup_24h = int(float(daily_stats.get('pickup_24h') or 0))
        daily_cap = int(float(daily_stats.get('capacity') or 0))
        if daily_cap > 0: capacity = daily_cap
    else:
        for m in market_data.get('pickup_velocity', []):
            if m['stay_date'].startswith(stay_date_str):
                rooms_sold = int(float(m.get('rooms_sold') or 0))
                pickup_24h = int(float(m.get('pickup_24h') or 0))
                daily_cap = int(float(m.get('capacity') or 0))
                if daily_cap > 0: capacity = daily_cap
                break
            
    current_occupancy_pct = 0.0
    if capacity > 0:
        current_occupancy_pct = (rooms_sold / capacity) * 100
        
    raw_delta = current_occupancy_pct - target_occupancy_pct
    delta = raw_delta

    # --- THE DECISION ENGINE (Proportional Ratchet) ---
    final_rate = base_rate
    reason_tag = "On Target"
    
    # 1. THE HIBERNATE SHIELD
    is_hibernating = False
    if season_tier in ['mid', 'high'] and raw_delta < 0:
        if dow in [4, 5] and lead_time > 30:
            is_hibernating = True
        elif dow not in [4, 5] and lead_time > 40:
            is_hibernating = True

    if is_hibernating:
        final_rate = base_rate
        reason_tag = "Hibernate Shield"

    # 2. THE RATCHET (Yield Up)
    elif raw_delta > 0:
        premium_pct = (raw_delta * up_aggression) / 100.0
        final_rate = base_rate * (1.0 + premium_pct)
        reason_tag = f"Ratchet Up (+{raw_delta:.1f}%)"

    # 3. YIELD DOWN (Panic)
    elif raw_delta < 0:
        if raw_delta <= -30.0:
            # Deep Deficit Override
            final_rate = effective_min
            reason_tag = "Deep Deficit (Floor)"
        else:
            discount_pct = (abs(raw_delta) * down_aggression) / 100.0
            final_rate = base_rate * (1.0 - discount_pct)
            reason_tag = f"Yield Down ({raw_delta:.1f}%)"

    # --- DESPERATION DECAY (Sell Every Room) ---
    pricing_mode = config.get('pricing_mode', 'maintain_profit').lower()
    
    if pricing_mode == 'sell_every_room' and lead_time <= 3 and raw_delta < 0 and current_rate > effective_min:
        hours_remaining = max(1, (lead_time * 24))
        decay_multiplier = (effective_min / current_rate) ** (1 / hours_remaining)
        decayed_rate = current_rate * decay_multiplier
        final_rate = max(effective_min, min(current_rate, decayed_rate))
        reason_tag = f"Ruthless Decay (T-{hours_remaining}h)"

    # --- THE BOUNCER (Final Bounds) ---
    final_rate = max(effective_min, min(final_rate, dynamic_max))

    # --- NOISE & VELOCITY GUARD ---
    diff = abs(final_rate - current_rate)
    is_below_floor = current_rate < (effective_min - 0.01)

    # Sticky Ratchet: Do not drop rate if we had pickup in last 24h
    # RULES:
    # 1. If delta < 0 (behind target) → always allow drops, pickup is irrelevant until we catch up
    # 2. If delta >= 0 (on/ahead of target) → only hold if projected fill covers remaining rooms
    rooms_remaining = capacity - rooms_sold
    projected_fill = pickup_24h * lead_time if lead_time > 0 else pickup_24h
    velocity_sufficient = projected_fill >= rooms_remaining

    if final_rate < current_rate and pickup_24h > 0 and pricing_mode != 'sell_every_room':
        if raw_delta >= 0 and velocity_sufficient:
            final_rate = current_rate
            reason_tag = "Velocity Guard (Hold)"
            diff = 0.0

    if diff < 1.00 and not is_below_floor:
       log(f"      [SKIP] {stay_date_str} | rate={current_rate} final={final_rate:.2f} diff={diff:.2f} pickup={pickup_24h} cap={capacity} occ={current_occupancy_pct:.1f}% delta={raw_delta:.1f} reason={reason_tag}")
       return None

    # Prefix reason tag if an event is active
    if is_event_day:
        reason_tag = f"Event ({float(event_multiplier):.1f}x) + {reason_tag}"

    return {
        "hotel_id": int(day_data.get('hotel_id')), 
        "room_type_id": day_data.get('room_type_id'),
        "stay_date": stay_date_str,
        "suggested_rate": round(final_rate, 2),
        "confidence_score": 0.90,
        "reasoning": f"{reason_tag} | Vel:{pickup_24h} | Rec:£{final_rate:.0f}",
        "model_version": "Sentinel-Logic-v6-OpenSky"
    }

def process_hotel(hotel_id, mode=None):
    """Orchestrates the logic for a single hotel."""
    log(f"🏨 STARTING HOTEL ID: {hotel_id} (mode={mode or 'autopilot'})")
    
    # A. Get Data
    context = get_context(hotel_id)
    if not context:
        log("   ⚠️ Skipping hotel due to context error.")
        return {"success": False, "message": "Context fetch failed"}

    config = context.get('config', {})
    inventory = context.get('inventory', [])
    constraints = context.get('constraints', {})
    market = context.get('market', {})

    # === OPTIMIZATION: PRE-BUILD MAPS ===
    # Build lookups once (O(N)) instead of loop-searching inside the pricer (O(N^2))
    max_rate_map = {
        row['stay_date'].split('T')[0]: float(row['max_price'])
        for row in constraints.get('max_rates', [])
        if row.get('max_price') is not None
    }
    constraints['optimized_max_rate_map'] = max_rate_map

    velocity_map = {
        m['stay_date'].split('T')[0]: m
        for m in market.get('pickup_velocity', [])
    }
    market['optimized_velocity_map'] = velocity_map
    # ====================================

    # Validation
    if not inventory:
        log("   ❌ CRITICAL: Inventory is EMPTY.")
        return {"success": False, "message": "Inventory is empty"}

    base_room_id = str(config.get('base_room_type_id'))
    if not base_room_id or base_room_id == "None":
        log("   ❌ CRITICAL: No base_room_type_id found in Config.")
        return {"success": False, "message": "Base Room ID not configured"}

    # B. Loop & Decide
    decisions = []
    dates_checked = 0  # [FIX] Rename for clarity
    
    for day in inventory:
        inv_room_id = str(day.get('room_type_id'))
        if inv_room_id != base_room_id:
            continue

        dates_checked += 1  # [FIX] Count every valid date we attempt to price

        decision = calculate_optimal_rate(day, config, constraints, market)
        if decision:
            decisions.append(decision)
            
    log(f"   ⚙️ Processing Summary: Checked {dates_checked} dates. Generated {len(decisions)} decisions.")

    # C. Upload
    uploaded = False
    if decisions:
        uploaded = send_decisions(decisions, mode=mode)
    
    return {
        "success": True,
        "hotel_id": hotel_id,
        "dates_checked": dates_checked,  # [FIX] Use correct variable name
        "decisions_generated": len(decisions),
        "upload_success": uploaded
    }

# ==========================================
# 🚀 FLASK API ROUTES
# ==========================================

@app.route('/run', methods=['POST'])
def run_job():
    """Endpoint triggered by the React Button or hourly cron."""
    data = request.json
    hotel_id = data.get('hotel_id')
    mode = data.get('mode')  # 'preview' = manual trigger, None = hourly cron

    if not hotel_id:
        return jsonify({"success": False, "message": "Missing hotel_id"}), 400

    if mode == 'preview':
        # Manual trigger: run synchronously so caller gets results back
        log(f"⚡️ PREVIEW trigger for Hotel {hotel_id}. Running synchronously...")
        result = process_hotel(hotel_id, mode='preview')
        return jsonify(result), 200
    else:
        # Hourly cron: fire and forget
        log(f"⚡️ AUTO trigger for Hotel {hotel_id}. Starting background thread.")
        thread = threading.Thread(target=process_hotel, args=(hotel_id,))
        thread.start()
        return jsonify({
            "success": True,
            "message": "AI Engine triggered in background.",
            "hotel_id": hotel_id
        }), 202

@app.route('/health', methods=['GET'])
def health():
    """Simple health check."""
    return jsonify({"status": "online", "system": "Sentinel DGX"}), 200

if __name__ == "__main__":
    log(f"🚀 Sentinel DGX Server listening on port {PORT}")
    # Run Flask App
    app.run(host='0.0.0.0', port=PORT)
