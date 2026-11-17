/** Help assistant switches (minimal stub: the settings agent replaces this with site-settings reads). */
export interface HelpConfig {
  enabled: boolean;
  hindi: boolean;
  ai: boolean;
}

export const HELP_DEFAULTS: HelpConfig = { enabled: true, hindi: false, ai: true };

export async function getHelpConfig(): Promise<HelpConfig> {
  return HELP_DEFAULTS;
}
