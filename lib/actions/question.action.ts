"use server";

import Question from "@/database/question.model";
import Tag from "@/database/tag.model";
import { connectToDatabase } from "../mongoose";
import {
  CreateQuestionParams,
  GetQuestionByIdParams,
  GetQuestionsParams,
  QuestionVoteParams,
} from "./shared.types";
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

export async function getQuestionById(params: GetQuestionByIdParams) {
  try {
    connectToDatabase();

    const { questionId } = params;

    /* .populate(...) используется для заполнения (populate) полей, 
    содержащих ссылки на другие коллекции. Так как в Базе мы имеем
    ссылки для отображения правильных данных нам нужно получить
    эти значение по id

    Этот метод заполняет поле "tags" документа "Question" данными из связанной коллекции "Tag".
     
    через select выбираем только то, что нам нужно.

    В файле получим  src={result.author.picture}, 
    result.tags.map ...


    path: "author" указывает на поле "author" в документе "Question".
    
    model: User указывает на модель, связанную с полем "author".
   
    select: "_id clerkId name picture" определяет, какие поля 
    (_id, clerkId, name, picture) нужно выбрать из коллекции "User" 
    для заполнения поля "author" вопроса.
    */

    const question = await Question.findById(questionId)
      .populate({ path: "tags", model: Tag, select: "_id name" })
      .populate({
        path: "author",
        model: User,
        select: "_id clerkId name picture",
      });

    return question;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function upvoteQuestion(params: QuestionVoteParams) {
  try {
    connectToDatabase();

    const { questionId, userId, hasupVoted, hasdownVoted, path } = params;

    // Создание пустого объекта updateQuery, который будет использоваться
    // для определения обновлений в базе данных в зависимости от действий пользователя.
    let updateQuery = {};

    if (hasupVoted) {
      // Если уже проголосовал при повторном нажатии удаляям
      updateQuery = { $pull: { upvotes: userId } };
    } else if (hasdownVoted) {
      updateQuery = {
        // $pull используется для удаления элемента из массива.
        $pull: { downvotes: userId },
        // $push добавления значения в массив поля документа.
        // добавление "userId" в массив "upvotes"
        $push: { upvotes: userId },
      };
    } else {
      // $addToSet, который добавляет элемент, если его еще нет в массиве.
      // Таким образом, гарантируется уникальность голоса пользователя "за" вопрос.
      updateQuery = { $addToSet: { upvotes: userId } };
    }

    const question = await Question.findByIdAndUpdate(questionId, updateQuery, {
      new: true,
    });

    if (!question) {
      throw new Error("Question not found");
    }

    // Increment author's reputation

    revalidatePath(path);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function downvoteQuestion(params: QuestionVoteParams) {
  try {
    connectToDatabase();

    const { questionId, userId, hasupVoted, hasdownVoted, path } = params;

    let updateQuery = {};

    if (hasdownVoted) {
      updateQuery = { $pull: { downvote: userId } };
    } else if (hasupVoted) {
      updateQuery = {
        $pull: { upvotes: userId },
        $push: { downvotes: userId },
      };
    } else {
      updateQuery = { $addToSet: { downvotes: userId } };
    }

    const question = await Question.findByIdAndUpdate(questionId, updateQuery, {
      new: true,
    });

    if (!question) {
      throw new Error("Question not found");
    }

    // Increment author's reputation

    revalidatePath(path);
  } catch (error) {
    console.log(error);
    throw error;
  }
}
