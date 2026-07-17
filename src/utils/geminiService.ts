import { GoogleGenerativeAI } from '@google/genai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export interface RouteRecommendation {
  originId: string;
  destinationId: string;
  confidence: number;
  reasoning: string;
  obstructions: string[];
}

export interface ScheduleOptimization {
  bundleId: string;
  recommendedAction: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedTime: number;
  reasoning: string;
}

export const geminiService = {
  // Analyze facility state and recommend gantry routes
  async recommendRoute(
    bundles: any[],
    originId: string,
    possibleDestinations: string[],
    constraints: any
  ): Promise<RouteRecommendation> {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
You are an expert logistics AI for a rebar processing facility. Analyze this scenario and recommend the optimal gantry crane route.

Current Facility State:
- Bundles in system: ${bundles.length}
- Origin zone: ${originId}
- Possible destinations: ${possibleDestinations.join(', ')}
- Material class constraints: Black rebar stays in SW zone only, Epoxy can move freely
- Capacity thresholds: Critical at 85%, Warning at 60%

Constraints:
${JSON.stringify(constraints, null, 2)}

Provide a JSON response with this structure:
{
  "recommendedDestination": "string",
  "confidence": 0.95,
  "reasoning": "string explaining the recommendation",
  "obstructions": ["list of potential issues to watch for"]
}
`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      const parsed = JSON.parse(response);

      return {
        originId,
        destinationId: parsed.recommendedDestination,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        obstructions: parsed.obstructions,
      };
    } catch (error) {
      console.error('Gemini route recommendation failed:', error);
      throw error;
    }
  },

  // Generate bundle processing schedule
  async optimizeSchedule(bundles: any[], jobs: any[]): Promise<ScheduleOptimization[]> {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
You are a manufacturing scheduling expert. Optimize the processing sequence for these bundles.

Active Bundles: ${bundles.length}
Active Jobs: ${jobs.length}

Bundle Summary:
${bundles.map(b => `- ${b.tagId}: ${b.status} at ${b.location}, Job ${b.jobId}`).join('\n')}

Provide a JSON array of optimization recommendations:
[
  {
    "bundleId": "string",
    "recommendedAction": "PRIORITY_MOVE|FABRICATE|LOAD|RACK",
    "priority": "HIGH|MEDIUM|LOW",
    "estimatedTime": 120,
    "reasoning": "string"
  }
]

Focus on maximizing throughput and respecting safety constraints.
`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      const parsed = JSON.parse(response);

      return parsed.map((rec: any) => ({
        bundleId: rec.bundleId,
        recommendedAction: rec.recommendedAction,
        priority: rec.priority,
        estimatedTime: rec.estimatedTime,
        reasoning: rec.reasoning,
      }));
    } catch (error) {
      console.error('Gemini schedule optimization failed:', error);
      throw error;
    }
  },

  // Predict and suggest exception handling
  async predictExceptions(bundles: any[], exceptions: any[]): Promise<string[]> {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
You are a quality assurance expert for rebar processing. Based on recent exceptions and current state, predict potential issues.

Recent Exceptions:
${exceptions.slice(0, 5).map(e => `- ${e.type}: ${e.description}`).join('\n')}

Current Bundle Issues:
${bundles.filter(b => b.status === 'BENDING').length} bundles in fabrication
${bundles.filter(b => b.status === 'STAGED').length} bundles staged

Provide a JSON array of predicted risks:
[
  "Predicted issue description",
  "Another potential problem"
]

Be specific and actionable.
`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      const parsed = JSON.parse(response);
      return parsed;
    } catch (error) {
      console.error('Gemini exception prediction failed:', error);
      return [];
    }
  },
};
