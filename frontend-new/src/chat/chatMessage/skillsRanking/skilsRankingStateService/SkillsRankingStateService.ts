import { SkillsRankingState } from "../types";

export default class SkillsRankingStateService {
    private static instance: SkillsRankingStateService;
    private state: SkillsRankingState | null;

    private constructor() {
        this.state = null;
    }

    public static getInstance(): SkillsRankingStateService {
        if (!SkillsRankingStateService.instance) {
            SkillsRankingStateService.instance = new SkillsRankingStateService();
        }
        return SkillsRankingStateService.instance;
    }

    public getSkillsRankingState(): SkillsRankingState | null {
        return this.state;
    }

    public async setSkillsRankingState(state: SkillsRankingState): Promise<void> {
        this.state = state;
    }
}