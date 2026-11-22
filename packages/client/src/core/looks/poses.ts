// From the frozen D1 manifest, D2 emotes ship no animation files
const D1_EMOTES: [string, string][] = [
  ["baseball_safe", "Safe"],
  ["baseball_swing", "Swing"],
  ["boo", "Boo"],
  ["booya", "Booyah"],
  ["bow", "Formal Bow"],
  ["bring_it", "Bring It On"],
  ["come_at_me", "Come at Me"],
  ["congrats", "Congrats"],
  ["cower", "Cower"],
  ["emote_air_guitar", "Air Guitar"],
  ["emote_amazed", "Amazed"],
  ["emote_awkward_dance", "Awkward Dance"],
  ["emote_bow_down", "Bow Down"],
  ["emote_boxing", "Shadow Boxing"],
  ["emote_bye_bye", "Bye-Bye"],
  ["emote_challenge_dance", "Challenge Dance"],
  ["emote_charmed", "Charmed"],
  ["emote_clap", "Clap"],
  ["emote_club_dance", "Club Dance"],
  ["emote_crane_kick", "Crane Kick"],
  ["emote_do_it", "Do It"],
  ["emote_facepalm", "Facepalm"],
  ["emote_finger_wag", "Finger Wag"],
  ["emote_fist_bump", "Fist Bump"],
  ["emote_flip_coin", "Flip Coin"],
  ["emote_frustrated", "Forehead Slap"],
  ["emote_graceful_sneeze", "Graceful Sneeze"],
  ["emote_howl", "Howl"],
  ["emote_i_dont_know", "I Don't Know"],
  ["emote_instructional_dance", "Instructional Dance"],
  ["emote_jazz_hands", "Jazz Hands"],
  ["emote_jump_on_it", "Energetic Dance"],
  ["emote_jump_shot", "Jump Shot"],
  ["emote_kicks_dance", "Kicks Dance"],
  ["emote_laugh", "Laugh"],
  ["emote_leg_dance", "Wiggly Leg Dance"],
  ["emote_mix_it_up", "Mix It Up"],
  ["emote_no_you_didnt", "No You Didn't"],
  ["emote_pew_pew", "Pew Pew"],
  ["emote_possessed", "Terrify"],
  ["emote_praise_the_gun", "Praise the Gun"],
  ["emote_praise_the_light", "Praise the Light"],
  ["emote_rude_taunt", "Rude Taunt"],
  ["emote_sad", "Sad"],
  ["emote_score", "Score"],
  ["emote_secret_greeting", "Secret Greeting"],
  ["emote_strange_dance", "Strange Dance"],
  ["emote_suave_dance", "Suave Dance"],
  ["emote_sumo", "Sumo"],
  ["emote_taken_shiver", "Taken Shiver"],
  ["emote_thumbs_down", "Thumbs Down"],
  ["emote_thumbs_up", "Thumbs Up"],
  ["emote_thunder_dance", "Thunder Dance"],
  ["emote_tiny_dance", "Tiny Dance"],
  ["emote_toe_tap", "Toe Tap"],
  ["emote_trotting_dance", "Trotting Dance"],
  ["emote_victory_wave", "Victory Wave"],
  ["emote_waving_taunt", "Waving Taunt"],
  ["emote_winded", "Winded"],
  ["emote_yawn", "Yawn"],
  ["enthusiastic_dance", "Enthusiastic Dance"],
  ["kiss", "Blowing a Kiss"],
  ["monster_dance", "Monster Dance"],
  ["oh_please", "Oh, Please"],
  ["pumped_up", "Pumped Up"],
  ["scheme", "Evil Scheme"],
  ["slow_clap", "Slow Clap"],
  ["sorrow", "Sorrow"],
  ["tantrum", "Tantrum"],
  ["throat_slit", "Watch Your Back"],
  ["victory_cheer", "Victory Cheer"],
  ["zombie_dance", "Zombie Dance"],
];

// Mild ones that hold well for display, picked by Adam
const FEATURED = new Set([
  "Bring It On",
  "Clap",
  "Praise the Light",
  "Sorrow",
  "Thumbs Up",
  "Victory Wave",
]);

export const STANDING = "standing";

/** D1 player animation files by their D1 emote name, played on the D1 skeleton */
export const POSES = D1_EMOTES.map(([file, name]) => ({
  file: `destiny_player_animation_${file}.js`,
  name,
  featured: FEATURED.has(name),
})).sort((a, b) => a.name.localeCompare(b.name));

export const FEATURED_POSE_IDS = [
  STANDING,
  ...POSES.filter((pose) => pose.featured).map((pose) => pose.file),
];

export const OTHER_POSE_IDS = POSES.filter((pose) => !pose.featured).map(
  (pose) => pose.file,
);

// Lists every D1 emote under "More" when on
export const SHOW_ALL_POSES = false;

/** Every pose in the order the picker lists them */
export const POSE_IDS = SHOW_ALL_POSES
  ? [...FEATURED_POSE_IDS, ...OTHER_POSE_IDS]
  : FEATURED_POSE_IDS;

export const POSE_NAMES: Record<string, string> = Object.fromEntries([
  [STANDING, "Standing"],
  ...POSES.map((pose) => [pose.file, pose.name]),
]);
