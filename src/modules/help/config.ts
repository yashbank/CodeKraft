/** STUB (P21-2): replaced by the settings agent (qa/p21-4-settings). Contract: getHelpConfig(). */
export interface HelpConfig {
  enabled: boolean;
  hindi: boolean;
  ai: boolean;
}

export async function getHelpConfig(): Promise<HelpConfig> {
  return { enabled: true, hindi: false, ai: true };
}
