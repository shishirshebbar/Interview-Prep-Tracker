import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().default(4000),
  APP_NAME: z.string().default("Learning Tracker"),
  TIMEZONE: z.string().default("Asia/Kolkata"),
  DEFAULT_WEEKDAY_START: z.string().default("22:15"),
  DEFAULT_WEEKDAY_STUDY_MINUTES: z.coerce.number().default(90),
  DEFAULT_WEEKEND_STUDY_MINUTES: z.coerce.number().default(480),
  DEFAULT_TARGET_ROLE: z.string().default("SDE-1"),
  DEFAULT_PREP_DEADLINE: z.string().default("2026-09-11"),
});

export const env = envSchema.parse(process.env);
