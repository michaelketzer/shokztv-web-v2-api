import { MessageBuilder, Webhook } from "webhook-discord";
import { OkPacket, RowDataPacket } from "mysql2";
import { Tag, requireTags } from "./tag";
import { removeFile, saveFormFile } from "./File";

import { UploadedFile } from "express-fileupload";
import config from "../config";
import { getConn } from "../db";
import { triggerDeploy } from "./zeit-co";

enum Status {
  draft = "draft",
  published = "published",
  hidden = "hidden",
}

interface Article {
  id: number;
  slug: string;
  title: string;
  body: string;
  tags: Array<{
    id: number;
    name: string;
    image?: string;
  }>;
  cover: string;
  coverWEBP: string;
  coverJP2: string;
  status: Status;
  author: {
    id?: number;
    twitch?: number;
    avatar?: string;
    name: string;
    title?: string;
  };
  created: number;
}

interface ArticleRow extends RowDataPacket {
  articleId: number;
  title: string;
  body: string;
  cover: string;
  status: Status;
  created: number;
  userId: number;
  twitch_id: number;
  display_name: string;
  avatar: string;
  custom_title: string;
}

interface TagResponse extends Tag {
  article: number;
}

function mapRows(rows: ArticleRow[], tags: TagResponse[]): Article[] {
  return rows.map((a) => ({
    id: a.articleId,
    title: a.title,
    body: a.body,
    cover: a.cover,
    coverWEBP: a.coverWEBP,
    coverJP2: a.coverJP2,
    status: a.status,
    created: a.created,
    slug: a.slug,
    author: {
      id: a.userId,
      twitch: a.twitch_id,
      name: a.display_name,
      avatar: a.avatar,
      avatarWEBP: a.avatarWEBP,
      avatarJP2: a.avatarJP2,
      title: a.custom_title,
      profileUrl: a.profile_url,
    },
    tags: tags
      .filter(({ article }) => article === a.articleId)
      .map(({ id, name, image, imageWEBP, imageJP2, slug }) => ({
        id,
        name,
        image,
        imageWEBP,
        imageJP2,
        slug,
      })),
  }));
}

export async function getArticles(
  articleIds: number[] = []
): Promise<Article[]> {
  const conn = await getConn();
  let conditionArticle = "",
    conditionTags = "";
  let params: number[] = [];

  if (articleIds.length) {
    conditionArticle = `WHERE a.id IN (${Array(articleIds.length).fill("?")})`;
    conditionTags = `WHERE at.article_id IN (${Array(articleIds.length).fill(
      "?"
    )})`;
    params = articleIds;
  }

  const [articles] = await conn.execute<ArticleRow[]>(
    `SELECT a.id as articleId, a.title, a.body, a.cover as cover, a.cover_webp as coverWEBP, a.cover_jpeg_2000 as coverJP2, a.status, UNIX_TIMESTAMP(a.created) as created, u.id as userId, u.twitch_id, u.display_name, u.avatar as avatar, u.avatar_webp as avatarWEBP, u.avatar_jpeg_2000 as avatarJP2, u.custom_title, u.profile_url, a.slug as slug FROM article a INNER JOIN user u ON u.id = a.author ${conditionArticle}`,
    params
  );
  const [tags] = await conn.execute<TagResponse[]>(
    `SELECT at.article_id as article, t.id, t.name, t.image as image, t.image_webp as imageWEBP, t.image_jpeg_2000 as imageJP2, t.slug as slug FROM article_tags at INNER JOIN tag t ON t.id = at.tag_id ${conditionTags}`,
    params
  );

  await conn.end();

  return mapRows(articles, tags);
}

interface IdsRowPacket extends RowDataPacket {
  slug: string;
}

export async function getFeaturedArticles(): Promise<Partial<Article>[]> {
  const conn = await getConn();
  const [articleIds] = await conn.execute<IdsRowPacket[]>(
    'SELECT slug FROM article WHERE status = "published" ORDER BY published DESC LIMIT 4;'
  );
  await conn.end();
  const articles = await getPublicArticles(articleIds.map(({ slug }) => slug));

  const sortedArticles = articles.sort(
    ({ created: a }, { created: b }) => b - a
  );

  return sortedArticles.map((article, index) => {
    if (index === 0) {
      return {
        id: article.id,
        slug: article.slug,
        created: article.created,
        title: article.title,
        body: article.body,
        cover: article.cover,
        coverWEBP: article.coverWEBP,
        coverJP2: article.coverJP2,
        author: {
          name: article.author.name,
        },
      };
    }

    return {
      id: article.id,
      slug: article.slug,
      created: article.created,
      title: article.title,
      cover: article.cover,
      coverWEBP: article.coverWEBP,
      coverJP2: article.coverJP2,
      author: {
        name: article.author.name,
      },
    };
  });
}

export async function getPublicArticleSlugs(): Promise<string[]> {
  const conn = await getConn();
  const [articleIds] = await conn.execute<IdsRowPacket[]>(
    'SELECT slug FROM article WHERE status = "published" ORDER BY published DESC;'
  );
  await conn.end();
  return articleIds.map(({ slug }) => slug);
}

export async function getSlugsAndPublishDate(): Promise<
  Array<{ slug: string; published: number }>
> {
  const conn = await getConn();
  const [articleIds] = await conn.execute<IdsRowPacket[]>(
    'SELECT slug, UNIX_TIMESTAMP(published) as published FROM article WHERE status = "published" ORDER BY published DESC;'
  );
  await conn.end();
  return articleIds.map(({ slug, published }) => ({ slug, published }));
}

export async function getPublicArticles(slugs: string[]): Promise<Article[]> {
  const conn = await getConn();
  const cond = Array(slugs.length).fill("?");

  const [articles] = await conn.execute<ArticleRow[]>(
    `SELECT a.id as articleId, a.title, a.body, a.cover as cover, a.cover_webp as coverWEBP, a.cover_jpeg_2000 as coverJP2, a.status, UNIX_TIMESTAMP(a.published) as created, u.id as userId, u.twitch_id, u.display_name, u.avatar as avatar, u.avatar_webp as avatarWEBP, u.avatar_jpeg_2000 as avatarJP2, u.custom_title, u.profile_url, a.slug as slug FROM article a INNER JOIN user u ON u.id = a.author WHERE a.status = 'published' AND a.slug IN (${cond.join(
      ","
    )})`,
    slugs
  );
  const [tags] = await conn.execute<TagResponse[]>(
    `SELECT at.article_id as article, t.id, t.name, t.image as image, t.image_webp as imageWEBP, t.image_jpeg_2000 as imageJP2, t.slug as slug FROM article_tags at INNER JOIN tag t ON t.id = at.tag_id`
  );
  await conn.end();
  return mapRows(articles, tags);
}

export async function createDraft(
  title: string,
  body: string,
  slug: string,
  tags: string[],
  userId: number,
  cover: UploadedFile | null
): Promise<number> {
  const conn = await getConn();

  let jpeg: string = "",
    webp: string = "",
    jp2: string = "";
  if (cover) {
    [webp, jp2, jpeg] = await saveFormFile("covers", title, cover);
  }

  const [{ insertId }] = await conn.execute<OkPacket>(
    `INSERT INTO article (id,title,author,created,cover,cover_webp,cover_jpeg_2000,body,status,slug) VALUES (NULL,?,?,NOW(),?,?,?,?,?,?)`,
    [title, userId, jpeg, webp, jp2, body, Status.draft, slug]
  );

  await assignTags(insertId, tags);
  await conn.end();

  return insertId;
}

interface StatusResponse extends RowDataPacket {
  status: string;
}

export async function patchArticle(
  articleId: number,
  title: string,
  body: string,
  slug: string,
  tags: string[],
  cover: UploadedFile | null = null
): Promise<void> {
  const conn = await getConn();
  await conn.execute("UPDATE article SET title=?,body=?,slug=? WHERE id=?", [
    title,
    body,
    slug,
    articleId,
  ]);
  await conn.execute("DELETE FROM article_tags WHERE article_id = ?", [
    articleId,
  ]);
  await assignTags(articleId, tags);

  if (cover) {
    const [webp, jpeg2000, orig] = await saveFormFile("covers", title, cover);
    await conn.execute(
      "UPDATE article SET cover=?, cover_webp=?, cover_jpeg_2000=? WHERE id=?",
      [orig, webp, jpeg2000, articleId]
    );
  }

  const [articleRows] = await conn.execute<StatusResponse[]>(
    "SELECT status FROM article WHERE id = ?",
    [articleId]
  );
  if (articleRows.length && articleRows[0].status === "published") {
    await triggerDeploy();
  }
  await conn.end();
}

interface ImageRow extends RowDataPacket {
  status: string;
  cover: string;
  webp: string;
  jp2: string;
}

export async function deleteArticle(articleId: number): Promise<void> {
  const conn = await getConn();
  const [articleRows] = await conn.execute<ImageRow[]>(
    "SELECT status, cover, cover_webp as webp, cover_jpeg_2000 as jp2 FROM article WHERE id = ?",
    [articleId]
  );
  if (articleRows.length > 0) {
    const article = articleRows[0];
    article.cover.length > 0 && removeFile(article.cover);
    article.webp.length > 0 && removeFile(article.webp);
    article.jp2.length > 0 && removeFile(article.jp2);

    await conn.execute("DELETE FROM article_tags WHERE article_id = ?", [
      articleId,
    ]);
    await conn.execute("DELETE FROM article WHERE id = ?", [articleId]);

    if (article.status === "published") {
      await triggerDeploy();
    }
  }
  await conn.end();
}

export async function publishArticle(articleId: number): Promise<void> {
  const conn = await getConn();
  await conn.execute(
    'UPDATE article SET status="published", published=NOW() WHERE id = ?;',
    [articleId]
  );
  const [slugRow] = await conn.execute<RowDataPacket[]>(
    "SELECT slug FROM article WHERE id = ?;",
    [articleId]
  );
  await conn.end();
  await triggerDeploy();
  if (slugRow.length > 0 && config.discordWebhook.length > 0) {
    setTimeout(() => {
      const hook = new Webhook(config.discordWebhook);
      const msg = new MessageBuilder()
        .setName("shokz.tv")
        .setText("https://dota2.shokz.tv/artikel/" + slugRow[0].slug);
      //@ts-ignore
      hook.send(msg);
    }, 300000);
  }
}

export async function unpublishArticle(articleId: number): Promise<void> {
  const conn = await getConn();
  await conn.execute('UPDATE article SET status="hidden" WHERE id = ?;', [
    articleId,
  ]);
  await conn.end();
  await triggerDeploy();
}

async function assignTags(
  articleId: number,
  tags: string[] = []
): Promise<void> {
  const tagMap = await requireTags(tags);
  const conn = await getConn();

  if (tags.length) {
    for (const tag of tags) {
      await conn.execute(
        "INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?);",
        [articleId, tagMap[tag]]
      );
    }
  }
  await conn.end();
}

export async function assignTag(articleId: number, tag: string): Promise<void> {
  const tagIds = await requireTags([tag]);
  const tagId = tagIds[tag];
  const conn = await getConn();

  await conn.execute(
    "INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?);",
    [articleId, tagId]
  );
  await conn.end();
}

export async function removeTag(
  articleId: number,
  tagId: number
): Promise<void> {
  const conn = await getConn();
  await conn.execute(
    "DELETE FROM article_tags WHERE article_id = ? AND tag_id = ?;",
    [articleId, tagId]
  );
  await conn.end();
}
