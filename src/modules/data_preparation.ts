/**
 * 数据准备模块
 * 负责加载文档、分割文档、增强元数据、生成 chunks 等
 */

import { CATEGORY_MAPPING, Document } from "../types";
import { globSync, readFileSync } from "node:fs";
import crypto from "crypto";
import path from "node:path";

class DataPreparation {
  private dataPath: string;
  documents: Document[];
  chunks: Document[];
  parentChildMap: Map<string, string>;

  constructor(dataPath: string) {
    this.dataPath = dataPath;
    this.documents = [];
    this.chunks = [];
    this.parentChildMap = new Map();
  }

  loadDocuments(): Document[] {
    const files = globSync(`${this.dataPath}/**/*.md`);

    for (const filePath of files) {
      const content = readFileSync(filePath, "utf8");
      const parentId = crypto.createHash("md5").update(filePath).digest("hex");
      const document = {
        metadata: {
          source: filePath,
          parentId,
          docType: "parent",
          category: "",
          dishName: "",
          difficulty: "",
        },
        pageContent: content,
      };
      this.enhanceMetadata(document);
      this.documents.push(document);
    }
    console.log(this.markdownHeaderSplit(this.documents[0].pageContent));
    return this.documents;
  }

  chunkDocuments(): Document[] {
    const allChunks: Document[] = [];

    for (const document of this.documents) {
      const chunks = this.markdownHeaderSplit(document.pageContent);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkId = crypto.randomUUID();
        allChunks.push({
          metadata: {
            ...document.metadata,
            chunkId,
            parentId: document.metadata.parentId,
            docType: "child",
            chunkIndex: i,
            chunkSize: chunks.length,
          },
          pageContent: chunk,
        });
        this.parentChildMap.set(chunkId, document.metadata.parentId);
      }
    }
    this.chunks = allChunks;
    console.log(
      `${this.documents.length} documents, ${this.chunks.length} chunks`,
    );
    return allChunks;
  }

  markdownHeaderSplit(content: string): string[] {
    const lines = content.split("\n");
    const chunks: string[] = [];
    let currentChunk: string[] = [];

    for (const line of lines) {
      if (line.match(/^#{1,3}\s/)) {
        if (currentChunk.length > 0)
          chunks.push(currentChunk.join("\n").trim());
        currentChunk = [line];
      } else {
        currentChunk.push(line);
      }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk.join("\n").trim());
    return chunks.filter((chunk) => chunk.length > 0);
  }

  getParentDocuments(childChunks: Document[]): Document[] {
    return [];
  }

  // 私有方法
  private enhanceMetadata(doc: Document): void {
    const filePath = doc.metadata.source;

    // 提取分类：检查路径中是否包含分类目录名
    for (const [key, value] of Object.entries(CATEGORY_MAPPING)) {
      if (filePath.includes(`/${key}/`) || filePath.includes(`\\${key}\\`)) {
        doc.metadata.category = value;
        break;
      }
    }

    // 提取菜名：文件名去掉 .md
    doc.metadata.dishName = path.basename(filePath, ".md");
    const content = doc.pageContent;
    if (content.includes("★★★★★")) doc.metadata.difficulty = "非常困难";
    else if (content.includes("★★★★")) doc.metadata.difficulty = "困难";
    else if (content.includes("★★★")) doc.metadata.difficulty = "中等";
    else if (content.includes("★★")) doc.metadata.difficulty = "简单";
    else if (content.includes("★")) doc.metadata.difficulty = "非常简单";

    return;
  }
}

export default DataPreparation;
