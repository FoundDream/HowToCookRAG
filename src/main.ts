import DataPreparation from "./modules/data_preparation";
import { dataPath } from "./config";
import IndexConstruction from "./modules/index_construction";

const dp = new DataPreparation(dataPath);
const docs = dp.loadDocuments();
const chunks = dp.chunkDocuments();

const idx = new IndexConstruction();
await idx.buildVectorIndex(chunks);
idx.saveIndex("./vector_index.json");

const results = await idx.similaritySearch("红烧肉怎么做", 3);
results.forEach((doc) => {
  console.log(doc.metadata.dishName, doc.pageContent.slice(0, 80));
});
