import { GoogleGenAI } from "@google/genai";
import { IssueRecord } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateDashboardInsights = async (history: IssueRecord[]): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "AI Insights unavailable: Missing API Key.";

  // Simplify data to send to LLM to save tokens
  const simplifiedHistory = history.slice(0, 50).map(h => ({
    item: h.itemName,
    qty: h.quantity,
    machine: h.machineName,
    loc: h.locationId,
    date: h.timestamp.split('T')[0]
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this warehouse issue log data in JSON format: ${JSON.stringify(simplifiedHistory)}.
      Provide 3 concise, actionable operational insights or patterns you detect (e.g., high consumption machines, frequent items).
      Format as a bulleted list. Keep it professional.`,
    });
    return response.text || "No insights generated.";
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "Unable to generate insights at this time.";
  }
};

export const generateIssueEmail = async (record: IssueRecord): Promise<{ subject: string; body: string }> => {
  const ai = getAiClient();
  if (!ai) return { subject: "Issue Notification", body: "Please check the system for details." };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Draft a professional email notification for a warehouse item issue.
      Details:
      - Location: ${record.locationId}
      - Item: ${record.itemName} (ID: ${record.itemId})
      - Quantity: ${record.quantity}
      - Machine: ${record.machineName}
      - Date: ${record.timestamp}

      Return the response in JSON format with "subject" and "body" keys.
      The body should be plain text, ready to send.`,
       config: { responseMimeType: "application/json" }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response");
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Gemini Email Error:", error);
    return { 
      subject: `Issue Alert: ${record.itemName}`,
      body: `An issue has been recorded for ${record.itemName} at ${record.locationId}. Machine: ${record.machineName}. Quantity: ${record.quantity}.`
    };
  }
};
