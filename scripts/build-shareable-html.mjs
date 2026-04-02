import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const templatePath = path.join(rootDir, "index.html");
const cssPath = path.join(rootDir, "styles.css");
const appPath = path.join(rootDir, "app.js");
const dataPath = path.join(rootDir, "data", "collectibles.js");
const outputPath = path.join(rootDir, "Fallout76-CAMP-Collectibles-Shareable.html");
const optimizedImageDir = path.join(rootDir, ".tmp-share-images");
const execAsync = promisify(exec);

const inlineProfile = {
  maxDimension: Number(process.env.F76_SHARE_MAX_DIM || 200),
  quality: Number(process.env.F76_SHARE_QUALITY || 52),
  effort: Number(process.env.F76_SHARE_EFFORT || 4)
};

async function main() {
  try {
    const [templateHtml, css, appJs, rawDatasetScript] = await Promise.all([
      readFile(templatePath, "utf8"),
      readFile(cssPath, "utf8"),
      readFile(appPath, "utf8"),
      readFile(dataPath, "utf8")
    ]);

    const dataset = loadDataset(rawDatasetScript);
    const optimizedImageMap = await buildOptimizedImageMap(dataset.items.map((item) => item.image));
    const imageMap = await buildInlineImageMap(dataset.items.map((item) => item.image), optimizedImageMap);

    const hydratedDataset = {
      ...dataset,
      generatedAt: new Date().toISOString(),
      standaloneBuild: {
        file: path.basename(outputPath),
        imageFormat: optimizedImageMap ? "webp" : "original",
        imageMaxDimension: optimizedImageMap ? inlineProfile.maxDimension : null,
        imageQuality: optimizedImageMap ? inlineProfile.quality : null
      },
      items: dataset.items.map((item) => ({
        ...item,
        image: imageMap.get(item.image) || item.image
      }))
    };

    const datasetScript = `window.F76_COLLECTIBLES = ${JSON.stringify(hydratedDataset)};`;
    const standaloneHtml = buildStandaloneHtml(templateHtml, css, datasetScript, appJs);

    await writeFile(outputPath, standaloneHtml, "utf8");

    const byteSize = Buffer.byteLength(standaloneHtml, "utf8");
    console.log(`Generated shareable file: ${path.basename(outputPath)}`);
    console.log(`Items embedded: ${hydratedDataset.items.length}`);
    console.log(`Images embedded: ${imageMap.size}`);
    console.log(`Approximate file size: ${formatBytes(byteSize)} (${byteSize} bytes)`);
    if (!optimizedImageMap) {
      console.log("Image optimization: unavailable. Install npm access for sharp-cli to produce a smaller standalone file.");
    } else if (byteSize > 10 * 1024 * 1024) {
      console.log("Warning: file is over 10 MB. Lower F76_SHARE_MAX_DIM or F76_SHARE_QUALITY for easier sharing.");
    }
  } finally {
    await rm(optimizedImageDir, { recursive: true, force: true });
  }
}

function loadDataset(rawScript) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(rawScript, sandbox, { filename: "collectibles.js" });
  return sandbox.window.F76_COLLECTIBLES;
}

async function buildOptimizedImageMap(imagePaths) {
  const uniquePaths = [...new Set(imagePaths.filter(Boolean))];
  if (!uniquePaths.length) {
    return new Map();
  }

  try {
    await rm(optimizedImageDir, { recursive: true, force: true });
    await mkdir(optimizedImageDir, { recursive: true });

    await runCommand(
      [
        "npm exec --yes --package=sharp-cli -- sharp",
        '-i "assets/images/**/*.*"',
        '-o ".tmp-share-images/{name}.webp"',
        `-q ${inlineProfile.quality}`,
        `--alphaQuality ${inlineProfile.quality}`,
        `--effort ${inlineProfile.effort}`,
        `resize ${inlineProfile.maxDimension} ${inlineProfile.maxDimension}`,
        "-f webp"
      ].join(" ")
    );

    const optimized = new Map();
    for (const relativeImagePath of uniquePaths) {
      const optimizedPath = path.join(optimizedImageDir, `${path.parse(relativeImagePath).name}.webp`);
      try {
        await access(optimizedPath);
        optimized.set(relativeImagePath, optimizedPath);
      } catch (error) {
        // Fall back to the original asset if this image did not convert.
      }
    }

    return optimized;
  } catch (error) {
    return null;
  }
}

async function buildInlineImageMap(imagePaths, optimizedImageMap) {
  const uniquePaths = [...new Set(imagePaths.filter(Boolean))];
  const map = new Map();

  for (let index = 0; index < uniquePaths.length; index += 1) {
    const relativeImagePath = uniquePaths[index];
    const optimizedPath = optimizedImageMap?.get(relativeImagePath);
    const absoluteImagePath = optimizedPath || path.join(rootDir, relativeImagePath);
    const payload = await readFile(absoluteImagePath);
    const mimeType = optimizedPath ? "image/webp" : mimeTypeFromPath(relativeImagePath);

    map.set(relativeImagePath, `data:${mimeType};base64,${payload.toString("base64")}`);

    if ((index + 1) % 25 === 0 || index + 1 === uniquePaths.length) {
      console.log(`Embedded ${index + 1}/${uniquePaths.length} images`);
    }
  }

  return map;
}

function buildStandaloneHtml(templateHtml, css, datasetScript, appJs) {
  return templateHtml
    .replace(
      /<link rel="stylesheet" href="styles\.css">\s*/i,
      `<style>\n${css}\n</style>\n`
    )
    .replace(
      /\s*<script src="data\/collectibles\.js"><\/script>\s*<script src="app\.js"><\/script>\s*/i,
      `\n    <script>\n${escapeInlineScript(datasetScript)}\n    </script>\n    <script>\n${escapeInlineScript(appJs)}\n    </script>\n`
    );
}

function escapeInlineScript(value) {
  return value.replace(/<\/script/gi, "<\\/script");
}

function mimeTypeFromPath(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".png":
    default:
      return "image/png";
  }
}

function formatBytes(value) {
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function runCommand(command) {
  const { stdout, stderr } = await execAsync(command, {
    cwd: rootDir,
    windowsHide: true
  });
  return stdout || stderr;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
