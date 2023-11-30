"use server";

import Question from "@/database/question.model";
import Tag from "@/database/tag.model";
import { connectToDatabase } from "../mongoose";
import { CreateQuestionParams, GetQuestionsParams } from "./shared.types";
import User from "@/database/user.model";
import { revalidatePath } from "next/cache";

export async function getQuestions(params: GetQuestionsParams) {
  try {
    connectToDatabase();

    /* "populate", которая заполняет поле "tags" в каждом найденном вопросе. 
    Она связывает поле "tags" вопроса с коллекцией "Tag" 
    по определенным связям или связям модели, где "Tag" является моделью 
    для коллекции тегов.

    Потому что в Базе связи выполнены как id, а нам нужны данные 
    */
    const questions = await Question.find({})
      .populate({ path: "tags", model: Tag })
      .populate({ path: "author", model: User })
      .sort({ createdAt: -1 });

    return { questions };
  } catch (error) {
    console.log(error);
    throw error;
  }
}

//
export async function createQuestion(params: CreateQuestionParams) {
  // eslint-disable-next-line no-empty
  try {
    connectToDatabase();

    const { title, content, tags, author, path } = params;

    // Create the Question
    const question = await Question.create({
      title,
      content,
      author,
    });

    // Список Тегов
    const tagDocuments = [];

    /* тот участок кода ищет тег в базе данных по его имени. 
Если тег не найден, он создает новый документ (тег) 
с указанным именем и добавляет ID вопроса к этому тегу. 
Если тег уже существует, он просто добавляет ID вопроса к существующему тегу. */

    // Create the tags or get them if they already exist
    for (const tag of tags) {
      // 1 param - find smth, 2 - do something with it, 3 - extra param
      const existingTag = await Tag.findOneAndUpdate(
        // found the Tag
        { name: { $regex: new RegExp(`^${tag}$`, "i") } },
        // Добавляем id вопроса к определенному Тегу
        // делая обратную связь по которой можно будет выбирать все вопросы по Тегу
        { $setOnInsert: { name: tag }, $push: { question: question._id } },
        // upsert: true указывает, что если не найден существующий тег, то будет создан новый. new: true говорит, что при создании нового документа будет возвращена обновленная версия документа.
        { upsert: true, new: true }
      );

      tagDocuments.push(existingTag._id);
    }

    // Теперь в Вопрос добавляем массив Тегов образуя Связь!
    await Question.findByIdAndUpdate(question._id, {
      $push: { tags: { $each: tagDocuments } },
    });

    // Запись о том, Какой пользователь задал этот вопрос?

    // Увеличиваем репутацию пользователю, за то что он задал вопрос на +5

    // revalidatePath allows you to purge cached data on-demand for a specific path.
    // /ask-question, PATH!!!
    // it's going to give as a new data that we just Submited! (new Question)

    console.log(`${path}, PATH!!!`);
    revalidatePath(path);
  } catch (error) {}
}
