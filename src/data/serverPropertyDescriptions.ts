export interface PropertyDescription {
  description: string;
  example?: string;
  options?: string[];
}

export const SERVER_PROPERTY_DESCRIPTIONS: Record<string, PropertyDescription> = {
  'accepts-transfers': {
    description:
      'Allows incoming player transfers from other servers via the /transfer command. When disabled, transferred players are rejected.',
    options: ['true', 'false'],
  },
  'allow-flight': {
    description:
      'Allows players in Survival mode to fly using mods or plugins. When false, players hovering too long are kicked for "flying is not enabled".',
    options: ['true', 'false'],
  },
  'allow-nether': {
    description:
      'Enables the Nether dimension. When false, players cannot enter the Nether and any existing portals will not function.',
    options: ['true', 'false'],
  },
  'broadcast-console-to-ops': {
    description:
      'Sends the output of console commands to all online operators.',
    options: ['true', 'false'],
  },
  'broadcast-rcon-to-ops': {
    description:
      'Sends the output of commands run via RCON to all online operators.',
    options: ['true', 'false'],
  },
  'bug-report-link': {
    description:
      'A URL shown to players who want to report a bug. Leave blank to disable the in-game bug report link.',
    example: 'https://example.com/report-bug',
  },
  difficulty: {
    description:
      'Sets the difficulty of the world. Affects mob damage, hunger, and other survival mechanics.',
    options: ['peaceful', 'easy', 'normal', 'hard'],
  },
  'enable-command-block': {
    description:
      'Enables command blocks, which let players run commands when triggered by redstone.',
    options: ['true', 'false'],
  },
  'enable-jmx-monitoring': {
    description:
      'Exposes an MBean for monitoring server performance metrics (tick times, etc.) via JMX.',
    options: ['true', 'false'],
  },
  'enable-query': {
    description:
      'Enables the GameSpy4 query protocol on the configured query port. Used by external server list tools to fetch server info.',
    options: ['true', 'false'],
  },
  'enable-rcon': {
    description:
      'Enables remote console access (RCON), letting external tools run server commands. Requires setting an rcon.password.',
    options: ['true', 'false'],
  },
  'enable-status': {
    description:
      'Makes the server appear in the multiplayer server list with its MOTD, player count, and icon.',
    options: ['true', 'false'],
  },
  'enforce-secure-profile': {
    description:
      "Requires players to have a verified secure profile (Mojang-signed chat keys) to join. Disabling allows users without signed chat to connect.",
    options: ['true', 'false'],
  },
  'enforce-whitelist': {
    description:
      'Kicks non-whitelisted players who are already online when the whitelist is reloaded. Has no effect unless white-list is also enabled.',
    options: ['true', 'false'],
  },
  'entity-broadcast-range-percentage': {
    description:
      'Controls how far entities are visible to clients, as a percentage of the default range. Lower values reduce network traffic at the cost of visibility.',
    example: '100',
  },
  'force-gamemode': {
    description:
      'Forces players into the server\'s default gamemode every time they join, instead of restoring their previous gamemode.',
    options: ['true', 'false'],
  },
  'function-permission-level': {
    description:
      'The default permission level used when running functions from data packs (1-4).',
    options: ['1', '2', '3', '4'],
  },
  gamemode: {
    description:
      'The default gamemode for new players joining the server.',
    options: ['survival', 'creative', 'adventure', 'spectator'],
  },
  'generate-structures': {
    description:
      'Whether structures like villages, strongholds, and temples generate in new chunks. Does not affect already-generated chunks.',
    options: ['true', 'false'],
  },
  'generator-settings': {
    description:
      'JSON object that customizes world generation for certain world types (e.g., superflat layer config). Most users leave this empty.',
    example: '{}',
  },
  hardcore: {
    description:
      'Enables hardcore mode: difficulty is locked to hard, and players who die are permanently banned or set to spectator.',
    options: ['true', 'false'],
  },
  'hide-online-players': {
    description:
      'Hides the player list from the server status response so client-side server browsers cannot see who is online.',
    options: ['true', 'false'],
  },
  'initial-disabled-packs': {
    description:
      'Comma-separated list of data packs disabled on first world creation.',
    example: 'vanilla,my_pack',
  },
  'initial-enabled-packs': {
    description:
      'Comma-separated list of data packs enabled on first world creation. Defaults to "vanilla".',
    example: 'vanilla',
  },
  'level-name': {
    description:
      'The folder name of the world to load. If the folder does not exist, a new world is generated with this name.',
    example: 'world',
  },
  'level-seed': {
    description:
      'Seed used to generate the world. Leave blank for a random seed. Can be a number or any string.',
    example: '1234567890',
  },
  'level-type': {
    description:
      'The type of world to generate.',
    options: [
      'minecraft:normal',
      'minecraft:flat',
      'minecraft:large_biomes',
      'minecraft:amplified',
      'minecraft:single_biome_surface',
    ],
  },
  'log-ips': {
    description:
      'Includes player IP addresses in server log entries when they join. Disable to keep IPs out of logs for privacy.',
    options: ['true', 'false'],
  },
  'max-chained-neighbor-updates': {
    description:
      'Maximum number of chained neighbor block updates per tick. Use -1 to disable the limit. Used to prevent server-crashing redstone contraptions.',
    example: '1000000',
  },
  'max-players': {
    description:
      'Maximum number of players that can be connected to the server at once.',
    example: '20',
  },
  'max-tick-time': {
    description:
      'Maximum time (in milliseconds) a single tick may take before the watchdog kills the server. Use -1 to disable.',
    example: '60000',
  },
  'max-world-size': {
    description:
      'World border maximum size in blocks (radius from center). Restricts how far players can travel from spawn.',
    example: '29999984',
  },
  motd: {
    description:
      'The "Message of the Day" shown beneath the server name in the multiplayer list. Supports color codes (§).',
    example: '§aWelcome to my server!',
  },
  'network-compression-threshold': {
    description:
      'Minimum packet size (bytes) before compression is applied. Use -1 to disable compression, 0 to compress everything. Higher values save CPU on LAN servers.',
    example: '256',
  },
  'online-mode': {
    description:
      'Verifies players against Mojang authentication servers. Disabling allows cracked clients to connect — only do this on LAN or isolated networks.',
    options: ['true', 'false'],
  },
  'op-permission-level': {
    description:
      'Default permission level granted to new operators (1=bypass spawn protection, 2=cheats, 3=multiplayer mgmt, 4=server mgmt).',
    options: ['1', '2', '3', '4'],
  },
  'pause-when-empty-seconds': {
    description:
      'Number of seconds with no players online before the server pauses ticking to save CPU. Use 0 to disable auto-pause.',
    example: '60',
  },
  'player-idle-timeout': {
    description:
      'Minutes of inactivity before idle players are kicked. Use 0 to disable.',
    example: '0',
  },
  'prevent-proxy-connections': {
    description:
      'Kicks players whose IP appears to come through a proxy/VPN (based on Mojang authentication metadata).',
    options: ['true', 'false'],
  },
  pvp: {
    description:
      'Allows players to damage each other directly. Indirect damage (TNT, fire) is unaffected.',
    options: ['true', 'false'],
  },
  'query.port': {
    description:
      'UDP port used for the GameSpy4 query protocol. Only relevant when enable-query is true.',
    example: '25565',
  },
  'rate-limit': {
    description:
      'Maximum packets per second a player can send before being kicked. Use 0 to disable rate limiting.',
    example: '0',
  },
  'rcon.password': {
    description:
      'Password required to connect via RCON. Must be set if enable-rcon is true. Use a strong, unique value.',
    example: 'your-strong-password',
  },
  'rcon.port': {
    description:
      'TCP port that RCON listens on.',
    example: '25575',
  },
  'region-file-compression': {
    description:
      'Compression algorithm used when writing region files. Affects disk usage and IO performance.',
    options: ['deflate', 'lz4', 'none'],
  },
  'require-resource-pack': {
    description:
      'When true, players who refuse the server resource pack are kicked. Requires resource-pack to be set.',
    options: ['true', 'false'],
  },
  'resource-pack': {
    description:
      'URL of a resource pack that players are prompted to download on join. Leave blank to disable.',
    example: 'https://example.com/pack.zip',
  },
  'resource-pack-id': {
    description:
      'Optional UUID used to identify the resource pack. Lets clients cache it across servers.',
    example: '00000000-0000-0000-0000-000000000000',
  },
  'resource-pack-prompt': {
    description:
      'Optional message shown to players when they are prompted to accept the resource pack. Supports JSON text components.',
    example: 'Please accept the pack for the best experience',
  },
  'resource-pack-sha1': {
    description:
      'Optional SHA-1 hash of the resource pack. Lets the client verify integrity and re-use cached downloads.',
    example: '40-character hex hash',
  },
  'server-ip': {
    description:
      'IP address to bind the server to. Leave blank to listen on all available interfaces.',
    example: '',
  },
  'server-port': {
    description:
      'TCP port the server listens on for player connections. Default is 25565.',
    example: '25565',
  },
  'simulation-distance': {
    description:
      'Radius (in chunks) around each player where entities, weather, and block updates are simulated. Lower values reduce CPU load.',
    example: '10',
  },
  'snooper-enabled': {
    description:
      'Sends anonymized usage statistics to Mojang. Removed in modern versions but still appears in some configs.',
    options: ['true', 'false'],
  },
  'spawn-animals': {
    description:
      'Allows passive mobs (cows, pigs, sheep, etc.) to spawn.',
    options: ['true', 'false'],
  },
  'spawn-monsters': {
    description:
      'Allows hostile mobs (zombies, skeletons, etc.) to spawn. Note: difficulty=peaceful overrides this.',
    options: ['true', 'false'],
  },
  'spawn-npcs': {
    description:
      'Allows villagers to spawn naturally.',
    options: ['true', 'false'],
  },
  'spawn-protection': {
    description:
      'Radius (in blocks) around spawn where non-ops cannot build or break blocks. Use 0 to disable.',
    example: '16',
  },
  'sync-chunk-writes': {
    description:
      'Forces chunk writes to flush to disk synchronously. Safer against crashes but slower; disable for performance.',
    options: ['true', 'false'],
  },
  'text-filtering-config': {
    description:
      'Optional JSON config for an external chat-filtering service. Leave blank to disable.',
    example: '',
  },
  'text-filtering-version': {
    description:
      'Version identifier sent to the configured text-filtering service.',
    example: '0',
  },
  'use-native-transport': {
    description:
      'On Linux, uses optimized epoll networking for better performance. Disable only if you experience compatibility issues.',
    options: ['true', 'false'],
  },
  'view-distance': {
    description:
      'Radius (in chunks) the server sends to clients. Higher values mean more visibility but more bandwidth and CPU usage.',
    example: '10',
  },
  'white-list': {
    description:
      'Restricts who can join the server to players in whitelist.json. Use the in-game /whitelist command to manage entries.',
    options: ['true', 'false'],
  },
};

export function getPropertyDescription(key: string): PropertyDescription | undefined {
  return SERVER_PROPERTY_DESCRIPTIONS[key];
}
