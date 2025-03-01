/**
 * Module: @liquid/broll
 */

import { openai } from "npm:openai";

// Define interfaces for the structured data
interface BrollOverlay {
  broll_filename: string;  // The filename or path of the B-roll clip or image
  timestamp: number;       // The time in the main video (in seconds) where the B-roll starts
  duration: number;        // Duration of the overlay in seconds
}

interface BrollSuggestion {
  filename: string;
  suggested_broll: BrollOverlay[];  // Each item contains B-roll filename, timestamp, and duration
}

interface BrollSuggestions {
  suggestions: BrollSuggestion[];
}

/**
 * Generates structured output from AI using a provided schema
 * @param prompt - The prompt to send to the AI
 * @param schema - The schema to validate the response against
 * @param defaultValue - Default value to return in case of failure
 * @returns Structured data matching the provided schema or the default value
 */
async function generateStructuredOutput<T>(
  prompt: string, 
  schema: any, 
  defaultValue: T
): Promise<T> {
  try {
    // Call OpenAI API to generate structured content
    // This implementation would need to be customized based on authentication and API requirements
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    // Parse the response content as JSON
    const content = response.choices[0].message.content;
    if (!content) {
      return defaultValue;
    }

    return JSON.parse(content) as T;
  } catch (error) {
    console.error("Error generating structured output:", error);
    return defaultValue;
  }
}

/**
 * Suggests B-roll overlays for analyzed media based on marketing context
 * @param analyzedMedia - The analyzed media items containing content information
 * @param marketingContext - The marketing context to guide B-roll selection
 * @returns An array of B-roll suggestions for each media file
 */
export async function suggestBroll(
  analyzedMedia: any[], 
  marketingContext: string
): Promise<BrollSuggestion[]> {
  // Prepare the media list for the prompt
  const mediaList = analyzedMedia.map(m => m);

  // Create a comprehensive prompt that includes context, analyzed media, and output requirements
  const prompt = `
    You have a marketing context:
    ${marketingContext}
    You have analyzed media items:
    ${JSON.stringify(mediaList, null, 2)}
    Based on these items, suggest suitable B-roll files to enhance the final video.
    For each analyzed media file, suggest the following:
    - B-roll files to use.
    - The timestamp (in seconds) where the B-roll should be overlaid.
    - The duration (in seconds) of the B-roll overlay.
    Return a JSON array of objects. Each object should have:
    - filename: The filename of a media file that needs B-roll.
    - suggested_broll: A list of objects, each with:
        - broll_filename: The filename or path of the B-roll clip or image.
        - timestamp: The time in the main video (in seconds) where the B-roll starts.
        - duration: The duration of the B-roll overlay (in seconds).
    Example JSON structure:
    [
      {
        "filename": "video1.mp4",
        "suggested_broll": [
          {
            "broll_filename": "broll_image1.png",
            "timestamp": 10,
            "duration": 5
          },
          {
            "broll_filename": "broll_clip2.mp4",
            "timestamp": 25,
            "duration": 8
          }
        ]
      }
    ]
    Return only valid JSON that matches the BrollSuggestions schema.
  `;

  // Generate structured B-roll suggestions using AI
  const brollResult = await generateStructuredOutput<BrollSuggestions>(
    prompt, 
    {}, // Schema validation would be implemented in a more complex version
    { suggestions: [] }
  );

  // Return the array of suggestions or empty array if nothing was generated
  return brollResult.suggestions || [];
}