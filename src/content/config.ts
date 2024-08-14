import { z, defineCollection } from "astro:content";

const exerciseCollection = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      id: z.string(),
      boxes: z.number(),
      canAddBoxes: z.boolean(),
      isExtra: z.boolean(),
      video: z.string().optional(),
      image: image().optional(),
      isVideoThumb: z.boolean().optional(),
      customClass: z.string().optional(),
      help: z
        .object({
          link: z.string(),
          topic: z.string(),
        })
        .optional(),
      startingCSS: z.string().optional(),
      startingHTML: z.string().optional(),
      hints: z
        .array(
          z.object({
            type: z.string(),
            name: z.string(),
          })
        )
        .optional(),
    }),
});

export const collections = {
  grid: exerciseCollection,
  flexbox: exerciseCollection,
  subgrid: exerciseCollection,
  defensive: exerciseCollection,
};

// title: Simpelt grid
// id: grid-1
// image { path: ./img/grid-ex-1.png, width: 1046, height: 254, type: "img" }
// boxes: 9
// canAddBoxes: false
// isExtra: false
// isVideoThumb: false
// customClass: ""
// help:
//   {
//     link: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout/Basic_Concepts_of_Grid_Layout#the_fr_unit,
//     topic: fr unit,
//   }
// startingCSS: |
//   .container {
//     display: ;
//     grid-template-columns: ;
//   }
// hints:
//   - { type: property, name: display }
//   - { type: property, name: grid-template-columns }
//   - { type: property, name: gap }
//   - { type: value, name: grid }
//   - { type: value, name: "1fr" }
