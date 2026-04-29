import { Module } from '@nestjs/common';

import { LlmModule } from '../llm/llm.module';
import { AgentRunner } from './agent/agent.runner';
import { DraftIntroTool } from './agent/tools/draft-intro.tool';
import { ScoreMatchTool } from './agent/tools/score-match.tool';
import { SearchAttendeesTool } from './agent/tools/search-attendees.tool';
import { ConciergeController } from './concierge.controller';
import { ConciergeService } from './concierge.service';

@Module({
  imports: [LlmModule],
  controllers: [ConciergeController],
  providers: [ConciergeService, AgentRunner, SearchAttendeesTool, ScoreMatchTool, DraftIntroTool],
})
export class ConciergeModule {}
