"use server";

import Question from "@/database/question.model";
import { connectToDatabase } from "../mongoose";
import { SearchParams } from "./shared.types";
import User from "@/database/user.model";
import Answer from "@/database/answer.model";
import Tag from "@/database/tag.model";

const SearchableTypes = ["question", "answer", "user", "tag"];

export async function globalSearch(params: SearchParams) {
  try {
    await connectToDatabase();

    const { query, type } = params;
    // запрос пользователя из Инпута поиска
    const regexQuery = { $regex: query, $options: "i" };

    let results = [];

    const modelsAndTypes = [
      { model: Question, searchField: "title", type: "question" },
      { model: User, searchField: "name", type: "user" },
      { model: Answer, searchField: "content", type: "answer" },
      { model: Tag, searchField: "name", type: "tag" },
    ];

    const typeLower = type?.toLowerCase();

    if (!typeLower || !SearchableTypes.includes(typeLower)) {
      // Если не выбран ТЕГ -- SEARCH ACROSS EVERYTHING

      /* с forEach, map... не сработает с async!   
      
      modelsAndTypes.forEach(async (item) => {
        const queryResults = await model.find()
      }) 
      
      Всегда используй for ... of! с ним await работает как нужно!
      
      или Promise.all(), но это будет чуть сложнее
      */

      for (const { model, searchField, type } of modelsAndTypes) {
        // queryResults!
        const queryResults = await model
          .find({ [searchField]: regexQuery })
          .limit(2);

        results.push(
          ...queryResults.map((item) => ({
            title:
              type === "answer"
                ? `Answers containing ${query}`
                : item[searchField],
            type,
            id:
              type === "user"
                ? item.clerkid
                : type === "answer"
                ? item.question
                : item._id,
          }))
        );
      }
    } else {
      // SEARCH IN THE SPECIFIED MODEL TYPE
      const modelInfo = modelsAndTypes.find((item) => item.type === type);

      console.log({ modelInfo, type });
      if (!modelInfo) {
        throw new Error("Invalid search type");
      }

      // modelInfo - Конкретно что ищёт пользователь
      const queryResults = await modelInfo.model
        // динамическая подстановка запроса к Базе modelInfo.title | name ...
        .find({ [modelInfo.searchField]: regexQuery })
        .limit(8);

      // преобразования каждого элемента queryResults в новый Объект в массиве results.
      // добавляем фильтры к уже ввёденому queryResults
      results = queryResults.map((item) => ({
        title:
          type === "answer"
            ? `Answers containing ${query}`
            : item[modelInfo.searchField],
        type,
        id:
          type === "user"
            ? item.clerkId
            : type === "answer"
            ? item.question
            : item._id,
      }));
    }

    return JSON.stringify(results);
  } catch (error) {
    console.log(`Error fetching global results, ${error}`);
    throw error;
  }
}
