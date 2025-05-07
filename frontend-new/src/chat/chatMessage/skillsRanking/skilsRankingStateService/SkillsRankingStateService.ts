import { DEFAULT_SKILLS_RANKING_STATE, SkillsRankingState } from "../types";

export default class SkillsRankingStateService {
    private static instance: SkillsRankingStateService;
    private state: SkillsRankingState;

    private constructor() {
        this.state = DEFAULT_SKILLS_RANKING_STATE;
    }

    public static getInstance(): SkillsRankingStateService {
        if (!SkillsRankingStateService.instance) {
            SkillsRankingStateService.instance = new SkillsRankingStateService();
        }
        return SkillsRankingStateService.instance;
    }

    public getSkillsRankingState(): SkillsRankingState {
        return this.state;
    }

    public async setSkillsRankingState(state: SkillsRankingState): Promise<void> {
        this.state = state;
    }
}