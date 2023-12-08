"use server";

import Question from "@/database/question.model";
import Tag from "@/database/tag.model";
import { connectToDatabase } from "../mongoose";
import {
  CreateQuestionParams,
  DeleteQuestionParams,
  EditQuestionParams,
  GetQuestionByIdParams,
  GetQuestionsParams,
  QuestionVoteParams,
} from "./shared.types";
import User from "@/database/user.model";
import { revalidatePath } from "next/cache";
import Answer from "@/database/answer.model";
import Interaction from "@/database/interaction.model";
import { FilterQuery } from "mongoose";

// У нас Комбинируется Поиск и Фильтрация + Пагинация!!!!!
export async function getQuestions(params: GetQuestionsParams) {
  try {
    connectToDatabase();

    // параметры переданные из Home page
    const { searchQuery, filter, page = 1, pageSize = 10 } = params;

    // Рассчитать количество ПОСТОВ! для Пропуска на основе номера страницы и размера страницы.
    const skipAmount = (page - 1) * pageSize;

    const query: FilterQuery<typeof Question> = {};

    // QUERY ДЛЯ LocalSearchbar
    // поле title, либо поле content соответствуют строке, заданной переменной searchQuery
    if (searchQuery) {
      // $or - указывает, что искать документы, в которых выполняется хотя бы одно из условий, перечисленных в массиве.
      query.$or = [
        { title: { $regex: new RegExp(searchQuery, "i") } },
        { content: { $regex: new RegExp(searchQuery, "i") } },
      ];
    }

    // Обработка для поля .sort() из HomePageFilters
    let sortOptions = {};

    switch (filter) {
      case "newest":
        // устанавливается опция сортировки по полю createdAt в порядке убывания
        sortOptions = { createdAt: -1 };
        break;
      case "frequent":
        sortOptions = { views: -1 };
        break;
      case "unanswered":
        //  поле answers должно иметь размер равный 0,
        query.answers = { $size: 0 };
        break;
      default:
        break;
    }

    /* "populate", которая заполняет поле "tags" в каждом найденном вопросе. 
    Она связывает поле "tags" вопроса с коллекцией "Tag" 
    по определенным связям или связям модели, где "Tag" является моделью 
    для коллекции тегов.

    Потому что в Базе связи выполнены как id, а нам нужны данные 

    query наш подготовленный запрос к Базе
    */
    const questions = await Question.find(query)
      .populate({ path: "tags", model: Tag })
      .populate({ path: "author", model: User })
      // Пагинация!
      // Количество ПОСТОВ, которые нужно пропустить перед началом выборки.
      .skip(skipAmount)
      // Ограничивает количество документов, которые будут возвращены, в данном случае
      .limit(pageSize)
      // обработанные данные для сортировки
      .sort(sortOptions);

    // подсчитали общее количество Вопросов через mongoose countDocuments
    const totalQuestions = await Question.countDocuments(query);

    // пропс для UI кнопки (если Общее число Вопросов всё еще больше
    // того, что мы Сейчас отобразили пользователю)
    // questions.length - что показали на отдельной странице
    // skipAmount - сколько мы уже пропустили
    // 101 => (4 * 20) + 20 = 100 -->  101 = true  100 = false  4 по 20 уже пропустили
    const isNext = totalQuestions > skipAmount + questions.length;

    return { questions, isNext };
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
        { $setOnInsert: { name: tag }, $push: { questions: question._id } },
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

export async function deleteQuestion(params: DeleteQuestionParams) {
  try {
    connectToDatabase();

    const { questionId, path } = params;

    // Удалили сам Вопрос
    await Question.deleteOne({ _id: questionId });
    // Удалили всё Ответы связанные с этим вопросом
    await Answer.deleteMany({ question: questionId });
    // Удалили всё Взаимодействия (просмотры, голосования) связанные с этим вопросом
    await Interaction.deleteMany({ question: questionId });

    // Обновляет ВСЕ связанные Теги, удаляя ссылки на удаляемый вопрос.
    await Tag.updateMany(
      // выбираем ВСЕ Теги у которого в поле questions id нашего вопроса
      { questions: questionId },
      // удаляям ссылку на удаляемый вопрос из массива вопросов, связанных с тегом.
      { $pull: { questions: questionId } }
    );

    revalidatePath(path);
  } catch (error) {
    console.log(error);
  }
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

export async function editQuestion(params: EditQuestionParams) {
  try {
    connectToDatabase();

    const { questionId, title, content, path } = params;

    const question = await Question.findById(questionId).populate("tags");

    if (!question) {
      throw new Error("Question not found");
    }

    // Обновили поля в Модели
    question.title = title;
    question.content = content;

    // Сохраняем Модель
    await question.save();

    revalidatePath(path);
  } catch (error) {
    console.log(error);
  }
}

export async function getHotQuestions() {
  try {
    connectToDatabase();

    const hotQuestions = await Question.find({})
      .sort({ views: -1, upvotes: -1 })
      .limit(5);

    return hotQuestions;
  } catch (error) {
    console.log(error);
    throw error;
  }
}
