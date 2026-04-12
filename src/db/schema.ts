import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: text("id").primaryKey(), // Clerk User ID
  name: text("name"),
  email: text("email").notNull(),
  impulses: integer("impulses").default(17), // The internal currency
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creatives = pgTable("creative", {
  id: text("id").primaryKey(),
  userId: text("userId").references(() => users.id),
  prompt: text("prompt").notNull(), // The prompt used to generate
  imageUrl: text("imageUrl"), // Result image/thumbnail
  videoUrl: text("videoUrl"), // Result video (if applicable)
  format: text("format"), // Format of the asset (e.g. 9:16)
  cost: integer("cost").default(3), // How many impulses it cost (3 static, 4 animated)
  htmlCode: text("htmlCode"),
  feedbackScore: integer("feedback_score"), // 1 for Like, -1 for Dislike, null for unrated
  feedbackText: text("feedback_text"), // Text comment from user telling the AI what went wrong/right
  createdAt: timestamp("created_at").defaultNow(),
});
