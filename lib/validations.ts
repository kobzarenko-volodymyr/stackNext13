import * as z from "zod";

export const QuestionsSchema = z.object({
  title: z.string().min(5).max(130),
  explanation: z.string().min(100),
  // array of strings with min 1 tag - max 3 tags  .min(1).max(3)
  // and each tag contains 1-15 character          .min(1).max(15)
  tags: z.array(z.string().min(1).max(15)).min(1).max(3),
});

export const AnswerSchema = z.object({
  answer: z.string().min(100),
});
