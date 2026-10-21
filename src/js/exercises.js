import { prefix } from './utils.js';
import { initExercises } from './exercise-controller.js';
initExercises('section[data-exercise-key]:not(.sda-exercise)', prefix);
