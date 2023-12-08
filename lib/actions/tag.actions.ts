"use server";

import User from "@/database/user.model";
import { connectToDatabase } from "../mongoose";
import {
  GetAllTagsParams,
  GetQuestionsByTagIdParams,
  GetTopInteractedTagsParams,
} from "./shared.types";
import Tag, { ITag } from "@/database/tag.model";
import Question from "@/database/question.model";
import { FilterQuery } from "mongoose";

export async function getTopInteractedTags(params: GetTopInteractedTagsParams) {
  try {
    connectToDatabase();

    const { userId } = params;

    const user = await User.findById(userId);

    if (!user) throw new Error("User not found");

    // Find interactions for the user and group by tags...
    // Interaction...

    return [
      { _id: "1", name: "tag" },
      { _id: "2", name: "tag2" },
    ];
  } catch (error) {
    console.log(error);
    throw error;
  }
}

// Поиск и Филтрация вместе!
export async function getAllTags(params: GetAllTagsParams) {
  try {
    connectToDatabase();

    const { searchQuery, filter } = params;

    const query: FilterQuery<typeof Tag> = {};

    if (searchQuery) {
      query.$or = [{ name: { $regex: new RegExp(searchQuery, "i") } }];
    }

    let sortOptions = {};

    switch (filter) {
      case "popular":
        sortOptions = { questions: -1 };
        break;
      case "recent":
        sortOptions = { createdAt: -1 };
        break;
      case "name":
        sortOptions = { name: 1 };
        break;
      case "old":
        sortOptions = { createdAt: 1 };
        break;

      default:
        break;
    }

    const tags = await Tag.find(query).sort(sortOptions);

    return { tags };
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getQuestionsByTagId(params: GetQuestionsByTagIdParams) {
  try {
    connectToDatabase();

    const { tagId, page = 1, pageSize = 10, searchQuery } = params;

    // Создание фильтра для поиска определенного тега по его _id
    // Фильтр где _id равен tagId.
    const tagFilter: FilterQuery<ITag> = { _id: tagId };

    // Этот фильтр будет использоваться для поиска тега в коллекции.
    // заполняются вопросы, связанные с этим тегом, на основе определенных критериев
    const tag = await Tag.findOne(tagFilter).populate({
      // чем розширяем
      path: "questions",
      model: Question,
      /* Если задан (searchQuery), используется regex для сравнения по полю title 
      вопросов с поисковым запросом. Если searchQuery не задан, 
      фильтрация не применяется, и выбираются все вопросы тега. */
      match: searchQuery
        ? { title: { $regex: searchQuery, $options: "i" } }
        : {},
      options: {
        sort: { createdAt: -1 },
      },
      // заполнение (populate) связанных данных. В данном случае, заполняются теги и авторы, связанные с каждым вопросом.
      populate: [
        { path: "tags", model: Tag, select: "_id name" },
        { path: "author", model: User, select: "_id clerkId name picture" },
      ],
    });

    if (!tag) {
      throw new Error("Tag not found");
    }

    console.log(tag);

    const questions = tag.questions;
    //  После выполнения запроса, функция возвращает
    // название тега (tag.name) и связанные с ним вопросы
    return { tagTitle: tag.name, questions };
    //
  } catch (error) {
    console.log(error);
    throw error;
  }
}

// Берем 5 Тегов у которых самое большое количество Вопросов
export async function getTopPopularTags() {
  try {
    connectToDatabase();

    // aggregate метод позволяет выполнять преобразования в нужный нам вид.
    const popularTags = await Tag.aggregate([
      // Оператор $project позволяет выбирать только определенные поля для вывода.
      // добавили новую переменную tag.numberOfQuestions - будет содержать
      // количество элементов в массиве questions для каждого тега.
      // поле questions в Моделе!
      { $project: { name: 1, numberOfQuestions: { $size: "$questions" } } },
      { $sort: { numberOfQuestions: -1 } },
      { $limit: 5 },
    ]);

    return popularTags;
  } catch (error) {
    console.log(error);
    throw error;
  }
}
