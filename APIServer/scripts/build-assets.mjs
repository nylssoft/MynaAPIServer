import { promises as fs } from "node:fs";
import path from "node:path";
import { minify } from "terser";
import CleanCSS from "clean-css";

const jsBundles = {
  backgammon: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/backgammon/backgammon.js"],
  chess: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/chess/chess.js"],
  contacts: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/contacts/contacts.js"],
  diary: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/diary/diary.js"],
  documents: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/documents/documents.js"],
  makeadate: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/makeadate/makeadate.js"],
  markdown: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/markdown/markdown.js"],
  notes: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/notes/notes.js"],
  password: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/password/password.js"],
  pwdman: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/pwdman/pwdman.js"],
  usermgmt: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/pwdman/usermgmt.js"],
  skat: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/skat/skatengine.js", "wwwroot/js/skat/skat.js"],
  slideshow: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/slideshow/slideshow.js"],
  tetris: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/tetris/tetris.js"],
  arkanoid: ["wwwroot/js/common/controls.js", "wwwroot/js/common/utils.js", "wwwroot/js/arkanoid/arkanoid.js"]
};

const cssTargets = {
  "wwwroot/css/backgammon/backgammon.min.css": "wwwroot/css/backgammon/backgammon.css",
  "wwwroot/css/chess/chess.min.css": "wwwroot/css/chess/chess.css",
  "wwwroot/css/contacts/contacts.min.css": "wwwroot/css/contacts/contacts.css",
  "wwwroot/css/diary/diary.min.css": "wwwroot/css/diary/diary.css",
  "wwwroot/css/documents/documents.min.css": "wwwroot/css/documents/documents.css",
  "wwwroot/css/makeadate/makeadate.min.css": "wwwroot/css/makeadate/makeadate.css",
  "wwwroot/css/markdown/markdown.min.css": "wwwroot/css/markdown/markdown.css",
  "wwwroot/css/notes/notes.min.css": "wwwroot/css/notes/notes.css",
  "wwwroot/css/password/password.min.css": "wwwroot/css/password/password.css",
  "wwwroot/css/pwdman/pwdman.min.css": "wwwroot/css/pwdman/pwdman.css",
  "wwwroot/css/skat/skat.min.css": "wwwroot/css/skat/skat.css",
  "wwwroot/css/slideshow/slideshow.min.css": "wwwroot/css/slideshow/slideshow.css",
  "wwwroot/css/tetris/tetris.min.css": "wwwroot/css/tetris/tetris.css",
  "wwwroot/css/arkanoid/arkanoid.min.css": "wwwroot/css/arkanoid/arkanoid.css"
};

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function clean() {
  await fs.rm("temp", { recursive: true, force: true });
  await fs.mkdir("temp", { recursive: true });

  for (const name of Object.keys(jsBundles)) {
    const minPath = `wwwroot/js/${name}/${name}.min.js`;
    if (await fileExists(minPath)) {
      await fs.rm(minPath, { force: true });
    }
  }

  for (const target of Object.keys(cssTargets)) {
    if (await fileExists(target)) {
      await fs.rm(target, { force: true });
    }
  }
}

async function buildJs() {
  for (const [name, sources] of Object.entries(jsBundles)) {
    const tempPath = `temp/${name}.js`;
    const outPath = `wwwroot/js/${name}/${name}.min.js`;

    const chunks = [];
    for (const source of sources) {
      chunks.push(await fs.readFile(source, "utf8"));
    }

    const combined = `${chunks.join("\n\n")}\n`;
    await ensureDir(tempPath);
    await fs.writeFile(tempPath, combined, "utf8");

    const result = await minify(combined, {
      compress: true,
      mangle: true,
      ecma: 2018
    });

    if (!result.code) {
      throw new Error(`Failed to minify JS bundle '${name}'.`);
    }

    await ensureDir(outPath);
    await fs.writeFile(outPath, result.code, "utf8");
  }
}

async function buildCss() {
  const minifier = new CleanCSS({ level: 2 });

  for (const [target, source] of Object.entries(cssTargets)) {
    const css = await fs.readFile(source, "utf8");
    const minified = minifier.minify(css);

    if (minified.errors.length > 0) {
      throw new Error(`Failed to minify CSS '${source}': ${minified.errors.join("; ")}`);
    }

    await ensureDir(target);
    await fs.writeFile(target, minified.styles, "utf8");
  }
}

async function main() {
  await clean();
  await buildJs();
  await buildCss();
  console.log("Asset build completed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
