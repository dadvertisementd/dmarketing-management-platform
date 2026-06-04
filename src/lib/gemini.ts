import { generateAIContent } from './ai';

export async function generateContentSuggestions(topic: string, platform: string) {
  try {
    const prompt = `Generate 3 creative social media post suggestions for ${platform} about ${topic}. Focus on marketing and engagement. Return a JSON array of objects with title and content.`;
    const resText = await generateAIContent(prompt, "You are a professional social media manager. Output ONLY a valid JSON array.");
    const match = resText.match(/\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : "[]");
  } catch (error) {
    console.error("AI Generation Error:", error);
    return [];
  }
}

export async function analyzeCampaignPerformance(data: any) {
  try {
    const prompt = `Analyze this campaign data and provide 3 key insights and 3 recommended actions. Summary should be professional. Data: ${JSON.stringify(data)}`;
    const resText = await generateAIContent(prompt, "You are a marketing data analyst. Output ONLY a valid JSON object with keys: insights (array), recommendations (array), summary (string).");
    const match = resText.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : "{}");
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
}
