fx_version 'cerulean'
game 'gta5'

author 'Arthur.dev'
description 'Custom HUD (health, armor, hunger, thirst, speed, fuel, voice)'
version '1.0.0'

lua54 'yes'

ui_page 'web/dist/index.html'

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
}

client_script 'client.lua'

files {
    'web/dist/index.html',
    'web/dist/assets/*',
}
