/**
 * 索引构建模块
 * 负责构建向量索引、保存索引、加载索引、计算相似度等
 *
 * 使用 OpenAI 的 text-embedding-3-small 模型生成向量
 * 使用 cosine similarity 计算相似度
 */

import { VectorEntry } from "../types";
import aiClient from "./ai_client";
import { Document } from "../types";
import fs from "fs";
import { log } from "../logger";

class IndexConstruction {
  private index: VectorEntry[] = [];

  constructor() {
    this.index = [];
  }

  async getEmbedding(text: string): Promise<number[]> {
    const response = await aiClient.client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  }

  async buildVectorIndex(chunks: Document[]): Promise<void> {
    const elapsed = log.timer();
    log.step("Index", "buildVectorIndex 开始", {
      待处理chunk数: chunks.length,
    });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.getEmbedding(chunk.pageContent);
      this.index.push({
        vector: embedding,
        document: chunk,
      });

      if ((i + 1) % 50 === 0) {
        log.step("Index", `进度 ${i + 1}/${chunks.length}`, {
          耗时: `${elapsed()}ms`,
        });
      }
    }

    log.step("Index", `buildVectorIndex 完成 (${elapsed()}ms)`, {
      索引条数: this.index.length,
      向量维度: this.index[0]?.vector.length,
    });
  }

  async similaritySearch(query: string, k: number): Promise<Document[]> {
    const elapsed = log.timer();
    const queryVector = await this.getEmbedding(query);

    const scored = this.index.map((entry) => ({
      document: entry.document,
      score: this.cosineSimilarity(queryVector, entry.vector),
    }));

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, k);

    log.step("Index", `similaritySearch 完成 (${elapsed()}ms)`, {
      查询: query,
      候选总数: this.index.length,
      "返回Top-K": k,
      结果: results.map((r) => ({
        菜名: r.document.metadata.dishName,
        分数: r.score.toFixed(4),
        内容预览: r.document.pageContent.slice(0, 50),
      })),
    });

    return results.map((entry) => entry.document);
  }

  saveIndex(filePath: string): void {
    fs.writeFileSync(filePath, JSON.stringify(this.index));
    log.step("Index", "saveIndex 完成", {
      路径: filePath,
      索引条数: this.index.length,
    });
  }

  loadIndex(filePath: string): boolean {
    if (!fs.existsSync(filePath)) {
      log.step("Index", "loadIndex 未找到索引文件", { 路径: filePath });
      return false;
    }
    const elapsed = log.timer();
    this.index = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    log.step("Index", `loadIndex 完成 (${elapsed()}ms)`, {
      路径: filePath,
      索引条数: this.index.length,
    });
    return true;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export default IndexConstruction;
