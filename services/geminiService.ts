
import { GoogleGenAI } from "@google/genai";
import { IssueRecord } from "../types";

const getAiClient = () => {
  try {
    // Safely check for process.env. In browser ESM without a bundler polyfill, process might be undefined.
    const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : null;
    if (!apiKey) {
      console.warn("API Key not found in environment variables.");
      return null;
    }
    return new GoogleGenAI({ apiKey });
  } catch (e) {
    console.warn("Error initializing AI client:", e);
    return null;
  }
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

export const generateIssueEmail = async (input: IssueRecord | IssueRecord[]): Promise<{ subject: string; body: string }> => {
  const ai = getAiClient();
  
  // Normalize input to array
  const records = Array.isArray(input) ? input : [input];
  if (records.length === 0) return { subject: "Error", body: "No records provided" };

  const firstRecord = records[0];
  const isMultiLine = records.length > 1;

  const fallbackSubject = `Issue Alert: ${isMultiLine ? 'Multiple Items' : firstRecord.itemName}`;
  const fallbackBody = `New issue recorded.\n\nMachine: ${firstRecord.machineName}\nLocation: ${firstRecord.locationId}\n\nItems:\n${records.map(r => `- ${r.itemName} (${r.quantity})`).join('\n')}`;

  // Fallback if AI not available
  if (!ai) {
    return { subject: fallbackSubject, body: fallbackBody };
  }

  try {
    const itemsDescription = records.map(r => `${r.itemName} (Qty: ${r.quantity})`).join(", ");

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Draft a professional email notification for a warehouse material issue slip.
      
      Context:
      - Location: ${firstRecord.locationId}
      - Machine: ${firstRecord.machineName}
      - Date: ${firstRecord.timestamp}
      - Items Issued: ${itemsDescription}

      Return the response in JSON format with "subject" and "body" keys.
      The body should be plain text, ready to send.`,
       config: { responseMimeType: "application/json" }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response");
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Gemini Email Error:", error);
     return { subject: fallbackSubject, body: fallbackBody };
  }
};
