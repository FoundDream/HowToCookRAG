import IndexConstruction from "./index_construction";
import { Document } from "../types";
import { log } from "../logger";

class Retrieval {
  private indexModule: IndexConstruction;
  private chunks: Document[];
  private bm25: BM25;

  constructor(indexModule: IndexConstruction, chunks: Document[]) {
    this.indexModule = indexModule;
    this.chunks = chunks;
    // 用所有 chunk 的文本初始化 BM25
    this.bm25 = new BM25(chunks.map((c) => c.pageContent));
  }

  bm25Search(query: string, k: number): Document[] {
    const elapsed = log.timer();
    const scores = this.bm25.search(query, k);
    const indexed = scores.map((score, i) => ({ score, i }));
    indexed.sort((a, b) => b.score - a.score);
    const results = indexed.slice(0, k);

    log.step("Retrieval", `bm25Search 完成 (${elapsed()}ms)`, {
      查询: query,
      "返回Top-K": k,
      结果: results.map((item) => ({
        菜名: this.chunks[item.i].metadata.dishName,
        BM25分数: item.score.toFixed(4),
        内容预览: this.chunks[item.i].pageContent.slice(0, 50),
      })),
    });

    return results.map((item) => this.chunks[item.i]);
  }

  private rrfRerank(
    vectorDocs: Document[],
    bm25Docs: Document[],
    k = 60,
  ): Document[] {
    const scores = new Map<string, number>();
    const docMap = new Map<string, Document>();

    // 向量检索结果计分
    vectorDocs.forEach((doc, rank) => {
      const id = doc.metadata.chunkId as string;
      docMap.set(id, doc);
      scores.set(id, (scores.get(id) || 0) + 1 / (k + rank + 1));
    });

    // BM25 结果计分
    bm25Docs.forEach((doc, rank) => {
      const id = doc.metadata.chunkId as string;
      docMap.set(id, doc);
      scores.set(id, (scores.get(id) || 0) + 1 / (k + rank + 1));
    });

    // 按总分降序
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);

    log.step("Retrieval", "RRF 重排序完成", {
      向量候选数: vectorDocs.length,
      BM25候选数: bm25Docs.length,
      融合后排序: sorted.map(([id, score]) => ({
        chunkId: id.slice(0, 8) + "...",
        菜名: docMap.get(id)!.metadata.dishName,
        RRF分数: score.toFixed(6),
      })),
    });

    return sorted.map(([id]) => docMap.get(id)!);
  }

  async hybridSearch(query: string, topK = 3): Promise<Document[]> {
    const elapsed = log.timer();
    log.step("Retrieval", `hybridSearch 开始`, { 查询: query, topK });

    const vectorDocs = await this.indexModule.similaritySearch(query, 5);
    const bm25Docs = this.bm25Search(query, 5);
    const reranked = this.rrfRerank(vectorDocs, bm25Docs);
    const results = reranked.slice(0, topK);

    log.step("Retrieval", `hybridSearch 完成 (${elapsed()}ms)`, {
      最终返回数: results.length,
      最终结果: results.map((d) => ({
        菜名: d.metadata.dishName,
        内容预览: d.pageContent.slice(0, 60),
      })),
    });

    return results;
  }

  // TODO: 元数据过滤搜索
  async metadataFilteredSearch(
    query: string,
    filters: Record<string, string>,
    topK = 3,
  ): Promise<Document[]> {
    // 多取一些候选，再过滤
    const candidates = await this.hybridSearch(query, topK * 3);
    return candidates
      .filter((doc) =>
        Object.entries(filters).every(
          ([key, value]) => doc.metadata[key] === value,
        ),
      )
      .slice(0, topK);
  }
}

// 分词
function tokenize(text: string): string[] {
  return text
    .replace(/[，。！？、；：""''（）\s\n#*\-]/g, " ")
    .split("")
    .filter((c) => c.trim().length > 0);
}

class BM25 {
  private docs: string[][]; // 每个文档的分词结果
  private avgDl: number; // 平均文档长度
  private df: Map<string, number>; // 每个词出现在几个文档中
  private k1 = 1.5;
  private b = 0.75;

  constructor(documents: string[]) {
    // 1. 对每个文档分词
    this.docs = documents.map(tokenize);

    // 2. 算平均文档长度
    this.avgDl =
      this.docs.reduce((sum, d) => sum + d.length, 0) / this.docs.length;

    // 3. 统计每个词出现在几个文档中（文档频率）
    this.df = new Map();
    for (const doc of this.docs) {
      const seen = new Set(doc);
      for (const word of seen) {
        this.df.set(word, (this.df.get(word) || 0) + 1);
      }
    }
  }

  /** 对查询打分，返回每个文档的 BM25 分数 */
  search(query: string, k: number): number[] {
    const queryTokens = tokenize(query);
    const n = this.docs.length;
    const scores = new Array(n).fill(0);

    for (const term of queryTokens) {
      const docFreq = this.df.get(term) || 0;
      // IDF：这个词越稀有，权重越高
      const idf = Math.log((n - docFreq + 0.5) / (docFreq + 0.5) + 1);

      for (let i = 0; i < n; i++) {
        // TF：这个词在当前文档出现几次
        const tf = this.docs[i].filter((t) => t === term).length;
        const dl = this.docs[i].length;

        // BM25 公式
        const score =
          (idf * (tf * (this.k1 + 1))) /
          (tf + this.k1 * (1 - this.b + (this.b * dl) / this.avgDl));
        scores[i] += score;
      }
    }

    return scores;
  }
}

export default Retrieval;
