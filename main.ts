import { analyzeMediaFiles } from "./media_analyzer.ts";
import { gatherMediaFiles } from "./media_gatherer.ts";
import { suggestBroll } from "./suggestBroll.ts";

let mediaFiles = await gatherMediaFiles("./media");

// import marketing.md
const marketingContext = Deno.readTextFileSync("marketing.md");

// analyzedMedia is an array of media items
const analyzedMedia = await analyzeMediaFiles(mediaFiles, marketingContext);

const suggested = await suggestBroll(analyzedMedia, marketingContext); 

console.log(suggested);