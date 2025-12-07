import { z, defineCollection } from "astro:content";
import { glob } from "astro/loaders";

// Shared schema parts
const helpSchema = z
  .object({
    link: z.string(),
    topic: z.string(),
  })
  .optional();

const hintsSchema = z
  .array(
    z.object({
      type: z.string(),
      name: z.string(),
    })
  )
  .optional();

// Base schema for standard exercises (grid, flexbox, subgrid)
const baseExerciseSchema = (image: Function) =>
  z.object({
    title: z.string(),
    id: z.string(),
    draft: z.boolean().optional(),
    boxes: z.number(),
    canAddBoxes: z.boolean(),
    isExtra: z.boolean(),
    video: z.string().optional(),
    image: image().optional(),
    isVideoThumb: z.boolean().optional(),
    customClass: z.string().optional(),
    help: helpSchema,
    startingCSS: z.string().optional(),
    startingHTML: z.string().optional(),
    hints: hintsSchema,
  });

// Helper to create standard exercise collection
const createExerciseCollection = (base: string) =>
  defineCollection({
    loader: glob({ pattern: "**/[^_]*.md", base }),
    schema: ({ image }) => baseExerciseSchema(image),
  });

const grid = createExerciseCollection("./src/exercises/grid");
const flexbox = createExerciseCollection("./src/exercises/flexbox");
const subgrid = createExerciseCollection("./src/exercises/subgrid");

// Defensive has extra hiddenCSS field
const defensive = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/exercises/defensive" }),
  schema: ({ image }) =>
    baseExerciseSchema(image).extend({
      hiddenCSS: z.string().optional(),
    }),
});

// SDA has different structure
const sda = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/exercises/sda" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      id: z.string(),
      draft: z.boolean().optional(),
      video: z.string().optional(),
      videoWidth: z.number().optional(),
      videoHeight: z.number().optional(),
      image: image().optional(),
      customClass: z.string().optional(),
      markers: z.boolean().optional(),
      help: helpSchema,
      startingCSS: z.string(),
      startingHTML: z.string().optional(),
      boxContent: z.string().optional(),
      hints: hintsSchema,
    }),
});

export const collections = {
  grid,
  flexbox,
  subgrid,
  defensive,
  sda,
};
