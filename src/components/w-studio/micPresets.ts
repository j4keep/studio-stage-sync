import type { EffectPresetId, EqPresetId, SpacePresetId } from './types';

/** One-click chains inspired by typical DAW / n-Track-style vocal & instrument workflows */
export type MicChainPresetId =
  | 'flat_dry'
  | 'broadcast_voice'
  | 'studio_vocal'
  | 'podcast_spoken'
  | 'acoustic_guitar'
  | 'electric_guitar_amp'
  | 'bass_di'
  | 'drum_room';

export type MicChainPreset = {
  id: MicChainPresetId;
  label: string;
  hint: string;
  eq: EqPresetId;
  fx: EffectPresetId;
  space: SpacePresetId;
};

export const MIC_CHAIN_PRESETS: MicChainPreset[] = [
  {
    id: 'flat_dry',
    label: 'Flat / dry',
    hint: 'No color — raw input',
    eq: 'flat',
    fx: 'none',
    space: 'off',
  },
  {
    id: 'broadcast_voice',
    label: 'Broadcast voice',
    hint: 'Presence + light comp + small room',
    eq: 'vocal_broadcast',
    fx: 'gentle_comp',
    space: 'room_small',
  },
  {
    id: 'studio_vocal',
    label: 'Studio vocal',
    hint: 'Clarity + punch comp + plate',
    eq: 'vocal_clarity',
    fx: 'punch_comp',
    space: 'plate',
  },
  {
    id: 'podcast_spoken',
    label: 'Podcast / spoken',
    hint: 'Warm + glue + tight room',
    eq: 'warm',
    fx: 'glue_bus',
    space: 'room_small',
  },
  {
    id: 'acoustic_guitar',
    label: 'Acoustic guitar',
    hint: 'Air + gentle dynamics',
    eq: 'acoustic_guitar',
    fx: 'gentle_comp',
    space: 'hall_med',
  },
  {
    id: 'electric_guitar_amp',
    label: 'Electric guitar (amp)',
    hint: 'Mid focus + punch',
    eq: 'electric_guitar',
    fx: 'punch_comp',
    space: 'room_small',
  },
  {
    id: 'bass_di',
    label: 'Bass (DI)',
    hint: 'Low weight + limiter-ish',
    eq: 'bass_boost',
    fx: 'limit_soft',
    space: 'off',
  },
  {
    id: 'drum_room',
    label: 'Drum kit (room)',
    hint: 'Snap + bus glue + hall',
    eq: 'drum_snap',
    fx: 'glue_bus',
    space: 'hall_med',
  },
];
