import { callAI, AICallResult, AIProvider } from './aiClient';
import { buildPrompt } from './promptManager';
import { logCost, calculateCost } from './costTracker';

export interface OrchestratorInput {
  /** Name of the generator prompt YAML (without .yaml) */
  generatorPrompt: string;
  /** Name of the critique prompt YAML (without .yaml) */
  critiquePrompt: string;
  /** Context variables to interpolate into prompts */
  context: Record<string, string>;
  /** Max Agent→Critique iterations before returning best result */
  maxIterations?: number;
  /** Minimum critique score (1-10) to accept without re-looping */
  acceptThreshold?: number;
  /** Operation name for cost logging */
  operation: string;
  /** User who triggered this */
  user?: string;
  /** Related document ID for cost tracking */
  relatedId?: string;
  /** Related collection name */
  relatedCollection?: string;
  /** Provider for the generator agent. Default: 'claude' */
  generatorProvider?: AIProvider;
  /** Provider for the critique agent. Default: 'gemini' */
  critiqueProvider?: AIProvider;
}

export interface CritiqueResult {
  score: number;
  feedback: string;
  passesThreshold: boolean;
  evidenceCheck: {
    hasStrategyReferences: boolean;
    hasDataPoints: boolean;
    isVoiceConsistent: boolean;
    isPlatformAppropriate: boolean;
  };
}

export interface EvidenceCitations {
  claims: Array<{ claim: string; source: string; reference: string }>;
  strategyReferences: string[];
  dataPoints: string[];
  evidenceCheck: {
    hasStrategyReferences: boolean;
    hasDataPoints: boolean;
    isVoiceConsistent: boolean;
    isPlatformAppropriate: boolean;
  };
}

export interface OrchestratorResult {
  /** The final generated content (raw text or JSON string) */
  content: string;
  /** Parsed JSON if the output is valid JSON, otherwise null */
  parsed: Record<string, any> | null;
  /** Final critique assessment */
  critique: CritiqueResult;
  /** How many iterations it took */
  iterations: number;
  /** Total tokens used across all iterations */
  totalInputTokens: number;
  totalOutputTokens: number;
  /** Total cost in USD */
  totalCostUsd: number;
  /** Evidence citations extracted from the AI response */
  evidence: EvidenceCitations;
  /** Which providers were used */
  providers: { generator: AIProvider; critique: AIProvider };
}

/**
 * The core Agent + Critique loop.
 *
 * 1. Generator agent (default: Claude) produces output from the prompt template + context
 * 2. Critique agent (default: Gemini) evaluates the output against quality criteria
 * 3. If critique score < threshold, generator re-runs with critique feedback
 * 4. Repeats up to maxIterations times, then returns the best result
 */
export async function runAgentCritiqueLoop(input: OrchestratorInput): Promise<OrchestratorResult> {
  const maxIterations = input.maxIterations || 3;
  const acceptThreshold = input.acceptThreshold || 8;
  const generatorProvider = input.generatorProvider || 'claude';
  const critiqueProvider = input.critiqueProvider || 'gemini';

  let bestResult: { content: string; critique: CritiqueResult; score: number } | null = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  let iterations = 0;
  let previousFeedback = '';

  for (let i = 1; i <= maxIterations; i++) {
    iterations = i;

    // --- GENERATOR STEP (Claude by default) ---
    const genContext = {
      ...input.context,
      ITERATION: String(i),
      PREVIOUS_FEEDBACK: previousFeedback,
    };

    const { systemPrompt: genSystem, userPrompt: genUser, template: genTemplate } = buildPrompt(
      input.generatorPrompt,
      genContext
    );

    const startGen = Date.now();
    const genResult: AICallResult = await callAI({
      systemPrompt: genSystem,
      userPrompt: genUser,
      model: genTemplate.model,
      maxTokens: genTemplate.max_tokens,
      temperature: genTemplate.temperature,
      provider: generatorProvider,
      enableFallback: true,
    });

    totalInputTokens += genResult.inputTokens;
    totalOutputTokens += genResult.outputTokens;
    totalCostUsd += calculateCost(genResult.model, genResult.inputTokens, genResult.outputTokens);

    await logCost({
      operation: input.operation,
      model: genResult.model,
      provider: genResult.provider,
      inputTokens: genResult.inputTokens,
      outputTokens: genResult.outputTokens,
      iteration: i,
      totalIterations: maxIterations,
      agentType: 'generator',
      user: input.user,
      relatedId: input.relatedId,
      relatedCollection: input.relatedCollection,
      promptName: input.generatorPrompt,
      durationMs: Date.now() - startGen,
    });

    // --- CRITIQUE STEP (Gemini by default) ---
    const critiqueContext = {
      ...input.context,
      GENERATED_CONTENT: genResult.content,
      ITERATION: String(i),
    };

    const { systemPrompt: critSystem, userPrompt: critUser, template: critTemplate } = buildPrompt(
      input.critiquePrompt,
      critiqueContext
    );

    const startCrit = Date.now();
    const critResult: AICallResult = await callAI({
      systemPrompt: critSystem,
      userPrompt: critUser,
      model: critTemplate.model,
      maxTokens: critTemplate.max_tokens,
      temperature: 0.3,
      provider: critiqueProvider,
      enableFallback: true,
    });

    totalInputTokens += critResult.inputTokens;
    totalOutputTokens += critResult.outputTokens;
    totalCostUsd += calculateCost(critResult.model, critResult.inputTokens, critResult.outputTokens);

    await logCost({
      operation: input.operation,
      model: critResult.model,
      provider: critResult.provider,
      inputTokens: critResult.inputTokens,
      outputTokens: critResult.outputTokens,
      iteration: i,
      totalIterations: maxIterations,
      agentType: 'critique',
      user: input.user,
      relatedId: input.relatedId,
      relatedCollection: input.relatedCollection,
      promptName: input.critiquePrompt,
      durationMs: Date.now() - startCrit,
    });

    // Parse critique response
    const critique = parseCritiqueResponse(critResult.content);

    // Track best result
    if (!bestResult || critique.score > bestResult.score) {
      bestResult = { content: genResult.content, critique, score: critique.score };
    }

    // Check if we pass the threshold
    if (critique.score >= acceptThreshold) {
      break;
    }

    // Prepare feedback for next iteration
    previousFeedback = `Previous attempt scored ${critique.score}/10. Critique feedback: ${critique.feedback}`;
  }

  const finalContent = bestResult!.content;
  let parsed: Record<string, any> | null = null;
  try {
    parsed = JSON.parse(finalContent);
  } catch {
    // Content is not JSON, that's fine
  }

  // Extract evidence from the final content and critique
  const evidence = extractEvidence(finalContent, bestResult!.critique);

  return {
    content: finalContent,
    parsed,
    critique: bestResult!.critique,
    iterations,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    evidence,
    providers: { generator: generatorProvider, critique: critiqueProvider },
  };
}

/**
 * Extracts evidence citations from AI-generated content and critique results.
 */
function extractEvidence(content: string, critique: CritiqueResult): EvidenceCitations {
  let claims: Array<{ claim: string; source: string; reference: string }> = [];
  const strategyReferences: string[] = [];
  const dataPoints: string[] = [];

  try {
    const parsed = JSON.parse(content);

    // Extract from evidence object if present (post generators, outreach drafters)
    if (parsed.evidence?.claims && Array.isArray(parsed.evidence.claims)) {
      claims = parsed.evidence.claims;
    }

    // Extract strategy references from known fields
    if (parsed.pillar) strategyReferences.push(`contentPillar: ${parsed.pillar}`);
    if (parsed.evidence?.hookJustification) strategyReferences.push(parsed.evidence.hookJustification);
    if (parsed.evidence?.ctaJustification) strategyReferences.push(parsed.evidence.ctaJustification);
    if (parsed.evidence?.pillarJustification) strategyReferences.push(parsed.evidence.pillarJustification);
    if (parsed.evidence?.formatJustification) strategyReferences.push(parsed.evidence.formatJustification);

    // Collect data points from claims
    claims.forEach((c) => {
      if (c.source === 'strategy') strategyReferences.push(c.reference);
      if (c.source === 'performance' || c.source === 'signal') dataPoints.push(c.reference);
    });

    // Extract from personalizationEvidence (outreach drafter)
    if (parsed.personalizationEvidence && Array.isArray(parsed.personalizationEvidence)) {
      parsed.personalizationEvidence.forEach((pe: any) => {
        if (pe.source) dataPoints.push(`${pe.element}: ${pe.source}`);
      });
    }
  } catch {
    // Content is not JSON; evidence cannot be structurally extracted
  }

  return {
    claims,
    strategyReferences,
    dataPoints,
    evidenceCheck: critique.evidenceCheck,
  };
}

/**
 * Parses the critique agent's response into a structured CritiqueResult.
 */
function parseCritiqueResponse(raw: string): CritiqueResult {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: parsed.score ?? 5,
        feedback: parsed.feedback ?? '',
        passesThreshold: parsed.score >= 8,
        evidenceCheck: {
          hasStrategyReferences: parsed.evidence_check?.has_strategy_references ?? false,
          hasDataPoints: parsed.evidence_check?.has_data_points ?? false,
          isVoiceConsistent: parsed.evidence_check?.is_voice_consistent ?? false,
          isPlatformAppropriate: parsed.evidence_check?.is_platform_appropriate ?? false,
        },
      };
    }
  } catch {
    // Failed to parse
  }

  return {
    score: 5,
    feedback: raw,
    passesThreshold: false,
    evidenceCheck: {
      hasStrategyReferences: false,
      hasDataPoints: false,
      isVoiceConsistent: false,
      isPlatformAppropriate: false,
    },
  };
}
