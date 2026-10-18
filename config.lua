Config = {
    -- true: speed in miles per hour (MPH), false: kilometers per hour (KPH)
    useMph = true,

    -- Speedometer scale maximum in the chosen unit (the red zone is at the end of the scale)
    gaugeMaxMph = 240,
    gaugeMaxKph = 360,

    -- How often to poll data (ms). In a vehicle it polls more often so the speed pointer is smooth
    tickOnFoot = 250,
    tickInVehicle = 100,

    -- Seatbelt hint: how many seconds behind the wheel without a seatbelt before it appears
    seatbeltHintDelay = 5,

    -- "Vehicle is locked" hint: after how many F presses in a row (within lockedHintWindow seconds) to show it
    lockedHintPresses = 2,
    lockedHintWindow = 4,
    lockedHintDistance = 5.0, -- distance to a vehicle at which the player is considered to be trying to get in

    -- Keys shown in hints. Text only: the real keys are configured in qbx_seatbelt and pma-voice
    seatbeltKey = 'B',
    lockKey = 'L',           -- vehicle lock in qbx_vehiclekeys
    talkKey = 'N',           -- FiveM default voice chat key (can be changed in FiveM settings)
    voiceRangeKey = '`',     -- voice_defaultCycle = "GRAVE" in voice.cfg

    -- Always-visible key reference on the left side of the screen.
    -- Text only: edit it to match the keys of your server. Players can hide it with /hudkeys.
    keyHelp = {
        enabled = true,
        items = {
            { key = 'Tab',  label = 'Inventory' },
            { key = '1-5',  label = 'Quick slots' },
            { key = 'M',    label = 'Phone (needs item)' },
            { key = 'Alt',  label = 'Interact (hold)' },
            { key = 'F5',   label = 'Emotes' },
            { key = 'Z',    label = 'Radial menu' },
            { key = 'N',    label = 'Talk' },
            { key = 'Home', label = 'Players' },
            { key = 'L',    label = 'Lock vehicle' },
            { key = 'B',    label = 'Seatbelt', vehicleOnly = true },
        },
    },
}
