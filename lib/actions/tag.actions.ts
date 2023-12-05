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

export async function getAllTags(params: GetAllTagsParams) {
  try {
    connectToDatabase();

    const tags = await Tag.find({});

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
