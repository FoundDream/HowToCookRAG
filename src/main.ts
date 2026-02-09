import DataPreparation from "./modules/data_preparation";
import IndexConstruction from "./modules/index_construction";
import Retrieval from "./modules/retrieval";
import Generation from "./modules/generation";
import readline from "readline";
import { log } from "./logger";

async function main() {
  const totalElapsed = log.timer();
  log.step("Main", "========== RAG 系统启动 ==========");

  // 1. 数据准备
  const dp = new DataPreparation("../../data/C8/cook");
  const docs = dp.loadDocuments();
  const chunks = dp.chunkDocuments();

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

  log.step("Main", `初始化完成 (${totalElapsed()}ms)`, {
    文档数: docs.length,
    chunk数: chunks.length,
    索引来源: loaded ? "从文件加载" : "新构建",
  });

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

      const queryElapsed = log.timer();
      log.step("Main", `>>> 新查询: "${query}"`);

      try {
        // 检索子块
        const relevant = await retrieval.hybridSearch(query, 3);

        // 回溯父文档
        const parentDocs = dp.getParentDocuments(relevant);
        log.step("Main", "父文档回溯完成", {
          子chunk数: relevant.length,
          父文档数: parentDocs.length,
          父文档菜名: parentDocs.map((d) => d.metadata.dishName),
        });

        // 生成回答
        const answer = await gen.answer(query, parentDocs);

        log.step("Main", `<<< 查询完成 (${queryElapsed()}ms)`);
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
