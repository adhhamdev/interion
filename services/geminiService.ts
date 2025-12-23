
import { GoogleGenAI } from "@google/genai";
import { DesignState, GenerationResponse, VideoState } from '../types';

const getBase64FromUrl = (url: string): string => {
  if (url.startsWith('data:')) {
    return url.split(',')[1];
  }
  return url;
};

const SYSTEM_PROMPT = `
You are "VibeArchitect," a world-class AI interior designer. Your task is to redesign the provided room image based on user preferences.

CRITICAL RULES:
1. You MUST provide exactly TWO parts in your response:
   - PART 1 (Text): A valid JSON object containing metadata.
   - PART 2 (Image): The redesigned room image (no text/labels in image).

JSON STRUCTURE:
{
  "vibeSummary": "Short catchy summary of the new atmosphere",
  "reasoning": "Technical explanation of layout, lighting, and style choices",
  "suggestions": ["4 specific, smart follow-up design requests"],
  "sustainabilityScore": 1-10
}

GUIDELINES:
- Analyze architectural constraints (windows, doors) and respect them.
- If an inspiration image is provided, match its color palette and mood.
- If furniture assets are provided, place them realistically in the scene.
- Be creative but professional. Ensure the output is high-quality.
`;

export const generateDesignIteration = async (
  currentImage: string,
  config: DesignState,
  previousVersionId: string | null
): Promise<GenerationResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("Missing API key configuration.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const mainImageBase64 = getBase64FromUrl(currentImage);

  const userPromptObj = {
    room_type: config.roomType,
    design_intent: {
      style: config.style,
      mood: config.mood,
      presets: config.selectedPresets
    },
    constraints: {
      budget: config.budget,
      locked_elements: config.lockedElements || "None"
    },
    iteration_instruction: config.instructions,
    vibe_context: config.selectedPresets.join(', ')
  };

  const parts: any[] = [
    { text: SYSTEM_PROMPT },
    { text: `REDESIGN REQUEST:\n${JSON.stringify(userPromptObj, null, 2)}\n\nApply these changes to the attached image.` },
    { inlineData: { mimeType: 'image/png', data: mainImageBase64 } }
  ];

  // Multimodal Inspiration
  if (config.inspirationImage) {
    parts.push({ text: "STYLE INSPIRATION REFERENCE:" });
    parts.push({ inlineData: { mimeType: 'image/png', data: getBase64FromUrl(config.inspirationImage) } });
  }

  // Custom Furniture Assets
  for (const item of config.customItems) {
    parts.push({ text: `PLACE THIS FURNITURE: ${item.instruction || "Natural placement."}` });
    parts.push({ inlineData: { mimeType: 'image/png', data: getBase64FromUrl(item.image) } });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
    });

    let imageUrl = "";
    let metadataStr = "";

    const candidates = response.candidates || [];
    if (candidates.length === 0 || !candidates[0].content) {
      throw new Error("The designer couldn't process this image. Please try a different room photo.");
    }

    for (const part of candidates[0].content.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      } else if (part.text) {
        metadataStr += part.text;
      }
    }

    // If the model didn't provide an image but provided text, it might be a refusal or safety block.
    if (!imageUrl) {
      if (metadataStr.toLowerCase().includes("safety") || metadataStr.toLowerCase().includes("cannot") || metadataStr.toLowerCase().includes("refuse")) {
        throw new Error("The design engine declined to generate this specific visual. Try a more neutral design request.");
      }
      throw new Error("VibeArchitect was unable to generate a redesigned image. Try simplifying your instructions or using a clearer room photo.");
    }

    // Extract JSON from metadata string with robust fallbacks
    let parsedMetadata = { 
      vibeSummary: "New atmosphere generated.", 
      reasoning: "Balanced the new style with existing architectural constraints.", 
      suggestions: ["Add indoor plants", "Include accent lighting", "Try a different wall color", "Add window treatments"],
      sustainabilityScore: 7 
    };
    
    try {
      const jsonMatch = metadataStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        parsedMetadata = {
          vibeSummary: parsed.vibeSummary || parsedMetadata.vibeSummary,
          reasoning: parsed.reasoning || parsedMetadata.reasoning,
          suggestions: (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) ? parsed.suggestions : parsedMetadata.suggestions,
          sustainabilityScore: typeof parsed.sustainabilityScore === 'number' ? parsed.sustainabilityScore : parsedMetadata.sustainabilityScore
        };
      }
    } catch (e) {
      console.warn("Could not parse AI reasoning JSON, using fallbacks.");
    }

    return {
      imageUrl,
      vibeSummary: parsedMetadata.vibeSummary,
      reasoning: parsedMetadata.reasoning,
      suggestions: parsedMetadata.suggestions,
      sustainabilityScore: parsedMetadata.sustainabilityScore
    };

  } catch (error: any) {
    if (error.message?.includes("block")) {
      throw new Error("The design was blocked by safety filters. Please ensure the instructions and images are appropriate.");
    }
    throw error;
  }
};

export const generateDesignVideo = async (
  imageBase64: string,
  config: VideoState
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const finalPrompt = `Professional cinematic interior showcase: ${config.prompt}. Style: ${config.style}. High quality architectural visualization, smooth camera sweep, photorealistic, 4k detail. Motion: ${config.motionIntensity}/10.`;

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: finalPrompt,
      image: {
        imageBytes: getBase64FromUrl(imageBase64),
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: config.resolution,
        aspectRatio: config.aspectRatio
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed: No URI returned.");

    // Append API key to fetch link
    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await videoResponse.blob();
    return URL.createObjectURL(blob);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      throw new Error("API_KEY_ERROR");
    }
    throw error;
  }
};
