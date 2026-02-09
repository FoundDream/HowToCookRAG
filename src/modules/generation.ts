import { Document } from "../types";
import aiClient from "./ai_client";
import { log } from "../logger";

class Generation {
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(model = "gpt-4o-mini", temperature = 0.1, maxTokens = 2048) {
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
  }

  /** 把文档列表拼成上下文字符串 */
  buildContext(docs: Document[], maxLength = 4000): string {
    if (docs.length === 0) return "暂无相关食谱信息。";

    const parts: string[] = [];
    let currentLength = 0;

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const header =
        `【食谱 ${i + 1}】` +
        `${doc.metadata.dishName || ""}` +
        ` | 分类: ${doc.metadata.category || "未知"}` +
        ` | 难度: ${doc.metadata.difficulty || "未知"}`;

      const text = `${header}\n${doc.pageContent}\n`;

      if (currentLength + text.length > maxLength) break;
      parts.push(text);
      currentLength += text.length;
    }

    return parts.join("\n" + "=".repeat(50) + "\n");
  }

  /** 调用 LLM */
  private async chat(prompt: string): Promise<string> {
    const response = await aiClient.client.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    return response.choices[0].message.content || "";
  }

  /** 查询路由：判断问题类型 */
  async queryRouter(query: string): Promise<"list" | "detail" | "general"> {
    const prompt = `根据用户的问题，将其分类为以下三种类型之一：

1. 'list' - 用户想要获取菜品列表或推荐
   例如：推荐几个素菜、有什么川菜、给我3个简单的菜

2. 'detail' - 用户想要具体的制作方法或详细信息
   例如：宫保鸡丁怎么做、制作步骤、需要什么食材

3. 'general' - 其他一般性问题
   例如：什么是川菜、制作技巧、营养价值

请只返回一个词：list、detail 或 general

用户问题: ${query}`;

    const result = (await this.chat(prompt)).trim().toLowerCase();
    if (result === "list" || result === "detail" || result === "general") {
      return result;
    }
    return "general";
  }

  /** 查询重写：优化模糊查询 */
  async queryRewrite(query: string): Promise<string> {
    const prompt = `你是一个查询优化助手。分析用户的查询，如果查询已经足够明确（包含具体菜名或明确意图），直接返回原查询。如果查询模糊，重写为更适合食谱搜索的查询。

原始查询: ${query}

只输出最终查询，不要解释：`;

    return (await this.chat(prompt)).trim();
  }

  /** 基础回答 */
  async generateBasicAnswer(query: string, docs: Document[]): Promise<string> {
    const context = this.buildContext(docs);
    const prompt = `你是一位专业的烹饪助手。请根据以下食谱信息回答用户的问题。

用户问题: ${query}

相关食谱信息:
${context}

请提供详细、实用的回答。如果信息不足，请诚实说明。`;

    return this.chat(prompt);
  }

  /** 分步骤详细回答 */
  async generateStepByStepAnswer(
    query: string,
    docs: Document[],
  ): Promise<string> {
    const context = this.buildContext(docs);
    const prompt = `你是一位专业的烹饪导师。请根据食谱信息，为用户提供详细的分步骤指导。

用户问题: ${query}

相关食谱信息:
${context}

请按以下结构组织回答：
## 菜品介绍
## 所需食材
## 制作步骤
## 制作技巧（如有）

重点突出实用性和可操作性。`;

    return this.chat(prompt);
  }

  /** 列表式回答：不调 LLM，直接从 metadata 取菜名 */
  generateListAnswer(docs: Document[]): string {
    if (docs.length === 0) return "抱歉，没有找到相关的菜品信息。";

    const names: string[] = [];
    for (const doc of docs) {
      const name = doc.metadata.dishName || "未知菜品";
      if (!names.includes(name)) names.push(name);
    }

    return (
      "为您推荐以下菜品：\n" + names.map((n, i) => `${i + 1}. ${n}`).join("\n")
    );
  }

  /** 完整的问答流程：路由 → 重写 → 生成 */
  async answer(query: string, docs: Document[]): Promise<string> {
    const elapsed = log.timer();
    log.step("Generation", "answer 流程开始", {
      原始查询: query,
      输入文档数: docs.length,
      文档菜名: docs.map((d) => d.metadata.dishName),
    });

    // 1. 路由
    const routeType = await this.queryRouter(query);
    log.step("Generation", "queryRouter 完成", {
      查询类型: routeType,
    });

    // 2. 列表查询直接返回
    if (routeType === "list") {
      const result = this.generateListAnswer(docs);
      log.step("Generation", `answer 完成 [list] (${elapsed()}ms)`, {
        输出: result,
      });
      return result;
    }

    // 3. 其他查询先重写
    const rewritten = await this.queryRewrite(query);
    log.step("Generation", "queryRewrite 完成", {
      原始查询: query,
      重写后: rewritten,
      是否改写: rewritten !== query,
    });

    // 4. 根据类型生成回答
    let result: string;
    if (routeType === "detail") {
      result = await this.generateStepByStepAnswer(rewritten, docs);
    } else {
      result = await this.generateBasicAnswer(rewritten, docs);
    }

    log.step("Generation", `answer 完成 [${routeType}] (${elapsed()}ms)`, {
      输出长度: result.length,
      输出预览: result.slice(0, 150),
    });

    return result;
  }
}

export default Generation;
