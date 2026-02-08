import { VectorEntry } from "../types";
import aiClient from "./ai_client";
import { Document } from "../types";
import fs from "fs";

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
    console.log(`building vector index...`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.getEmbedding(chunk.pageContent);
      this.index.push({
        vector: embedding,
        document: chunk,
      });

      // 每 50 个打印一次进度
      if ((i + 1) % 50 === 0) {
        console.log(`已处理 ${i + 1}/${chunks.length}`);
      }
    }
    console.log(`vector index built successfully, ${this.index.length} chunks`);
  }

  async similaritySearch(query: string, k: number): Promise<Document[]> {
    const queryVector = await this.getEmbedding(query);

    // 计算与所有向量的相似度
    const scored = this.index.map((entry) => ({
      document: entry.document,
      score: this.cosineSimilarity(queryVector, entry.vector),
    }));

    // 按相似度排序
    scored.sort((a, b) => b.score - a.score);

    // 返回前 k 个结果
    return scored.slice(0, k).map((entry) => entry.document);
  }

  saveIndex(filePath: string): void {
    fs.writeFileSync(filePath, JSON.stringify(this.index));
    console.log(`索引已保存到 ${filePath}`);
  }

  loadIndex(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    this.index = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    console.log(`已加载索引，共 ${this.index.length} 条`);
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
