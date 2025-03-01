import {
    walk,
    exists
} from "jsr:@std/fs";

import {
    join
} from "jsr:@std/path";

/**
 * Gather all media files from the given directory, including images and videos.
 * @param mediaDir - Path to the directory containing media files
 * @returns Array of file paths as strings
 */
export async function gatherMediaFiles(mediaDir: string): Promise<string[]> {
  // Define the extensions to include
  const allowedExtensions = ['mp4', 'mov', 'jpg', 'jpeg', 'png'];
  
  // Check if the directory exists
  if (!(await exists(mediaDir))) {
    return [];
  }
  
  const mediaFiles: string[] = [];
  
  // Use Deno's walk function to recursively iterate through directory
  for await (const entry of walk(mediaDir)) {
    if (entry.isFile) {
      // Get file extension and convert to lowercase
      const fileExt = entry.path.split('.').pop()?.toLowerCase() || '';
      
      // Check if extension is in allowed list
      if (allowedExtensions.includes(fileExt)) {
        mediaFiles.push(entry.path);
      }
    }
  }
  
  return mediaFiles;
}