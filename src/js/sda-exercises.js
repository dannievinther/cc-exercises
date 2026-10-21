import { sdaPrefix } from './sda-prefix.js';
import { initExercises } from './exercise-controller.js';
initExercises('section.sda-exercise[data-exercise-key]', sdaPrefix, true);
