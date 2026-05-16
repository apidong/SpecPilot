import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const REQUIREMENTS_SECTIONS = [
  'Problem Statement',
  'Goals',
  'Non-goals',
  'User Stories',
  'Functional Requirements',
  'Non-functional Requirements',
  'Business Rules',
  'Edge Cases',
  'Acceptance Criteria',
];

const DESIGN_SECTIONS = [
  'Overview',
  'Architecture',
  'Folder',
  'Data Model',
  'API',
  'UI',
  'Security',
  'Error',
  'Testing',
  'Rollback',
];

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly config: ConfigService) {}

  async generateRequirements(prompt: string): Promise<string> {
    const systemPrompt = `You are a requirements engineer. Generate a comprehensive requirements document in Markdown format.
The document MUST include ALL of these sections as ## headings:
- ## Problem Statement
- ## Goals
- ## Non-goals
- ## User Stories
- ## Functional Requirements
- ## Non-functional Requirements
- ## Business Rules
- ## Edge Cases
- ## Acceptance Criteria

Each section must have at least one non-empty content line.`;

    const content = await this.callLlm(systemPrompt, prompt, 60000);
    this.validateRequirementsSections(content);
    return content;
  }

  async generateDesign(requirementsContent: string): Promise<string> {
    const systemPrompt = `You are a software architect. Generate a comprehensive design document in Markdown format based on the provided requirements.
The document MUST include ALL of these sections as ## headings:
- ## Overview
- ## Architecture
- ## Folder Structure
- ## Data Model
- ## API Design
- ## UI Design
- ## Security Consideration
- ## Error Handling
- ## Testing Strategy
- ## Rollback Strategy

Each section must have at least one non-empty content line.`;

    const content = await this.callLlm(systemPrompt, `Requirements:\n\n${requirementsContent}`, 120000);
    this.validateDesignSections(content);
    return content;
  }

  async generateTasks(designContent: string): Promise<string> {
    const systemPrompt = `You are a project manager. Generate a task checklist in Markdown format based on the provided design.
Format each task as:
- [ ] TSK-001: Task title
  Type: backend|frontend|fullstack|infra|docs|test
  Priority: high|medium|low
  Depends on: TSK-NNN, ... or none
  Acceptance: Clear acceptance criteria

Use sequential TSK-NNN codes starting from TSK-001.
Generate between 5 and 50 tasks covering all aspects of the design.`;

    const content = await this.callLlm(systemPrompt, `Design:\n\n${designContent}`, 60000);
    if (!content.includes('TSK-')) {
      throw new BadGatewayException('LLM response does not contain valid task items');
    }
    return content;
  }

  private async callLlm(
    systemPrompt: string,
    userMessage: string,
    timeoutMs: number,
  ): Promise<string> {
    const provider = this.config.get<string>('LLM_DEFAULT_PROVIDER', 'openai_compatible');
    const baseUrl = this.config.get<string>('LLM_DEFAULT_BASE_URL', 'https://api.openai.com/v1');
    const apiKey = this.config.get<string>('LLM_DEFAULT_API_KEY', '');
    const model = this.config.get<string>('LLM_DEFAULT_MODEL', 'gpt-4o');

    if (!apiKey) {
      throw new BadGatewayException('LLM API key not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 8000,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new BadGatewayException(`LLM API error ${response.status}: ${errorText}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message: string };
      };

      if (data.error) {
        throw new BadGatewayException(`LLM error: ${data.error.message}`);
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new BadGatewayException('LLM returned empty response');
      }

      if (content.length > 200000) {
        throw new BadGatewayException('LLM response exceeds 200000 character limit');
      }

      return content;
    } catch (err: unknown) {
      if (err instanceof BadGatewayException) throw err;
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') {
        throw new BadGatewayException('LLM request timed out');
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadGatewayException(`LLM request failed: ${msg}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private validateRequirementsSections(content: string): void {
    const missing = REQUIREMENTS_SECTIONS.filter(
      (section) => !content.toLowerCase().includes(section.toLowerCase()),
    );
    if (missing.length > 0) {
      throw new BadGatewayException(
        `LLM response missing required sections: ${missing.join(', ')}`,
      );
    }
  }

  private validateDesignSections(content: string): void {
    const missing = DESIGN_SECTIONS.filter(
      (section) => !content.toLowerCase().includes(section.toLowerCase()),
    );
    if (missing.length > 0) {
      throw new BadGatewayException(
        `LLM response missing required design sections: ${missing.join(', ')}`,
      );
    }
  }
}
