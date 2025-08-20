import fs from "fs/promises";
import matter from "gray-matter";
import path from "path";
import { setTimeout } from "timers/promises";

const DEVTO_API_KEY = process.env["DEVTO_API_KEY"] as string;
if (!DEVTO_API_KEY) {
  throw new Error("DEVTO_API_KEY is not set");
}

// コマンドライン引数を処理
const args = process.argv.slice(2);
const dryRun = !args.includes("--publish");
const files = args.filter((a) => a.endsWith(".md")).sort();

interface ArticleResponse {
  id: number;
}

async function postArticle(title: string, body: string): Promise<number> {
  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": DEVTO_API_KEY,
    },
    body: JSON.stringify({
      article: {
        title,
        body_markdown: body,
        published: true,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to post article: ${res.status} ${res.statusText}`);
  }

  const data: ArticleResponse = await res.json();
  return data.id;
}

async function processFile(filename: string) {
  const raw = await fs.readFile(filename, "utf-8");
  const parsed = matter(raw);

  if (parsed.data["id"]) {
    console.log(`⏩ Skip (already has id): ${filename}`);
    return;
  }

  const title = parsed.data["title"];
  if (!title) {
    throw new Error(
      `ファイル ${filename} の front matter に title がありません`
    );
  }

  if (dryRun) {
    console.log(`📝 Dry-run: would post "${title}" from ${filename}`);
    return;
  }

  console.log(`🚀 Posting article: ${title}`);
  const newId = await postArticle(title, parsed.content.trim());
  console.log(`✅ Posted with id: ${newId}`);

  // Front matter に id を追加
  parsed.data["id"] = newId;
  const newContent = matter.stringify(parsed.content.trim(), parsed.data);

  // 新しいファイル名を作成
  const dirname = path.dirname(filename);
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  const newFilename = path.join(dirname, `${basename}_${newId}${ext}`);

  // 上書きではなくリネーム保存
  await fs.writeFile(newFilename, newContent, "utf-8");
  await fs.unlink(filename);

  console.log(`💾 Saved as ${newFilename}`);

  await setTimeout(5000);
}

async function main() {
  for (const file of files) {
    await processFile(file);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
