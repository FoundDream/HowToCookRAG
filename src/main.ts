import DataPreparation from "./modules/data_preparation";
import { dataPath, vectorIndexPath } from "./config";
import IndexConstruction from "./modules/index_construction";
import Retrieval from "./modules/retrieval";

const dp = new DataPreparation(dataPath);
const docs = dp.loadDocuments();
const chunks = dp.chunkDocuments();

const idx = new IndexConstruction();
// await idx.buildVectorIndex(chunks);
// idx.saveIndex(vectorIndexPath);

const results = await idx.similaritySearch("红烧肉怎么做", 3);
results.forEach((doc) => {
  console.log(doc.metadata.dishName, doc.pageContent.slice(0, 80));
});

const retrieval = new Retrieval(idx, chunks);
const bm25Results = retrieval.bm25Search("红烧肉怎么做", 3);
bm25Results.forEach((doc) => {
  console.log(doc.metadata.dishName, doc.pageContent.slice(0, 80));
});
