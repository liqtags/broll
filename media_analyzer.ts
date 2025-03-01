import * as path from "jsr:@std/path";
import {
    ensureDir,
    exists
} from "jsr:@std/fs";
import {
    encodeBase64
} from "jsr:@std/encoding";

// Define MediaItem interface
interface MediaItem {
  filename: string;
  media_type: "image" | "video" | "other" | "unknown";
  description: string;
  relevance: string;
  [key: string]: any; // For any additional properties that might be in the data
}

/**
 * Extracts a representative frame from a video file
 * @param filePath - Path to the video file
 * @returns A Uint8Array containing the image data
 */
async function extractFrame(filePath: string): Promise<Uint8Array | null> {
  try {
    // Using Deno's subprocess to call ffmpeg for frame extraction
    // You would need ffmpeg installed for this to work
    const process = Deno.run({
      cmd: [
        "ffmpeg",
        "-i", filePath,
        "-ss", "00:00:05", // Extract frame at 5 seconds
        "-frames:v", "1",
        "-f", "image2pipe",
        "-c:v", "mjpeg",
        "-"
      ],
      stdout: "piped",
      stderr: "piped"
    });

    // Get the output
    const output = await process.output();
    const status = await process.status();
    process.close();

    if (status.success) {
      return output;
    }
    return null;
  } catch (error) {
    console.error(`Error extracting frame: ${error}`);
    return null;
  }
}

/**
 * Encodes an image to base64
 * @param imageData - Uint8Array containing the image data
 * @returns Base64 encoded string
 */
function encodeImage(imageData: Uint8Array): string {
  return encodeBase64(imageData);
}

/**
 * Loads transcript for a video file
 * @param filePath - Path to the video file
 * @param transcriptDir - Directory containing transcripts
 * @returns Transcript text or empty string if not found
 */
async function loadTranscriptForVideo(
  filePath: string,
  transcriptDir: string
): Promise<string> {
  const fileName = path.basename(filePath);
  const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
  const transcriptPath = path.join(transcriptDir, `${baseName}.txt`);
  
  try {
    if (await exists(transcriptPath)) {
      return await Deno.readTextFile(transcriptPath);
    }
    return "";
  } catch (error) {
    console.error(`Error loading transcript: ${error}`);
    return "";
  }
}

/**
 * Generates structured output using OpenAI API
 * @param systemPrompt - System prompt for the AI
 * @param schema - Schema for the output
 * @param messages - Messages to send to the AI
 * @returns Structured data or null on failure
 */
async function generateStructuredOutput<T>(
  systemPrompt: string,
  schema: any,
  messages: Array<{ role: string, content: string }>
): Promise<T | null> {
  try {
    // This is a placeholder for the actual OpenAI API integration
    // You would need to implement the actual API call
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not set");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Error generating structured output: ${error}`);
    return null;
  }
}

/**
 * Analyzes media files, processes only new files, and appends results to the cached JSON
 * @param mediaFiles - Array of paths to media files
 * @param marketingContext - The marketing context for analysis
 * @param transcriptDir - Directory containing transcripts
 * @param cachePath - Path to the cache file
 * @returns Array of MediaItem objects
 */
export async function analyzeMediaFiles(
  mediaFiles: string[],
  marketingContext: string,
  transcriptDir: string = "./transcripts",
  cachePath: string = "./media_cache.json"
): Promise<MediaItem[]> {
  // Ensure transcript directory exists
  await ensureDir(transcriptDir);
  
  // Load existing cache if available
  let cachedItems: MediaItem[] = [];
  let cachedFilenames: Set<string> = new Set();
  
  try {
    if (await exists(cachePath)) {
      const cacheData = await Deno.readTextFile(cachePath);
      const cachedData = JSON.parse(cacheData);
      cachedItems = cachedData as MediaItem[];
      cachedFilenames = new Set(cachedItems.map(item => item.filename));
    }
  } catch (error) {
    console.error(`Error loading cache: ${error}`);
    // Continue with empty cache
  }
  
  // Identify new files to process
  const newFiles = mediaFiles.filter(f => 
    !cachedFilenames.has(path.basename(f))
  );
  
  // Process new files
  const newItems: MediaItem[] = [];
  
  for (const f of newFiles) {
    const filePath = path.resolve(f);
    const fileName = path.basename(filePath);
    
    // Determine media type
    let mediaType: MediaItem["media_type"] = "unknown";
    const fileExt = path.extname(filePath).toLowerCase();
    
    if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(fileExt)) {
      mediaType = "image";
    } else if ([".mp4", ".mov", ".mkv", ".webm", ".m4v"].includes(fileExt)) {
      mediaType = "video";
    } else {
      mediaType = "other";
    }
    
    let imageData: string | null = null;
    let transcriptText = "";
    
    // Process based on media type
    if (mediaType === "image") {
      try {
        const imgData = await Deno.readFile(filePath);
        imageData = encodeBase64(imgData);
      } catch (error) {
        console.error(`Failed to read image ${fileName}: ${error}`);
      }
    } else if (mediaType === "video") {
      try {
        const frameData = await extractFrame(filePath);
        if (frameData) {
          imageData = encodeBase64(frameData);
        }
      } catch (error) {
        console.error(`Failed to extract frame from ${fileName}: ${error}`);
      }
      
      transcriptText = await loadTranscriptForVideo(filePath, transcriptDir);
    }
    
    // Prepare content for analysis
    const contentLines = [
      `Marketing Context: ${marketingContext.substring(0, 1000)}...`,
      `File: ${fileName}, Type: ${mediaType}`
    ];
    
    if (transcriptText) {
      contentLines.push(`Transcript: ${transcriptText}`);
    }
    
    if (imageData) {
      contentLines.push(`Image: data:image/jpeg;base64,${imageData}`);
    } else {
      contentLines.push("No image available.");
    }
    
    const userMessage = contentLines.join("\n");
    
    const systemPrompt = 
      "You are analyzing a media file in the context of a marketing project. " +
      "You will return a JSON describing filename, media_type, description, and relevance. " +
      "No extra text, only valid JSON.";
    
    const messages = [{ role: "user", content: userMessage }];
    
    let item = await generateStructuredOutput<MediaItem>(
      systemPrompt,
      {},  // Schema placeholder
      messages
    );
    
    if (item === null) {
      console.log(`OpenAI API failed to analyze ${fileName}, using fallback.`);
      item = {
        filename: fileName,
        media_type: mediaType,
        description: "No description found",
        relevance: "unknown"
      };
    }
    
    newItems.push(item);
  }
  
  // Combine cached and new items
  const allItems = [...cachedItems, ...newItems];
  
  // Save updated cache
  try {
    await Deno.writeTextFile(
      cachePath, 
      JSON.stringify(allItems, null, 2)
    );
  } catch (error) {
    console.error(`Error saving cache: ${error}`);
  }
  
  return allItems;
}