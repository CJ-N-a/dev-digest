/** What a use case needs from the request: the tenant. */
export interface SkillsContext {
  workspaceId: string;
}

/** Injected clock so stats windows are testable. */
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();
