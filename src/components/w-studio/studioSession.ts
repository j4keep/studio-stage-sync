/**
 * Session / role model for future remote engineer–artist workflows.
 * No realtime collaboration here — only capability flags for UI and state hooks.
 */

export type SessionRole = 'engineer' | 'artist' | 'viewer';

/** Mutable project-level metadata (saved with project JSON when present). */
export type StudioProjectMeta = {
  title: string;
  notes: string;
  /** Opaque id for a booking / appointment in the product layer */
  bookingRef: string;
  /** Opaque id for this studio session instance */
  sessionRef: string;
};

export function defaultStudioProjectMeta(): StudioProjectMeta {
  return {
    title: '',
    notes: '',
    bookingRef: '',
    sessionRef: '',
  };
}

/** What the current role is allowed to do in the UI (coarse gates). */
export type StudioSessionCapabilities = {
  canEditTimeline: boolean;
  canOpenFullMixer: boolean;
  canAdjustMaster: boolean;
  canManageTracks: boolean;
  canArmRecord: boolean;
  canImportExportProject: boolean;
  canOpenBeatTools: boolean;
  canOpenKeyboard: boolean;
  canBrowseLoops: boolean;
  canManageFxRack: boolean;
};

export function studioSessionCapabilities(
  role: SessionRole,
  artistSessionLimited: boolean,
): StudioSessionCapabilities {
  if (role === 'engineer') {
    return {
      canEditTimeline: true,
      canOpenFullMixer: true,
      canAdjustMaster: true,
      canManageTracks: true,
      canArmRecord: true,
      canImportExportProject: true,
      canOpenBeatTools: true,
      canOpenKeyboard: true,
      canBrowseLoops: true,
      canManageFxRack: true,
    };
  }
  if (role === 'artist') {
    const lim = artistSessionLimited;
    return {
      canEditTimeline: true,
      canOpenFullMixer: !lim,
      canAdjustMaster: !lim,
      canManageTracks: !lim,
      canArmRecord: true,
      canImportExportProject: false,
      canOpenBeatTools: true,
      canOpenKeyboard: true,
      canBrowseLoops: true,
      canManageFxRack: !lim,
    };
  }
  return {
    canEditTimeline: false,
    canOpenFullMixer: true,
    canAdjustMaster: false,
    canManageTracks: false,
    canArmRecord: false,
    canImportExportProject: false,
    canOpenBeatTools: false,
    canOpenKeyboard: false,
    canBrowseLoops: true,
    canManageFxRack: false,
  };
}

/** Bottom sheet / side panel placeholders for BandLab-style tools. */
export type StudioToolSheetId =
  | 'keyboard'
  | 'beat_maker'
  | 'loops_browser'
  | 'instruments'
  | 'fx_rack';
