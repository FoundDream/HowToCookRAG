import DataPreparation from "./modules/data_preparation";
import IndexConstruction from "./modules/index_construction";
import Retrieval from "./modules/retrieval";
import Generation from "./modules/generation";
import readline from "readline";

async function main() {
  // 1. 数据准备
  const dp = new DataPreparation("../../data/C8/cook");
  const docs = dp.loadDocuments();
  const chunks = dp.chunkDocuments();
  console.log(`加载 ${docs.length} 个文档，分成 ${chunks.length} 个 chunk`);

  // 2. 索引构建（优先加载已有索引）
  const idx = new IndexConstruction();
  const loaded = idx.loadIndex("./vector_index.json");
  if (!loaded) {
    await idx.buildVectorIndex(chunks);
    idx.saveIndex("./vector_index.json");
  }

  // 3. 检索模块
  const retrieval = new Retrieval(idx, chunks);

  // 4. 生成模块
  const gen = new Generation();

  // 5. 交互式问答
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n菜谱 RAG 系统已启动（输入"退出"结束）\n');

  const ask = () => {
    rl.question("你的问题: ", async (query) => {
      if (query.trim() === "退出" || query.trim() === "exit") {
        rl.close();
        return;
      }

      try {
        // 检索子块
        const relevant = await retrieval.hybridSearch(query, 3);
        console.log(`检索到 ${relevant.length} 个相关片段`);

        // 回溯父文档
        const parentDocs = dp.getParentDocuments(relevant);
        console.log(`对应 ${parentDocs.length} 个完整文档`);

        // 生成回答
        const answer = await gen.answer(query, parentDocs);
        console.log(`\n${answer}\n`);
      } catch (err) {
        console.error("出错:", err);
      }

      ask();
    });
  };

  ask();
}

main();
