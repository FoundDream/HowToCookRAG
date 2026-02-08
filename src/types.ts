export interface Document {
  metadata: Metadata;
  pageContent: string;
}

interface Metadata {
  source: string;
  chunkId?: string;
  chunkIndex?: number;
  chunkSize?: number;
  parentId: string;
  docType: string;
  category: string;
  dishName: string;
  difficulty: string;
}

// 分类映射（目录名 → 中文）
export const CATEGORY_MAPPING: Record<string, string> = {
  meat_dish: "荤菜",
  vegetable_dish: "素菜",
  soup: "汤品",
  dessert: "甜品",
  breakfast: "早餐",
  staple: "主食",
  aquatic: "水产",
  condiment: "调料",
  drink: "饮品",
};

// vector store entry
export interface VectorEntry {
  vector: number[];
  document: Document;
}
