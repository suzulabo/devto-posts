import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEVTO_API_KEY = process.env["DEVTO_API_KEY"] as string;
if (!DEVTO_API_KEY) {
  throw new Error("DEVTO_API_KEY is not set");
}

interface Article {
  id: number;
  title: string;
  body_markdown: string;
}

async function fetchAllArticles(): Promise<Article[]> {
  const all: Article[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://dev.to/api/articles/me?page=${page}&per_page=100`,
      {
        headers: { "api-key": DEVTO_API_KEY },
      }
    );

    if (!res.ok) {
      throw new Error(
        `Failed to fetch page ${page}: ${res.status} ${res.statusText}`
      );
    }

    const articles: Article[] = await res.json();
    if (articles.length === 0) break;

    all.push(...articles);
    console.log(`Fetched page ${page} (${articles.length} articles)`);

    page++;
  }

  return all;
}

async function main() {
  const articles = await fetchAllArticles();

  for (const article of articles) {
    const { id, title, body_markdown } = article;

    // 本文から "###### YYYY-MM-DD" を抽出
    console.log({ body_markdown });
    const match = body_markdown.match(/^###### (\d{4}-\d{2}-\d{2})/m);
    if (!match) {
      throw new Error(`記事 ${id} に日付が見つかりません`);
    }
    const date = match[1];

    const filename = `articles/${date}_${id}.md`;

    const content = `---
title: ${title}
id: ${id}
---

${body_markdown}
`;

    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, content, "utf-8");
    console.log(`Saved ${filename}`);
  }

  console.log(`✅ 全 ${articles.length} 件のエクスポートが完了しました`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
