import type { HelpArticle } from "@/help/types";

function haystack(article: HelpArticle): string {
  const parts = [article.title, article.summary, article.slug, article.category];
  for (const block of article.blocks) {
    if (block.type === "p" || block.type === "h2" || block.type === "h3") parts.push(block.text);
    if (block.type === "ul" || block.type === "ol") parts.push(...block.items);
    if (block.type === "code") parts.push(block.code);
    if (block.type === "callout") parts.push(block.title ?? "", block.text);
    if (block.type === "steps") parts.push(...block.items.flatMap((item) => [item.title, item.text]));
    if (block.type === "table") parts.push(...block.headers, ...block.rows.flat());
  }
  return parts.join(" ").toLowerCase();
}

export function searchArticles(articles: HelpArticle[], query: string): HelpArticle[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return articles;
  const tokens = needle.split(/\s+/).filter(Boolean);
  return articles.filter((article) => {
    const text = haystack(article);
    return tokens.every((token) => text.includes(token));
  });
}

export function articleBySlug(articles: HelpArticle[], slug: string): HelpArticle | null {
  return articles.find((article) => article.slug === slug) ?? null;
}

export function headingsOf(article: HelpArticle): Array<{ id: string; text: string }> {
  return article.blocks
    .filter((block): block is Extract<HelpArticle["blocks"][number], { type: "h2" | "h3" }> => block.type === "h2" || block.type === "h3")
    .map((block, index) => ({ id: block.id ?? `${article.slug}-${index}`, text: block.text }));
}
