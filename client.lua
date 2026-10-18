-- Collects player data and sends it to the NUI window only when something changed.

local last = {}

-- The voice hint is shown until the player speaks for the first time.
-- This is remembered on the player's computer (KVP) so it does not come back after a reconnect.
local MIC_KVP = 'mic_hint_done'
local micHintDone = GetResourceKvpString(MIC_KVP) == '1'

-- When the player sat behind the wheel without a seatbelt (ms), used to delay the hint
local unbuckledSince = nil

-- Until when (ms) to show the "unfasten your seatbelt first" hint
local exitBlockedUntil = 0
local EXIT_HINT_MS = 2500

local function round(value)
    return math.floor((value or 0) + 0.5)
end

-- Whether the new data differs from what we sent last time
local function hasChanged(data)
    for key, value in pairs(data) do
        if last[key] ~= value then return true end
    end
    return false
end

local function send(data)
    if not hasChanged(data) then return end
    last = data
    data.action = 'hud'
    SendNUIMessage(data)
end

-- Health percent: a GTA ped has 100 base health points, the rest is extra health
local function getHealthPercent(ped)
    local max = GetEntityMaxHealth(ped) - 100
    if max <= 0 then return 0 end
    return math.max(0, math.min(100, round((GetEntityHealth(ped) - 100) / max * 100)))
end

-- "Vehicle is locked" hint: the player pressed F a couple of times at a locked vehicle and cannot get in.
-- It is tied to the F key through a keybind, so there is no loop while idle.
local lockedHintUntil = 0
local enterPresses = 0
local firstPressAt = 0

lib.addKeybind({
    name = 'custom_hud_locked_hint',
    description = 'Locked vehicle hint (does not change the key)',
    defaultKey = 'F',
    onPressed = function()
        if cache.vehicle then return end -- already in a vehicle, not relevant

        local vehicle = lib.getClosestVehicle(GetEntityCoords(cache.ped), Config.lockedHintDistance, false)
        if not vehicle or GetVehicleDoorLockStatus(vehicle) < 2 then
            enterPresses = 0
            return
        end

        -- Count presses in a row: if too much time has passed, start counting again
        local now = GetGameTimer()
        if enterPresses == 0 or now - firstPressAt > Config.lockedHintWindow * 1000 then
            enterPresses = 0
            firstPressAt = now
        end
        enterPresses += 1

        if enterPresses >= Config.lockedHintPresses then
            lockedHintUntil = now + 4000
            enterPresses = 0
        end
    end,
})

-- qbx_seatbelt disables the vehicle exit key (control 75, usually F) while the seatbelt is on.
-- A disabled control can still be "listened to" with IsDisabledControlJustPressed.
-- The fast per-frame loop runs only in a vehicle with the seatbelt on, otherwise it sleeps.
CreateThread(function()
    while true do
        local state = LocalPlayer.state
        if cache.vehicle and (state.seatbelt == true or state.harness == true) then
            if IsDisabledControlJustPressed(0, 75) then
                exitBlockedUntil = GetGameTimer() + EXIT_HINT_MS
            end
            Wait(0)
        else
            Wait(250)
        end
    end
end)

-- Test command: show the voice hint again
RegisterCommand('hudreset', function()
    micHintDone = false
    DeleteResourceKvp(MIC_KVP)
end, false)

CreateThread(function()
    local speedFactor = Config.useMph and 2.236936 or 3.6
    local unit = Config.useMph and 'MPH' or 'KPH'
    local gaugeMax = Config.useMph and Config.gaugeMaxMph or Config.gaugeMaxKph

    while true do
        local state = LocalPlayer.state
        local ped = cache.ped
        local vehicle = cache.vehicle
        local inVehicle = vehicle ~= false and vehicle ~= nil and vehicle ~= 0

        -- Hide the HUD until the character is loaded or while the pause menu is open
        if not state.isLoggedIn or IsPauseMenuActive() then
            send({ show = false })
        else
            -- pma-voice works through Mumble: the native returns 1 (or true), not only true
            local mumbleTalking = MumbleIsPlayerTalking(cache.playerId)
            local talking = mumbleTalking == 1 or mumbleTalking == true

            -- First time speaking: the hint is no longer needed
            if talking and not micHintDone then
                micHintDone = true
                SetResourceKvp(MIC_KVP, '1')
            end

            -- Seatbelt: a regular one or a harness
            local buckled = state.seatbelt == true or state.harness == true
            local isDriver = inVehicle and cache.seat == -1

            if isDriver and not buckled then
                unbuckledSince = unbuckledSince or GetGameTimer()
            else
                unbuckledSince = nil
            end
            local hintSeatbelt = unbuckledSince ~= nil
                and (GetGameTimer() - unbuckledSince) >= Config.seatbeltHintDelay * 1000

            local data = {
                show = true,
                health = getHealthPercent(ped),
                armor = math.max(0, math.min(100, GetPedArmour(ped))),
                hunger = round(state.hunger or 100),
                thirst = round(state.thirst or 100),
                talking = talking,
                inVehicle = inVehicle,
                speed = 0,
                fuel = 0,
                seatbelt = buckled,
                unit = unit,
                gaugeMax = gaugeMax,
                hintSeatbelt = hintSeatbelt,
                hintMic = not micHintDone,
                hintLocked = GetGameTimer() < lockedHintUntil,
                lockKey = Config.lockKey,
                -- 'belt' or 'harness' (which one blocks leaving the vehicle), otherwise false
                hintExit = GetGameTimer() < exitBlockedUntil and (state.harness == true and 'harness' or 'belt') or false,
                seatbeltKey = Config.seatbeltKey,
                talkKey = Config.talkKey,
                voiceRangeKey = Config.voiceRangeKey,
            }

            if inVehicle then
                data.speed = round(GetEntitySpeed(vehicle) * speedFactor)
                -- ox_fuel keeps fuel in the vehicle statebag, fallback: the native game function
                data.fuel = round(Entity(vehicle).state.fuel or GetVehicleFuelLevel(vehicle))
            end

            send(data)
        end

        Wait(inVehicle and Config.tickInVehicle or Config.tickOnFoot)
    end
end)
