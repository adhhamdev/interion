import { GoogleGenAI } from "@google/genai";
import { DesignState, DesignVersion } from '../types';

const getBase64FromUrl = async (url: string): Promise<string> => {
  // If it's already a data URL, strip the prefix
  if (url.startsWith('data:')) {
    return url.split(',')[1];
  }
  return url;
};

// System prompt definition based on requirements
const SYSTEM_PROMPT = JSON.stringify({
  role: "system",
  identity: "You are a world-class interior designer with decades of experience in residential and commercial interiors. You strictly follow architectural realism, interior design principles, ergonomic standards, and budget feasibility.",
  core_objective: "Transform the provided interior image into a realistic, buildable, and professionally designed interior that satisfies user intent while respecting physical, spatial, and budget constraints.",
  design_rules: {
    spatial_integrity: "Preserve original room geometry, perspective, and structural elements. Do not add or remove walls, doors, or windows unless explicitly instructed.",
    scale_accuracy: "All furniture and decor must be correctly scaled to the room dimensions and camera perspective.",
    material_realism: "Use materials that exist in the real world and match the defined budget level.",
    budget_alignment: "Every design choice must align with the declared budget constraints.",
    no_hallucination: "Never invent objects, structures, or features not supported by the image or user instructions."
  },
  output_requirements: {
    image_quality: "High-resolution, photorealistic, clean interior visualization",
    visual_purity: "No text, no labels, no logos, no watermarks"
  }
});

export const generateDesignIteration = async (
  currentImage: string,
  config: DesignState,
  previousVersionId: string | null
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1. Prepare Main Image
  const mainImageBase64 = await getBase64FromUrl(currentImage);

  // 2. Prepare Custom Items
  const customItemsPrompt = config.customItems.map((item, index) => {
    return `   - Asset #${index + 1}: ${item.instruction || "Integrate this item naturally into the room."}`;
  }).join('\n');

  // 3. Construct structured prompt
  const userPromptObj = {
    room_type: config.roomType,
    design_intent: {
      style: config.style,
      mood: config.mood,
    },
    constraints: {
      budget: config.budget,
      locked_elements: config.lockedElements || "None"
    },
    iteration_instruction: config.instructions,
    previous_version_reference: previousVersionId || "Initial Upload"
  };

  let fullPrompt = `
    ${SYSTEM_PROMPT}
    
    USER INSTRUCTION JSON:
    ${JSON.stringify(userPromptObj, null, 2)}
    
    ACTION:
    Edit the provided MAIN ROOM IMAGE to match the Design Intent and Constraints above. 
    Maintain the perspective and structural elements of the input image strictly.
  `;

  if (config.customItems.length > 0) {
    fullPrompt += `
    
    IMPORTANT - INTEGRATING CUSTOM ASSETS:
    I have provided ${config.customItems.length} additional reference images after the main room image.
    You must realistically place these specific items into the room based on the following instructions:
    ${customItemsPrompt}
    
    Ensure the lighting, perspective, and scale of these assets match the main room perfectly.
    `;
  }

  fullPrompt += `\nReturn only the generated image.`;

  // 4. Build Request Parts
  const parts: any[] = [
    { text: fullPrompt },
    { 
      inlineData: {
        mimeType: 'image/png', 
        data: mainImageBase64, 
      }
    }
  ];

  // Append custom item images
  for (const item of config.customItems) {
    const itemBase64 = await getBase64FromUrl(item.image);
    parts.push({
      inlineData: {
        mimeType: 'image/png', // Simplified assumption, logic handles various types via base64 extraction
        data: itemBase64
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts,
      },
      config: {}
    });

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image generated in response.");

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};